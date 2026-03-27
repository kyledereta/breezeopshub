
CREATE TABLE public.booking_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audit logs" ON public.booking_audit_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert audit logs" ON public.booking_audit_log FOR INSERT WITH CHECK (true);

CREATE INDEX idx_booking_audit_log_booking_id ON public.booking_audit_log(booking_id);
