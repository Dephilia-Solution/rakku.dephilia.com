-- Durable provider inbox and job queue. Run inside the migration runner's
-- transaction after 0010.
CREATE TABLE app_private.provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  transaction_id text,
  invoice_number text,
  payload jsonb NOT NULL,
  signature_status text NOT NULL DEFAULT 'unverified'
    CHECK (signature_status IN ('valid','invalid','unverified')),
  correlation_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text
);
CREATE INDEX provider_events_received_idx
  ON app_private.provider_events(provider, received_at DESC);
CREATE INDEX provider_events_reference_idx
  ON app_private.provider_events(provider, transaction_id, invoice_number);
REVOKE ALL ON app_private.provider_events FROM PUBLIC;
ALTER TABLE app_private.provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.provider_events FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.provider_events
  FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));

CREATE TABLE app_private.job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  unique_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','leased','done','dead_letter')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  run_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  locked_by text,
  last_error text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  dead_lettered_at timestamptz,
  replayed_at timestamptz,
  replay_count integer NOT NULL DEFAULT 0 CHECK (replay_count >= 0),
  UNIQUE (kind, unique_key)
);
CREATE INDEX job_queue_due_idx
  ON app_private.job_queue(state, run_at, created_at, id);
CREATE INDEX job_queue_dead_letter_idx
  ON app_private.job_queue(dead_lettered_at DESC)
  WHERE state = 'dead_letter';
CREATE TRIGGER trg_job_queue_updated_at BEFORE UPDATE ON app_private.job_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
REVOKE ALL ON app_private.job_queue FROM PUBLIC;
ALTER TABLE app_private.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.job_queue FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_access ON app_private.job_queue
  FOR ALL USING ((SELECT app_private.platform())) WITH CHECK ((SELECT app_private.platform()));
