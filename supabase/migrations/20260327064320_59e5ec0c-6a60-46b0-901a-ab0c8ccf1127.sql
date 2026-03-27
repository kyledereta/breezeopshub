ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deposit_deducted_reason text DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS kitchen_use boolean NOT NULL DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS kitchen_use_fee numeric NOT NULL DEFAULT 0;