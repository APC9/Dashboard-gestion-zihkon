--
-- PostgreSQL database dump
--

\restrict jUljKWtEGEBtxyH9Jzh8SIGGvccUQ0Mf7S4NsMyGtGBu7dJ1VJz4Ahx4ygYbhkb

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditorias_locales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditorias_locales (
    id bigint NOT NULL,
    email_normalizado text NOT NULL,
    negocio_clave text NOT NULL,
    email text NOT NULL,
    nombre_negocio text NOT NULL,
    direccion text NOT NULL,
    google_places jsonb NOT NULL,
    informe jsonb NOT NULL,
    pdf_url text NOT NULL,
    drive_file_id text,
    cloudinary_public_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auditorias_locales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditorias_locales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditorias_locales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditorias_locales_id_seq OWNED BY public.auditorias_locales.id;


--
-- Name: automation_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_admins (
    phone_e164 text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT automation_admins_phone_e164_check CHECK ((phone_e164 ~ '^[+][1-9][0-9]{7,14}$'::text))
);


--
-- Name: automation_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_catalog (
    automation_key text NOT NULL,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    usage_instructions text
);


--
-- Name: client_automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_automations (
    client_id uuid NOT NULL,
    automation_key text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trial_started_at timestamp with time zone,
    trial_ends_at timestamp with time zone,
    trial_posts_limit integer DEFAULT 4 NOT NULL,
    trial_posts_used integer DEFAULT 0 NOT NULL,
    trial_reminder_sent_at timestamp with time zone,
    trial_finished_at timestamp with time zone,
    CONSTRAINT client_automations_trial_check CHECK (((trial_posts_limit > 0) AND (trial_posts_used >= 0) AND ((trial_started_at IS NULL) OR ((trial_ends_at IS NOT NULL) AND (trial_ends_at > trial_started_at)))))
);


--
-- Name: client_websites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_websites (
    website_id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    github_owner text,
    github_repository text,
    default_branch text DEFAULT 'main'::text NOT NULL,
    netlify_site_id text,
    website_url text,
    preview_mode_enabled boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    client_id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_name text,
    whatsapp_e164 text NOT NULL,
    drive_folder_id text NOT NULL,
    google_sheet_id text NOT NULL,
    timezone text DEFAULT 'Europe/Madrid'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    google_sheet_tab text DEFAULT 'Mtr_plantilla_calendario'::text NOT NULL,
    CONSTRAINT clients_whatsapp_e164_check CHECK ((whatsapp_e164 ~ '^[+][1-9][0-9]{7,14}$'::text))
);


--
-- Name: content_intakes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_intakes (
    intake_id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    source_message_id text NOT NULL,
    description text,
    status text DEFAULT 'ready'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    expected_count integer DEFAULT 1 NOT NULL,
    CONSTRAINT content_intakes_status_check CHECK ((status = ANY (ARRAY['awaiting_description'::text, 'ready'::text, 'processing'::text, 'processed'::text, 'failed'::text])))
);


--
-- Name: content_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_media (
    media_id uuid DEFAULT gen_random_uuid() NOT NULL,
    intake_id uuid NOT NULL,
    provider_message_id text NOT NULL,
    media_type text NOT NULL,
    mime_type text,
    original_file_name text,
    drive_file_id text,
    drive_url text,
    "position" integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT content_media_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'audio'::text, 'document'::text])))
);


--
-- Name: content_session_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_session_media (
    session_media_id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    instance_id text NOT NULL,
    message_id text NOT NULL,
    media_type text NOT NULL,
    mime_type text NOT NULL,
    filename text,
    media_reference text,
    drive_file_id text,
    drive_url text,
    caption text,
    message_timestamp timestamp with time zone,
    "position" integer NOT NULL,
    file_size bigint,
    status text DEFAULT 'RECEIVED'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT content_session_media_file_size_check CHECK (((file_size IS NULL) OR (file_size >= 0))),
    CONSTRAINT content_session_media_media_type_check CHECK ((media_type = ANY (ARRAY['IMAGE'::text, 'VIDEO'::text]))),
    CONSTRAINT content_session_media_position_check CHECK ((("position" >= 1) AND ("position" <= 8))),
    CONSTRAINT content_session_media_status_check CHECK ((status = ANY (ARRAY['RECEIVED'::text, 'STORED'::text, 'FAILED'::text])))
);


--
-- Name: content_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_sessions (
    session_id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id text NOT NULL,
    remote_jid text NOT NULL,
    client_id uuid NOT NULL,
    content_intake_id uuid NOT NULL,
    start_message_id text NOT NULL,
    status text DEFAULT 'WAITING_MEDIA'::text NOT NULL,
    media_type text,
    media_count integer DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    ready_message_id text,
    description_message_id text,
    CONSTRAINT content_sessions_media_count_check CHECK ((media_count >= 0)),
    CONSTRAINT content_sessions_media_type_check CHECK (((media_type IS NULL) OR (media_type = ANY (ARRAY['IMAGE'::text, 'VIDEO'::text])))),
    CONSTRAINT content_sessions_status_check CHECK ((status = ANY (ARRAY['WAITING_MEDIA'::text, 'WAITING_DESCRIPTION'::text, 'WAITING_CONFIRMATION'::text, 'PROCESSING'::text, 'COMPLETED'::text, 'CANCELLED'::text, 'EXPIRED'::text])))
);


--
-- Name: gbp_automation_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gbp_automation_errors (
    id integer NOT NULL,
    stage text NOT NULL,
    review_db_id integer,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    client_id uuid
);


--
-- Name: gbp_automation_errors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gbp_automation_errors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gbp_automation_errors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gbp_automation_errors_id_seq OWNED BY public.gbp_automation_errors.id;


--
-- Name: gbp_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gbp_clients (
    location_id text NOT NULL,
    account_id text NOT NULL,
    business_type text,
    active boolean DEFAULT true NOT NULL,
    response_tone text,
    preferred_language text,
    response_mode text DEFAULT 'manual'::text NOT NULL,
    custom_ai_instructions text,
    telegram_chat_id text,
    delay_minutes integer DEFAULT 15 NOT NULL,
    contact_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    backlog_status text DEFAULT 'PENDING'::text NOT NULL,
    daily_reply_limit integer DEFAULT 50 NOT NULL,
    reviews_manage_url text,
    last_synced_at timestamp with time zone,
    backlog_imported_at timestamp with time zone,
    backlog_finished_at timestamp with time zone,
    is_test boolean DEFAULT false NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    CONSTRAINT gbp_clients_backlog_status_check CHECK ((backlog_status = ANY (ARRAY['PENDING'::text, 'IN_PROGRESS'::text, 'LIVE'::text]))),
    CONSTRAINT gbp_clients_response_mode_check CHECK ((response_mode = ANY (ARRAY['automatic'::text, 'manual'::text])))
);


--
-- Name: COLUMN gbp_clients.client_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gbp_clients.client_id IS 'Cliente de Zihkon (clients.client_id): nombre y WhatsApp salen de ahí';


--
-- Name: gbp_review_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gbp_review_activity (
    id integer NOT NULL,
    review_id text NOT NULL,
    reviewer_name text,
    rating text,
    review_text text,
    review_date timestamp with time zone,
    existing_response text,
    generated_response text,
    status text DEFAULT 'new'::text NOT NULL,
    scheduled_publish_date timestamp with time zone,
    created_date timestamp with time zone DEFAULT now() NOT NULL,
    approved_date timestamp with time zone,
    published_date timestamp with time zone,
    error_details text,
    review_name text,
    star_rating integer,
    source text DEFAULT 'live'::text NOT NULL,
    approval_token text,
    approval_sent_at timestamp with time zone,
    decision text,
    decision_at timestamp with time zone,
    owner_notified_at timestamp with time zone,
    processed_at timestamp with time zone,
    client_id uuid NOT NULL,
    last_reminder_at timestamp with time zone,
    reminder_count integer DEFAULT 0 NOT NULL
);


--
-- Name: gbp_review_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gbp_review_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gbp_review_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gbp_review_activity_id_seq OWNED BY public.gbp_review_activity.id;


--
-- Name: gbp_test_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gbp_test_reviews (
    review_id text NOT NULL,
    location_id text NOT NULL,
    account_id text DEFAULT 'TEST'::text NOT NULL,
    reviewer_name text,
    star_rating text NOT NULL,
    comment text,
    create_time timestamp with time zone DEFAULT now() NOT NULL,
    reply_comment text,
    reply_time timestamp with time zone,
    CONSTRAINT gbp_test_reviews_star_rating_check CHECK ((star_rating = ANY (ARRAY['ONE'::text, 'TWO'::text, 'THREE'::text, 'FOUR'::text, 'FIVE'::text])))
);


--
-- Name: processed_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_messages (
    provider_message_id text NOT NULL,
    client_id uuid,
    status text DEFAULT 'received'::text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    error text
);


--
-- Name: publication_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publication_requests (
    client_id uuid NOT NULL,
    action text NOT NULL,
    target_date date NOT NULL,
    new_date date,
    payload jsonb,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT publication_requests_action_check CHECK ((action = ANY (ARRAY['DELETE'::text, 'MOVE'::text, 'EDIT'::text])))
);


--
-- Name: website_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    provider_message_id text,
    phone_e164 text NOT NULL,
    instruction text NOT NULL,
    repository text NOT NULL,
    branch text DEFAULT 'main'::text NOT NULL,
    commit_sha text,
    commit_message text,
    changed_files jsonb DEFAULT '[]'::jsonb,
    status text NOT NULL,
    rejection_reason text,
    deployment_status text,
    netlify_site_id text,
    deploy_id text,
    deploy_url text,
    execution_time_ms integer,
    change_summary text,
    error_detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_sessions (
    client_id uuid NOT NULL,
    state text NOT NULL,
    instruction text,
    analysis jsonb,
    expires_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT whatsapp_sessions_state_check CHECK ((state = ANY (ARRAY['awaiting_request'::text, 'awaiting_confirmation'::text, 'awaiting_menu_media'::text, 'awaiting_menu_confirmation'::text, 'awaiting_suggestion_media'::text, 'awaiting_suggestion_confirmation'::text])))
);


--
-- Name: TABLE whatsapp_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.whatsapp_sessions IS 'Conversación activa por WhatsApp (comando WEB -> petición -> confirmación). Una fila por cliente; caduca en expires_at.';


--
-- Name: auditorias_locales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_locales ALTER COLUMN id SET DEFAULT nextval('public.auditorias_locales_id_seq'::regclass);


--
-- Name: gbp_automation_errors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_automation_errors ALTER COLUMN id SET DEFAULT nextval('public.gbp_automation_errors_id_seq'::regclass);


--
-- Name: gbp_review_activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_review_activity ALTER COLUMN id SET DEFAULT nextval('public.gbp_review_activity_id_seq'::regclass);


--
-- Name: auditorias_locales auditorias_locales_email_normalizado_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_locales
    ADD CONSTRAINT auditorias_locales_email_normalizado_key UNIQUE (email_normalizado);


--
-- Name: auditorias_locales auditorias_locales_negocio_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_locales
    ADD CONSTRAINT auditorias_locales_negocio_clave_key UNIQUE (negocio_clave);


--
-- Name: auditorias_locales auditorias_locales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditorias_locales
    ADD CONSTRAINT auditorias_locales_pkey PRIMARY KEY (id);


--
-- Name: automation_admins automation_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_admins
    ADD CONSTRAINT automation_admins_pkey PRIMARY KEY (phone_e164);


--
-- Name: automation_catalog automation_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_catalog
    ADD CONSTRAINT automation_catalog_pkey PRIMARY KEY (automation_key);


--
-- Name: client_automations client_automations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_automations
    ADD CONSTRAINT client_automations_pkey PRIMARY KEY (client_id, automation_key);


--
-- Name: client_websites client_websites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_websites
    ADD CONSTRAINT client_websites_pkey PRIMARY KEY (website_id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (client_id);


--
-- Name: clients clients_whatsapp_e164_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_whatsapp_e164_key UNIQUE (whatsapp_e164);


--
-- Name: content_intakes content_intakes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_intakes
    ADD CONSTRAINT content_intakes_pkey PRIMARY KEY (intake_id);


--
-- Name: content_intakes content_intakes_source_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_intakes
    ADD CONSTRAINT content_intakes_source_message_id_key UNIQUE (source_message_id);


--
-- Name: content_media content_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_media
    ADD CONSTRAINT content_media_pkey PRIMARY KEY (media_id);


--
-- Name: content_media content_media_provider_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_media
    ADD CONSTRAINT content_media_provider_message_id_key UNIQUE (provider_message_id);


--
-- Name: content_session_media content_session_media_instance_id_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_session_media
    ADD CONSTRAINT content_session_media_instance_id_message_id_key UNIQUE (instance_id, message_id);


--
-- Name: content_session_media content_session_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_session_media
    ADD CONSTRAINT content_session_media_pkey PRIMARY KEY (session_media_id);


--
-- Name: content_session_media content_session_media_session_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_session_media
    ADD CONSTRAINT content_session_media_session_id_position_key UNIQUE (session_id, "position");


--
-- Name: content_sessions content_sessions_content_intake_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_sessions
    ADD CONSTRAINT content_sessions_content_intake_id_key UNIQUE (content_intake_id);


--
-- Name: content_sessions content_sessions_instance_id_start_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_sessions
    ADD CONSTRAINT content_sessions_instance_id_start_message_id_key UNIQUE (instance_id, start_message_id);


--
-- Name: content_sessions content_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_sessions
    ADD CONSTRAINT content_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: gbp_automation_errors gbp_automation_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_automation_errors
    ADD CONSTRAINT gbp_automation_errors_pkey PRIMARY KEY (id);


--
-- Name: gbp_clients gbp_clients_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_clients
    ADD CONSTRAINT gbp_clients_location_id_key UNIQUE (location_id);


--
-- Name: gbp_clients gbp_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_clients
    ADD CONSTRAINT gbp_clients_pkey PRIMARY KEY (id);


--
-- Name: gbp_review_activity gbp_review_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_review_activity
    ADD CONSTRAINT gbp_review_activity_pkey PRIMARY KEY (id);


--
-- Name: gbp_review_activity gbp_review_activity_review_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_review_activity
    ADD CONSTRAINT gbp_review_activity_review_id_key UNIQUE (review_id);


--
-- Name: gbp_test_reviews gbp_test_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_test_reviews
    ADD CONSTRAINT gbp_test_reviews_pkey PRIMARY KEY (review_id);


--
-- Name: processed_messages processed_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_messages
    ADD CONSTRAINT processed_messages_pkey PRIMARY KEY (provider_message_id);


--
-- Name: publication_requests publication_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publication_requests
    ADD CONSTRAINT publication_requests_pkey PRIMARY KEY (client_id);


--
-- Name: website_changes website_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_changes
    ADD CONSTRAINT website_changes_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_sessions whatsapp_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_sessions
    ADD CONSTRAINT whatsapp_sessions_pkey PRIMARY KEY (client_id);


--
-- Name: client_automations_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_automations_key_idx ON public.client_automations USING btree (automation_key) WHERE enabled;


--
-- Name: client_automations_one_trial_per_client; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX client_automations_one_trial_per_client ON public.client_automations USING btree (client_id) WHERE (trial_started_at IS NOT NULL);


--
-- Name: client_automations_trial_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_automations_trial_open_idx ON public.client_automations USING btree (trial_ends_at) WHERE ((trial_started_at IS NOT NULL) AND (trial_finished_at IS NULL));


--
-- Name: gbp_review_activity_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gbp_review_activity_pending_idx ON public.gbp_review_activity USING btree (client_id, approval_sent_at) WHERE (status = 'PENDING_APPROVAL'::text);


--
-- Name: idx_client_websites_github_repo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_client_websites_github_repo ON public.client_websites USING btree (github_owner, github_repository);


--
-- Name: idx_content_intakes_one_pending_per_client; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_content_intakes_one_pending_per_client ON public.content_intakes USING btree (client_id) WHERE (status = 'awaiting_description'::text);


--
-- Name: idx_content_media_intake_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_media_intake_position ON public.content_media USING btree (intake_id, "position");


--
-- Name: idx_content_session_media_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_session_media_message ON public.content_session_media USING btree (instance_id, message_id);


--
-- Name: idx_content_session_media_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_session_media_session ON public.content_session_media USING btree (session_id, "position");


--
-- Name: idx_content_sessions_client_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_sessions_client_status ON public.content_sessions USING btree (client_id, status, updated_at DESC);


--
-- Name: idx_content_sessions_description_message; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_content_sessions_description_message ON public.content_sessions USING btree (instance_id, description_message_id) WHERE (description_message_id IS NOT NULL);


--
-- Name: idx_content_sessions_expiration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_sessions_expiration ON public.content_sessions USING btree (expires_at) WHERE (status = ANY (ARRAY['WAITING_MEDIA'::text, 'WAITING_DESCRIPTION'::text, 'WAITING_CONFIRMATION'::text]));


--
-- Name: idx_content_sessions_one_active_per_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_content_sessions_one_active_per_chat ON public.content_sessions USING btree (instance_id, remote_jid) WHERE (status = ANY (ARRAY['WAITING_MEDIA'::text, 'WAITING_DESCRIPTION'::text, 'WAITING_CONFIRMATION'::text, 'PROCESSING'::text]));


--
-- Name: idx_content_sessions_one_active_per_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_content_sessions_one_active_per_contact ON public.content_sessions USING btree (instance_id, remote_jid) WHERE (status = ANY (ARRAY['WAITING_MEDIA'::text, 'WAITING_DESCRIPTION'::text, 'WAITING_CONFIRMATION'::text, 'PROCESSING'::text]));


--
-- Name: idx_content_sessions_ready_message; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_content_sessions_ready_message ON public.content_sessions USING btree (instance_id, ready_message_id) WHERE (ready_message_id IS NOT NULL);


--
-- Name: idx_content_sessions_status_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_sessions_status_expiry ON public.content_sessions USING btree (status, expires_at);


--
-- Name: idx_gbp_clients_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gbp_clients_client_id ON public.gbp_clients USING btree (client_id);


--
-- Name: idx_gbp_review_approval_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_gbp_review_approval_token ON public.gbp_review_activity USING btree (approval_token) WHERE (approval_token IS NOT NULL);


--
-- Name: idx_gbp_review_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gbp_review_client ON public.gbp_review_activity USING btree (client_id);


--
-- Name: idx_gbp_review_client_status_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gbp_review_client_status_source ON public.gbp_review_activity USING btree (client_id, status, source);


--
-- Name: idx_gbp_review_published_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gbp_review_published_date ON public.gbp_review_activity USING btree (client_id, published_date);


--
-- Name: idx_gbp_review_status_sched; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gbp_review_status_sched ON public.gbp_review_activity USING btree (status, scheduled_publish_date);


--
-- Name: idx_gbp_test_reviews_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gbp_test_reviews_location ON public.gbp_test_reviews USING btree (location_id);


--
-- Name: idx_processed_messages_client_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_messages_client_received ON public.processed_messages USING btree (client_id, received_at DESC);


--
-- Name: idx_website_changes_client_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_changes_client_created ON public.website_changes USING btree (client_id, created_at DESC);


--
-- Name: idx_website_changes_commit_sha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_changes_commit_sha ON public.website_changes USING btree (commit_sha);


--
-- Name: idx_website_changes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_changes_status ON public.website_changes USING btree (status);


--
-- Name: client_automations client_automations_automation_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_automations
    ADD CONSTRAINT client_automations_automation_key_fkey FOREIGN KEY (automation_key) REFERENCES public.automation_catalog(automation_key) ON UPDATE CASCADE;


--
-- Name: client_automations client_automations_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_automations
    ADD CONSTRAINT client_automations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE CASCADE;


--
-- Name: client_websites client_websites_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_websites
    ADD CONSTRAINT client_websites_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE CASCADE;


--
-- Name: content_intakes content_intakes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_intakes
    ADD CONSTRAINT content_intakes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE CASCADE;


--
-- Name: content_media content_media_intake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_media
    ADD CONSTRAINT content_media_intake_id_fkey FOREIGN KEY (intake_id) REFERENCES public.content_intakes(intake_id) ON DELETE CASCADE;


--
-- Name: content_session_media content_session_media_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_session_media
    ADD CONSTRAINT content_session_media_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.content_sessions(session_id) ON DELETE CASCADE;


--
-- Name: content_sessions content_sessions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_sessions
    ADD CONSTRAINT content_sessions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE CASCADE;


--
-- Name: content_sessions content_sessions_content_intake_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_sessions
    ADD CONSTRAINT content_sessions_content_intake_id_fkey FOREIGN KEY (content_intake_id) REFERENCES public.content_intakes(intake_id) ON DELETE CASCADE;


--
-- Name: gbp_automation_errors gbp_automation_errors_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_automation_errors
    ADD CONSTRAINT gbp_automation_errors_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.gbp_clients(id);


--
-- Name: gbp_automation_errors gbp_automation_errors_review_db_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_automation_errors
    ADD CONSTRAINT gbp_automation_errors_review_db_id_fkey FOREIGN KEY (review_db_id) REFERENCES public.gbp_review_activity(id);


--
-- Name: gbp_clients gbp_clients_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_clients
    ADD CONSTRAINT gbp_clients_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE RESTRICT;


--
-- Name: gbp_review_activity gbp_review_activity_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gbp_review_activity
    ADD CONSTRAINT gbp_review_activity_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.gbp_clients(id);


--
-- Name: processed_messages processed_messages_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_messages
    ADD CONSTRAINT processed_messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE SET NULL;


--
-- Name: publication_requests publication_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publication_requests
    ADD CONSTRAINT publication_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE CASCADE;


--
-- Name: website_changes website_changes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_changes
    ADD CONSTRAINT website_changes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE RESTRICT;


--
-- Name: website_changes website_changes_provider_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_changes
    ADD CONSTRAINT website_changes_provider_message_id_fkey FOREIGN KEY (provider_message_id) REFERENCES public.processed_messages(provider_message_id) ON DELETE SET NULL;


--
-- Name: whatsapp_sessions whatsapp_sessions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_sessions
    ADD CONSTRAINT whatsapp_sessions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict jUljKWtEGEBtxyH9Jzh8SIGGvccUQ0Mf7S4NsMyGtGBu7dJ1VJz4Ahx4ygYbhkb

