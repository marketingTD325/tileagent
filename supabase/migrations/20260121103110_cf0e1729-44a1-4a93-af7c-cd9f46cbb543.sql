-- Create rank_tracking_history table for storing keyword position history
CREATE TABLE public.rank_tracking_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword_id UUID NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  position INTEGER,
  url TEXT,
  title TEXT,
  snippet TEXT,
  search_engine TEXT NOT NULL DEFAULT 'google',
  location TEXT DEFAULT 'Netherlands',
  device TEXT DEFAULT 'desktop',
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rank_tracking_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own rank history"
  ON public.rank_tracking_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rank history"
  ON public.rank_tracking_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rank history"
  ON public.rank_tracking_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_rank_history_keyword_id ON public.rank_tracking_history(keyword_id);
CREATE INDEX idx_rank_history_checked_at ON public.rank_tracking_history(checked_at);
CREATE INDEX idx_rank_history_user_id ON public.rank_tracking_history(user_id);

-- Add domain column to keywords table for tracking which domain to monitor
ALTER TABLE public.keywords ADD COLUMN IF NOT EXISTS target_domain TEXT;