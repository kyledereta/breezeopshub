import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BlockedDate {
  id: string;
  unit_id: string;
  blocked_date: string;
  reason: string | null;
  created_at: string;
}

export function useBlockedDates(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["blocked_dates", startDate, endDate],
    queryFn: async () => {
      let query = supabase.from("blocked_dates").select("*");
      if (startDate && endDate) {
        query = query.gte("blocked_date", startDate).lte("blocked_date", endDate);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as BlockedDate[];
    },
  });
}

export function useBlockDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ unit_id, blocked_date, reason }: { unit_id: string; blocked_date: string; reason?: string }) => {
      const { error } = await supabase
        .from("blocked_dates")
        .upsert({ unit_id, blocked_date, reason: reason || null }, { onConflict: "unit_id,blocked_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked_dates"] });
    },
  });
}

export function useUnblockDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ unit_id, blocked_date }: { unit_id: string; blocked_date: string }) => {
      const { error } = await supabase
        .from("blocked_dates")
        .delete()
        .eq("unit_id", unit_id)
        .eq("blocked_date", blocked_date);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked_dates"] });
    },
  });
}
