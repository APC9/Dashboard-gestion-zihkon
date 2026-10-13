-- =============================================================================
-- Cobros con Stripe: planes (servicios sueltos y packs), una suscripción por
-- cliente, checkouts enviados, cobros (para la gestoría) y eventos recibidos.
-- Solo AÑADE tablas nuevas. Importes en céntimos y SIN IVA (se suma el 21 %).
-- Las facturas las emite la gestoría: Stripe solo cobra.
-- =============================================================================

BEGIN;

-- Lo que se vende. automation_keys = automatizaciones que activa al pagarse.
CREATE TABLE IF NOT EXISTS billing_plans (
  plan_key                TEXT        PRIMARY KEY,
  name                    TEXT        NOT NULL,
  kind                    TEXT        NOT NULL CHECK (kind IN ('service', 'pack')),
  automation_keys         TEXT[]      NOT NULL,
  setup_amount_cents      INTEGER     NOT NULL CHECK (setup_amount_cents >= 0),
  monthly_amount_cents    INTEGER     NOT NULL CHECK (monthly_amount_cents > 0),
  -- Pago anual opcional: 12 meses con un 15 % de descuento.
  yearly_amount_cents     INTEGER     CHECK (yearly_amount_cents > 0),
  currency                TEXT        NOT NULL DEFAULT 'eur',
  stripe_product_id       TEXT,
  stripe_setup_price_id   TEXT,
  stripe_monthly_price_id TEXT,
  stripe_yearly_price_id  TEXT,
  sort_order              INTEGER     NOT NULL DEFAULT 0,
  active                  BOOLEAN     NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una suscripción de Stripe por cliente (con uno o varios planes dentro).
CREATE TABLE IF NOT EXISTS client_billing (
  client_id              UUID        PRIMARY KEY REFERENCES clients (client_id) ON DELETE CASCADE,
  stripe_customer_id     TEXT        UNIQUE,
  stripe_subscription_id TEXT        UNIQUE,
  -- none | pending (SEPA en curso) | active | past_due | canceled
  status                 TEXT        NOT NULL DEFAULT 'none',
  billing_interval       TEXT        CHECK (billing_interval IN ('month', 'year')),
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN     NOT NULL DEFAULT false,
  -- Datos fiscales recogidos en el checkout (para la factura de la gestoría).
  billing_name           TEXT,
  billing_email          TEXT,
  tax_id                 TEXT,
  billing_address        JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Planes incluidos en la suscripción del cliente.
CREATE TABLE IF NOT EXISTS client_billing_items (
  client_id                   UUID        NOT NULL REFERENCES clients (client_id) ON DELETE CASCADE,
  plan_key                    TEXT        NOT NULL REFERENCES billing_plans (plan_key),
  stripe_subscription_item_id TEXT,
  -- pending | active | canceled
  status                      TEXT        NOT NULL DEFAULT 'pending',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, plan_key)
);

-- Enlaces de pago enviados (Stripe Checkout).
CREATE TABLE IF NOT EXISTS billing_checkouts (
  checkout_session_id TEXT        PRIMARY KEY,
  client_id           UUID        NOT NULL REFERENCES clients (client_id) ON DELETE CASCADE,
  plan_keys           TEXT[]      NOT NULL,
  billing_interval    TEXT        NOT NULL CHECK (billing_interval IN ('month', 'year')),
  -- open | processing (SEPA) | paid | failed | expired
  status              TEXT        NOT NULL DEFAULT 'open',
  url                 TEXT,
  stripe_subscription_id TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS billing_checkouts_client_idx ON billing_checkouts (client_id, created_at DESC);

-- Cobros recibidos: es lo que se exporta para la gestoría.
CREATE TABLE IF NOT EXISTS billing_payments (
  payment_id       BIGSERIAL   PRIMARY KEY,
  stripe_object_id TEXT        NOT NULL UNIQUE,  -- cs_… (alta) o in_… (cuotas)
  client_id        UUID        REFERENCES clients (client_id) ON DELETE SET NULL,
  concept          TEXT        NOT NULL,
  subtotal_cents   INTEGER     NOT NULL,
  tax_cents        INTEGER     NOT NULL,
  total_cents      INTEGER     NOT NULL,
  currency         TEXT        NOT NULL DEFAULT 'eur',
  payment_method   TEXT,                          -- card | sepa_debit
  status           TEXT        NOT NULL,          -- paid | failed
  billing_name     TEXT,
  tax_id           TEXT,
  billing_address  JSONB,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_payments_paid_idx ON billing_payments (paid_at);

-- Eventos de Stripe ya procesados (Stripe puede reenviar el mismo evento).
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id     TEXT        PRIMARY KEY,
  type         TEXT        NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error        TEXT
);

-- Precios del catálogo de servicios (sin IVA). Anual = 12 meses − 15 %.
INSERT INTO billing_plans (plan_key, name, kind, automation_keys, setup_amount_cents, monthly_amount_cents, yearly_amount_cents, sort_order) VALUES
  ('resenas_gbp',   'Respuesta a reseñas',          'service', ARRAY['resenas_gbp'],                                  19000,  6900,  70380, 10),
  ('web_whatsapp',  'Web editable por WhatsApp',    'service', ARRAY['web_whatsapp'],                                 49000,  6900,  70380, 20),
  ('publicaciones', 'Publicaciones multicanal',     'service', ARRAY['publicaciones'],                                25000, 16900, 172380, 30),
  ('pack_1',        'Pack 1 · Presencia Local',     'pack',    ARRAY['resenas_gbp', 'publicaciones_gbp'],             19000,  7900,  80580, 40),
  ('pack_2',        'Pack 2',                       'pack',    ARRAY['web_whatsapp', 'resenas_gbp'],                  59000, 12000, 122400, 50),
  ('pack_3',        'Pack 3',                       'pack',    ARRAY['web_whatsapp', 'resenas_gbp', 'publicaciones'], 79000, 24900, 253980, 60)
ON CONFLICT (plan_key) DO NOTHING;

COMMIT;
