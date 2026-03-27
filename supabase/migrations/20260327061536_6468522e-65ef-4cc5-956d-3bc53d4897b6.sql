
ALTER TYPE public.deposit_status ADD VALUE IF NOT EXISTS 'Collected';

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS security_deposit numeric NOT NULL DEFAULT 0;
