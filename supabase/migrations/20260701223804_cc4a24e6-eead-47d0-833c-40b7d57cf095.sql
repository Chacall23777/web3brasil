DROP POLICY IF EXISTS "post-files public read" ON storage.objects;
CREATE POLICY "post-files authenticated read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'post-files');