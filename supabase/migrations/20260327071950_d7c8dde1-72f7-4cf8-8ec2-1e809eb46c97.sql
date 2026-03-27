ALTER TABLE public.units ADD COLUMN status_updated_at timestamptz DEFAULT now();

UPDATE public.units SET status_updated_at = now();