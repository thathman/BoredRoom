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
      matches: {
        Row: {
          duration_ms: number | null
          finished_at: string
          game_type: string
          id: string
          match_key: string | null
          player_device_ids: string[]
          player_names: Json
          room_code: string
          turn_count: number | null
          winner_device_id: string | null
        }
        Insert: {
          duration_ms?: number | null
          finished_at?: string
          game_type?: string
          id?: string
          match_key?: string | null
          player_device_ids?: string[]
          player_names?: Json
          room_code: string
          turn_count?: number | null
          winner_device_id?: string | null
        }
        Update: {
          duration_ms?: number | null
          finished_at?: string
          game_type?: string
          id?: string
          match_key?: string | null
          player_device_ids?: string[]
          player_names?: Json
          room_code?: string
          turn_count?: number | null
          winner_device_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string
          created_at: string
          device_id: string
          games_played: number
          updated_at: string
          username: string
          wins: number
        }
        Insert: {
          avatar?: string
          created_at?: string
          device_id: string
          games_played?: number
          updated_at?: string
          username: string
          wins?: number
        }
        Update: {
          avatar?: string
          created_at?: string
          device_id?: string
          games_played?: number
          updated_at?: string
          username?: string
          wins?: number
        }
        Relationships: []
      }
      replay_turns: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          replay_id: string
          snapshot: Json
          turn_number: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          replay_id: string
          snapshot: Json
          turn_number: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          replay_id?: string
          snapshot?: Json
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "replay_turns_replay_id_fkey"
            columns: ["replay_id"]
            isOneToOne: false
            referencedRelation: "replays"
            referencedColumns: ["id"]
          },
        ]
      }
      replays: {
        Row: {
          created_at: string
          duration_ms: number | null
          final_state: Json
          game_type: string
          id: string
          player_names: Json
          recap: Json | null
          room_code: string
          share_token: string
          standings: Json
          turn_count: number | null
          view_count: number
          winner_device_id: string | null
          winner_name: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          final_state: Json
          game_type: string
          id?: string
          player_names?: Json
          recap?: Json | null
          room_code: string
          share_token: string
          standings?: Json
          turn_count?: number | null
          view_count?: number
          winner_device_id?: string | null
          winner_name?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          final_state?: Json
          game_type?: string
          id?: string
          player_names?: Json
          recap?: Json | null
          room_code?: string
          share_token?: string
          standings?: Json
          turn_count?: number | null
          view_count?: number
          winner_device_id?: string | null
          winner_name?: string | null
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
