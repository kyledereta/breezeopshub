
-- Create form_submissions table
CREATE TABLE public.form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  unit_id UUID REFERENCES public.units(id),
  pax INTEGER NOT NULL DEFAULT 1,
  payment_screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  rejection_reason TEXT,
  booking_id UUID REFERENCES public.bookings(id),
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to form_submissions"
  ON public.form_submissions
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', true);

-- Allow public read on payment screenshots
CREATE POLICY "Public read payment screenshots"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'payment-screenshots');

-- Allow public insert on payment screenshots  
CREATE POLICY "Public insert payment screenshots"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'payment-screenshots');

-- Updated at trigger
CREATE TRIGGER update_form_submissions_updated_at
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
