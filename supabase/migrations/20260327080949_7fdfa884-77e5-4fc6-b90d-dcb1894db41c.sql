ALTER TABLE public.bookings 
ADD COLUMN towel_rent boolean NOT NULL DEFAULT false,
ADD COLUMN towel_rent_qty integer NOT NULL DEFAULT 0,
ADD COLUMN towel_rent_fee numeric NOT NULL DEFAULT 0,
ADD COLUMN bonfire boolean NOT NULL DEFAULT false,
ADD COLUMN bonfire_fee numeric NOT NULL DEFAULT 0;