import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const ROLES = [
  "ADMIN",
  "MANAGER",
  "MESERO",
  "COCINA",
  "CAJA",
] as const;

const PERMISSIONS = [
  {
    code: "ADMIN_ORDERS_MANAGE",
    description: "Gestionar órdenes del restaurante",
  },
  {
    code: "ADMIN_KITCHEN_MANAGE",
    description: "Gestionar cocina del restaurante",
  },
  {
    code: "ADMIN_TABLES_MANAGE",
    description: "Gestionar mesas del restaurante",
  },
  {
    code: "ADMIN_SHIFTS_&_STATIONS_MANAGE",
    description: "Gestionar turnos del personal y estaciones del restaurante",
  },
  {
    code: "ADMIN_MENU_MANAGE",
    description: "Gestionar menú del restaurante",
  },
  {
    code: "ADMIN_LODGING_MANAGE",
    description: "Gestionar hospedaje del hotel",
  },
  {
    code: "ADMIN_BILLING_MANAGE",
    description: "Gestionar facturación y cobros del restaurante y del hotel",
  },
] as const;

type AdminSeedConfig = {
  username: string;
  password: string | null;
  firstName: string;
  lastName: string;
};

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `La variable de entorno ${name} es obligatoria para ejecutar el seed.`,
    );
  }

  return value;
}

function getOptionalEnvironmentVariable(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function validateAdminUsername(username: string): void {
  if (username.length < 3 || username.length > 50) {
    throw new Error(
      "SEED_ADMIN_USERNAME debe tener entre 3 y 50 caracteres.",
    );
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    throw new Error(
      "SEED_ADMIN_USERNAME solo puede contener letras, números, punto, guion y guion bajo.",
    );
  }
}

function validateNewAdminPassword(password: string): void {
  if (password.length < 12) {
    throw new Error(
      "SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres.",
    );
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialCharacter = /[^a-zA-Z0-9]/.test(password);

  if (
    !hasUppercase ||
    !hasLowercase ||
    !hasNumber ||
    !hasSpecialCharacter
  ) {
    throw new Error(
      "SEED_ADMIN_PASSWORD debe incluir mayúscula, minúscula, número y carácter especial.",
    );
  }
}

function getAdminSeedConfig(): AdminSeedConfig {
  const config: AdminSeedConfig = {
    username: getRequiredEnvironmentVariable("SEED_ADMIN_USERNAME"),
    password: getOptionalEnvironmentVariable("SEED_ADMIN_PASSWORD"),
    firstName: getRequiredEnvironmentVariable("SEED_ADMIN_FIRST_NAME"),
    lastName: getRequiredEnvironmentVariable("SEED_ADMIN_LAST_NAME"),
  };

  validateAdminUsername(config.username);

  return config;
}

async function upsertRoles(): Promise<Map<string, bigint>> {
  const roleMap = new Map<string, bigint>();

  for (const roleName of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    roleMap.set(role.name, role.id);
  }

  return roleMap;
}

async function upsertPermissions(): Promise<void> {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        description: permission.description,
      },
      create: {
        code: permission.code,
        description: permission.description,
      },
    });
  }
}

async function ensureInitialAdmin(
  roleMap: Map<string, bigint>,
  config: AdminSeedConfig,
): Promise<{ created: boolean; username: string }> {
  const adminRoleId = roleMap.get("ADMIN");

  if (!adminRoleId) {
    throw new Error("No se pudo resolver el rol ADMIN.");
  }

  let user = await prisma.user.findUnique({
    where: {
      username: config.username,
    },
  });

  let created = false;

  if (!user) {
    if (!config.password) {
      throw new Error(
        "SEED_ADMIN_PASSWORD es obligatoria cuando el administrador inicial todavía no existe.",
      );
    }

    validateNewAdminPassword(config.password);

    const passwordHash = await bcrypt.hash(config.password, 12);

    user = await prisma.user.create({
      data: {
        username: config.username,
        passwordHash,
        firstName: config.firstName,
        lastName: config.lastName,
        isActive: true,
      },
    });

    created = true;
  } else {
    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        firstName: config.firstName,
        lastName: config.lastName,
        isActive: true,
      },
    });
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: adminRoleId,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: adminRoleId,
    },
  });

  return {
    created,
    username: user.username,
  };
}

async function main(): Promise<void> {
  const adminConfig = getAdminSeedConfig();
  const roleMap = await upsertRoles();

  await upsertPermissions();

  const adminResult = await ensureInitialAdmin(
    roleMap,
    adminConfig,
  );

  console.log("Seed RBAC oficial completado correctamente.");
  console.log(`Administrador: ${adminResult.username}`);
  console.log(
    adminResult.created
      ? "La cuenta ADMIN inicial fue creada."
      : "La cuenta ADMIN ya existía; su contraseña fue conservada.",
  );
  console.log(
    "Roles disponibles: ADMIN, MANAGER, MESERO, COCINA y CAJA.",
  );
  console.log(
    "Los permisos de MANAGER se asignarán posteriormente desde la administración de accesos.",
  );
}

main()
  .catch((error: unknown) => {
    console.error("Error ejecutando seed-rbac:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
