-- Enable PostGIS for geospatial columns and queries.
-- Run via Supabase CLI (`supabase db push`) or SQL Editor in the dashboard.
create extension if not exists postgis with schema extensions;
