-- Add additional columns to seo_audits table for complete audit storage
ALTER TABLE public.seo_audits 
ADD COLUMN IF NOT EXISTS content_quality JSONB,
ADD COLUMN IF NOT EXISTS link_analysis JSONB,
ADD COLUMN IF NOT EXISTS keyword_analysis JSONB,
ADD COLUMN IF NOT EXISTS tone_of_voice_score JSONB,
ADD COLUMN IF NOT EXISTS image_issues JSONB,
ADD COLUMN IF NOT EXISTS schema_types TEXT[],
ADD COLUMN IF NOT EXISTS focus_keyword TEXT,
ADD COLUMN IF NOT EXISTS metadata_sources JSONB,
ADD COLUMN IF NOT EXISTS truncation_info JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.seo_audits.content_quality IS 'Word count, paragraph count, readability metrics';
COMMENT ON COLUMN public.seo_audits.link_analysis IS 'Internal/external link counts, content links vs footer links';
COMMENT ON COLUMN public.seo_audits.keyword_analysis IS 'Focus keyword presence in title/h1/meta, density';
COMMENT ON COLUMN public.seo_audits.tone_of_voice_score IS 'Tegeldepot tone of voice scores';
COMMENT ON COLUMN public.seo_audits.image_issues IS 'Images with missing or generic alt tags';
COMMENT ON COLUMN public.seo_audits.schema_types IS 'Found JSON-LD schema types';
COMMENT ON COLUMN public.seo_audits.focus_keyword IS 'The focus keyword used for analysis';
COMMENT ON COLUMN public.seo_audits.metadata_sources IS 'Source indicators for title/description (title-tag, og:title, etc)';
COMMENT ON COLUMN public.seo_audits.truncation_info IS 'Info about content truncation for AI analysis';