export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          business_unit: string
          created_at: string
          date: string
          id: string
          operation_id: string
          overtime: boolean
          planned_hours: number
          updated_at: string
          worker_id: string
        }
        Insert: {
          business_unit?: string
          created_at?: string
          date: string
          id?: string
          operation_id: string
          overtime?: boolean
          planned_hours: number
          updated_at?: string
          worker_id: string
        }
        Update: {
          business_unit?: string
          created_at?: string
          date?: string
          id?: string
          operation_id?: string
          overtime?: boolean
          planned_hours?: number
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      build_statuses: {
        Row: {
          clockable: boolean
          code: string
          created_at: string
          id: string
          name: string
          sequence: number
          updated_at: string
        }
        Insert: {
          clockable?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          sequence: number
          updated_at?: string
        }
        Update: {
          clockable?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          sequence?: number
          updated_at?: string
        }
        Relationships: []
      }
      builds: {
        Row: {
          bu_number: string
          business_unit: string
          created_at: string
          customer_id: string
          id: string
          materials_complete: boolean
          order_number: string | null
          order_received_date: string | null
          ow_esd_sales_order_ref: string | null
          ow_sales_order_ref: string | null
          part_id: string
          priority: string
          project_id: string | null
          requested_delivery_date: string | null
          status_id: string
          updated_at: string
        }
        Insert: {
          bu_number: string
          business_unit?: string
          created_at?: string
          customer_id: string
          id?: string
          materials_complete?: boolean
          order_number?: string | null
          order_received_date?: string | null
          ow_esd_sales_order_ref?: string | null
          ow_sales_order_ref?: string | null
          part_id: string
          priority?: string
          project_id?: string | null
          requested_delivery_date?: string | null
          status_id: string
          updated_at?: string
        }
        Update: {
          bu_number?: string
          business_unit?: string
          created_at?: string
          customer_id?: string
          id?: string
          materials_complete?: boolean
          order_number?: string | null
          order_received_date?: string | null
          ow_esd_sales_order_ref?: string | null
          ow_sales_order_ref?: string | null
          part_id?: string
          priority?: string
          project_id?: string | null
          requested_delivery_date?: string | null
          status_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "builds_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "build_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          build_id: string
          business_unit: string
          created_at: string
          file_type: string | null
          filename: string
          id: string
          note_id: string | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          build_id: string
          business_unit?: string
          created_at?: string
          file_type?: string | null
          filename: string
          id?: string
          note_id?: string | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          build_id?: string
          business_unit?: string
          created_at?: string
          file_type?: string | null
          filename?: string
          id?: string
          note_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          date_from: string
          date_to: string
          id: string
          note: string | null
          part_of_day: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          date_from: string
          date_to: string
          id?: string
          note?: string | null
          part_of_day?: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          date_from?: string
          date_to?: string
          id?: string
          note?: string | null
          part_of_day?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_items: {
        Row: {
          booked_in: boolean
          booked_in_date: string | null
          build_id: string
          business_unit: string
          component_part_number: string
          created_at: string
          description: string | null
          expected_delivery_date: string | null
          id: string
          updated_at: string
        }
        Insert: {
          booked_in?: boolean
          booked_in_date?: string | null
          build_id: string
          business_unit?: string
          component_part_number: string
          created_at?: string
          description?: string | null
          expected_delivery_date?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          booked_in?: boolean
          booked_in_date?: string | null
          build_id?: string
          business_unit?: string
          component_part_number?: string
          created_at?: string
          description?: string | null
          expected_delivery_date?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_items_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string
          body: string
          build_id: string
          business_unit: string
          created_at: string
          hidden: boolean
          id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          build_id: string
          business_unit?: string
          created_at?: string
          hidden?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          build_id?: string
          business_unit?: string
          created_at?: string
          hidden?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
        ]
      }
      operations: {
        Row: {
          blocked: boolean
          blocked_reason: string | null
          build_id: string
          business_unit: string
          created_at: string
          depends_on: string | null
          description: string | null
          estimated_hours: number
          id: string
          phase_id: string
          status: string
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          blocked_reason?: string | null
          build_id: string
          business_unit?: string
          created_at?: string
          depends_on?: string | null
          description?: string | null
          estimated_hours?: number
          id?: string
          phase_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          blocked_reason?: string | null
          build_id?: string
          business_unit?: string
          created_at?: string
          depends_on?: string | null
          description?: string | null
          estimated_hours?: number
          id?: string
          phase_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operations_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_depends_on_fkey"
            columns: ["depends_on"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          part_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          part_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          part_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      phases: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          adjusted_at: string | null
          adjusted_by: string | null
          auto_closed: boolean
          business_unit: string
          created_at: string
          ended_at: string | null
          id: string
          operation_id: string
          original_values: Json | null
          ot_class: string
          started_at: string
          updated_at: string
          voided: boolean
          voided_at: string | null
          voided_by: string | null
          worker_id: string
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          auto_closed?: boolean
          business_unit?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          operation_id: string
          original_values?: Json | null
          ot_class?: string
          started_at: string
          updated_at?: string
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
          worker_id: string
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          auto_closed?: boolean
          business_unit?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          operation_id?: string
          original_values?: Json | null
          ot_class?: string
          started_at?: string
          updated_at?: string
          voided?: boolean
          voided_at?: string | null
          voided_by?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_phases: {
        Row: {
          phase_id: string
          worker_id: string
        }
        Insert: {
          phase_id: string
          worker_id: string
        }
        Update: {
          phase_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_phases_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_phases_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          standard_day: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          standard_day?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          standard_day?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      active_time_entries: {
        Row: {
          adjusted_at: string | null
          adjusted_by: string | null
          auto_closed: boolean | null
          business_unit: string | null
          created_at: string | null
          ended_at: string | null
          id: string | null
          operation_id: string | null
          original_values: Json | null
          ot_class: string | null
          started_at: string | null
          updated_at: string | null
          voided: boolean | null
          voided_at: string | null
          voided_by: string | null
          worker_id: string | null
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          auto_closed?: boolean | null
          business_unit?: string | null
          created_at?: string | null
          ended_at?: string | null
          id?: string | null
          operation_id?: string | null
          original_values?: Json | null
          ot_class?: string | null
          started_at?: string | null
          updated_at?: string | null
          voided?: boolean | null
          voided_at?: string | null
          voided_by?: string | null
          worker_id?: string | null
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          auto_closed?: boolean | null
          business_unit?: string | null
          created_at?: string | null
          ended_at?: string | null
          id?: string | null
          operation_id?: string | null
          original_values?: Json | null
          ot_class?: string | null
          started_at?: string | null
          updated_at?: string | null
          voided?: boolean | null
          voided_at?: string | null
          voided_by?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      app_role: { Args: never; Returns: string }
      auto_close_open_time_entries: {
        Args: { before_ts?: string }
        Returns: number
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

