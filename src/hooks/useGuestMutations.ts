import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export function useCreateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (guest: TablesInsert<"guests">) => {
      const { data, error } = await supabase.from("guests").insert(guest).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guests"] }),
  });
}

export function useUpdateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"guests"> & { id: string }) => {
      const { data, error } = await supabase.from("guests").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests"] });
      qc.invalidateQueries({ queryKey: ["guest"] });
    },
  });
}

export function useDeleteGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("guests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests"] });
    },
  });
}

export function useLinkGuestToBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, guestId }: { bookingId: string; guestId: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ guest_id: guestId })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["guest-bookings"] });
    },
  });
}
