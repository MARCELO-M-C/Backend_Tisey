# Backend_Tisey

API REST (Node.js + Fastify + Prisma + MySQL) para el sistema de gestion y facturacion de la Eco-posada Tisey.

## Stack actual

- Node.js + TypeScript
- Fastify
- Prisma ORM (MySQL/MariaDB)
- Socket.IO (actualizacion en tiempo real)
- Swagger OpenAPI en `/docs`
- Seguridad base: `helmet`, `rate-limit`, validaciones y manejo de errores

2. Configurar variables:

```bash
cp .env.example .env
```

# Instalación

Instalar dependencias:

```bash
npm install
```

Generar cliente Prisma:

```bash
npx prisma generate
```
Compilar el proyecto:

```bash
npm run build
```

Ejecutar en desarrollo:

```bash
npm run dev
```

Ejecutar versión compilada:

```bash
npm run start
```

# Scripts útiles

Desarrollo:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Producción local:

```bash
npm run start
```

Generar Prisma Client:

```bash
npx prisma generate
```

Aplicar migraciones:

```bash
npx prisma migrate dev
```

Abrir Prisma Studio:

```bash
npx prisma studio
```

# Documentación Swagger

Disponible localmente en:

http://localhost:3000/docs
