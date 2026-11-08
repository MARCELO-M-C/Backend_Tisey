import {
  OrderChannel,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ServiceMode,
  StayStatus,
} from "../../generated/prisma/client";
import type { AuthTokenPayload } from "../auth/mapper";
import {
  isAdminRequestUser,
  requestUserHasPermission,
  requestUserHasRole,
} from "../auth/service";
import { toOrderResponse, type OrderResponseDto } from "./mapper";
import * as ordersRepository from "./repository";
import type {
  AddOrderItemsBodyInput,
  CancelOrderBodyInput,
  CreateOrderBodyInput,
  CreateOrderItemInput,
  ListOrdersQueryInput,
  UpdateOrderBodyInput,
  UpdateOrderItemStatusBodyInput,
} from "./schemas";

const ORDERS_MANAGE_PERMISSION = "ADMIN_ORDERS_MANAGE";
const KITCHEN_MANAGE_PERMISSION = "ADMIN_KITCHEN_MANAGE";

export class OrdersServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OrdersServiceError";
  }
}

function parseUserId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new OrdersServiceError(
      400,
      "INVALID_USER_ID",
      "Id de usuario inválido.",
    );
  }
}

function dedupeBigIntArray(values: bigint[]): bigint[] {
  return Array.from(
    new Map(values.map((value) => [value.toString(), value])).values(),
  );
}

function actorCanManageOrders(actor: AuthTokenPayload): boolean {
  return (
    isAdminRequestUser(actor) ||
    requestUserHasPermission(actor, ORDERS_MANAGE_PERMISSION)
  );
}

function actorIsOperationalWaiter(actor: AuthTokenPayload): boolean {
  return requestUserHasRole(actor, "MESERO") && !actorCanManageOrders(actor);
}

function actorCanUseKitchenTransitions(actor: AuthTokenPayload): boolean {
  return (
    requestUserHasRole(actor, "COCINA") ||
    requestUserHasPermission(actor, KITCHEN_MANAGE_PERMISSION)
  );
}

function assertWaiterOwnsOrder(
  actor: AuthTokenPayload,
  order: Awaited<ReturnType<typeof ensureOrderExists>>,
): void {
  if (!actorIsOperationalWaiter(actor)) return;

  const actorId = parseUserId(actor.sub);
  const isOwner = order.waiterId === actorId || order.createdBy === actorId;

  if (!isOwner) {
    throw new OrdersServiceError(
      403,
      "ORDER_ACCESS_FORBIDDEN",
      "No puedes administrar una orden asignada a otro mesero.",
    );
  }
}

async function ensureUserExists(userId: bigint) {
  const user = await ordersRepository.findUserById(userId);

  if (!user) {
    throw new OrdersServiceError(
      404,
      "USER_NOT_FOUND",
      "Usuario no encontrado.",
    );
  }

  if (!user.isActive) {
    throw new OrdersServiceError(
      403,
      "USER_INACTIVE",
      "El usuario está inactivo.",
    );
  }

  return user;
}

async function ensureOrderExists(orderId: bigint) {
  const order = await ordersRepository.findOrderById(orderId);

  if (!order) {
    throw new OrdersServiceError(
      404,
      "ORDER_NOT_FOUND",
      "Orden no encontrada.",
    );
  }

  return order;
}

async function generateNextOrderCode(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `ORD-${yyyy}${mm}${dd}`;

  const latestCode = await ordersRepository.findLatestOrderCode(prefix);

  if (!latestCode) {
    return `${prefix}-0001`;
  }

  const rawSequence = latestCode.split("-").at(-1);
  const numericSequence = rawSequence ? Number.parseInt(rawSequence, 10) : 0;
  const nextSequence = Number.isNaN(numericSequence) ? 1 : numericSequence + 1;

  return `${prefix}-${String(nextSequence).padStart(4, "0")}`;
}

async function validateOrderContext(input: {
  channel: OrderChannel;
  serviceMode: ServiceMode;
  tableId?: bigint | null;
  stayId?: bigint | null;
  waiterId?: bigint | null;
  shiftId?: bigint | null;
}) {
  if (input.channel === OrderChannel.DINE_IN) {
    if (!input.tableId) {
      throw new OrdersServiceError(
        400,
        "TABLE_REQUIRED",
        "Una orden DINE_IN requiere una mesa.",
      );
    }

    if (input.stayId) {
      throw new OrdersServiceError(
        400,
        "STAY_NOT_ALLOWED",
        "Una orden DINE_IN no puede asociarse a una estadía.",
      );
    }

    if (input.serviceMode !== ServiceMode.EAT_HERE) {
      throw new OrdersServiceError(
        400,
        "INVALID_SERVICE_MODE",
        "DINE_IN debe usar serviceMode EAT_HERE.",
      );
    }
  }

  if (input.channel === OrderChannel.TAKE_AWAY) {
    if (input.tableId || input.stayId) {
      throw new OrdersServiceError(
        400,
        "INVALID_CONTEXT",
        "TAKE_AWAY no puede asociarse a mesa ni a estadía.",
      );
    }

    if (input.serviceMode !== ServiceMode.TO_GO) {
      throw new OrdersServiceError(
        400,
        "INVALID_SERVICE_MODE",
        "TAKE_AWAY debe usar serviceMode TO_GO.",
      );
    }
  }

  if (input.channel === OrderChannel.ROOM_CHARGE) {
    if (!input.stayId) {
      throw new OrdersServiceError(
        400,
        "STAY_REQUIRED",
        "ROOM_CHARGE requiere una estadía.",
      );
    }

    if (input.tableId) {
      throw new OrdersServiceError(
        400,
        "TABLE_NOT_ALLOWED",
        "ROOM_CHARGE no puede asociarse a una mesa.",
      );
    }
  }

  if (input.tableId) {
    const table = await ordersRepository.findTableById(input.tableId);

    if (!table) {
      throw new OrdersServiceError(
        400,
        "TABLE_NOT_FOUND",
        "Mesa no encontrada.",
      );
    }

    if (!table.isActive) {
      throw new OrdersServiceError(
        400,
        "TABLE_INACTIVE",
        "La mesa indicada está inactiva.",
      );
    }
  }

  if (input.stayId) {
    const stay = await ordersRepository.findStayById(input.stayId);

    if (!stay) {
      throw new OrdersServiceError(
        400,
        "STAY_NOT_FOUND",
        "Estadía no encontrada.",
      );
    }

    if (
      input.channel === OrderChannel.ROOM_CHARGE &&
      stay.status !== StayStatus.CHECKED_IN
    ) {
      throw new OrdersServiceError(
        400,
        "INVALID_STAY_STATUS",
        "Solo se puede cargar a habitación una estadía CHECKED_IN.",
      );
    }
  }

  if (input.waiterId) {
    const waiter = await ordersRepository.findUserById(input.waiterId);

    if (!waiter) {
      throw new OrdersServiceError(
        400,
        "WAITER_NOT_FOUND",
        "Mesero no encontrado.",
      );
    }

    if (!waiter.isActive) {
      throw new OrdersServiceError(
        400,
        "WAITER_INACTIVE",
        "El mesero indicado está inactivo.",
      );
    }
  }

  if (input.shiftId) {
    const shift = await ordersRepository.findShiftById(input.shiftId);

    if (!shift) {
      throw new OrdersServiceError(
        400,
        "SHIFT_NOT_FOUND",
        "Turno no encontrado.",
      );
    }

    if (shift.endedAt) {
      throw new OrdersServiceError(
        400,
        "SHIFT_CLOSED",
        "No se puede asociar una orden a un turno cerrado.",
      );
    }

    if (input.waiterId && shift.userId !== input.waiterId) {
      throw new OrdersServiceError(
        400,
        "SHIFT_WAITER_MISMATCH",
        "El turno no pertenece al mesero indicado.",
      );
    }
  }
}

async function resolveMenuItemSnapshots(
  items: CreateOrderItemInput[],
): Promise<ordersRepository.CreateOrderItemSnapshotInput[]> {
  const uniqueMenuItemIds = dedupeBigIntArray(
    items.map((item) => item.menuItemId),
  );
  const menuItems = await ordersRepository.findMenuItemsByIds(uniqueMenuItemIds);

  if (menuItems.length !== uniqueMenuItemIds.length) {
    const foundIds = new Set(menuItems.map((item) => item.id.toString()));
    const missingIds = uniqueMenuItemIds
      .map((value) => value.toString())
      .filter((value) => !foundIds.has(value));

    throw new OrdersServiceError(
      400,
      "MENU_ITEM_NOT_FOUND",
      `Menu items no encontrados: ${missingIds.join(", ")}.`,
    );
  }

  const menuItemMap = new Map(
    menuItems.map((item) => [item.id.toString(), item]),
  );

  return items.map((item) => {
    const menuItem = menuItemMap.get(item.menuItemId.toString());

    if (!menuItem) {
      throw new OrdersServiceError(
        400,
        "MENU_ITEM_NOT_FOUND",
        `Menu item ${item.menuItemId.toString()} no encontrado.`,
      );
    }

    if (!menuItem.isActive) {
      throw new OrdersServiceError(
        400,
        "MENU_ITEM_INACTIVE",
        `El menu item ${menuItem.name} está inactivo.`,
      );
    }

    return {
      menuItemId: item.menuItemId,
      itemName: menuItem.name,
      stationId: menuItem.stationId,
      unitPrice: new Prisma.Decimal(menuItem.basePrice),
      quantity: item.quantity,
      itemNotes: item.itemNotes?.trim() || undefined,
    };
  });
}

function deriveOrderStatusFromItems(
  order: Awaited<ReturnType<typeof ensureOrderExists>>,
  targetItemId: bigint,
  nextItemStatus: OrderItemStatus,
): OrderStatus {
  const statuses = order.items.map((item) =>
    item.id === targetItemId ? nextItemStatus : item.itemStatus,
  );

  const activeStatuses = statuses.filter(
    (status) => status !== OrderItemStatus.CANCELLED,
  );

  if (activeStatuses.length === 0) {
    return OrderStatus.CANCELLED;
  }

  if (activeStatuses.every((status) => status === OrderItemStatus.DELIVERED)) {
    return OrderStatus.DELIVERED;
  }

  if (
    activeStatuses.every(
      (status) =>
        status === OrderItemStatus.READY ||
        status === OrderItemStatus.DELIVERED,
    )
  ) {
    return OrderStatus.READY;
  }

  if (
    activeStatuses.some(
      (status) =>
        status === OrderItemStatus.IN_PROGRESS ||
        status === OrderItemStatus.READY ||
        status === OrderItemStatus.DELIVERED,
    )
  ) {
    return OrderStatus.IN_PROGRESS;
  }

  return OrderStatus.SENT;
}

function assertItemStatusTransition(
  currentStatus: OrderItemStatus,
  nextStatus: OrderItemStatus,
) {
  const allowedTransitions: Record<OrderItemStatus, OrderItemStatus[]> = {
    [OrderItemStatus.PENDING]: [
      OrderItemStatus.IN_PROGRESS,
      OrderItemStatus.CANCELLED,
    ],
    [OrderItemStatus.IN_PROGRESS]: [
      OrderItemStatus.READY,
      OrderItemStatus.CANCELLED,
    ],
    [OrderItemStatus.READY]: [
      OrderItemStatus.DELIVERED,
      OrderItemStatus.CANCELLED,
    ],
    [OrderItemStatus.DELIVERED]: [],
    [OrderItemStatus.CANCELLED]: [],
  };

  if (currentStatus === nextStatus) {
    throw new OrdersServiceError(
      400,
      "ITEM_STATUS_UNCHANGED",
      "El ítem ya tiene ese estado.",
    );
  }

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new OrdersServiceError(
      400,
      "INVALID_ITEM_STATUS_TRANSITION",
      `No se puede cambiar un ítem de ${currentStatus} a ${nextStatus}.`,
    );
  }
}

function assertItemStatusTransitionForActor(
  actor: AuthTokenPayload,
  currentStatus: OrderItemStatus,
  nextStatus: OrderItemStatus,
): void {
  if (actorCanManageOrders(actor)) {
    assertItemStatusTransition(currentStatus, nextStatus);
    return;
  }

  if (actorCanUseKitchenTransitions(actor)) {
    const kitchenTransitionIsAllowed =
      (currentStatus === OrderItemStatus.PENDING &&
        nextStatus === OrderItemStatus.IN_PROGRESS) ||
      (currentStatus === OrderItemStatus.IN_PROGRESS &&
        nextStatus === OrderItemStatus.READY);

    if (!kitchenTransitionIsAllowed) {
      throw new OrdersServiceError(
        403,
        "KITCHEN_ITEM_TRANSITION_FORBIDDEN",
        "Cocina solo puede iniciar la preparación o marcar un ítem como listo.",
      );
    }

    return;
  }

  if (actorIsOperationalWaiter(actor)) {
    if (
      currentStatus !== OrderItemStatus.READY ||
      nextStatus !== OrderItemStatus.DELIVERED
    ) {
      throw new OrdersServiceError(
        403,
        "WAITER_ITEM_TRANSITION_FORBIDDEN",
        "El mesero solo puede marcar como entregado un ítem que ya está listo.",
      );
    }

    return;
  }

  throw new OrdersServiceError(
    403,
    "ORDER_ITEM_STATUS_FORBIDDEN",
    "No tienes autorización para cambiar el estado de este ítem.",
  );
}

export async function listOrders(
  filters: ListOrdersQueryInput,
  actor: AuthTokenPayload,
): Promise<OrderResponseDto[]> {
  if (actorIsOperationalWaiter(actor)) {
    const actorId = parseUserId(actor.sub);

    if (filters.waiterId && filters.waiterId !== actorId) {
      throw new OrdersServiceError(
        403,
        "ORDER_ACCESS_FORBIDDEN",
        "No puedes consultar órdenes asignadas a otro mesero.",
      );
    }

    if (filters.createdBy && filters.createdBy !== actorId) {
      throw new OrdersServiceError(
        403,
        "ORDER_ACCESS_FORBIDDEN",
        "No puedes consultar órdenes creadas por otro usuario.",
      );
    }

    const orders = await ordersRepository.listOrders({
      ...filters,
      waiterId: actorId,
    });

    return orders.map(toOrderResponse);
  }

  const orders = await ordersRepository.listOrders(filters);
  return orders.map(toOrderResponse);
}

export async function getOrderById(
  orderId: bigint,
  actor: AuthTokenPayload,
): Promise<OrderResponseDto> {
  const order = await ensureOrderExists(orderId);
  assertWaiterOwnsOrder(actor, order);

  return toOrderResponse(order);
}

export async function createOrder(
  input: CreateOrderBodyInput,
  actor: AuthTokenPayload,
): Promise<OrderResponseDto> {
  const actorId = parseUserId(actor.sub);
  await ensureUserExists(actorId);

  let resolvedWaiterId = input.waiterId ?? null;

  if (actorIsOperationalWaiter(actor)) {
    if (input.waiterId && input.waiterId !== actorId) {
      throw new OrdersServiceError(
        403,
        "WAITER_ASSIGNMENT_FORBIDDEN",
        "Un mesero solo puede crear órdenes asignadas a sí mismo.",
      );
    }

    resolvedWaiterId = actorId;
  }

  await validateOrderContext({
    channel: input.channel,
    serviceMode: input.serviceMode,
    tableId: input.tableId,
    stayId: input.stayId,
    waiterId: resolvedWaiterId,
    shiftId: input.shiftId,
  });

  const orderCode = await generateNextOrderCode();
  const items = await resolveMenuItemSnapshots(input.items);

  const order = await ordersRepository.createOrder({
    orderCode,
    customerName: input.customerName?.trim() || null,
    channel: input.channel,
    serviceMode: input.serviceMode,
    tableId: input.tableId ?? null,
    stayId: input.stayId ?? null,
    createdBy: actorId,
    waiterId: resolvedWaiterId,
    shiftId: input.shiftId ?? null,
    notes: input.notes?.trim() || null,
    items,
    performedBy: actorId,
  });

  return toOrderResponse(order);
}

export async function updateOrder(
  orderId: bigint,
  input: UpdateOrderBodyInput,
  actor: AuthTokenPayload,
): Promise<OrderResponseDto> {
  const actorId = parseUserId(actor.sub);
  await ensureUserExists(actorId);

  const currentOrder = await ensureOrderExists(orderId);
  assertWaiterOwnsOrder(actor, currentOrder);

  if (currentOrder.status !== OrderStatus.DRAFT) {
    throw new OrdersServiceError(
      409,
      "ORDER_NOT_DRAFT",
      "Solo se puede editar la cabecera de una orden en estado DRAFT.",
    );
  }

  const nextChannel = input.channel ?? currentOrder.channel;
  const nextServiceMode = input.serviceMode ?? currentOrder.serviceMode;
  const nextTableId = Object.prototype.hasOwnProperty.call(input, "tableId")
    ? (input.tableId ?? null)
    : (currentOrder.tableId ?? null);
  const nextStayId = Object.prototype.hasOwnProperty.call(input, "stayId")
    ? (input.stayId ?? null)
    : (currentOrder.stayId ?? null);

  let nextWaiterId = Object.prototype.hasOwnProperty.call(input, "waiterId")
    ? (input.waiterId ?? null)
    : (currentOrder.waiterId ?? null);

  if (actorIsOperationalWaiter(actor)) {
    if (
      Object.prototype.hasOwnProperty.call(input, "waiterId") &&
      input.waiterId !== actorId
    ) {
      throw new OrdersServiceError(
        403,
        "WAITER_ASSIGNMENT_FORBIDDEN",
        "No puedes reasignar tu orden a otro usuario.",
      );
    }

    nextWaiterId = actorId;
  }

  const nextShiftId = Object.prototype.hasOwnProperty.call(input, "shiftId")
    ? (input.shiftId ?? null)
    : (currentOrder.shiftId ?? null);

  await validateOrderContext({
    channel: nextChannel,
    serviceMode: nextServiceMode,
    tableId: nextTableId,
    stayId: nextStayId,
    waiterId: nextWaiterId,
    shiftId: nextShiftId,
  });

  const updatedOrder = await ordersRepository.updateOrderHeader(
    orderId,
    {
      ...(Object.prototype.hasOwnProperty.call(input, "customerName")
        ? { customerName: input.customerName?.trim() || null }
        : {}),
      ...(input.channel ? { channel: input.channel } : {}),
      ...(input.serviceMode ? { serviceMode: input.serviceMode } : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "tableId")
        ? { tableId: input.tableId ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "stayId")
        ? { stayId: input.stayId ?? null }
        : {}),
      ...(actorIsOperationalWaiter(actor)
        ? { waiterId: actorId }
        : Object.prototype.hasOwnProperty.call(input, "waiterId")
          ? { waiterId: input.waiterId ?? null }
          : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "shiftId")
        ? { shiftId: input.shiftId ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "notes")
        ? { notes: input.notes?.trim() ?? null }
        : {}),
    },
    actorId,
  );

  return toOrderResponse(updatedOrder);
}

export async function addItemsToOrder(
  orderId: bigint,
  input: AddOrderItemsBodyInput,
  actor: AuthTokenPayload,
): Promise<OrderResponseDto> {
  const actorId = parseUserId(actor.sub);
  await ensureUserExists(actorId);

  const order = await ensureOrderExists(orderId);
  assertWaiterOwnsOrder(actor, order);

  if (order.status !== OrderStatus.DRAFT) {
    throw new OrdersServiceError(
      409,
      "ORDER_NOT_DRAFT",
      "Solo se pueden agregar ítems mientras la orden esté en DRAFT.",
    );
  }

  const items = await resolveMenuItemSnapshots(input.items);
  const updatedOrder = await ordersRepository.addItemsToOrder(
    orderId,
    items,
    actorId,
  );

  return toOrderResponse(updatedOrder);
}

export async function sendOrder(
  orderId: bigint,
  actor: AuthTokenPayload,
): Promise<OrderResponseDto> {
  const actorId = parseUserId(actor.sub);
  await ensureUserExists(actorId);

  const order = await ensureOrderExists(orderId);
  assertWaiterOwnsOrder(actor, order);

  if (order.status !== OrderStatus.DRAFT) {
    throw new OrdersServiceError(
      409,
      "ORDER_NOT_DRAFT",
      "Solo se puede enviar una orden en estado DRAFT.",
    );
  }

  const activeItems = order.items.filter(
    (item) => item.itemStatus !== OrderItemStatus.CANCELLED,
  );

  if (activeItems.length === 0) {
    throw new OrdersServiceError(
      400,
      "ORDER_WITHOUT_ACTIVE_ITEMS",
      "No se puede enviar una orden sin ítems activos.",
    );
  }

  const sentOrder = await ordersRepository.sendOrder(orderId, actorId);
  return toOrderResponse(sentOrder);
}

export async function cancelOrder(
  orderId: bigint,
  input: CancelOrderBodyInput,
  actor: AuthTokenPayload,
): Promise<OrderResponseDto> {
  const actorId = parseUserId(actor.sub);
  await ensureUserExists(actorId);

  const order = await ensureOrderExists(orderId);
  assertWaiterOwnsOrder(actor, order);

  if (order.status === OrderStatus.CANCELLED) {
    throw new OrdersServiceError(
      409,
      "ORDER_ALREADY_CANCELLED",
      "La orden ya está cancelada.",
    );
  }

  if (order.status === OrderStatus.CLOSED) {
    throw new OrdersServiceError(
      409,
      "ORDER_ALREADY_CLOSED",
      "No se puede cancelar una orden cerrada.",
    );
  }

  const cancelledOrder = await ordersRepository.cancelOrder(
    orderId,
    input.reason.trim(),
    actorId,
  );

  return toOrderResponse(cancelledOrder);
}

export async function updateOrderItemStatus(
  orderId: bigint,
  itemId: bigint,
  input: UpdateOrderItemStatusBodyInput,
  actor: AuthTokenPayload,
): Promise<OrderResponseDto> {
  const actorId = parseUserId(actor.sub);
  await ensureUserExists(actorId);

  const order = await ensureOrderExists(orderId);

  if (actorIsOperationalWaiter(actor)) {
    assertWaiterOwnsOrder(actor, order);
  }

  if (order.status === OrderStatus.DRAFT) {
    throw new OrdersServiceError(
      409,
      "ORDER_NOT_SENT",
      "Primero debes enviar la orden antes de mover estados de cocina.",
    );
  }

  if (
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.CLOSED
  ) {
    throw new OrdersServiceError(
      409,
      "ORDER_NOT_EDITABLE",
      "No se puede cambiar el estado de ítems de una orden cerrada o cancelada.",
    );
  }

  const item = order.items.find((currentItem) => currentItem.id === itemId);

  if (!item) {
    throw new OrdersServiceError(
      404,
      "ORDER_ITEM_NOT_FOUND",
      "Ítem de orden no encontrado.",
    );
  }

  assertItemStatusTransitionForActor(actor, item.itemStatus, input.status);

  const nextOrderStatus = deriveOrderStatusFromItems(
    order,
    itemId,
    input.status,
  );

  const updatedOrder = await ordersRepository.updateOrderItemStatus({
    orderId,
    itemId,
    previousItemStatus: item.itemStatus,
    nextItemStatus: input.status,
    previousOrderStatus: order.status,
    nextOrderStatus,
    actorUserId: actorId,
  });

  return toOrderResponse(updatedOrder);
}
