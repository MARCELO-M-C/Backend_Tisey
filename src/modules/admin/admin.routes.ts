import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../../lib/prisma";
import { normalizeBigIntFields, parseBigIntLike, toApiValue } from "../../lib/serialization";
import { ROLE_GROUPS, authenticate, requireAnyRole } from "../auth/auth.guards";

type EntityConfig = {
  path: string;
  delegate: string;
  idField: string;
  bigintFields: readonly string[];
  blockedCreateFields?: readonly string[];
  blockedUpdateFields?: readonly string[];
  transformCreate?: (
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  transformUpdate?: (
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
};

const ADMIN_GUARDS = [authenticate, requireAnyRole([...ROLE_GROUPS.ADMIN])];

const SINGLE_KEY_ENTITIES: EntityConfig[] = [
  {
    path: "users",
    delegate: "user",
    idField: "id",
    bigintFields: [],
    blockedCreateFields: ["id", "createdAt"],
    blockedUpdateFields: ["id", "createdAt", "passwordHash"],
    transformCreate: async (payload) => {
      const mutablePayload = { ...payload };
      const password = mutablePayload.password;
      const passwordHash = mutablePayload.passwordHash;

      if (!password && !passwordHash) {
        throw new Error("Debes enviar password o passwordHash para crear usuario.");
      }

      if (password) {
        if (typeof password !== "string" || password.length < 8) {
          throw new Error("password debe tener al menos 8 caracteres.");
        }

        mutablePayload.passwordHash = await bcrypt.hash(password, 12);
      }

      delete mutablePayload.password;

      return mutablePayload;
    },
    transformUpdate: async (payload) => {
      const mutablePayload = { ...payload };
      const password = mutablePayload.password;

      if (password !== undefined) {
        if (typeof password !== "string" || password.length < 8) {
          throw new Error("password debe tener al menos 8 caracteres.");
        }

        mutablePayload.passwordHash = await bcrypt.hash(password, 12);
      }

      delete mutablePayload.password;

      return mutablePayload;
    },
  },
  {
    path: "roles",
    delegate: "role",
    idField: "id",
    bigintFields: [],
    blockedCreateFields: ["id"],
    blockedUpdateFields: ["id"],
  },
  {
    path: "permissions",
    delegate: "permission",
    idField: "id",
    bigintFields: [],
    blockedCreateFields: ["id"],
    blockedUpdateFields: ["id"],
  },
  {
    path: "stations",
    delegate: "station",
    idField: "id",
    bigintFields: [],
    blockedCreateFields: ["id"],
    blockedUpdateFields: ["id"],
  },
  {
    path: "menu-categories",
    delegate: "menuCategory",
    idField: "id",
    bigintFields: [],
    blockedCreateFields: ["id"],
    blockedUpdateFields: ["id"],
  },
  {
    path: "menu-items",
    delegate: "menuItem",
    idField: "id",
    bigintFields: ["categoryId", "stationId"],
    blockedCreateFields: ["id", "createdAt", "updatedAt"],
    blockedUpdateFields: ["id", "createdAt"],
  },
  {
    path: "restaurant-tables",
    delegate: "restaurantTable",
    idField: "id",
    bigintFields: [],
    blockedCreateFields: ["id"],
    blockedUpdateFields: ["id"],
  },
  {
    path: "shifts",
    delegate: "shift",
    idField: "id",
    bigintFields: ["userId"],
    blockedCreateFields: ["id"],
    blockedUpdateFields: ["id"],
  },
  {
    path: "cabins",
    delegate: "cabin",
    idField: "id",
    bigintFields: [],
    blockedCreateFields: ["id"],
    blockedUpdateFields: ["id"],
  },
  {
    path: "guests",
    delegate: "guest",
    idField: "id",
    bigintFields: [],
    blockedCreateFields: ["id", "createdAt"],
    blockedUpdateFields: ["id", "createdAt"],
  },  
  {
    path: "stays",
    delegate: "stay",
    idField: "id",
    bigintFields: ["cabinId", "primaryGuestId", "createdBy"],
    blockedCreateFields: ["id", "createdAt"],
    blockedUpdateFields: ["id", "createdAt"],
  },
  {
    path: "orders",
    delegate: "order",
    idField: "id",
    bigintFields: ["tableId", "stayId", "createdBy", "waiterId", "shiftId"],
    blockedCreateFields: ["id", "createdAt"],
    blockedUpdateFields: ["id", "createdAt"],
  },
  {
    path: "order-items",
    delegate: "orderItem",
    idField: "id",
    bigintFields: ["orderId", "menuItemId", "stationId", "preparedBy", "deliveredBy"],
    blockedCreateFields: ["id", "createdAt"],
    blockedUpdateFields: ["id", "createdAt"],
  },
  {
    path: "order-events",
    delegate: "orderEvent",
    idField: "id",
    bigintFields: ["orderId", "performedBy"],
    blockedCreateFields: ["id", "performedAt"],
    blockedUpdateFields: ["id", "performedAt"],
  },
  {
    path: "invoices",
    delegate: "invoice",
    idField: "id",
    bigintFields: ["issuedBy", "orderId", "stayId", "printedBy"],
    blockedCreateFields: ["id", "issuedAt", "printCount"],
    blockedUpdateFields: ["id", "issuedAt"],
  },
  {
    path: "invoice-lines",
    delegate: "invoiceLine",
    idField: "id",
    bigintFields: ["invoiceId", "orderItemId"],
    blockedCreateFields: ["id", "createdAt"],
    blockedUpdateFields: ["id", "createdAt"],
  },
  {
    path: "payments",
    delegate: "payment",
    idField: "id",
    bigintFields: ["invoiceId", "receivedBy"],
    blockedCreateFields: ["id", "paidAt"],
    blockedUpdateFields: ["id", "paidAt"],
  },
];

const ENTITY_MAP = new Map(SINGLE_KEY_ENTITIES.map((entity) => [entity.path, entity]));

function sanitizePayload(
  payload: Record<string, unknown>,
  blockedFields: readonly string[] = [],
): Record<string, unknown> {
  const sanitizedPayload = { ...payload };

  for (const fieldName of blockedFields) {
    delete sanitizedPayload[fieldName];
  }

  return sanitizedPayload;
}

function parsePageQuery(value: unknown, fallback: number, max: number): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const asNumber = Number(value);
  if (!Number.isInteger(asNumber) || asNumber < 0) {
    throw new Error("skip/take deben ser enteros no negativos.");
  }

  return Math.min(asNumber, max);
}

function getDelegate(delegateName: string): Prisma.TypeMap["meta"]["modelProps"] | any {
  return (prisma as unknown as Record<string, unknown>)[delegateName];
}

function extractPayload(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Body invalido. Debe ser un objeto JSON.");
  }

  return body as Record<string, unknown>;
}

function parseEntityId(idRaw: string): bigint {
  const parsed = parseBigIntLike(idRaw, "id");
  if (parsed === null) {
    throw new Error("id es obligatorio.");
  }

  return parsed;
}

function parseCompositeIds(params: Record<string, string>, fields: readonly string[]) {
  const result: Record<string, bigint> = {};
  for (const fieldName of fields) {
    const parsedValue = parseBigIntLike(params[fieldName], fieldName);
    if (parsedValue === null) {
      throw new Error(`${fieldName} es obligatorio.`);
    }

    result[fieldName] = parsedValue;
  }

  return result;
}

function isPrismaNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function isPrismaConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2003")
  );
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/:entity",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Listar registros de una tabla",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { entity } = request.params as { entity: string };
      const config = ENTITY_MAP.get(entity);

      if (!config) {
        return reply.notFound("Entidad no soportada.");
      }

      const delegate = getDelegate(config.delegate);
      if (!delegate) {
        return reply.notFound("Delegate no encontrado.");
      }

      let skip = 0;
      let take = 100;
      try {
        const query = request.query as Record<string, unknown>;
        skip = parsePageQuery(query.skip, 0, 5000);
        take = parsePageQuery(query.take, 100, 500);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      const records = await delegate.findMany({
        skip,
        take,
        orderBy: {
          [config.idField]: "desc",
        },
      });

      return {
        entity,
        count: records.length,
        data: toApiValue(records),
      };
    },
  );

  app.get(
    "/:entity/:id",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Obtener registro por id",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { entity, id: rawId } = request.params as { entity: string; id: string };
      const config = ENTITY_MAP.get(entity);
      if (!config) {
        return reply.notFound("Entidad no soportada.");
      }

      const delegate = getDelegate(config.delegate);
      if (!delegate) {
        return reply.notFound("Delegate no encontrado.");
      }

      let id: bigint;
      try {
        id = parseEntityId(rawId);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      const record = await delegate.findUnique({
        where: {
          [config.idField]: id,
        },
      });

      if (!record) {
        return reply.notFound("Registro no encontrado.");
      }

      return toApiValue(record);
    },
  );

  app.post(
    "/:entity",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Crear registro",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { entity } = request.params as { entity: string };
      const config = ENTITY_MAP.get(entity);
      if (!config) {
        return reply.notFound("Entidad no soportada.");
      }

      const delegate = getDelegate(config.delegate);
      if (!delegate) {
        return reply.notFound("Delegate no encontrado.");
      }

      let payload: Record<string, unknown>;
      try {
        payload = extractPayload(request.body);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      try {
        payload = sanitizePayload(payload, config.blockedCreateFields);
        payload = normalizeBigIntFields(payload, config.bigintFields);
        if (config.transformCreate) {
          payload = await config.transformCreate(payload);
        }
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      try {
        const createdRecord = await delegate.create({
          data: payload,
        });

        return reply.code(201).send(toApiValue(createdRecord));
      } catch (error) {
        if (isPrismaConstraintError(error)) {
          return reply.conflict("Conflicto de integridad al crear registro.");
        }

        request.log.error(error);
        return reply.internalServerError("No se pudo crear el registro.");
      }
    },
  );

  app.patch(
    "/:entity/:id",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Actualizar registro",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { entity, id: rawId } = request.params as { entity: string; id: string };
      const config = ENTITY_MAP.get(entity);
      if (!config) {
        return reply.notFound("Entidad no soportada.");
      }

      const delegate = getDelegate(config.delegate);
      if (!delegate) {
        return reply.notFound("Delegate no encontrado.");
      }

      let id: bigint;
      try {
        id = parseEntityId(rawId);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      let payload: Record<string, unknown>;
      try {
        payload = extractPayload(request.body);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      try {
        payload = sanitizePayload(payload, config.blockedUpdateFields);
        payload = normalizeBigIntFields(payload, config.bigintFields);
        if (config.transformUpdate) {
          payload = await config.transformUpdate(payload);
        }
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      try {
        const updatedRecord = await delegate.update({
          where: {
            [config.idField]: id,
          },
          data: payload,
        });

        return toApiValue(updatedRecord);
      } catch (error) {
        if (isPrismaNotFound(error)) {
          return reply.notFound("Registro no encontrado.");
        }

        if (isPrismaConstraintError(error)) {
          return reply.conflict("Conflicto de integridad al actualizar.");
        }

        request.log.error(error);
        return reply.internalServerError("No se pudo actualizar el registro.");
      }
    },
  );

  app.delete(
    "/:entity/:id",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Eliminar registro",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { entity, id: rawId } = request.params as { entity: string; id: string };
      const config = ENTITY_MAP.get(entity);
      if (!config) {
        return reply.notFound("Entidad no soportada.");
      }

      const delegate = getDelegate(config.delegate);
      if (!delegate) {
        return reply.notFound("Delegate no encontrado.");
      }

      let id: bigint;
      try {
        id = parseEntityId(rawId);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      try {
        const deletedRecord = await delegate.delete({
          where: {
            [config.idField]: id,
          },
        });

        return toApiValue(deletedRecord);
      } catch (error) {
        if (isPrismaNotFound(error)) {
          return reply.notFound("Registro no encontrado.");
        }

        if (isPrismaConstraintError(error)) {
          return reply.conflict("No se puede eliminar por dependencias existentes.");
        }

        request.log.error(error);
        return reply.internalServerError("No se pudo eliminar el registro.");
      }
    },
  );

  app.get(
    "/user-roles",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Listar user_roles",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const query = request.query as { userId?: string; roleId?: string };
      const where: Record<string, unknown> = {};

      if (query.userId) {
        where.userId = parseBigIntLike(query.userId, "userId");
      }

      if (query.roleId) {
        where.roleId = parseBigIntLike(query.roleId, "roleId");
      }

      const records = await prisma.userRole.findMany({
        where,
      });

      return toApiValue(records);
    },
  );

  app.post(
    "/user-roles",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Crear user_role",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      let payload: Record<string, unknown>;
      try {
        payload = extractPayload(request.body);
        payload = normalizeBigIntFields(payload, ["userId", "roleId"]);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      try {
        const createdRecord = await prisma.userRole.create({
          data: payload as { userId: bigint; roleId: bigint },
        });

        return reply.code(201).send(toApiValue(createdRecord));
      } catch (error) {
        if (isPrismaConstraintError(error)) {
          return reply.conflict("Conflicto de integridad al crear user_role.");
        }

        request.log.error(error);
        return reply.internalServerError("No se pudo crear user_role.");
      }
    },
  );

  app.delete(
    "/user-roles/:userId/:roleId",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Eliminar user_role",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      let ids: Record<string, bigint>;
      try {
        ids = parseCompositeIds(request.params as Record<string, string>, ["userId", "roleId"]);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      try {
        const deletedRecord = await prisma.userRole.delete({
          where: {
            userId_roleId: {
              userId: ids.userId,
              roleId: ids.roleId,
            },
          },
        });

        return toApiValue(deletedRecord);
      } catch (error) {
        if (isPrismaNotFound(error)) {
          return reply.notFound("user_role no encontrado.");
        }

        request.log.error(error);
        return reply.internalServerError("No se pudo eliminar user_role.");
      }
    },
  );

  app.get(
    "/role-permissions",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Listar role_permissions",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const query = request.query as { roleId?: string; permissionId?: string };
      const where: Record<string, unknown> = {};

      if (query.roleId) {
        where.roleId = parseBigIntLike(query.roleId, "roleId");
      }

      if (query.permissionId) {
        where.permissionId = parseBigIntLike(query.permissionId, "permissionId");
      }

      const records = await prisma.rolePermission.findMany({
        where,
      });

      return toApiValue(records);
    },
  );

  app.post(
    "/role-permissions",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Crear role_permission",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      let payload: Record<string, unknown>;
      try {
        payload = extractPayload(request.body);
        payload = normalizeBigIntFields(payload, ["roleId", "permissionId"]);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      try {
        const createdRecord = await prisma.rolePermission.create({
          data: payload as { roleId: bigint; permissionId: bigint },
        });

        return reply.code(201).send(toApiValue(createdRecord));
      } catch (error) {
        if (isPrismaConstraintError(error)) {
          return reply.conflict("Conflicto de integridad al crear role_permission.");
        }

        request.log.error(error);
        return reply.internalServerError("No se pudo crear role_permission.");
      }
    },
  );

  app.delete(
    "/role-permissions/:roleId/:permissionId",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Eliminar role_permission",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      let ids: Record<string, bigint>;
      try {
        ids = parseCompositeIds(request.params as Record<string, string>, [
          "roleId",
          "permissionId",
        ]);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      try {
        const deletedRecord = await prisma.rolePermission.delete({
          where: {
            roleId_permissionId: {
              roleId: ids.roleId,
              permissionId: ids.permissionId,
            },
          },
        });

        return toApiValue(deletedRecord);
      } catch (error) {
        if (isPrismaNotFound(error)) {
          return reply.notFound("role_permission no encontrado.");
        }

        request.log.error(error);
        return reply.internalServerError("No se pudo eliminar role_permission.");
      }
    },
  );

  app.get(
    "/stay-guests",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Listar stay_guests",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const query = request.query as { stayId?: string; guestId?: string };
      const where: Record<string, unknown> = {};

      if (query.stayId) {
        where.stayId = parseBigIntLike(query.stayId, "stayId");
      }

      if (query.guestId) {
        where.guestId = parseBigIntLike(query.guestId, "guestId");
      }

      const records = await prisma.stayGuest.findMany({
        where,
      });

      return toApiValue(records);
    },
  );

  app.post(
    "/stay-guests",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Crear stay_guest",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      let payload: Record<string, unknown>;
      try {
        payload = extractPayload(request.body);
        payload = normalizeBigIntFields(payload, ["stayId", "guestId"]);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      try {
        const createdRecord = await prisma.stayGuest.create({
          data: payload as { stayId: bigint; guestId: bigint },
        });

        return reply.code(201).send(toApiValue(createdRecord));
      } catch (error) {
        if (isPrismaConstraintError(error)) {
          return reply.conflict("Conflicto de integridad al crear stay_guest.");
        }

        request.log.error(error);
        return reply.internalServerError("No se pudo crear stay_guest.");
      }
    },
  );

  app.delete(
    "/stay-guests/:stayId/:guestId",
    {
      preHandler: ADMIN_GUARDS,
      schema: {
        tags: ["Admin"],
        summary: "Eliminar stay_guest",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      let ids: Record<string, bigint>;
      try {
        ids = parseCompositeIds(request.params as Record<string, string>, ["stayId", "guestId"]);
      } catch (error) {
        return reply.badRequest((error as Error).message);
      }

      try {
        const deletedRecord = await prisma.stayGuest.delete({
          where: {
            stayId_guestId: {
              stayId: ids.stayId,
              guestId: ids.guestId,
            },
          },
        });

        return toApiValue(deletedRecord);
      } catch (error) {
        if (isPrismaNotFound(error)) {
          return reply.notFound("stay_guest no encontrado.");
        }

        request.log.error(error);
        return reply.internalServerError("No se pudo eliminar stay_guest.");
      }
    },
  );
};
