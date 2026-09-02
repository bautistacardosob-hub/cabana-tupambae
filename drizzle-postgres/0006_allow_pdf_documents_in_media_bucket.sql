update storage.buckets
set file_size_limit = 25165824,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','application/pdf']
where id = 'media';
