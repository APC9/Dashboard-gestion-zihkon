-- =============================================================================
-- 2026-10-15 · Prueba gratuita de 7 días de la automatización de publicaciones.
--  - La prueba vive en la fila de client_automations de 'publicaciones_gbp'
--    (por defecto) o 'publicaciones' (multicanal).
--  - En prueba = trial_started_at con valor y trial_finished_at vacío.
--  - Máximo trial_posts_limit publicaciones (4); n8n suma trial_posts_used
--    cuando una publicación queda programada (no al cancelarla).
--  - n8n envía un único recordatorio 1 día antes (trial_reminder_sent_at) y al
--    vencer desactiva la automatización y marca trial_finished_at.
--  - Cada cliente solo puede tener UNA prueba: índice único por client_id
--    entre las filas con trial_started_at (nunca se borra al acabar).
-- =============================================================================
BEGIN;

ALTER TABLE client_automations
  ADD COLUMN IF NOT EXISTS trial_started_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_posts_limit      INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS trial_posts_used       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_finished_at      TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_automations_trial_check') THEN
    ALTER TABLE client_automations ADD CONSTRAINT client_automations_trial_check CHECK (
      trial_posts_limit > 0 AND trial_posts_used >= 0
      AND (trial_started_at IS NULL OR (trial_ends_at IS NOT NULL AND trial_ends_at > trial_started_at))
    );
  END IF;
END $$;

-- Una sola prueba por cliente (sea de la automatización que sea).
CREATE UNIQUE INDEX IF NOT EXISTS client_automations_one_trial_per_client
  ON client_automations (client_id) WHERE trial_started_at IS NOT NULL;

-- Lo que consulta cada hora el workflow de pruebas.
CREATE INDEX IF NOT EXISTS client_automations_trial_open_idx
  ON client_automations (trial_ends_at) WHERE trial_started_at IS NOT NULL AND trial_finished_at IS NULL;

COMMIT;
