CREATE TABLE public.aa_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_consent_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','revoked','expired','rejected','error')),
  redirect_url text,
  accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_consent_id)
);
GRANT SELECT ON public.aa_consents TO authenticated;
GRANT ALL ON public.aa_consents TO service_role;
ALTER TABLE public.aa_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own aa consents read" ON public.aa_consents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX aa_consents_user_idx ON public.aa_consents (user_id, created_at DESC);

ALTER TABLE public.upi_transactions ADD COLUMN IF NOT EXISTS account_ref text;
ALTER TABLE public.upi_transactions ADD COLUMN IF NOT EXISTS provider_txn_id text;