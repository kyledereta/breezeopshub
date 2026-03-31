ALTER TABLE public.bookings ADD COLUMN wristband_qty integer NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN wristband_returned_qty integer NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN wristband_collected boolean NOT NULL DEFAULT false;