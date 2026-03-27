ALTER TABLE public.bookings ADD COLUMN booking_group_id uuid DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN is_primary boolean NOT NULL DEFAULT true;