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
  facebook_name: string | null;
  birthday_month: number | null;
  has_pet: boolean;
  gov_id_url: string | null;
  promo_code: string | null;
  payment_method: string | null;
  marketing_consent: boolean;
}

export function useFormSubmissions(status?: string) {
  return useQuery({
    queryKey: ["form_submissions", status],
    queryFn: async () => {
      let query = supabase
        .from("form_submissions")
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

function generateGuestRef(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `G-${y}${m}-${rand}`;
}

export function useApproveSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (submission: FormSubmission) => {
      // Try to find or create guest
      let guestId: string | null = null;

      // Check if guest exists by phone or email
      if (submission.phone || submission.email) {
        let guestQuery = supabase.from("guests").select("id").limit(1);
        if (submission.phone) {
          guestQuery = guestQuery.eq("phone", submission.phone);
        } else if (submission.email) {
          guestQuery = guestQuery.eq("email", submission.email);
        }
        const { data: existingGuest } = await guestQuery.maybeSingle();
        if (existingGuest) {
          guestId = existingGuest.id;
          // Update guest with new info
          const updates: Record<string, any> = {};
          if (submission.birthday_month) updates.birthday_month = submission.birthday_month;
          if (submission.marketing_consent) updates.marketing_consent = true;
          if (submission.has_pet) updates.pets = true;
          if (Object.keys(updates).length > 0) {
            await supabase.from("guests").update(updates).eq("id", guestId);
          }
        }
      }

      if (!guestId) {
        // Create new guest
        const { data: newGuest, error: guestError } = await supabase
          .from("guests")
          .insert({
            guest_ref: generateGuestRef(),
            guest_name: submission.guest_name,
            phone: submission.phone,
            email: submission.email,
            birthday_month: submission.birthday_month,
            marketing_consent: submission.marketing_consent,
            pets: submission.has_pet,
            referral_code: submission.promo_code,
          })
          .select()
          .single();

        if (!guestError && newGuest) {
          guestId = newGuest.id;
        }
      }

      // Store gov ID on guest record if available
      if (guestId && submission.gov_id_url) {
        await supabase.from("guests").update({ 
          notes: submission.gov_id_url 
        }).eq("id", guestId);
      }

      // Build facebook name display for guest_name field
      const displayName = submission.facebook_name 
        ? `${submission.guest_name} (${submission.facebook_name})`
        : submission.guest_name;

      // Create booking from submission
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          booking_ref: generateBookingRef(),
          guest_name: displayName,
          phone: submission.phone,
          email: submission.email,
          check_in: submission.check_in,
          check_out: submission.check_out,
          unit_id: submission.unit_id,
          pax: submission.pax,
          booking_status: "Confirmed" as const,
          booking_source: "Facebook Direct" as const,
          payment_status: "Partial DP" as const,
          guest_id: guestId,
          pets: submission.has_pet,
          referral_code: submission.promo_code,
          dp_mode_of_payment: submission.payment_method,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Update submission status
      const { error: updateError } = await supabase
        .from("form_submissions")
        .update({ status: "Approved", booking_id: booking.id } as any)
        .eq("id", submission.id);

      if (updateError) throw updateError;

      return booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["form_submissions"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["guests"] });
    },
  });
}

export function useRejectSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await supabase
        .from("form_submissions")
        .update({ status: "Rejected", rejection_reason: reason || null } as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["form_submissions"] });
    },
  });
}
