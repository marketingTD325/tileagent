-- Create bulk_jobs table for tracking bulk content generation jobs
CREATE TABLE public.bulk_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  job_type TEXT NOT NULL, -- category, filter, cms
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create bulk_job_items table for individual items in a bulk job
CREATE TABLE public.bulk_job_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.bulk_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_content_main TEXT, -- description_bottom_extra (klantgericht, onderaan pagina)
  generated_content_side TEXT, -- description_bottom (SEO-gericht, zijkant)
  meta_title TEXT,
  meta_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on bulk_jobs
ALTER TABLE public.bulk_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for bulk_jobs
CREATE POLICY "Users can view their own bulk jobs"
  ON public.bulk_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bulk jobs"
  ON public.bulk_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bulk jobs"
  ON public.bulk_jobs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bulk jobs"
  ON public.bulk_jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on bulk_job_items
ALTER TABLE public.bulk_job_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for bulk_job_items
CREATE POLICY "Users can view their own bulk job items"
  ON public.bulk_job_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bulk job items"
  ON public.bulk_job_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bulk job items"
  ON public.bulk_job_items
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bulk job items"
  ON public.bulk_job_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_bulk_jobs_user_id ON public.bulk_jobs(user_id);
CREATE INDEX idx_bulk_jobs_status ON public.bulk_jobs(status);
CREATE INDEX idx_bulk_job_items_job_id ON public.bulk_job_items(job_id);
CREATE INDEX idx_bulk_job_items_status ON public.bulk_job_items(status);