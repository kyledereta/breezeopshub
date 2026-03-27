import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnitStatusLogEntry {
  id: string;
  unit_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  notes: string | null;
}

export function useUnitStatusLog(unitId?: string) {
  return useQuery({
    queryKey: ["unit_status_log", unitId],
    queryFn: async () => {
      if (!unitId) return [];
      const { data, error } = await supabase
        .from("unit_status_log" as any)
        .select("*")
        .eq("unit_id", unitId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data as unknown as UnitStatusLogEntry[];
    },
    enabled: !!unitId,
  });
}

export async function logUnitStatusChange(
  unitId: string,
  oldStatus: string,
  newStatus: string,
  notes?: string
) {
  await supabase.from("unit_status_log" as any).insert({
    unit_id: unitId,
    old_status: oldStatus,
    new_status: newStatus,
    notes: notes || null,
  });
}
