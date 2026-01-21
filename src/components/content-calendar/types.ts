export interface ContentSuggestion {
  id: string;
  title: string;
  description: string;
  content_type: string;
  target_keywords: string[];
  priority: string;
  opportunity_score: number;
  source: string;
  source_data: any;
  status: string;
  scheduled_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ContentTypeConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}
