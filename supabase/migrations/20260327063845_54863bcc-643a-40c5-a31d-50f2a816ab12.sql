ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS karaoke boolean NOT NULL DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS karaoke_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pet_fee numeric NOT NULL DEFAULT 0;