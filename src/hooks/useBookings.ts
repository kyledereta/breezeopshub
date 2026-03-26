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
        .not("booking_status", "eq", "Cancelled");

      if (startDate) {
        query = query.lte("check_in", endDate!).gte("check_out", startDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Booking[];
    },
  });
}