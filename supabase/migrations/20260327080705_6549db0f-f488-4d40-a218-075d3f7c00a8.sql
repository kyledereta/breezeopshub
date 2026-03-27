ALTER TABLE public.bookings 
ADD COLUMN water_jug boolean NOT NULL DEFAULT false,
ADD COLUMN water_jug_qty integer NOT NULL DEFAULT 0,
ADD COLUMN water_jug_fee numeric NOT NULL DEFAULT 0;