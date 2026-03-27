ALTER TABLE public.bookings ADD COLUMN daytour_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN other_extras_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN other_extras_note text DEFAULT NULL;