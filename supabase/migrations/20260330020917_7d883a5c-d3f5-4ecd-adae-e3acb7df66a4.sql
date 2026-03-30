ALTER TABLE public.bookings ADD COLUMN early_checkin boolean NOT NULL DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN early_checkin_fee numeric NOT NULL DEFAULT 0;