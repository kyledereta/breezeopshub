ALTER TABLE public.bookings ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN deletion_reason text DEFAULT NULL;