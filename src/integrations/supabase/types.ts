export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_description: string
          action_type: string
          created_at: string
          id: string
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_id: string
        }
        Insert: {
          action_description: string
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_id: string
        }
        Update: {
          action_description?: string
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bulk_job_items: {
        Row: {
          created_at: string
          error_message: string | null
          generated_content_main: string | null
          generated_content_side: string | null
          id: string
          input_data: Json
          job_id: string
          meta_description: string | null
          meta_title: string | null
          processed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          generated_content_main?: string | null
          generated_content_side?: string | null
          id?: string
          input_data?: Json
          job_id: string
          meta_description?: string | null
          meta_title?: string | null
          processed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          generated_content_main?: string | null
          generated_content_side?: string | null
          id?: string
          input_data?: Json
          job_id?: string
          meta_description?: string | null
          meta_title?: string | null
          processed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "bulk_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_items: number
          id: string
          job_type: string
          processed_items: number
          status: string
          total_items: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_items?: number
          id?: string
          job_type: string
          processed_items?: number
          status?: string
          total_items?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_items?: number
          id?: string
          job_type?: string
          processed_items?: number
          status?: string
          total_items?: number
          user_id?: string
        }
        Relationships: []
      }
      competitor_analyses: {
        Row: {
          analysis_data: Json | null
          competitor_id: string
          content_gaps: Json | null
          created_at: string
          id: string
          keyword_overlap: Json | null
          top_keywords: Json | null
          user_id: string
          visibility_score: number | null
        }
        Insert: {
          analysis_data?: Json | null
          competitor_id: string
          content_gaps?: Json | null
          created_at?: string
          id?: string
          keyword_overlap?: Json | null
          top_keywords?: Json | null
          user_id: string
          visibility_score?: number | null
        }
        Update: {
          analysis_data?: Json | null
          competitor_id?: string
          content_gaps?: Json | null
          created_at?: string
          id?: string
          keyword_overlap?: Json | null
          top_keywords?: Json | null
          user_id?: string
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_analyses_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          created_at: string
          domain: string
          id: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_calendar: {
        Row: {
          completed_at: string | null
          content_type: string
          created_at: string
          description: string | null
          id: string
          opportunity_score: number | null
          priority: string
          scheduled_date: string | null
          source: string | null
          source_data: Json | null
          status: string
          target_keywords: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content_type?: string
          created_at?: string
          description?: string | null
          id?: string
          opportunity_score?: number | null
          priority?: string
          scheduled_date?: string | null
          source?: string | null
          source_data?: Json | null
          status?: string
          target_keywords?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          content_type?: string
          created_at?: string
          description?: string | null
          id?: string
          opportunity_score?: number | null
          priority?: string
          scheduled_date?: string | null
          source?: string | null
          source_data?: Json | null
          status?: string
          target_keywords?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_content: {
        Row: {
          content: string
          content_type: string
          created_at: string
          id: string
          is_favorite: boolean | null
          language: string | null
          target_keywords: string[] | null
          title: string
          user_id: string
        }
        Insert: {
          content: string
          content_type: string
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          language?: string | null
          target_keywords?: string[] | null
          title: string
          user_id: string
        }
        Update: {
          content?: string
          content_type?: string
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          language?: string | null
          target_keywords?: string[] | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      keywords: {
        Row: {
          category: string | null
          created_at: string
          difficulty: number | null
          id: string
          is_tracking: boolean | null
          keyword: string
          last_checked: string | null
          position: number | null
          previous_position: number | null
          search_volume: number | null
          target_domain: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          difficulty?: number | null
          id?: string
          is_tracking?: boolean | null
          keyword: string
          last_checked?: string | null
          position?: number | null
          previous_position?: number | null
          search_volume?: number | null
          target_domain?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          difficulty?: number | null
          id?: string
          is_tracking?: boolean | null
          keyword?: string
          last_checked?: string | null
          position?: number | null
          previous_position?: number | null
          search_volume?: number | null
          target_domain?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rank_tracking_history: {
        Row: {
          checked_at: string
          created_at: string
          device: string | null
          id: string
          keyword_id: string
          location: string | null
          position: number | null
          search_engine: string
          snippet: string | null
          title: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          checked_at?: string
          created_at?: string
          device?: string | null
          id?: string
          keyword_id: string
          location?: string | null
          position?: number | null
          search_engine?: string
          snippet?: string | null
          title?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          checked_at?: string
          created_at?: string
          device?: string | null
          id?: string
          keyword_id?: string
          location?: string | null
          position?: number | null
          search_engine?: string
          snippet?: string | null
          title?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_tracking_history_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_audits: {
        Row: {
          created_at: string
          id: string
          issues: Json | null
          meta_description: string | null
          recommendations: Json | null
          score: number | null
          technical_data: Json | null
          title: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issues?: Json | null
          meta_description?: string | null
          recommendations?: Json | null
          score?: number | null
          technical_data?: Json | null
          title?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issues?: Json | null
          meta_description?: string | null
          recommendations?: Json | null
          score?: number | null
          technical_data?: Json | null
          title?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
