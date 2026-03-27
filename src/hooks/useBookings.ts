import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Booking = Tables<"bookings">;

export function useBookings(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["bookings", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("bookings")
        .select("*")
        .is("deleted_at", null);

      if (startDate) {
        query = query.lte("check_in", endDate!).gte("check_out", startDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Booking[];
    },
  });
}

export function useDeletedBookings() {
  return useQuery({
    queryKey: ["bookings", "deleted"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data as Booking[];
    },
  });
}