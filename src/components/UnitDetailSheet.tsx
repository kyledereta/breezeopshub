import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Unit } from "@/hooks/useUnits";
import {
  Home, Tent, TreePalm, Crown, Fan, Snowflake,
  CheckCircle, Construction, AlertTriangle, XCircle,
} from "lucide-react";

interface UnitDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: Unit | null;
}

function getUnitIcon(name: string) {
  if (name.includes("Villa") && name.includes("Owner")) return Crown;
  if (name.includes("Villa")) return Home;
  if (name.includes("Teepee")) return Tent;
  if (name.includes("Kubo")) return TreePalm;
  return Home;
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  "Available": { color: "bg-[hsl(142,71%,45%)]/20 text-[hsl(142,71%,45%)] border-[hsl(142,71%,45%)]/30", icon: CheckCircle, label: "Available" },
  "Under Construction": { color: "bg-warning-orange/20 text-warning-orange border-warning-orange/30", icon: Construction, label: "Under Construction" },
  "Maintenance": { color: "bg-[hsl(48,96%,53%)]/20 text-[hsl(48,96%,40%)] border-[hsl(48,96%,53%)]/30", icon: AlertTriangle, label: "Maintenance" },
  "Closed": { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle, label: "Closed" },
};

export function UnitDetailSheet({ open, onOpenChange, unit }: UnitDetailSheetProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const updateUnit = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("units").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
  });

  if (!unit) return null;

  const status = unit.unit_status || "Available";
  const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG["Available"];
  const StatusIcon = statusConf.icon;
  const IconComp = getUnitIcon(unit.name);

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    try {
      await updateUnit.mutateAsync({ id: unit.id, unit_status: newStatus });
      toast.success(`${unit.name} marked as ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[480px] bg-card border-border p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-lg font-display text-foreground">
            Unit Details
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-5">
            {/* Unit Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <IconComp className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold text-foreground">{unit.name}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{unit.area}</p>
              <Badge variant="outline" className={cn("text-xs gap-1", statusConf.color)}>
                <StatusIcon className="h-3 w-3" /> {status}
              </Badge>
            </div>

            <Separator className="bg-border" />

            {/* Amenities */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs gap-1 border-border">
                  {unit.has_ac ? <Snowflake className="h-3 w-3 text-ocean" /> : <Fan className="h-3 w-3 text-muted-foreground" />}
                  {unit.has_ac ? "Air Conditioned" : "Fan Only"}
                </Badge>
                <Badge variant="outline" className="text-xs border-border">
                  {unit.max_pax} PAX max
                </Badge>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Rates */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">Rates</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Nightly</p>
                  <p className="text-sm font-medium text-foreground">₱{unit.nightly_rate.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Peak</p>
                  <p className="text-sm font-medium text-foreground">₱{unit.peak_rate.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Extension</p>
                  <p className="text-sm font-medium text-foreground">₱{unit.extension_fee.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Quick Status Toggle */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">Status</h3>
              <div className="flex gap-2 flex-wrap">
                {(["Available", "Under Construction", "Maintenance", "Closed"] as const).map((s) => {
                  const conf = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      disabled={saving}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-full border transition-all",
                        status === s
                          ? conf.color + " font-medium"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      )}
                      onClick={() => handleStatusChange(s)}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            {unit.notes && (
              <>
                <Separator className="bg-border" />
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{unit.notes}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
