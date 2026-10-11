# Zihkon Admin

Panel central de gestión de clientes y automatizaciones de Zihkon. Sustituye la gestión manual con DBeaver por una interfaz web sobre el PostgreSQL existente.

```
DATOS            → PostgreSQL (fuente de verdad, sin duplicar)
GESTIÓN          → Zihkon Admin (este proyecto)
AUTOMATIZACIONES → n8n (webhooks autenticados)
INTEGRACIONES    → n8n / servicios externos (GitHub, Netlify, GBP, Evolution API…)
```

Navegador → API de Zihkon Admin (sesión + permisos + Zod) → PostgreSQL / webhook de n8n → automatización → PostgreSQL

## Stack

Next.js 16 (App Router, Route Handlers) · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Lucide · Prisma 7 + `@prisma/adapter-pg` · NextAuth 4 (Credentials + JWT) · React Hook Form + Zod 4 · TanStack Table 8 · Recharts · Docker.

> Prisma 8 aún está en RC; se usa Prisma 7.10 (estable).

## Puesta en marcha

### Producción (Docker / Coolify)

```bash
cp .env.example .env          # rellenar valores
npm run hash-password -- "contraseña-larga-y-segura"   # → ADMIN_PASSWORD_HASH
docker compose up -d
```

En **Coolify**: crea un recurso *Dockerfile* (o *Docker Compose*) apuntando a este repositorio, define las variables de `.env.example` en la sección *Environment Variables*, expón el puerto `3000` y usa `/api/health` como healthcheck. `NEXTAUTH_URL` debe ser la URL pública final (https).

La imagen no ejecuta migraciones ni toca la estructura de la base de datos.

### Desarrollo local

```bash
npm install
npm run dev:db       # PostgreSQL desechable en :5433 con la estructura y datos ficticios (dev/)
cp .env.example .env # DATABASE_URL=postgresql://zihkon:zihkon@localhost:5433/zihkon_dev
npm run dev
```

`dev/schema.sql` es una réplica aproximada **solo para desarrollo**. Nunca se ejecuta contra producción.

## Base de datos existente

- `prisma/schema.prisma` mapea las 12 tablas existentes (`@@map`/`@map`) sin renombrar nada en la BD.
- Los campos no clave son opcionales: una fila con `NULL` nunca rompe una pantalla.
- **No usar** `prisma migrate dev`, `migrate reset` ni `db push` contra producción.
- Para comparar el schema con la BD real **sin modificar nada**:

  ```bash
  DATABASE_URL=... npm run db:inspect   # prisma db pull --print (solo imprime)
  ```

  Revisa nulabilidad, tipos (`TIMESTAMP` vs `TIMESTAMPTZ`) y defaults antes del primer despliegue. Lo recomendable es conectar con un usuario de PostgreSQL con permisos `SELECT/INSERT/UPDATE/DELETE` y sin `CREATE/ALTER/DROP`.
- El panel **prefiere desactivar** (`active = false`). Borrar un cliente solo se permite si no tiene datos asociados.

### clients ↔ gbp_clients

`gbp_clients.client_id` es una FK obligatoria a `clients.client_id` (`ON DELETE RESTRICT`). Un cliente puede tener
varios perfiles (uno por ubicación). El nombre y el WhatsApp del negocio **no** se guardan en `gbp_clients`: se leen
siempre de `clients`. Los IDs de `gbp_clients` son UUID; `gbp_review_activity.client_id` y
`gbp_automation_errors.client_id` apuntan a `gbp_clients.id`.

### Migraciones propuestas (no se ejecutan solas)

| Archivo | Qué hace | Cuándo |
|---|---|---|
| `prisma/proposed-migrations/001_admin_activity_log.sql` | Tabla nueva para el histórico de acciones del panel | Cuando quieras histórico permanente |
| `prisma/proposed-migrations/003_admin_users.sql` | Tabla `panel_users` con roles ADMIN/CLIENT | FASE 2 |

Todas son aditivas (no eliminan ni modifican columnas existentes). Revisa y ejecuta manualmente (p. ej. desde DBeaver) cuando decidas.

## Seguridad

- Autenticación obligatoria: `src/proxy.ts` bloquea todo lo que no sea `/login`, `/api/auth` y `/api/health`. Además **cada** página y Route Handler vuelve a comprobar sesión y rol en servidor.
- Roles `ADMIN` (activo) y `CLIENT` (preparado). `src/lib/auth/permissions.ts` aplica el ámbito por cliente (`clientScope`, `gbpScope`, `assertClientAccess`…) en todas las consultas de `src/lib/data/`.
- Los IDs que llegan del navegador se validan con Zod y se comprueban en BD antes de actuar o llamar a n8n.
- Entradas validadas con Zod; consultas parametrizadas con Prisma (`$queryRaw` solo con plantillas etiquetadas).
- Protección CSRF por comprobación de `Origin` en peticiones que modifican datos + cookies `SameSite=Lax`.
- Login con limitación de intentos y comparación bcrypt en tiempo constante.
- Ningún secreto con prefijo `NEXT_PUBLIC_`; `src/lib/env.ts` y la capa de datos son `server-only`.
- Cabeceras de seguridad (`X-Frame-Options`, `nosniff`…) y `robots: noindex`.
- Las previews de Google Drive usan solo miniaturas públicas: nunca se exponen credenciales.

## n8n

`src/lib/n8n/`:

- `workflows.ts` — catálogo de workflows (id, ruta por defecto, variable de entorno, esquema Zod de datos).
- `client.ts` — llamada HTTP firmada al webhook.
- `triggers.ts` — `triggerContentGeneration()`, `triggerWebsiteChange()`, `triggerWebsitePreview()`, `triggerWebsitePublish()`, `triggerGbpReviewApproval()`, `triggerGbpReviewPublication()`, `triggerGbpReviewRegeneration()`, `triggerAuditGeneration()`, `triggerGbpListAccounts()`. Cada una: autentica → valida → verifica recurso y permisos → envía `client_id` + id del recurso → registra → devuelve resultado → normaliza errores.
- `api.ts` — lectura opcional de ejecuciones con la API REST de n8n.

### Configurar un webhook en n8n

1. Nodo **Webhook**, método `POST`, ruta igual a la del catálogo (p. ej. `zihkon/gbp/review-publish`, ver *Configuración* en el panel).
2. *Authentication → Header Auth*: nombre `X-Zihkon-Secret`, valor = `N8N_WEBHOOK_SECRET`.
3. (Opcional, más estricto) verificar `X-Zihkon-Signature = sha256=HMAC_SHA256(secret, "${X-Zihkon-Timestamp}.${body}")`.

Cuerpo recibido:

```json
{
  "event": "gbp-review-publication",
  "request_id": "uuid",
  "requested_at": "2026-10-08T10:42:00.000Z",
  "requested_by": { "id": "admin", "email": "admin@zihkon.com", "role": "ADMIN" },
  "client_system": "gbp_clients",
  "client_id": "f7612649-6fe0-4c4e-a33c-45b3428cf77e",
  "resource": { "type": "gbp_review", "id": 345 },
  "data": { "review_id": "…", "location_id": "…", "account_id": "…", "zihkon_client_id": "uuid" }
}
```

`client_system` indica si `client_id` es el UUID de `clients` o el UUID de un perfil de `gbp_clients` (en ese caso `data.zihkon_client_id` es el cliente).

### Consultar cuentas y fichas de Google (`gbp-list-accounts`)

Página *Google Business → Cuentas de Google* (`/gbp/accounts`, solo administradores). Al pulsar «Consultar en Google» el panel llama a `POST /api/gbp/accounts`, que lanza el webhook `zihkon/gbp/accounts` (`N8N_PATH_GBP_LIST_ACCOUNTS`) con `resource.type = "global"` y `data = {}`. Timeout propio de 30 s (el resto usa `N8N_WEBHOOK_TIMEOUT_MS`).

Respuesta esperada de n8n (se valida con Zod; si no cumple el esquema se muestra un error):

```json
// HTTP 200
{ "ok": true, "count": 2, "items": [
  { "account_id": "100942243931077822997", "account_name": "Zihkon", "location_id": "17992834784523084306", "title": "Zihkon", "address": "Calle 1, Estepona" }
] }
// HTTP 502
{ "ok": false, "error": "mensaje" }
```

`location_id`, `title` y `address` pueden ser `null` si la cuenta no tiene fichas; esas cuentas no se muestran. Las fichas cuyo `location_id` ya existe en `gbp_clients` se marcan «Ya dado de alta»; el resto enlaza a `/gbp/profiles/new?accountId=…&locationId=…` con los IDs rellenados.

El panel solo cambia el estado de una reseña cuando es una decisión humana (aprobar → `APPROVED`/`SCHEDULED`, rechazar → `REJECTED`). `PUBLISHED` lo escribe n8n cuando Google confirma la publicación. Si n8n falla, el cambio en BD se mantiene y se muestra un aviso.

## Estados

Los estados son `TEXT` libre escrito por n8n; se comparan sin distinguir mayúsculas. Colores y agrupaciones (pendiente, listo, terminado…) en `src/lib/status.ts`: ajústalos si tus workflows usan otros valores.

## Estructura

```
prisma/                     schema + migraciones propuestas
src/proxy.ts                barrera de autenticación
src/app/(admin)/            páginas del panel (dashboard, clients, websites, gbp, content, audits, automations, admin, settings)
src/app/api/                API interna (Route Handlers)
src/lib/auth/               NextAuth, sesión, permisos por cliente
src/lib/data/               acceso a datos con ámbito por actor (única puerta a PostgreSQL)
src/lib/n8n/                integración con n8n
src/lib/validation/         esquemas Zod compartidos por formularios y API
src/lib/activity-log.ts     registro de acciones (stdout + memoria; preparado para tabla)
src/components/             UI (shadcn/ui en components/ui)
dev/                        BD de desarrollo (no producción)
```

## API

| Método | Ruta | |
|---|---|---|
| GET/POST | `/api/clients` | listar (filtros `q,status,web,gbp,page`) / crear |
| GET/PATCH/DELETE | `/api/clients/[id]` | ficha / editar o activar-desactivar / eliminar (solo sin datos) |
| GET/PATCH | `/api/clients/[id]/website` | webs del cliente / crear-actualizar |
| POST | `/api/clients/[id]/website/actions` | `change` (IA), `preview`, `publish` → n8n |
| GET | `/api/clients/[id]/gbp` | perfiles GBP vinculados + resumen de reseñas |
| GET/POST, GET/PATCH | `/api/gbp/profiles`, `/api/gbp/profiles/[id]` | perfiles GBP |
| GET, GET/PATCH | `/api/gbp/reviews`, `/api/gbp/reviews/[id]` | bandeja / editar respuesta |
| POST | `/api/gbp/reviews/[id]/{approve,reject,publish,regenerate,schedule}` | acciones |
| POST | `/api/gbp/accounts` | consultar cuentas y fichas de Google → n8n (admin) |
| GET | `/api/gbp/errors` | errores GBP |
| GET, GET/PATCH | `/api/content`, `/api/content/[id]` | contenido / editar descripción |
| POST | `/api/content/[id]/{generate,cancel}` | n8n / cancelar |
| GET | `/api/audits`, `/api/audits/[id]`, `/api/audits/[id]/download` | auditorías |
| POST | `/api/audits/generate` | nueva auditoría → n8n |
| GET, POST | `/api/automations`, `/api/automations/[id]/execute` | catálogo + ejecuciones / ejecutar |
| GET/POST, PATCH | `/api/admin/automation-admins`, `…/[phone]` | teléfonos autorizados |
| GET | `/api/search?q=` | buscador global |
| GET | `/api/health` | healthcheck público |

## Próximas fases

- **FASE 2**: aplicar la migración 003, `authorize` contra `panel_users`, portal `/portal` para CLIENT (los filtros de ámbito ya están en la capa de datos), integraciones GitHub/Netlify vía n8n.
- **FASE 3**: suscripciones, facturación, analytics, IA avanzada.
