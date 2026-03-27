
-- Add guest_ref to guests table
ALTER TABLE public.guests ADD COLUMN guest_ref TEXT UNIQUE;

-- Backfill existing guests with generated refs
UPDATE public.guests 
SET guest_ref = 'GR-' || TO_CHAR(created_at, 'YYMM') || '-' || UPPER(SUBSTR(id::text, 1, 4))
WHERE guest_ref IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE public.guests ALTER COLUMN guest_ref SET NOT NULL;

-- Add unit_status to units table
CREATE TYPE public.unit_status AS ENUM ('Available', 'Under Construction', 'Maintenance', 'Closed');

ALTER TABLE public.units ADD COLUMN unit_status public.unit_status NOT NULL DEFAULT 'Available';
