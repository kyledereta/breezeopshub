import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  id: string;
  booking_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export function useBookingAuditLog(bookingId?: string) {
  return useQuery({
    queryKey: ["booking_audit_log", bookingId],
    queryFn: async () => {
      if (!bookingId) return [];
      const { data, error } = await supabase
        .from("booking_audit_log")
        .select("*")
        .eq("booking_id", bookingId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data as AuditLogEntry[];
    },
    enabled: !!bookingId,
  });
}

export async function logBookingChanges(
  bookingId: string,
  oldValues: Record<string, any>,
  newValues: Record<string, any>
) {
  const fieldsToTrack = [
    "guest_name", "unit_id", "check_in", "check_out", "pax",
    "total_amount", "deposit_paid", "payment_status", "booking_status",
    "booking_source", "email", "phone", "notes", "utensil_rental",
    "utensil_rental_fee", "pets", "pet_fee", "deposit_status", "deposit_deducted_amount",
    "extra_pax_fee", "discount_given", "discount_type", "discount_reason",
    "karaoke", "karaoke_fee", "kitchen_use", "kitchen_use_fee",
    "water_jug", "water_jug_qty", "water_jug_fee",
    "towel_rent", "towel_rent_qty", "towel_rent_fee",
    "bonfire", "bonfire_fee", "extension_fee", "security_deposit",
  ];

  const changes: { booking_id: string; field_name: string; old_value: string | null; new_value: string | null }[] = [];

  for (const field of fieldsToTrack) {
    const oldVal = String(oldValues[field] ?? "");
    const newVal = String(newValues[field] ?? "");
    if (oldVal !== newVal) {
      changes.push({
        booking_id: bookingId,
        field_name: field,
        old_value: oldVal || null,
        new_value: newVal || null,
      });
    }
  }

  if (changes.length > 0) {
    await supabase.from("booking_audit_log").insert(changes);
  }
}
