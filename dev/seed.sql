-- SOLO DESARROLLO: datos ficticios para probar el panel localmente.

INSERT INTO clients (client_id, client_name, whatsapp_e164, drive_folder_id, google_sheet_id, google_sheet_tab, timezone, active, created_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Café Aurora', '+34600111222', 'drive-folder-aurora', 'sheet-aurora', 'Contenido', 'Europe/Madrid', true, now() - interval '150 days'),
  ('22222222-2222-4222-8222-222222222222', 'Clínica Dental Sonrisa', '+34600333444', 'drive-folder-sonrisa', NULL, NULL, 'Europe/Madrid', true, now() - interval '70 days'),
  ('33333333-3333-4333-8333-333333333333', 'Taller Mecánico Ruiz', '+34600555666', NULL, NULL, NULL, 'Atlantic/Canary', false, now() - interval '20 days');

INSERT INTO client_websites (client_id, github_owner, github_repository, default_branch, netlify_site_id, website_url, preview_mode_enabled, active) VALUES
  ('11111111-1111-4111-8111-111111111111', 'zihkon', 'cafe-aurora-web', 'main', 'netlify-aurora', 'https://cafe-aurora.example.com', true, true),
  ('22222222-2222-4222-8222-222222222222', 'zihkon', 'clinica-sonrisa-web', 'main', 'netlify-sonrisa', 'https://clinica-sonrisa.example.com', false, true);

INSERT INTO content_intakes (intake_id, client_id, source_message_id, description, status, expected_count, created_at) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'MSG-1', 'Nuevo menú de otoño con tarta de calabaza', 'READY', 3, now() - interval '2 days'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'MSG-2', 'Fotos de la nueva sala de espera', 'COMPLETED', 2, now() - interval '9 days');

INSERT INTO content_media (intake_id, provider_message_id, media_type, mime_type, original_file_name, drive_file_id, drive_url, position, metadata) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'MSG-1a', 'image', 'image/jpeg', 'tarta.jpg', NULL, NULL, 1, '{"width":1080,"height":1350}'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'MSG-1b', 'image', 'image/jpeg', 'cafe.jpg', NULL, NULL, 2, '{}'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'MSG-2a', 'image', 'image/png', 'sala.png', NULL, NULL, 1, NULL);

INSERT INTO content_sessions (instance_id, remote_jid, client_id, content_intake_id, status, media_type, media_count, description, created_at) VALUES
  ('zihkon', '34600111222@s.whatsapp.net', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'COLLECTING', 'image', 2, 'Nuevo menú', now() - interval '1 hour');

INSERT INTO processed_messages (provider_message_id, client_id, status, received_at, error) VALUES
  ('MSG-1', '11111111-1111-4111-8111-111111111111', 'processed', now() - interval '2 days', NULL),
  ('MSG-2', '22222222-2222-4222-8222-222222222222', 'processed', now() - interval '9 days', NULL),
  ('MSG-3', '11111111-1111-4111-8111-111111111111', 'error', now() - interval '3 hours', 'Drive upload timeout');

INSERT INTO gbp_clients (business_name, location_id, account_id, business_type, active, response_tone, preferred_language, response_mode, notification_email, whatsapp_e164, delay_minutes, contact_email) VALUES
  ('Café Aurora', 'locations/111', 'accounts/1', 'Cafetería', true, 'cercano', 'es', 'APPROVAL', 'hola@cafe-aurora.example.com', '+34600111222', 30, 'hola@cafe-aurora.example.com'),
  ('Clínica Dental Sonrisa', 'locations/222', 'accounts/1', 'Clínica dental', true, 'profesional', 'es', 'AUTO', 'info@sonrisa.example.com', NULL, 60, 'info@sonrisa.example.com');

INSERT INTO gbp_review_activity (client_id, review_id, reviewer_name, rating, review_text, review_date, generated_response, status, created_date) VALUES
  (1, 'rev-001', 'Laura G.', 'FIVE', '¡El mejor café del barrio! La tarta de zanahoria espectacular.', now() - interval '1 day', '¡Muchas gracias, Laura! Nos alegra muchísimo que disfrutaras de la tarta. ¡Te esperamos pronto!', 'PENDING_APPROVAL', now() - interval '1 day'),
  (1, 'rev-002', 'Pedro M.', 'TWO', 'Tardaron mucho en servir.', now() - interval '3 days', 'Hola Pedro, sentimos la espera. Estamos reforzando el equipo en horas punta.', 'DRAFT', now() - interval '3 days'),
  (2, 'rev-003', 'Ana R.', '5', 'Trato excelente.', now() - interval '6 days', 'Gracias Ana, ¡un placer atenderte!', 'PUBLISHED', now() - interval '6 days'),
  (2, 'rev-004', 'Jorge S.', 'FOUR', NULL, now() - interval '12 hours', NULL, 'NEW', now() - interval '12 hours');

INSERT INTO gbp_automation_errors (stage, client_id, review_db_id, error_message, created_at) VALUES
  ('publish', 2, 3, 'Google API 429: quota exceeded (reintentado)', now() - interval '5 days');

INSERT INTO auditorias_locales (email_normalizado, negocio_clave, email, nombre_negocio, direccion, google_places, informe, pdf_url) VALUES
  ('dueno@restaurante-x.example.com', 'restaurante-x', 'Dueno@restaurante-x.example.com', 'Restaurante X', 'Calle Mayor 1, Madrid',
   '{"rating":4.3,"user_ratings_total":212,"formatted_phone_number":"910 000 000","website":"https://restaurante-x.example.com","types":["restaurant","food"],"opening_hours":{"open_now":true}}',
   '{"puntuacion_global":72,"resumen":"Buena reputación, pero la ficha está incompleta.","secciones":[{"titulo":"Ficha de Google","puntuacion":65,"hallazgos":["Faltan fotos recientes","Horario sin actualizar"],"recomendaciones":["Subir 10 fotos nuevas","Actualizar horario de verano"]},{"titulo":"Reseñas","puntuacion":80,"hallazgos":["Responde al 40% de las reseñas"],"recomendaciones":["Responder a todas las reseñas en <48h"]}]}',
   'https://example.com/auditoria-restaurante-x.pdf');

INSERT INTO automation_admins (phone_e164, active) VALUES ('+34600999000', true);
