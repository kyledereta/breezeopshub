
ALTER TABLE public.bookings 
  ADD COLUMN dp_mode_of_payment text DEFAULT NULL,
  ADD COLUMN remaining_mode_of_payment text DEFAULT NULL,
  ADD COLUMN remaining_paid boolean NOT NULL DEFAULT false;

-- Migrate existing mode_of_payment data to dp_mode_of_payment
UPDATE public.bookings SET dp_mode_of_payment = mode_of_payment WHERE mode_of_payment IS NOT NULL;
