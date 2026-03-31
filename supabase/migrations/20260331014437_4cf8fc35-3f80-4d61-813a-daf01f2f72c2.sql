ALTER TABLE public.bookings
  ADD COLUMN atv boolean NOT NULL DEFAULT false,
  ADD COLUMN atv_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN banana_boat boolean NOT NULL DEFAULT false,
  ADD COLUMN banana_boat_fee numeric NOT NULL DEFAULT 0;