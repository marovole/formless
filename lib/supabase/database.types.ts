export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          preferred_language: 'zh' | 'en'
          profile: Json
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['users']['Row']>
        Update: Partial<Database['public']['Tables']['users']['Row']>
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string | null
          language: 'zh' | 'en'
          message_count: number
          last_message_at: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['conversations']['Row']>
        Update: Partial<Database['public']['Tables']['conversations']['Row']>
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          tokens: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['messages']['Row']>
        Update: Partial<Database['public']['Tables']['messages']['Row']>
      }
      key_quotes: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          quote: string
          context: string | null
          emotion: string | null
          topic: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['key_quotes']['Row']>
        Update: Partial<Database['public']['Tables']['key_quotes']['Row']>
      }
      api_keys: {
        Row: {
          id: string
          provider: 'chutes' | 'openrouter'
          api_key: string
          model_name: string | null
          daily_limit: number
          daily_used: number
          priority: number
          is_active: boolean
          last_used_at: string | null
          reset_at: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['api_keys']['Row']>
        Update: Partial<Database['public']['Tables']['api_keys']['Row']>
      }
      api_usage: {
        Row: {
          id: string
          api_key_id: string | null
          provider: string
          model_name: string | null
          user_id: string | null
          conversation_id: string | null
          tokens_used: number
          success: boolean
          error_message: string | null
          response_time_ms: number | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['api_usage']['Row']>
        Update: Partial<Database['public']['Tables']['api_usage']['Row']>
      }
      admin_users: {
        Row: {
          id: string
          email: string
          password_hash: string
          full_name: string | null
          role: 'admin' | 'super_admin'
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['admin_users']['Row']>
        Update: Partial<Database['public']['Tables']['admin_users']['Row']>
      }
      prompts: {
        Row: {
          id: string
          name: string
          role: 'formless_elder' | 'memory_extractor' | 'system'
          language: 'zh' | 'en'
          content: string
          version: number
          is_active: boolean
          variables: Json
          description: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['prompts']['Row']>
        Update: Partial<Database['public']['Tables']['prompts']['Row']>
      }
      guanzhao_budget_tracking: {
        Row: {
          id: string
          user_id: string
          enabled: boolean
          frequency_level: 'silent' | 'qingjian' | 'zhongdao' | 'jingjin'
          style: 'qingming' | 'cibei' | 'zhizhi'
          push_enabled: boolean
          dnd_start: string
          dnd_end: string
          snoozed_until: string | null
          budget_in_app_day: number
          budget_in_app_week: number
          budget_push_day: number
          budget_push_week: number
          used_in_app_day: number
          used_in_app_week: number
          used_push_day: number
          used_push_week: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['guanzhao_budget_tracking']['Row']>
        Update: Partial<Database['public']['Tables']['guanzhao_budget_tracking']['Row']>
      }
      guanzhao_trigger_history: {
        Row: {
          id: string
          user_id: string
          trigger_id: string
          template_id: string
          channel: 'in_app' | 'push'
          status: 'shown' | 'dismissed' | 'clicked' | 'feedback'
          feedback: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['guanzhao_trigger_history']['Row']>
        Update: Partial<Database['public']['Tables']['guanzhao_trigger_history']['Row']>
      }
      guanzhao_cooldowns: {
        Row: {
          id: string
          user_id: string
          trigger_id: string
          channel: 'in_app' | 'push'
          cooldown_until: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['guanzhao_cooldowns']['Row']>
        Update: Partial<Database['public']['Tables']['guanzhao_cooldowns']['Row']>
      }
    }
    Views: {
      user_stats: {
        Row: {
          id: string | null
          email: string | null
          full_name: string | null
          total_conversations: number | null
          total_messages: number | null
          total_quotes: number | null
          last_active_at: string | null
          user_since: string | null
        }
      }
      daily_api_usage: {
        Row: {
          usage_date: string | null
          provider: string | null
          model_name: string | null
          total_calls: number | null
          successful_calls: number | null
          total_tokens: number | null
          avg_response_time_ms: number | null
        }
      }
    }
    Functions: {
      reset_api_key_usage: {
        Args: Record<string, never>
        Returns: void
      }
    }
    Enums: {}
  }
}
