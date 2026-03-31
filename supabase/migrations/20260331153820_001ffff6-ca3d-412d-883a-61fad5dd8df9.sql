-- 1. Make payment-screenshots bucket private
UPDATE storage.buckets SET public = false WHERE id = 'payment-screenshots';

-- 2. Drop existing public SELECT policy on payment-screenshots
DROP POLICY IF EXISTS "Public read payment screenshots" ON storage.objects;

-- 3. Add authenticated-only SELECT policy
CREATE POLICY "Auth read payment-screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-screenshots');

-- 4. Add authenticated DELETE policy for staff cleanup
CREATE POLICY "Auth delete payment-screenshots" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payment-screenshots');

-- 5. Add authenticated UPDATE policy
CREATE POLICY "Auth update payment-screenshots" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-screenshots');

-- 6. Tighten RLS on bookings (replace permissive true with auth check)
DROP POLICY IF EXISTS "Authenticated access to bookings" ON public.bookings;
CREATE POLICY "Authenticated access to bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Tighten RLS on units
DROP POLICY IF EXISTS "Authenticated access to units" ON public.units;
CREATE POLICY "Authenticated access to units" ON public.units
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 8. Tighten RLS on guests
DROP POLICY IF EXISTS "Authenticated access to guests" ON public.guests;
CREATE POLICY "Authenticated access to guests" ON public.guests
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 9. Tighten RLS on blocked_dates
DROP POLICY IF EXISTS "Authenticated access to blocked_dates" ON public.blocked_dates;
CREATE POLICY "Authenticated access to blocked_dates" ON public.blocked_dates
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 10. Tighten RLS on booking_audit_log
DROP POLICY IF EXISTS "Authenticated access to booking_audit_log" ON public.booking_audit_log;
CREATE POLICY "Authenticated access to booking_audit_log" ON public.booking_audit_log
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 11. Tighten RLS on unit_status_log
DROP POLICY IF EXISTS "Authenticated access to unit_status_log" ON public.unit_status_log;
CREATE POLICY "Authenticated access to unit_status_log" ON public.unit_status_log
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 12. Tighten RLS on pricing_multipliers
DROP POLICY IF EXISTS "Authenticated access to pricing_multipliers" ON public.pricing_multipliers;
CREATE POLICY "Authenticated access to pricing_multipliers" ON public.pricing_multipliers
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 13. Tighten RLS on monthly_targets
DROP POLICY IF EXISTS "Authenticated access to monthly_targets" ON public.monthly_targets;
CREATE POLICY "Authenticated access to monthly_targets" ON public.monthly_targets
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 14. Tighten RLS on form_submissions (authenticated access only, keep public INSERT)
DROP POLICY IF EXISTS "Authenticated access to form_submissions" ON public.form_submissions;
CREATE POLICY "Authenticated access to form_submissions" ON public.form_submissions
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
