-- Run this in Supabase SQL Editor to create the storage bucket for listing photos

-- 1. Create the bucket (public read so approved listing photos load without auth)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'frework-uploads',
  'frework-uploads',
  true,
  10485760,  -- 10 MB per file
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- 2. Allow any authenticated user to upload
create policy "Authenticated users can upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'frework-uploads');

-- 3. Allow owners to delete their own uploads
create policy "Users can delete their own uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'frework-uploads' and auth.uid()::text = (storage.foldername(name))[2]);

-- 4. Public can read (so photos show on the website once approved)
create policy "Public can view uploaded photos"
  on storage.objects for select
  to public
  using (bucket_id = 'frework-uploads');
