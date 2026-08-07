UPDATE public.upi_transactions
SET dedupe_key = 'legacy|' || id::text
WHERE dedupe_key IS NULL;

ALTER TABLE public.upi_transactions
  ALTER COLUMN dedupe_key SET NOT NULL;

DROP INDEX IF EXISTS public.upi_transactions_user_dedupe_key_idx;

CREATE UNIQUE INDEX upi_transactions_user_dedupe_key_idx
  ON public.upi_transactions (user_id, dedupe_key);