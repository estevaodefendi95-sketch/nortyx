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
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          record_id: string
          table_name: string
          user_email: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id: string
          table_name: string
          user_email?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string
          table_name?: string
          user_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_charges: {
        Row: {
          client_id: string
          created_at: string
          data_cobranca: string
          email_enviado: boolean
          id: string
          meses_restantes: number | null
          organization_id: string | null
          recorrente: boolean
          status: string
          transaction_id: number | null
          valor: number
        }
        Insert: {
          client_id: string
          created_at?: string
          data_cobranca: string
          email_enviado?: boolean
          id?: string
          meses_restantes?: number | null
          organization_id?: string | null
          recorrente?: boolean
          status?: string
          transaction_id?: number | null
          valor: number
        }
        Update: {
          client_id?: string
          created_at?: string
          data_cobranca?: string
          email_enviado?: boolean
          id?: string
          meses_restantes?: number | null
          organization_id?: string | null
          recorrente?: boolean
          status?: string
          transaction_id?: number | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_charges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "billing_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_charges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_clients: {
        Row: {
          created_at: string
          email: string
          forma_cobranca: string | null
          id: string
          nome: string
          organization_id: string | null
          telefone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          forma_cobranca?: string | null
          id?: string
          nome: string
          organization_id?: string | null
          telefone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          forma_cobranca?: string | null
          id?: string
          nome?: string
          organization_id?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_incomes: {
        Row: {
          created_at: string
          data: string
          id: number
          organization_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          data: string
          id?: never
          organization_id?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          id?: never
          organization_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_incomes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          categoria: string | null
          created_at: string
          forma_pagamento: string | null
          id: string
          nome: string
          organization_id: string | null
          pix_code: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          forma_pagamento?: string | null
          id?: string
          nome: string
          organization_id?: string | null
          pix_code?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          forma_pagamento?: string | null
          id?: string
          nome?: string
          organization_id?: string | null
          pix_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          category: string
          content: string
          created_at: string
          id: number
          organization_id: string | null
          title: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: never
          organization_id?: string | null
          title: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: never
          organization_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_dashboard_settings: {
        Row: {
          cmv_categories: string[]
          created_at: string
          id: string
          organization_id: string
          show_cmv: boolean
          show_faturamento_medio: boolean
          show_top_drinks: boolean
          show_top_foods: boolean
          top_drinks_title: string
          top_foods_title: string
          updated_at: string
        }
        Insert: {
          cmv_categories?: string[]
          created_at?: string
          id?: string
          organization_id: string
          show_cmv?: boolean
          show_faturamento_medio?: boolean
          show_top_drinks?: boolean
          show_top_foods?: boolean
          top_drinks_title?: string
          top_foods_title?: string
          updated_at?: string
        }
        Update: {
          cmv_categories?: string[]
          created_at?: string
          id?: string
          organization_id?: string
          show_cmv?: boolean
          show_faturamento_medio?: boolean
          show_top_drinks?: boolean
          show_top_foods?: boolean
          top_drinks_title?: string
          top_foods_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_dashboard_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          plan: string
          primary_color: string
          slug: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          plan?: string
          primary_color?: string
          slug: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          plan?: string
          primary_color?: string
          slug?: string
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          ano: number
          created_at: string
          id: number
          mes: number
          nome: string
          organization_id: string | null
          quantidade: number
          tipo: string
          valor_total: number
        }
        Insert: {
          ano: number
          created_at?: string
          id?: never
          mes: number
          nome: string
          organization_id?: string | null
          quantidade?: number
          tipo?: string
          valor_total?: number
        }
        Update: {
          ano?: number
          created_at?: string
          id?: never
          mes?: number
          nome?: string
          organization_id?: string | null
          quantidade?: number
          tipo?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved: boolean
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: number
          notify_hour: number
          notify_minute: number
          organization_id: string | null
          p256dh: string
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: never
          notify_hour?: number
          notify_minute?: number
          organization_id?: string | null
          p256dh: string
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: never
          notify_hour?: number
          notify_minute?: number
          organization_id?: string | null
          p256dh?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_code: string
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          category_code: string
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          category_code?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tab_visibility: {
        Row: {
          id: string
          organization_id: string | null
          tab_id: string
          user_id: string
          visible: boolean
        }
        Insert: {
          id?: string
          organization_id?: string | null
          tab_id: string
          user_id: string
          visible?: boolean
        }
        Update: {
          id?: string
          organization_id?: string | null
          tab_id?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tab_visibility_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          agendado: boolean
          categoria: string
          created_at: string
          data: string
          empresa: string
          forma_pagamento: string | null
          id: number
          organization_id: string | null
          pago: boolean
          pix_code: string | null
          recurrence_group_id: string | null
          recurrence_type: string | null
          subcategoria: string | null
          tipo: string
          valor: number
        }
        Insert: {
          agendado?: boolean
          categoria: string
          created_at?: string
          data: string
          empresa: string
          forma_pagamento?: string | null
          id?: never
          organization_id?: string | null
          pago?: boolean
          pix_code?: string | null
          recurrence_group_id?: string | null
          recurrence_type?: string | null
          subcategoria?: string | null
          tipo?: string
          valor: number
        }
        Update: {
          agendado?: boolean
          categoria?: string
          created_at?: string
          data?: string
          empresa?: string
          forma_pagamento?: string | null
          id?: never
          organization_id?: string | null
          pago?: boolean
          pix_code?: string | null
          recurrence_group_id?: string | null
          recurrence_type?: string | null
          subcategoria?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      create_organization_with_owner: {
        Args: { _name: string; _slug: string; _user_id: string }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_push_schedule_hour: { Args: never; Returns: number }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      update_push_schedule: { Args: { utc_hour: number }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "viewer"
      org_role: "owner" | "admin" | "member" | "viewer"
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
      app_role: ["admin", "moderator", "user", "viewer"],
      org_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
