
-- Add pets column to bookings
ALTER TABLE public.bookings
  ADD COLUMN pets boolean NOT NULL DEFAULT false;

-- Create storage bucket for guest IDs
INSERT INTO storage.buckets (id, name, public)
VALUES ('guest-ids', 'guest-ids', false);

-- Allow public read/write for guest-ids bucket (internal app, no auth yet)
CREATE POLICY "Allow all uploads to guest-ids"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'guest-ids');

CREATE POLICY "Allow all reads from guest-ids"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'guest-ids');

CREATE POLICY "Allow all deletes from guest-ids"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'guest-ids');
