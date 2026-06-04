-- DHCR parse results (text extraction + rent line items)

alter table public.dhcr_submissions
  add column if not exists parsed_data jsonb,
  add column if not exists parse_error text,
  add column if not exists parsed_at timestamptz;
