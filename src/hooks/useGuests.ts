import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Guest = Tables<"guests">;

export function useGuests() {
  return useQuery({
    queryKey: ["guests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Guest[];
    },
  });
}

export function useGuest(id: string | undefined) {
  return useQuery({
    queryKey: ["guest", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guests")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Guest;
    },
  });
}

export function useGuestBookings(guestId: string | undefined) {
  return useQuery({
    queryKey: ["guest-bookings", guestId],
    enabled: !!guestId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, units(name, area)")
        .eq("guest_id", guestId!)
        .order("check_in", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
