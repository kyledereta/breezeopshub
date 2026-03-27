CREATE TABLE public.unit_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.unit_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to unit_status_log" ON public.unit_status_log FOR ALL TO public USING (true) WITH CHECK (true);