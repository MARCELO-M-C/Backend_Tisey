# Backend_Tisey

API REST (Node.js + Fastify + Prisma + MySQL) para el sistema de gestion y facturacion de la Eco-posada Tisey.

## Stack actual

- Node.js + TypeScript
- Fastify
- Prisma ORM (MySQL/MariaDB)
- Socket.IO (actualizacion en tiempo real)
- Swagger OpenAPI en `/docs`
- Seguridad base: `helmet`, `rate-limit`, validaciones y manejo de errores

## Arranque local

1. Instalar dependencias:

```bash
npm install
```

2. Configurar variables:

```bash
cp .env.example .env
```

3. Ajustar `DATABASE_URL` y `JWT_SECRET` en `.env`.
Tambien define `CORS_ORIGIN` con los dominios permitidos separados por comas.
Opcionalmente ajusta `JWT_EXPIRES_IN` (por defecto `8h`).

4. Generar cliente Prisma:

```bash
npm run prisma:generate
```

5. Seed inicial de autenticacion (roles, permisos, usuarios demo):

```bash
npm run seed:auth
```

Credenciales por defecto:
- `admin_demo` / `Admin123!`
- `mesero_demo` / `Mesero123!`

Puedes sobrescribir contrasenas con variables:
- `SEED_ADMIN_PASSWORD`
- `SEED_WAITER_PASSWORD`

6. Ejecutar en desarrollo:

```bash
npm run dev
```

## Swagger

- URL local: `http://localhost:3000/docs`

## Endpoints iniciales

- `POST /api/auth/login` (retorna JWT)
- `GET /api/auth/me` (requiere JWT)
- `GET /health`
- `POST /api/orders` (crea pedido con `order_code` secuencial diario, requiere JWT)
- `GET /api/orders/overdue` (alertas de atraso 20+ y roja 30+ min, requiere JWT)
- `PATCH /api/orders/:orderId` (edicion por rol/tiempo, requiere JWT)

## Realtime

- Socket.IO habilitado en el mismo server HTTP.
- Evento emitido al crear pedido: `orders:new`.
- Evento emitido al editar pedido: `orders:update`.

## Roles esperados

El backend reconoce estos roles (insensible a mayusculas):

- `ADMIN` / `SUPERADMIN`
- `MESERO` / `WAITER`
- `COCINA` / `KITCHEN`
- `CAJA` / `CASHIER`

## Cambios BD para grupos (fase 1)

Se incluyo script SQL en:

- `docs/phase1_group_support.sql`

Este script agrega soporte para grupos de hospedaje en:

- `stay_groups`
- `stays.group_id`
- `orders.stay_group_id`
- `invoices.stay_group_id`
