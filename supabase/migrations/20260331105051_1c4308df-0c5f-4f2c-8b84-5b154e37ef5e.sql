ALTER TABLE public.units ADD COLUMN last_deep_cleaned date DEFAULT NULL;
ALTER TABLE public.units ADD COLUMN damage_items jsonb NOT NULL DEFAULT '[]'::jsonb;