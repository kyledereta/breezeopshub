import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FormSubmission {
  id: string;
  guest_name: string;
  phone: string | null;
  email: string | null;
  check_in: string;
  check_out: string;
  unit_id: string | null;
  pax: number;
  payment_screenshot_url: string | null;
  status: string;
  rejection_reason: string | null;
  booking_id: string | null;
  raw_payload: any;
  created_at: string;
  updated_at: string;
}

export function useFormSubmissions(status?: string) {
  return useQuery({
    queryKey: ["form_submissions", status],
    queryFn: async () => {
      let query = supabase
        .from("form_submissions" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as FormSubmission[];
    },
  });
}

function generateBookingRef(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BR-${y}${m}-${rand}`;
}

export function useApproveSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (submission: FormSubmission) => {
      // Create booking from submission
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          booking_ref: generateBookingRef(),
          guest_name: submission.guest_name,
          phone: submission.phone,
          email: submission.email,
          check_in: submission.check_in,
          check_out: submission.check_out,
          unit_id: submission.unit_id,
          pax: submission.pax,
          booking_status: "Confirmed" as const,
          booking_source: "Other" as const,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Update submission status
      const { error: updateError } = await supabase
        .from("form_submissions" as any)
        .update({ status: "Approved", booking_id: booking.id } as any)
        .eq("id", submission.id);

      if (updateError) throw updateError;

      return booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["form_submissions"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useRejectSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await supabase
        .from("form_submissions" as any)
        .update({ status: "Rejected", rejection_reason: reason || null } as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["form_submissions"] });
    },
  });
}
