-- 1. Create a new public bucket for B2B proofs
insert into storage.buckets (id, name, public)
values ('b2b_proofs', 'b2b_proofs', true);

-- 2. Allow anyone to view the uploaded proofs
create policy "Public Access for b2b_proofs"
on storage.objects for select
using ( bucket_id = 'b2b_proofs' );

-- 3. Allow anyone to upload proofs (or you can restrict to authenticated users if needed)
create policy "Allow uploads for b2b_proofs"
on storage.objects for insert
with check ( bucket_id = 'b2b_proofs' );

-- 4. Allow users to update their uploads if needed
create policy "Allow updates for b2b_proofs"
on storage.objects for update
using ( bucket_id = 'b2b_proofs' );

-- 5. Allow users to delete their uploads if needed
create policy "Allow deletes for b2b_proofs"
on storage.objects for delete
using ( bucket_id = 'b2b_proofs' );
