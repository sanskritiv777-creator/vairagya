
CREATE TYPE public.upi_category AS ENUM ('client_payment','personal','business_expense','refund','other');

CREATE TABLE public.upi_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  counterparty TEXT NOT NULL,
  upi_id TEXT,
  note TEXT,
  category public.upi_category NOT NULL DEFAULT 'other',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.upi_transactions TO authenticated;
GRANT ALL ON public.upi_transactions TO service_role;

ALTER TABLE public.upi_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own upi txns" ON public.upi_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX upi_txns_user_time_idx ON public.upi_transactions (user_id, occurred_at DESC);
