-- Create content_calendar table for AI-generated suggestions
CREATE TABLE public.content_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'category',
  target_keywords TEXT[] DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'medium',
  opportunity_score INTEGER DEFAULT 50,
  source TEXT DEFAULT 'ai_suggestion',
  source_data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'suggested',
  scheduled_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own calendar items"
  ON public.content_calendar FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar items"
  ON public.content_calendar FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar items"
  ON public.content_calendar FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar items"
  ON public.content_calendar FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_content_calendar_updated_at
  BEFORE UPDATE ON public.content_calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for efficient queries
CREATE INDEX idx_content_calendar_user_status ON public.content_calendar(user_id, status);
CREATE INDEX idx_content_calendar_scheduled ON public.content_calendar(scheduled_date) WHERE scheduled_date IS NOT NULL;