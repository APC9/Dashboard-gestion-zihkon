-- =============================================================================
-- Automatizaciones contratadas por cliente.
-- Solo AÑADE tablas nuevas: no modifica ni borra nada existente.
--
--  automation_catalog   → automatizaciones que ofrece Zihkon (una fila por automatización).
--  client_automations   → cuáles tiene habilitadas cada cliente.
--
-- n8n puede comprobar si un cliente tiene una automatización con:
--   SELECT 1 FROM client_automations
--   WHERE client_id = $1 AND automation_key = 'web_whatsapp' AND enabled;
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS automation_catalog (
  automation_key TEXT        PRIMARY KEY,
  name           TEXT        NOT NULL,
  description    TEXT,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  active         BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_automations (
  client_id      UUID        NOT NULL REFERENCES clients (client_id) ON DELETE CASCADE,
  automation_key TEXT        NOT NULL REFERENCES automation_catalog (automation_key) ON UPDATE CASCADE,
  enabled        BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, automation_key)
);

CREATE INDEX IF NOT EXISTS client_automations_key_idx ON client_automations (automation_key) WHERE enabled;

INSERT INTO automation_catalog (automation_key, name, description, sort_order) VALUES
  ('web_whatsapp', 'Edición de la web por WhatsApp', 'El cliente pide cambios en su web escribiendo "WEB" por WhatsApp.', 10),
  ('publicaciones', 'Publicaciones en redes y Google', 'El cliente envía fotos o vídeos por WhatsApp y se generan y programan sus publicaciones.', 20),
  ('resenas_gbp', 'Respuesta automática a reseñas', 'Se generan y publican respuestas a las reseñas de su ficha de Google.', 30)
ON CONFLICT (automation_key) DO NOTHING;

-- Los clientes que ya usan una automatización la mantienen habilitada.
INSERT INTO client_automations (client_id, automation_key)
SELECT DISTINCT client_id, 'web_whatsapp' FROM client_websites WHERE client_id IS NOT NULL AND active IS NOT FALSE
UNION
SELECT DISTINCT client_id, 'publicaciones' FROM content_intakes WHERE client_id IS NOT NULL
UNION
SELECT DISTINCT client_id, 'resenas_gbp' FROM gbp_clients WHERE active IS NOT FALSE
ON CONFLICT DO NOTHING;

COMMIT;
