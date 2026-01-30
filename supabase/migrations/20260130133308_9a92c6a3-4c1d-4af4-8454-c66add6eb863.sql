-- Phase 1 & 3: Add page_type to seo_audits and create seo_audit_queue table

-- 1. Add page_type column to seo_audits table
ALTER TABLE public.seo_audits 
ADD COLUMN IF NOT EXISTS page_type text DEFAULT 'other';

-- 2. Create seo_audit_queue table for bulk audit functionality
CREATE TABLE public.seo_audit_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  page_type TEXT DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 50,
  result_id UUID REFERENCES public.seo_audits(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Enable RLS on seo_audit_queue
ALTER TABLE public.seo_audit_queue ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for seo_audit_queue
CREATE POLICY "Users can view their own queue items"
ON public.seo_audit_queue
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own queue items"
ON public.seo_audit_queue
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue items"
ON public.seo_audit_queue
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own queue items"
ON public.seo_audit_queue
FOR DELETE
USING (auth.uid() = user_id);

-- 5. Create index for efficient queue processing
CREATE INDEX idx_seo_audit_queue_status ON public.seo_audit_queue(status);
CREATE INDEX idx_seo_audit_queue_user_status ON public.seo_audit_queue(user_id, status);
CREATE INDEX idx_seo_audit_queue_priority ON public.seo_audit_queue(priority DESC);

-- 6. Add is_quick_scan column to seo_audits to track scan type
ALTER TABLE public.seo_audits 
ADD COLUMN IF NOT EXISTS is_quick_scan BOOLEAN DEFAULT false;