ALTER TABLE public.bookings ADD COLUMN deposit_deducted_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN utensil_rental_fee numeric NOT NULL DEFAULT 0;