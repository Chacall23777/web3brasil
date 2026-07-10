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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          created_at: string
          created_by_admin_id: string | null
          duration_days: number
          expires_at: string
          id: string
          image_url: string
          is_active: boolean
          tg_link: string | null
          title: string | null
          updated_at: string
          website_link: string | null
          x_link: string | null
        }
        Insert: {
          created_at?: string
          created_by_admin_id?: string | null
          duration_days: number
          expires_at: string
          id?: string
          image_url: string
          is_active?: boolean
          tg_link?: string | null
          title?: string | null
          updated_at?: string
          website_link?: string | null
          x_link?: string | null
        }
        Update: {
          created_at?: string
          created_by_admin_id?: string | null
          duration_days?: number
          expires_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          tg_link?: string | null
          title?: string | null
          updated_at?: string
          website_link?: string | null
          x_link?: string | null
        }
        Relationships: []
      }
      ai_agent_api_events: {
        Row: {
          agent_id: string
          created_at: string
          id: number
          kind: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: number
          kind: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: number
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_api_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string
          created_by_admin_id: string | null
          description: string | null
          id: string
          is_suspended: boolean
          name: string
          operator_contact: string
          rate_limit_per_hour: number
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string
          created_by_admin_id?: string | null
          description?: string | null
          id?: string
          is_suspended?: boolean
          name: string
          operator_contact: string
          rate_limit_per_hour?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string
          created_by_admin_id?: string | null
          description?: string | null
          id?: string
          is_suspended?: boolean
          name?: string
          operator_contact?: string
          rate_limit_per_hour?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          post_id: string | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          comments_count: number
          content: string | null
          content_en: string | null
          content_original: string | null
          content_pt: string | null
          created_at: string
          edited_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          image_url: string | null
          likes_count: number
          original_language: string
          reposts_count: number
          title: string | null
          token_chain: string | null
          token_contract: string | null
          token_link: string | null
          token_name: string | null
          token_symbol: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_count?: number
          content?: string | null
          content_en?: string | null
          content_original?: string | null
          content_pt?: string | null
          created_at?: string
          edited_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          likes_count?: number
          original_language?: string
          reposts_count?: number
          title?: string | null
          token_chain?: string | null
          token_contract?: string | null
          token_link?: string | null
          token_name?: string | null
          token_symbol?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_count?: number
          content?: string | null
          content_en?: string | null
          content_original?: string | null
          content_pt?: string | null
          created_at?: string
          edited_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          likes_count?: number
          original_language?: string
          reposts_count?: number
          title?: string | null
          token_chain?: string | null
          token_contract?: string | null
          token_link?: string | null
          token_name?: string | null
          token_symbol?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          github_handle: string | null
          id: string
          instagram_handle: string | null
          is_verified: boolean
          preferred_language: string
          solana_wallet: string | null
          telegram: string | null
          telegram_handle: string | null
          updated_at: string
          verified_at: string | null
          verified_by_admin_id: string | null
          verified_method: string | null
          verified_tx_signature: string | null
          x_handle: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          github_handle?: string | null
          id: string
          instagram_handle?: string | null
          is_verified?: boolean
          preferred_language?: string
          solana_wallet?: string | null
          telegram?: string | null
          telegram_handle?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by_admin_id?: string | null
          verified_method?: string | null
          verified_tx_signature?: string | null
          x_handle?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          github_handle?: string | null
          id?: string
          instagram_handle?: string | null
          is_verified?: boolean
          preferred_language?: string
          solana_wallet?: string | null
          telegram?: string | null
          telegram_handle?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by_admin_id?: string | null
          verified_method?: string | null
          verified_tx_signature?: string | null
          x_handle?: string | null
        }
        Relationships: []
      }
      reposts: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          original_post_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          original_post_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          original_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_links: {
        Row: {
          id: number
          instagram_url: string | null
          telegram_url: string | null
          updated_at: string
          whatsapp_url: string | null
          x_url: string | null
        }
        Insert: {
          id?: number
          instagram_url?: string | null
          telegram_url?: string | null
          updated_at?: string
          whatsapp_url?: string | null
          x_url?: string | null
        }
        Update: {
          id?: number
          instagram_url?: string | null
          telegram_url?: string | null
          updated_at?: string
          whatsapp_url?: string | null
          x_url?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          role: string
          sort_order: number
          telegram_url: string | null
          x_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          role: string
          sort_order?: number
          telegram_url?: string | null
          x_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          role?: string
          sort_order?: number
          telegram_url?: string | null
          x_url?: string | null
        }
        Relationships: []
      }
      ticker_config: {
        Row: {
          id: number
          speed_seconds: number
          updated_at: string
        }
        Insert: {
          id?: number
          speed_seconds?: number
          updated_at?: string
        }
        Update: {
          id?: number
          speed_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      ticker_tokens: {
        Row: {
          ativo: boolean
          chain: string
          contract_address: string
          created_at: string
          fonte: string
          id: string
          ordem: number
          symbol: string | null
        }
        Insert: {
          ativo?: boolean
          chain?: string
          contract_address: string
          created_at?: string
          fonte?: string
          id?: string
          ordem?: number
          symbol?: string | null
        }
        Update: {
          ativo?: boolean
          chain?: string
          contract_address?: string
          created_at?: string
          fonte?: string
          id?: string
          ordem?: number
          symbol?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_own_profile: {
        Args: never
        Returns: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          github_handle: string | null
          id: string
          instagram_handle: string | null
          is_verified: boolean
          preferred_language: string
          solana_wallet: string | null
          telegram: string | null
          telegram_handle: string | null
          updated_at: string
          verified_at: string | null
          verified_by_admin_id: string | null
          verified_method: string | null
          verified_tx_signature: string | null
          x_handle: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      post_cache_translation: {
        Args: { _lang: string; _post_id: string; _text: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type: "human" | "ai_agent"
      app_role: "admin" | "user" | "super_admin"
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
    Enums: {
      account_type: ["human", "ai_agent"],
      app_role: ["admin", "user", "super_admin"],
    },
  },
} as const
