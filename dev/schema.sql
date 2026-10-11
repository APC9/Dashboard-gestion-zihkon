-- =============================================================================
-- SOLO PARA DESARROLLO LOCAL.
-- Réplica aproximada de la estructura de producción para poder ejecutar el panel
-- sin tocar la base de datos real. NUNCA ejecutar contra producción.
-- Se carga automáticamente con: docker compose -f docker-compose.dev.yml up -d
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS clients (
  client_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT,
  whatsapp_e164 TEXT,
  drive_folder_id TEXT,
  google_sheet_id TEXT,
  timezone TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  google_sheet_tab TEXT
);

CREATE TABLE IF NOT EXISTS client_websites (
  website_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(client_id),
  github_owner TEXT,
  github_repository TEXT,
  default_branch TEXT,
  netlify_site_id TEXT,
  website_url TEXT,
  preview_mode_enabled BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_intakes (
  intake_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(client_id),
  source_message_id TEXT,
  description TEXT,
  status TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP,
  expected_count INTEGER
);

CREATE TABLE IF NOT EXISTS content_media (
  media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id UUID REFERENCES content_intakes(intake_id),
  provider_message_id TEXT,
  media_type TEXT,
  mime_type TEXT,
  original_file_name TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  position INTEGER,
  created_at TIMESTAMP DEFAULT now(),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS content_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT,
  remote_jid TEXT,
  client_id UUID REFERENCES clients(client_id),
  content_intake_id UUID REFERENCES content_intakes(intake_id),
  start_message_id TEXT,
  status TEXT,
  media_type TEXT,
  media_count INTEGER,
  description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP,
  ready_message_id TEXT,
  description_message_id TEXT
);

CREATE TABLE IF NOT EXISTS content_session_media (
  session_media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES content_sessions(session_id),
  instance_id TEXT,
  message_id TEXT,
  media_type TEXT,
  mime_type TEXT,
  filename TEXT,
  media_reference TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  caption TEXT,
  message_timestamp TIMESTAMP,
  position INTEGER,
  file_size BIGINT,
  status TEXT,
  created_at TIMESTAMP DEFAULT now(),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS processed_messages (
  provider_message_id TEXT PRIMARY KEY,
  client_id UUID REFERENCES clients(client_id),
  status TEXT,
  received_at TIMESTAMP DEFAULT now(),
  error TEXT
);

CREATE TABLE IF NOT EXISTS gbp_clients (
  id SERIAL PRIMARY KEY,
  business_name TEXT,
  location_id TEXT,
  account_id TEXT,
  business_type TEXT,
  active BOOLEAN DEFAULT true,
  response_tone TEXT,
  preferred_language TEXT,
  response_mode TEXT,
  custom_ai_instructions TEXT,
  notification_email TEXT,
  telegram_chat_id TEXT,
  whatsapp_e164 TEXT,
  delay_minutes INTEGER,
  contact_email TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gbp_review_activity (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES gbp_clients(id),
  review_id TEXT,
  reviewer_name TEXT,
  rating TEXT,
  review_text TEXT,
  review_date TIMESTAMP,
  existing_response TEXT,
  generated_response TEXT,
  status TEXT,
  scheduled_publish_date TIMESTAMP,
  created_date TIMESTAMP DEFAULT now(),
  approved_date TIMESTAMP,
  published_date TIMESTAMP,
  error_details TEXT
);

CREATE TABLE IF NOT EXISTS gbp_automation_errors (
  id SERIAL PRIMARY KEY,
  stage TEXT,
  client_id INTEGER,
  review_db_id INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditorias_locales (
  id BIGSERIAL PRIMARY KEY,
  email_normalizado TEXT,
  negocio_clave TEXT,
  email TEXT,
  nombre_negocio TEXT,
  direccion TEXT,
  google_places JSONB,
  informe JSONB,
  pdf_url TEXT,
  drive_file_id TEXT,
  cloudinary_public_id TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_admins (
  phone_e164 TEXT PRIMARY KEY,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Automatizaciones contratadas por cliente (ver prisma/proposed-migrations/004_client_automations.sql)
CREATE TABLE IF NOT EXISTS automation_catalog (
  automation_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_automations (
  client_id UUID NOT NULL REFERENCES clients (client_id) ON DELETE CASCADE,
  automation_key TEXT NOT NULL REFERENCES automation_catalog (automation_key) ON UPDATE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, automation_key)
);

INSERT INTO automation_catalog (automation_key, name, description, sort_order) VALUES
  ('web_whatsapp', 'Edición de la web por WhatsApp', 'El cliente pide cambios en su web escribiendo "WEB" por WhatsApp.', 10),
  ('publicaciones', 'Publicaciones en redes y Google', 'El cliente envía fotos o vídeos por WhatsApp y se generan y programan sus publicaciones.', 20),
  ('resenas_gbp', 'Respuesta automática a reseñas', 'Se generan y publican respuestas a las reseñas de su ficha de Google.', 30)
ON CONFLICT (automation_key) DO NOTHING;
