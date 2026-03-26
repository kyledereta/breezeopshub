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

// Sort priority within Beach Area
const BEACH_SORT_ORDER: Record<string, number> = {
  "Beach Kubo": 1,
  "Big Kubo": 2,
  "Teepee Kubo": 3,
  "Beach Villa": 4,
};

function getUnitSortKey(name: string): number {
  for (const [prefix, order] of Object.entries(BEACH_SORT_ORDER)) {
    if (name.startsWith(prefix)) return order;
  }
  return 99;
}

export function groupUnitsByArea(units: Unit[]) {
  const grouped: { area: string; units: Unit[] }[] = [];
  for (const area of AREA_ORDER) {
    const areaUnits = units
      .filter((u) => u.area === area)
      .sort((a, b) => {
        const orderA = getUnitSortKey(a.name);
        const orderB = getUnitSortKey(b.name);
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
    if (areaUnits.length > 0) {
      grouped.push({ area, units: areaUnits });
    }
  }
  return grouped;
}