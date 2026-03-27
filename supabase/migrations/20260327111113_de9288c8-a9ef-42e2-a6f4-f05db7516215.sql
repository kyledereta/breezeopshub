
ALTER TABLE public.bookings ADD COLUMN has_car boolean NOT NULL DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN car_details jsonb DEFAULT '[]'::jsonb;
