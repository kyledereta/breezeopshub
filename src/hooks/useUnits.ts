import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Unit = Tables<"units">;

export function useUnits() {
  return useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .order("area")
        .order("name");
      if (error) throw error;
      return data as Unit[];
    },
  });
}

// Group units by area in display order
const AREA_ORDER = ["Owner's Villa", "Beach Area", "Pool Area"];

export function groupUnitsByArea(units: Unit[]) {
  const grouped: { area: string; units: Unit[] }[] = [];
  for (const area of AREA_ORDER) {
    const areaUnits = units.filter((u) => u.area === area);
    if (areaUnits.length > 0) {
      grouped.push({ area, units: areaUnits });
    }
  }
  return grouped;
}