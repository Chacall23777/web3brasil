
CREATE POLICY "post-files public read" ON storage.objects FOR SELECT USING (bucket_id = 'post-files');
CREATE POLICY "post-files auth upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "post-files owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'post-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "post-files owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'post-files' AND (storage.foldername(name))[1] = auth.uid()::text);
