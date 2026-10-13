-- =============================================================================
-- 2026-10-13 · Pack 1 "Presencia Local": publicaciones solo en Google (GBP).
--  - Nueva automatización 'publicaciones_gbp' (solo ficha de Google).
--  - 'publicaciones' pasa a llamarse "Publicaciones multicanal" (misma clave).
--  - No toca client_automations: los clientes actuales siguen como multicanal.
-- 'publicaciones' y 'publicaciones_gbp' son excluyentes (lo controla el panel).
-- =============================================================================

BEGIN;

INSERT INTO automation_catalog (automation_key, name, description, sort_order, active) VALUES
  ('publicaciones_gbp', 'Publicaciones en Google (GBP)',
   'El cliente envía fotos o vídeos por WhatsApp y se publican solo en su ficha de Google (Google Business Profile).', 15, true)
ON CONFLICT (automation_key) DO NOTHING;

UPDATE automation_catalog
   SET name = 'Publicaciones multicanal',
       description = 'El cliente envía fotos o vídeos por WhatsApp y se publican en Instagram, Facebook, TikTok y Google (Google Business Profile).'
 WHERE automation_key = 'publicaciones';

COMMIT;
