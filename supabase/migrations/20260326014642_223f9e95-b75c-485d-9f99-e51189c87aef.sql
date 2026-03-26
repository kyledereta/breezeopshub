
-- Deposit return status enum
CREATE TYPE public.deposit_status AS ENUM ('Pending', 'Returned', 'Deducted');

-- Add utensil rental and deposit status columns
ALTER TABLE public.bookings
  ADD COLUMN utensil_rental boolean NOT NULL DEFAULT false,
  ADD COLUMN deposit_status deposit_status NOT NULL DEFAULT 'Pending'::deposit_status;
