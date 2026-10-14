-- =============================================================================
-- 2026-10-14 · Las fichas nuevas de Google Business empiezan con la puesta al día
-- de reseñas antiguas pendiente (la arranca n8n "GBP · Puesta al día" en la próxima
-- hora en punto, de 9 a 19). No cambia las fichas existentes.
-- =============================================================================
BEGIN;
ALTER TABLE gbp_clients ALTER COLUMN backlog_status SET DEFAULT 'PENDING';
COMMIT;
