-- =============================================================================
-- PROPUESTA FASE 2 (NO SE EJECUTA AUTOMÁTICAMENTE)
-- Usuarios del panel con roles. Sustituye al administrador por variables de
-- entorno y permite el portal de cliente (rol CLIENT ligado a un client_id).
-- Solo AÑADE una tabla nueva.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS panel_users (
  user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  name           TEXT,
  password_hash  TEXT NOT NULL,                       -- bcrypt
  role           TEXT NOT NULL CHECK (role IN ('ADMIN', 'CLIENT')),
  client_id      UUID NULL REFERENCES clients(client_id) ON DELETE CASCADE,
  active         BOOLEAN NOT NULL DEFAULT true,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un CLIENT siempre pertenece a un cliente; un ADMIN nunca.
  CONSTRAINT panel_users_role_client_chk CHECK (
    (role = 'CLIENT' AND client_id IS NOT NULL) OR (role = 'ADMIN' AND client_id IS NULL)
  )
);

COMMIT;

-- gen_random_uuid() requiere PostgreSQL 13+ o la extensión pgcrypto.
