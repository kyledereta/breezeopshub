
ALTER TABLE public.form_submissions
  ADD COLUMN facebook_name text,
  ADD COLUMN birthday_month integer,
  ADD COLUMN has_pet boolean NOT NULL DEFAULT false,
  ADD COLUMN gov_id_url text,
  ADD COLUMN promo_code text,
  ADD COLUMN payment_method text,
  ADD COLUMN marketing_consent boolean NOT NULL DEFAULT false;
