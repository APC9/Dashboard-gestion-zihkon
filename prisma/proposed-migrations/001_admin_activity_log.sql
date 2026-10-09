-- =============================================================================
-- PROPUESTA (NO SE EJECUTA AUTOMÁTICAMENTE)
-- Tabla de auditoría de acciones del panel. Solo AÑADE una tabla nueva:
-- no modifica ni borra nada existente.
--
-- Tras aplicarla: añadir el modelo a schema.prisma y un sink en
-- src/lib/activity-log.ts que inserte cada ActivityEntry.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id      TEXT        NOT NULL,
  actor_email   TEXT        NOT NULL,
  actor_role    TEXT        NOT NULL,
  action        TEXT        NOT NULL,          -- p. ej. gbp.review.approve, n8n:website-publish
  client_id     TEXT,                          -- UUID de clients o id de gbp_clients (texto)
  client_label  TEXT,
  resource_type TEXT,
  resource_id   TEXT,
  ip            TEXT,
  result        TEXT        NOT NULL CHECK (result IN ('SUCCESS', 'ERROR', 'DENIED')),
  message       TEXT,
  duration_ms   INTEGER
);

CREATE INDEX IF NOT EXISTS admin_activity_log_created_at_idx ON admin_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_activity_log_client_idx     ON admin_activity_log (client_id, created_at DESC);

COMMIT;
