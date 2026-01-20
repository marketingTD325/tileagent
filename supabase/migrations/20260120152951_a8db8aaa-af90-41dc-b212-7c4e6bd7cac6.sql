-- Create profiles table for team members
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create SEO audits table
CREATE TABLE public.seo_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  score INTEGER DEFAULT 0,
  issues JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  technical_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generated content table
CREATE TABLE public.generated_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('product_description', 'blog_post', 'meta_tags', 'category_description')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_keywords TEXT[],
  language TEXT DEFAULT 'nl',
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create keywords table
CREATE TABLE public.keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  difficulty INTEGER,
  category TEXT,
  is_tracking BOOLEAN DEFAULT true,
  position INTEGER,
  previous_position INTEGER,
  last_checked TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create competitors table
CREATE TABLE public.competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create competitor analyses table
CREATE TABLE public.competitor_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  visibility_score INTEGER,
  keyword_overlap JSONB DEFAULT '[]'::jsonb,
  content_gaps JSONB DEFAULT '[]'::jsonb,
  top_keywords JSONB DEFAULT '[]'::jsonb,
  analysis_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activity log table for team collaboration
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies (users can view all team profiles, but only update their own)
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- SEO audits policies (all authenticated users can see and create audits for collaboration)
CREATE POLICY "Authenticated users can view all audits" ON public.seo_audits FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create audits" ON public.seo_audits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own audits" ON public.seo_audits FOR DELETE USING (auth.uid() = user_id);

-- Generated content policies
CREATE POLICY "Authenticated users can view all content" ON public.generated_content FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create content" ON public.generated_content FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own content" ON public.generated_content FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own content" ON public.generated_content FOR DELETE USING (auth.uid() = user_id);

-- Keywords policies
CREATE POLICY "Authenticated users can view all keywords" ON public.keywords FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create keywords" ON public.keywords FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update keywords" ON public.keywords FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete their own keywords" ON public.keywords FOR DELETE USING (auth.uid() = user_id);

-- Competitors policies
CREATE POLICY "Authenticated users can view all competitors" ON public.competitors FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create competitors" ON public.competitors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update competitors" ON public.competitors FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete competitors" ON public.competitors FOR DELETE USING (auth.uid() IS NOT NULL);

-- Competitor analyses policies
CREATE POLICY "Authenticated users can view analyses" ON public.competitor_analyses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create analyses" ON public.competitor_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own analyses" ON public.competitor_analyses FOR DELETE USING (auth.uid() = user_id);

-- Activity log policies (all authenticated users can view and create activity)
CREATE POLICY "Authenticated users can view activity" ON public.activity_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can log activity" ON public.activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-create profile on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();