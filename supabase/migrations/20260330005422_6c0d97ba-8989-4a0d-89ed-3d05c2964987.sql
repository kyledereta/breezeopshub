-- Drop all permissive public policies and replace with authenticated-only

-- bookings
DROP POLICY IF EXISTS "Allow all access to bookings" ON public.bookings;
CREATE POLICY "Authenticated access to bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- guests
DROP POLICY IF EXISTS "Allow all access to guests" ON public.guests;
CREATE POLICY "Authenticated access to guests" ON public.guests
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- units
DROP POLICY IF EXISTS "Allow all access to units" ON public.units;
CREATE POLICY "Authenticated access to units" ON public.units
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- blocked_dates
DROP POLICY IF EXISTS "Allow all access to blocked_dates" ON public.blocked_dates;
CREATE POLICY "Authenticated access to blocked_dates" ON public.blocked_dates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- booking_audit_log
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.booking_audit_log;
DROP POLICY IF EXISTS "Anyone can read audit logs" ON public.booking_audit_log;
CREATE POLICY "Authenticated access to booking_audit_log" ON public.booking_audit_log
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- form_submissions (allow public INSERT for guest enquiries, restrict the rest)
DROP POLICY IF EXISTS "Allow all access to form_submissions" ON public.form_submissions;
CREATE POLICY "Public can insert form submissions" ON public.form_submissions
  FOR INSERT TO public
  WITH CHECK (true);
CREATE POLICY "Authenticated access to form_submissions" ON public.form_submissions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- unit_status_log
DROP POLICY IF EXISTS "Allow all access to unit_status_log" ON public.unit_status_log;
CREATE POLICY "Authenticated access to unit_status_log" ON public.unit_status_log
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- pricing_multipliers
DROP POLICY IF EXISTS "Allow all access to pricing_multipliers" ON public.pricing_multipliers;
CREATE POLICY "Authenticated access to pricing_multipliers" ON public.pricing_multipliers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- monthly_targets
DROP POLICY IF EXISTS "Allow all access to monthly_targets" ON public.monthly_targets;
CREATE POLICY "Authenticated access to monthly_targets" ON public.monthly_targets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Storage: guest-ids bucket
DROP POLICY IF EXISTS "Allow all reads from guest-ids" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads to guest-ids" ON storage.objects;
DROP POLICY IF EXISTS "Allow all deletes from guest-ids" ON storage.objects;

CREATE POLICY "Auth read guest-ids" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'guest-ids');

CREATE POLICY "Auth upload guest-ids" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'guest-ids');

CREATE POLICY "Auth delete guest-ids" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'guest-ids');
