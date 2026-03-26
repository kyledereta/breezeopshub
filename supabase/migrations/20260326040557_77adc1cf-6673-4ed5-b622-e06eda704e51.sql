
ALTER TABLE public.bookings 
  ADD COLUMN extra_pax_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN discount_type text NOT NULL DEFAULT 'fixed';
