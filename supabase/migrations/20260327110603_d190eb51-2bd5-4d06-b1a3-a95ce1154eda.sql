
ALTER TABLE public.bookings ADD COLUMN daytour boolean NOT NULL DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN is_daytour_booking boolean NOT NULL DEFAULT false;

CREATE TABLE public.blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unit_id, blocked_date)
);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to blocked_dates" ON public.blocked_dates FOR ALL USING (true) WITH CHECK (true);
