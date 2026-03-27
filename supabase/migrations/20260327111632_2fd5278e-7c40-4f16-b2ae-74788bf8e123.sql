
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'Unpaid Extras';
ALTER TABLE public.bookings ADD COLUMN extras_paid_status jsonb NOT NULL DEFAULT '{}'::jsonb;
