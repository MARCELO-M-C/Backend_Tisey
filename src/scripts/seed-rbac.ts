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
    code: "users:manage",
    description: "Gestionar usuarios",
  },
  {
    code: "roles:manage",
    description: "Gestionar roles y permisos",
  },
  {
    code: "menu:view",
    description: "Ver menu",
  },
  {
    code: "menu:manage",
    description: "Gestionar menu",
  },
  {
    code: "stations:view",
    description: "Ver estaciones y colas",
  },
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
    code: "invoices:issue",
    description: "Emitir facturas",
  },
  {
    code: "invoices:void",
    description: "Anular facturas",
  },
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.ADMIN]: PERMISSIONS.map((permission) => permission.code),
  [ROLES.WAITER]: [
    "menu:view",
    "stations:view",
    "orders:create",
    "orders:view:self",
    "orders:update:self",
    "orders:overdue:view",
  ],
  [ROLES.KITCHEN]: [
    "stations:view",
    "orders:view:all",
    "orders:overdue:view",
  ],
  [ROLES.CASHIER]: [
    "stations:view",
    "orders:view:all",
    "orders:overdue:view",
    "invoices:issue",
    "invoices:void",
  ],
};

type DemoUserConfig = {
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  roleName: string;
};

function getDemoUsers(): DemoUserConfig[] {
  return [
    {
      username: "admin_demo",
      firstName: "Admin",
      lastName: "Demo",
      password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!",
      roleName: ROLES.ADMIN,
    },
    {
      username: "mesero_demo",
      firstName: "Mesero",
      lastName: "Demo",
      password: process.env.SEED_WAITER_PASSWORD ?? "Mesero123!",
      roleName: ROLES.WAITER,
    },
    {
      username: "cocina_demo",
      firstName: "Cocina",
      lastName: "Demo",
      password: process.env.SEED_KITCHEN_PASSWORD ?? "Cocina123!",
      roleName: ROLES.KITCHEN,
    },
    {
      username: "caja_demo",
      firstName: "Caja",
      lastName: "Demo",
      password: process.env.SEED_CASHIER_PASSWORD ?? "Caja123!",
      roleName: ROLES.CASHIER,
    },
  ];
}

async function upsertRoles() {
  const roleMap = new Map<string, bigint>();

  for (const roleName of Object.values(ROLES)) {
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
    const savedPermission = await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        description: permission.description,
      },
      create: {
        code: permission.code,
        description: permission.description,
      },
    });

    permissionMap.set(savedPermission.code, savedPermission.id);
  }

  return permissionMap;
}

async function syncRolePermissions(
  roleMap: Map<string, bigint>,
  permissionMap: Map<string, bigint>,
) {
  for (const [roleName, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName);

    if (!roleId) {
      throw new Error(`Rol no encontrado: ${roleName}`);
    }

    const permissionIds = permissionCodes.map((code) => {
      const permissionId = permissionMap.get(code);
      if (!permissionId) {
        throw new Error(`Permiso no encontrado: ${code}`);
      }
      return permissionId;
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  }
}

async function upsertUser(
  username: string,
  firstName: string,
  lastName: string,
  password: string,
) {
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

async function syncUserRole(userId: bigint, roleId: bigint) {
  await prisma.userRole.deleteMany({
    where: { userId },
  });

  await prisma.userRole.create({
    data: {
      userId,
      roleId,
    },
  });
}

async function main() {
  const roleMap = await upsertRoles();
  const permissionMap = await upsertPermissions();

  await syncRolePermissions(roleMap, permissionMap);

  const demoUsers = getDemoUsers();

  for (const demoUser of demoUsers) {
    const roleId = roleMap.get(demoUser.roleName);

    if (!roleId) {
      throw new Error(`No se pudo resolver el rol ${demoUser.roleName}`);
    }

    const user = await upsertUser(
      demoUser.username,
      demoUser.firstName,
      demoUser.lastName,
      demoUser.password,
    );

    await syncUserRole(user.id, roleId);
  }

  console.log(" Seed RBAC completado.");
  console.log("Usuarios demo creados/actualizados:");

  for (const user of demoUsers) {
    console.log(`- ${user.username} / ${user.password} (${user.roleName})`);
  }

  console.log(
    "Puedes sobrescribir contraseñas con SEED_ADMIN_PASSWORD, SEED_WAITER_PASSWORD, SEED_KITCHEN_PASSWORD y SEED_CASHIER_PASSWORD.",
  );
}

main()
  .catch((error) => {
    console.error(" Error ejecutando seed-rbac:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });