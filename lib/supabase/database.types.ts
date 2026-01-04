/**
 * 数据库类型定义
 * 基于 supabase/schema.sql 生成
 *
 * 注意: 此文件由工具生成，请勿手动编辑
 */

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
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          preferred_language?: 'zh' | 'en'
          profile?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          preferred_language?: 'zh' | 'en'
          profile?: Json
          created_at?: string
          updated_at?: string
        }
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
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          language?: 'zh' | 'en'
          message_count?: number
          last_message_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          language?: 'zh' | 'en'
          message_count?: number
          last_message_at?: string
          created_at?: string
          updated_at?: string
        }
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
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          tokens?: number
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          tokens?: number
          created_at?: string
        }
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
        Insert: {
          id?: string
          user_id: string
          conversation_id?: string | null
          quote: string
          context?: string | null
          emotion?: string | null
          topic?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string | null
          quote?: string
          context?: string | null
          emotion?: string | null
          topic?: string | null
          created_at?: string
        }
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
        Insert: {
          id?: string
          provider: 'chutes' | 'openrouter'
          api_key: string
          model_name?: string | null
          daily_limit?: number
          daily_used?: number
          priority?: number
          is_active?: boolean
          last_used_at?: string | null
          reset_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider?: 'chutes' | 'openrouter'
          api_key?: string
          model_name?: string | null
          daily_limit?: number
          daily_used?: number
          priority?: number
          is_active?: boolean
          last_used_at?: string | null
          reset_at?: string
          created_at?: string
          updated_at?: string
        }
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
        Insert: {
          id?: string
          api_key_id?: string | null
          provider: string
          model_name?: string | null
          user_id?: string | null
          conversation_id?: string | null
          tokens_used?: number
          success?: boolean
          error_message?: string | null
          response_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          api_key_id?: string | null
          provider?: string
          model_name?: string | null
          user_id?: string | null
          conversation_id?: string | null
          tokens_used?: number
          success?: boolean
          error_message?: string | null
          response_time_ms?: number | null
          created_at?: string
        }
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
        Insert: {
          id?: string
          email: string
          password_hash: string
          full_name?: string | null
          role?: 'admin' | 'super_admin'
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          full_name?: string | null
          role?: 'admin' | 'super_admin'
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
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
        Insert: {
          id?: string
          name: string
          role: 'formless_elder' | 'memory_extractor' | 'system'
          language: 'zh' | 'en'
          content: string
          version?: number
          is_active?: boolean
          variables?: Json
          description?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: 'formless_elder' | 'memory_extractor' | 'system'
          language?: 'zh' | 'en'
          content?: string
          version?: number
          is_active?: boolean
          variables?: Json
          description?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      guanzhao_budget_tracking: {
        Row: {
          id: string
          user_id: string
          enabled: boolean
          frequency_level: string
          style: string
          snoozed_until: string | null
          dnd_start: string
          dnd_end: string
          budget_in_app_day: number
          budget_in_app_week: number
          used_in_app_day: number
          used_in_app_week: number
          budget_push_day: number
          budget_push_week: number
          used_push_day: number
          used_push_week: number
          last_reset_day: string
          last_reset_week: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          enabled?: boolean
          frequency_level?: string
          style?: string
          snoozed_until?: string | null
          dnd_start?: string
          dnd_end?: string
          budget_in_app_day?: number
          budget_in_app_week?: number
          used_in_app_day?: number
          used_in_app_week?: number
          budget_push_day?: number
          budget_push_week?: number
          used_push_day?: number
          used_push_week?: number
          last_reset_day?: string
          last_reset_week?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          enabled?: boolean
          frequency_level?: string
          style?: string
          snoozed_until?: string | null
          dnd_start?: string
          dnd_end?: string
          budget_in_app_day?: number
          budget_in_app_week?: number
          used_in_app_day?: number
          used_in_app_week?: number
          budget_push_day?: number
          budget_push_week?: number
          used_push_day?: number
          used_push_week?: number
          last_reset_day?: string
          last_reset_week?: string
          created_at?: string
          updated_at?: string
        }
      }
      guanzhao_trigger_history: {
        Row: {
          id: string
          user_id: string
          trigger_id: string
          template_id: string
          channel: string
          status: string
          budget_cost: number
          clicked_at: string | null
          dismissed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trigger_id: string
          template_id: string
          channel: string
          status?: string
          budget_cost: number
          clicked_at?: string | null
          dismissed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          trigger_id?: string
          template_id?: string
          channel?: string
          status?: string
          budget_cost?: number
          clicked_at?: string | null
          dismissed_at?: string | null
          created_at?: string
        }
      }
      guanzhao_session_events: {
        Row: {
          id: string
          user_id: string
          event_type: string
          session_start: string
          session_end: string | null
          duration_seconds: number | null
          message_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_type: string
          session_start: string
          session_end?: string | null
          duration_seconds?: number | null
          message_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_type?: string
          session_start?: string
          session_end?: string | null
          duration_seconds?: number | null
          message_count?: number
          created_at?: string
        }
      }
      guanzhao_settings: {
        Row: {
          id: string
          user_id: string
          enabled: boolean
          frequency_level: string
          style: string
          dnd_start: string
          dnd_end: string
          channels: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          enabled?: boolean
          frequency_level?: string
          style?: string
          dnd_start?: string
          dnd_end?: string
          channels?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          enabled?: boolean
          frequency_level?: string
          style?: string
          dnd_start?: string
          dnd_end?: string
          channels?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      guanzhao_action_history: {
        Row: {
          id: string
          user_id: string
          action_type: string
          trigger_id: string | null
          trigger_history_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action_type: string
          trigger_id?: string | null
          trigger_history_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action_type?: string
          trigger_id?: string | null
          trigger_history_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      guanzhao_push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          device_type: string | null
          is_active: boolean
          last_used_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          device_type?: string | null
          is_active?: boolean
          last_used_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          device_type?: string | null
          is_active?: boolean
          last_used_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_api_key_usage: {
        Args: Record<PropertyKey, never>
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
