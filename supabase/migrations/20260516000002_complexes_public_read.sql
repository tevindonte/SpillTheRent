-- Allow the Next.js app (anon key) to read complexes for the public map.
create policy "complexes_select_public"
  on public.complexes
  for select
  to anon, authenticated
  using (true);
