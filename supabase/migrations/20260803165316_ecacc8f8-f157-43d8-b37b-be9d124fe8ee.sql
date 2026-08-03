ALTER TABLE public.upi_transactions
  ADD COLUMN IF NOT EXISTS bank text,
  ADD COLUMN IF NOT EXISTS ref_id text,
  ADD COLUMN IF NOT EXISTS balance numeric,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS upi_transactions_user_dedupe_key_idx
  ON public.upi_transactions (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;