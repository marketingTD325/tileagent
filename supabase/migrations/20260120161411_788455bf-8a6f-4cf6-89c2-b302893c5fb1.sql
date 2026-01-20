-- Remove the check constraint that limits content_type values
ALTER TABLE public.generated_content DROP CONSTRAINT IF EXISTS generated_content_content_type_check;

-- Add updated constraint to include category_with_links
ALTER TABLE public.generated_content ADD CONSTRAINT generated_content_content_type_check 
CHECK (content_type IN ('product_description', 'blog_post', 'meta_tags', 'category_description', 'category_with_links'));