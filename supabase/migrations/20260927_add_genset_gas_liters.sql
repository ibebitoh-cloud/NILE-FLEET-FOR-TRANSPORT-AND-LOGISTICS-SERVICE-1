-- Track the current fuel amount for each genset.
-- Existing units start at 50 liters; new units default to 50 liters.
ALTER TABLE public.gensets
  ADD COLUMN IF NOT EXISTS gas_liters numeric NOT NULL DEFAULT 50;

UPDATE public.gensets
SET gas_liters = 50;
