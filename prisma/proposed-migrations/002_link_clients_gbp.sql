-- =============================================================================
-- PROPUESTA (NO SE EJECUTA AUTOMÁTICAMENTE)
-- Vínculo explícito entre clients (UUID) y gbp_clients (INTEGER).
--
-- Hoy el panel DEDUCE el vínculo por WhatsApp o nombre (src/lib/data/client-links.ts).
-- Eso basta para el ADMIN, pero NO es seguro para el futuro portal de cliente:
-- un CLIENT solo debe ver los perfiles GBP vinculados explícitamente.
--
-- Cambio NO destructivo: añade una columna NULLABLE. Los workflows de n8n que
-- leen gbp_clients siguen funcionando igual (ignoran la columna nueva).
-- =============================================================================

BEGIN;

ALTER TABLE gbp_clients
  ADD COLUMN IF NOT EXISTS zihkon_client_id UUID NULL REFERENCES clients(client_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gbp_clients_zihkon_client_id_idx ON gbp_clients (zihkon_client_id);

COMMIT;

-- Relleno inicial OPCIONAL (revisar el resultado antes de ejecutarlo):
-- solo vincula coincidencias exactas de WhatsApp (dígitos) y deja el resto en NULL.
--
-- SELECT g.id, g.business_name, c.client_id, c.client_name
-- FROM gbp_clients g
-- JOIN clients c
--   ON regexp_replace(g.whatsapp_e164, '\D', '', 'g') = regexp_replace(c.whatsapp_e164, '\D', '', 'g')
-- WHERE g.whatsapp_e164 IS NOT NULL;
--
-- UPDATE gbp_clients g
-- SET zihkon_client_id = c.client_id
-- FROM clients c
-- WHERE g.zihkon_client_id IS NULL
--   AND g.whatsapp_e164 IS NOT NULL
--   AND regexp_replace(g.whatsapp_e164, '\D', '', 'g') = regexp_replace(c.whatsapp_e164, '\D', '', 'g');
