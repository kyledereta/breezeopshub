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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          id: string
          reason: string | null
          unit_id: string
        }
        Insert: {
          blocked_date: string
          created_at?: string
          id?: string
          reason?: string | null
          unit_id: string
        }
        Update: {
          blocked_date?: string
          created_at?: string
          id?: string
          reason?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_audit_log: {
        Row: {
          booking_id: string
          changed_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          booking_id: string
          changed_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          booking_id?: string
          changed_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_audit_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          bonfire: boolean
          bonfire_fee: number
          booking_group_id: string | null
          booking_ref: string
          booking_source: Database["public"]["Enums"]["booking_source"]
          booking_status: Database["public"]["Enums"]["booking_status"]
          car_details: Json | null
          check_in: string
          check_out: string
          created_at: string
          daytour: boolean
          daytour_fee: number
          deleted_at: string | null
          deletion_reason: string | null
          deposit_deducted_amount: number
          deposit_deducted_reason: string | null
          deposit_paid: number
          deposit_status: Database["public"]["Enums"]["deposit_status"]
          discount_given: number
          discount_reason: string | null
          discount_type: string
          dp_mode_of_payment: string | null
          email: string | null
          extension_fee: number
          extra_pax_fee: number
          extras_paid_status: Json
          guest_id: string | null
          guest_name: string
          has_car: boolean
          id: string
          is_daytour_booking: boolean
          is_primary: boolean
          karaoke: boolean
          karaoke_fee: number
          key_deposit: boolean
          kitchen_use: boolean
          kitchen_use_fee: number
          mode_of_payment: string | null
          notes: string | null
          other_extras_fee: number
          other_extras_note: string | null
          pax: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          pet_fee: number
          pets: boolean
          phone: string | null
          referral_code: string | null
          remaining_mode_of_payment: string | null
          remaining_paid: boolean
          security_deposit: number
          total_amount: number
          towel_rent: boolean
          towel_rent_fee: number
          towel_rent_qty: number
          unit_id: string | null
          updated_at: string
          utensil_rental: boolean
          utensil_rental_fee: number
          water_jug: boolean
          water_jug_fee: number
          water_jug_qty: number
          wristband_deposit: boolean
        }
        Insert: {
          bonfire?: boolean
          bonfire_fee?: number
          booking_group_id?: string | null
          booking_ref: string
          booking_source?: Database["public"]["Enums"]["booking_source"]
          booking_status?: Database["public"]["Enums"]["booking_status"]
          car_details?: Json | null
          check_in: string
          check_out: string
          created_at?: string
          daytour?: boolean
          daytour_fee?: number
          deleted_at?: string | null
          deletion_reason?: string | null
          deposit_deducted_amount?: number
          deposit_deducted_reason?: string | null
          deposit_paid?: number
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          discount_given?: number
          discount_reason?: string | null
          discount_type?: string
          dp_mode_of_payment?: string | null
          email?: string | null
          extension_fee?: number
          extra_pax_fee?: number
          extras_paid_status?: Json
          guest_id?: string | null
          guest_name: string
          has_car?: boolean
          id?: string
          is_daytour_booking?: boolean
          is_primary?: boolean
          karaoke?: boolean
          karaoke_fee?: number
          key_deposit?: boolean
          kitchen_use?: boolean
          kitchen_use_fee?: number
          mode_of_payment?: string | null
          notes?: string | null
          other_extras_fee?: number
          other_extras_note?: string | null
          pax?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pet_fee?: number
          pets?: boolean
          phone?: string | null
          referral_code?: string | null
          remaining_mode_of_payment?: string | null
          remaining_paid?: boolean
          security_deposit?: number
          total_amount?: number
          towel_rent?: boolean
          towel_rent_fee?: number
          towel_rent_qty?: number
          unit_id?: string | null
          updated_at?: string
          utensil_rental?: boolean
          utensil_rental_fee?: number
          water_jug?: boolean
          water_jug_fee?: number
          water_jug_qty?: number
          wristband_deposit?: boolean
        }
        Update: {
          bonfire?: boolean
          bonfire_fee?: number
          booking_group_id?: string | null
          booking_ref?: string
          booking_source?: Database["public"]["Enums"]["booking_source"]
          booking_status?: Database["public"]["Enums"]["booking_status"]
          car_details?: Json | null
          check_in?: string
          check_out?: string
          created_at?: string
          daytour?: boolean
          daytour_fee?: number
          deleted_at?: string | null
          deletion_reason?: string | null
          deposit_deducted_amount?: number
          deposit_deducted_reason?: string | null
          deposit_paid?: number
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          discount_given?: number
          discount_reason?: string | null
          discount_type?: string
          dp_mode_of_payment?: string | null
          email?: string | null
          extension_fee?: number
          extra_pax_fee?: number
          extras_paid_status?: Json
          guest_id?: string | null
          guest_name?: string
          has_car?: boolean
          id?: string
          is_daytour_booking?: boolean
          is_primary?: boolean
          karaoke?: boolean
          karaoke_fee?: number
          key_deposit?: boolean
          kitchen_use?: boolean
          kitchen_use_fee?: number
          mode_of_payment?: string | null
          notes?: string | null
          other_extras_fee?: number
          other_extras_note?: string | null
          pax?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pet_fee?: number
          pets?: boolean
          phone?: string | null
          referral_code?: string | null
          remaining_mode_of_payment?: string | null
          remaining_paid?: boolean
          security_deposit?: number
          total_amount?: number
          towel_rent?: boolean
          towel_rent_fee?: number
          towel_rent_qty?: number
          unit_id?: string | null
          updated_at?: string
          utensil_rental?: boolean
          utensil_rental_fee?: number
          water_jug?: boolean
          water_jug_fee?: number
          water_jug_qty?: number
          wristband_deposit?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          birthday_month: number | null
          created_at: string
          email: string | null
          guest_name: string
          guest_ref: string
          guest_segment: Database["public"]["Enums"]["guest_segment"] | null
          id: string
          location: string | null
          marketing_consent: boolean
          notes: string | null
          parang_dati_tier: Database["public"]["Enums"]["parang_dati_tier"]
          pets: boolean
          phone: string | null
          referral_code: string | null
          total_stays: number
          updated_at: string
        }
        Insert: {
          birthday_month?: number | null
          created_at?: string
          email?: string | null
          guest_name: string
          guest_ref: string
          guest_segment?: Database["public"]["Enums"]["guest_segment"] | null
          id?: string
          location?: string | null
          marketing_consent?: boolean
          notes?: string | null
          parang_dati_tier?: Database["public"]["Enums"]["parang_dati_tier"]
          pets?: boolean
          phone?: string | null
          referral_code?: string | null
          total_stays?: number
          updated_at?: string
        }
        Update: {
          birthday_month?: number | null
          created_at?: string
          email?: string | null
          guest_name?: string
          guest_ref?: string
          guest_segment?: Database["public"]["Enums"]["guest_segment"] | null
          id?: string
          location?: string | null
          marketing_consent?: boolean
          notes?: string | null
          parang_dati_tier?: Database["public"]["Enums"]["parang_dati_tier"]
          pets?: boolean
          phone?: string | null
          referral_code?: string | null
          total_stays?: number
          updated_at?: string
        }
        Relationships: []
      }
      monthly_targets: {
        Row: {
          created_at: string
          id: string
          month: string
          target_occupancy: number
          target_revenue: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          target_occupancy?: number
          target_revenue?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          target_occupancy?: number
          target_revenue?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_multipliers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          multiplier: number
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          multiplier?: number
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          multiplier?: number
          name?: string
        }
        Relationships: []
      }
      unit_status_log: {
        Row: {
          changed_at: string
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          unit_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          unit_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_status_log_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          area: string
          created_at: string
          extension_fee: number
          has_ac: boolean
          id: string
          max_pax: number
          name: string
          nightly_rate: number
          notes: string | null
          peak_rate: number
          status_updated_at: string | null
          unit_status: Database["public"]["Enums"]["unit_status"]
        }
        Insert: {
          area: string
          created_at?: string
          extension_fee?: number
          has_ac?: boolean
          id?: string
          max_pax: number
          name: string
          nightly_rate: number
          notes?: string | null
          peak_rate: number
          status_updated_at?: string | null
          unit_status?: Database["public"]["Enums"]["unit_status"]
        }
        Update: {
          area?: string
          created_at?: string
          extension_fee?: number
          has_ac?: boolean
          id?: string
          max_pax?: number
          name?: string
          nightly_rate?: number
          notes?: string | null
          peak_rate?: number
          status_updated_at?: string | null
          unit_status?: Database["public"]["Enums"]["unit_status"]
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
      booking_source:
        | "Facebook Direct"
        | "Airbnb"
        | "Walk-in"
        | "Referral"
        | "Instagram"
        | "TikTok"
        | "Other"
      booking_status:
        | "Inquiry"
        | "Confirmed"
        | "Checked In"
        | "Checked Out"
        | "Cancelled"
        | "Rescheduled"
        | "Hold"
      deposit_status: "Pending" | "Returned" | "Deducted" | "Collected"
      guest_segment:
        | "Local Family"
        | "Couple"
        | "Balikbayan OFW"
        | "Corporate Group"
        | "Walk-in"
      parang_dati_tier: "New Guest" | "Returning" | "Loyal 3+" | "VIP 5+"
      payment_status:
        | "Unpaid"
        | "Partial DP"
        | "Fully Paid"
        | "Airbnb Paid"
        | "Refunded"
        | "Unpaid Extras"
      unit_status: "Available" | "Under Construction" | "Maintenance" | "Closed"
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
      booking_source: [
        "Facebook Direct",
        "Airbnb",
        "Walk-in",
        "Referral",
        "Instagram",
        "TikTok",
        "Other",
      ],
      booking_status: [
        "Inquiry",
        "Confirmed",
        "Checked In",
        "Checked Out",
        "Cancelled",
        "Rescheduled",
        "Hold",
      ],
      deposit_status: ["Pending", "Returned", "Deducted", "Collected"],
      guest_segment: [
        "Local Family",
        "Couple",
        "Balikbayan OFW",
        "Corporate Group",
        "Walk-in",
      ],
      parang_dati_tier: ["New Guest", "Returning", "Loyal 3+", "VIP 5+"],
      payment_status: [
        "Unpaid",
        "Partial DP",
        "Fully Paid",
        "Airbnb Paid",
        "Refunded",
        "Unpaid Extras",
      ],
      unit_status: ["Available", "Under Construction", "Maintenance", "Closed"],
    },
  },
} as const
