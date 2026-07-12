-- Users can upload only to their own folder (path: <userId>/...)
CREATE POLICY "chat_images_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'chat-images'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can read only from their own folder
CREATE POLICY "chat_images_select"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'chat-images'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete only their own uploads
CREATE POLICY "chat_images_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'chat-images'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );