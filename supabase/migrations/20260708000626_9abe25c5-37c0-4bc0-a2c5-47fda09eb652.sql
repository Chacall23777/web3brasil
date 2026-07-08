
-- Enforce http(s)-only URLs at the DB layer for user- and admin-supplied link fields.

ALTER TABLE public.posts
  ADD CONSTRAINT posts_token_link_http_only
  CHECK (token_link IS NULL OR token_link ~* '^https?://[^\s]+$');

ALTER TABLE public.advertisements
  ADD CONSTRAINT advertisements_website_link_http_only
  CHECK (website_link IS NULL OR website_link ~* '^https?://[^\s]+$');

ALTER TABLE public.advertisements
  ADD CONSTRAINT advertisements_x_link_http_only
  CHECK (x_link IS NULL OR x_link ~* '^https?://[^\s]+$');

ALTER TABLE public.advertisements
  ADD CONSTRAINT advertisements_tg_link_http_only
  CHECK (tg_link IS NULL OR tg_link ~* '^https?://[^\s]+$');
