import "dotenv/config";

import bcrypt from "bcryptjs";

import { prisma } from "../lib/prisma";

const ROLES = {
  ADMIN: "ADMIN",
  WAITER: "MESERO",
  KITCHEN: "COCINA",
  CASHIER: "CAJA",
} as const;

const PERMISSIONS = [
  {
    code: "orders:create",
    description: "Crear pedidos",
  },
  {
    code: "orders:view:self",
    description: "Ver pedidos propios",
  },
  {
    code: "orders:update:self",
    description: "Editar pedidos propios en ventana permitida",
  },
  {
    code: "orders:view:all",
    description: "Ver todos los pedidos",
  },
  {
    code: "orders:update:any",
    description: "Editar cualquier pedido",
  },
  {
    code: "orders:overdue:view",
    description: "Ver pedidos atrasados",
  },
  {
    code: "menu:manage",
    description: "Gestionar menu",
  },
  {
    code: "invoices:issue",
    description: "Emitir facturas",
  },
  {
    code: "invoices:void",
    description: "Anular facturas",
  },
  {
    code: "stays:manage",
    description: "Gestionar hospedajes",
  },
  {
    code: "users:manage",
    description: "Gestionar usuarios",
  },
  {
    code: "reports:view",
    description: "Ver reportes",
  },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.ADMIN]: PERMISSIONS.map((permission) => permission.code),
  [ROLES.WAITER]: [
    "orders:create",
    "orders:view:self",
    "orders:update:self",
    "orders:overdue:view",
  ],
  [ROLES.KITCHEN]: ["orders:view:all", "orders:overdue:view"],
  [ROLES.CASHIER]: [
    "orders:view:all",
    "orders:overdue:view",
    "invoices:issue",
    "invoices:void",
  ],
};

async function upsertRoles() {
  const roleNames = Object.values(ROLES);
  const roleMap = new Map<string, bigint>();

  for (const roleName of roleNames) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    roleMap.set(role.name, role.id);
  }

  return roleMap;
}

async function upsertPermissions() {
  const permissionMap = new Map<string, bigint>();

  for (const permission of PERMISSIONS) {
    const upsertedPermission = await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        description: permission.description,
      },
      create: {
        code: permission.code,
        description: permission.description,
      },
    });

    permissionMap.set(upsertedPermission.code, upsertedPermission.id);
  }

  return permissionMap;
}

async function linkRolePermissions(
  roleMap: Map<string, bigint>,
  permissionMap: Map<string, bigint>,
) {
  for (const [roleName, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) {
      throw new Error(`Rol no encontrado: ${roleName}`);
    }

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionMap.get(permissionCode);
      if (!permissionId) {
        throw new Error(`Permiso no encontrado: ${permissionCode}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }
  }
}

async function upsertUser(username: string, firstName: string, lastName: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.user.upsert({
    where: { username },
    update: {
      firstName,
      lastName,
      passwordHash,
      isActive: true,
    },
    create: {
      username,
      firstName,
      lastName,
      passwordHash,
      isActive: true,
    },
  });
}

async function attachUserRole(userId: bigint, roleId: bigint) {
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId,
      },
    },
    update: {},
    create: {
      userId,
      roleId,
    },
  });
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const waiterPassword = process.env.SEED_WAITER_PASSWORD ?? "Mesero123!";

  const roleMap = await upsertRoles();
  const permissionMap = await upsertPermissions();
  await linkRolePermissions(roleMap, permissionMap);

  const adminUser = await upsertUser("admin_demo", "Admin", "Demo", adminPassword);
  const waiterUser = await upsertUser("mesero_demo", "Mesero", "Demo", waiterPassword);

  const adminRoleId = roleMap.get(ROLES.ADMIN);
  const waiterRoleId = roleMap.get(ROLES.WAITER);
  if (!adminRoleId || !waiterRoleId) {
    throw new Error("No se pudieron resolver roles base.");
  }

  await attachUserRole(adminUser.id, adminRoleId);
  await attachUserRole(waiterUser.id, waiterRoleId);

  console.log("Auth seed completado.");
  console.log("Usuarios de prueba:");
  console.log(`- admin_demo / ${adminPassword}`);
  console.log(`- mesero_demo / ${waiterPassword}`);
  console.log("Puedes sobrescribir contrasenas con SEED_ADMIN_PASSWORD y SEED_WAITER_PASSWORD.");
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed-auth:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
