import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useUnits, groupUnitsByArea, type Unit } from "@/hooks/useUnits";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Home, Tent, TreePalm, Crown, Fan, Snowflake, Search, Pencil, Construction, CheckCircle, AlertTriangle, XCircle, Download, SprayCan, Wrench, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/csvExport";
import { format, parseISO, formatDistanceToNow } from "date-fns";

const DAMAGE_OPTIONS = [
  "Faucet", "Toilet", "Shower Head", "Door Lock", "Window", "Light Fixture",
  "Ceiling Fan", "Air Conditioner", "Mattress", "Bed Frame", "Cabinet",
  "Flooring", "Wall Damage", "Roof Leak", "Electrical Outlet", "Plumbing",
  "Screen Door", "Water Heater", "Towel Rack", "Mirror", "Other",
];

function getUnitIcon(name: string) {
  if (name.includes("Villa") && name.includes("Owner")) return Crown;
  if (name.includes("Villa")) return Home;
  if (name.includes("Teepee")) return Tent;
  if (name.includes("Kubo")) return TreePalm;
  return Home;
}

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  "Available": { color: "bg-[hsl(142,71%,45%)]/20 text-[hsl(142,71%,45%)] border-[hsl(142,71%,45%)]/30", icon: CheckCircle },
  "Under Construction": { color: "bg-warning-orange/20 text-warning-orange border-warning-orange/30", icon: Construction },
  "Maintenance": { color: "bg-[hsl(48,96%,53%)]/20 text-[hsl(48,96%,40%)] border-[hsl(48,96%,53%)]/30", icon: AlertTriangle },
  "Closed": { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
};

function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("units").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
  });
}

export default function UnitsPage() {
  const { data: units = [], isLoading } = useUnits();
  const updateUnit = useUpdateUnit();
  const [search, setSearch] = useState("");
  const [editModal, setEditModal] = useState<{ open: boolean; unit: Unit | null }>({ open: false, unit: null });

  const grouped = useMemo(() => groupUnitsByArea(units), [units]);

  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    return grouped
      .map(({ area, units: areaUnits }) => ({
        area,
        units: areaUnits.filter(
          (u) => u.name.toLowerCase().includes(q) || u.area.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.units.length > 0);
  }, [grouped, search]);

  const handleStatusToggle = async (unit: Unit, newStatus: string) => {
    try {
      await updateUnit.mutateAsync({ id: unit.id, unit_status: newStatus });
      toast.success(`${unit.name} marked as ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update");
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
          <h1 className="text-xl sm:text-3xl font-display text-foreground tracking-wide">Units</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                const headers = ["Name", "Area", "Status", "Max Pax", "Nightly Rate", "Peak Rate", "Extension Fee", "AC", "Notes"];
                const rows = units.map((u) => [
                  u.name, u.area, (u as any).unit_status || "Available", String(u.max_pax),
                  String(u.nightly_rate), String(u.peak_rate), String(u.extension_fee),
                  u.has_ac ? "Yes" : "No", u.notes || "",
                ]);
                downloadCsv("units.csv", headers, rows);
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Export
            </Button>
            <span className="text-xs text-muted-foreground">{units.length} units</span>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 border-b border-border shrink-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search units..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-muted-foreground text-sm">Loading...</span>
            </div>
          ) : (
            filteredGrouped.map(({ area, units: areaUnits }) => (
              <section key={area}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-primary mb-3">{area}</h2>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {areaUnits.map((unit) => {
                    const IconComp = getUnitIcon(unit.name);
                    const status = (unit as any).unit_status || "Available";
                    const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG["Available"];
                    const StatusIcon = statusConf.icon;

                    return (
                      <div
                        key={unit.id}
                        className={cn(
                          "rounded-xl border border-border bg-card p-4 space-y-3 transition-all hover:shadow-md",
                          status !== "Available" && "opacity-75"
                        )}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <IconComp className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <h3 className="font-medium text-foreground text-sm">{unit.name}</h3>
                              <p className="text-[10px] text-muted-foreground">{unit.area}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditModal({ open: true, unit })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Status Badge */}
                        <Badge variant="outline" className={cn("text-[10px] gap-1", statusConf.color)}>
                          <StatusIcon className="h-3 w-3" /> {status}
                        </Badge>

                        {/* Amenities */}
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="text-[10px] gap-1 border-border">
                            {unit.has_ac ? <Snowflake className="h-3 w-3 text-ocean" /> : <Fan className="h-3 w-3 text-muted-foreground" />}
                            {unit.has_ac ? "Air Conditioned" : "Fan Only"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-border">
                            {unit.max_pax} PAX max
                          </Badge>
                        </div>

                        {/* Rates */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-background border border-border p-2">
                            <p className="text-[9px] uppercase text-muted-foreground">Nightly</p>
                            <p className="text-xs font-medium text-foreground">₱{unit.nightly_rate.toLocaleString()}</p>
                          </div>
                          <div className="rounded-lg bg-background border border-border p-2">
                            <p className="text-[9px] uppercase text-muted-foreground">Peak</p>
                            <p className="text-xs font-medium text-foreground">₱{unit.peak_rate.toLocaleString()}</p>
                          </div>
                          <div className="rounded-lg bg-background border border-border p-2">
                            <p className="text-[9px] uppercase text-muted-foreground">Extension</p>
                            <p className="text-xs font-medium text-foreground">₱{unit.extension_fee.toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Deep Cleaning */}
                        <div className="pt-1 border-t border-border space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <SprayCan className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Deep Cleaned</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] px-2 text-primary hover:text-primary"
                              onClick={async () => {
                                try {
                                  await updateUnit.mutateAsync({ id: unit.id, last_deep_cleaned: format(new Date(), "yyyy-MM-dd") });
                                  toast.success(`${unit.name} marked as deep cleaned today`);
                                } catch (err: any) {
                                  toast.error(err.message ?? "Failed to update");
                                }
                              }}
                            >
                              Mark Today
                            </Button>
                          </div>
                          <p className="text-[11px] text-foreground">
                            {(unit as any).last_deep_cleaned
                              ? `${format(parseISO((unit as any).last_deep_cleaned), "MMM d, yyyy")} (${formatDistanceToNow(parseISO((unit as any).last_deep_cleaned), { addSuffix: true })})`
                              : "Never recorded"}
                          </p>
                        </div>

                        {/* Damage Items */}
                        {(() => {
                          const damages: string[] = (unit as any).damage_items || [];
                          return damages.length > 0 ? (
                            <div className="pt-1 border-t border-border space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Wrench className="h-3 w-3 text-destructive" />
                                <span className="text-[10px] text-destructive uppercase tracking-wider font-medium">Needs Attention</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {damages.map((d) => (
                                  <Badge key={d} variant="outline" className="text-[9px] border-destructive/30 text-destructive bg-destructive/10">
                                    {d}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Quick Status Toggle */}
                        <div className="pt-1 border-t border-border space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Quick Status</span>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {(["Available", "Under Construction", "Maintenance", "Closed"] as const).map((s) => (
                              <button
                                key={s}
                                className={cn(
                                  "text-[9px] px-2 py-1 rounded-full border transition-all",
                                  status === s
                                    ? STATUS_CONFIG[s].color + " font-medium"
                                    : "border-border text-muted-foreground hover:border-foreground/30"
                                )}
                                onClick={() => handleStatusToggle(unit, s)}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Notes */}
                        {unit.notes && (
                          <p className="text-[11px] text-muted-foreground italic border-t border-border pt-2">{unit.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <UnitEditModal
        open={editModal.open}
        onOpenChange={(open) => setEditModal((p) => ({ ...p, open }))}
        unit={editModal.unit}
      />
    </AppLayout>
  );
}

function UnitEditModal({ open, onOpenChange, unit }: { open: boolean; onOpenChange: (o: boolean) => void; unit: Unit | null }) {
  const updateUnit = useUpdateUnit();
  const [nightlyRate, setNightlyRate] = useState("");
  const [peakRate, setPeakRate] = useState("");
  const [extensionFee, setExtensionFee] = useState("");
  const [maxPax, setMaxPax] = useState("");
  const [hasAc, setHasAc] = useState(false);
  const [notes, setNotes] = useState("");
  const [unitStatus, setUnitStatus] = useState("Available");
  const [saving, setSaving] = useState(false);

  // Reset on open
  const handleOpen = () => {
    if (unit) {
      setNightlyRate(String(unit.nightly_rate));
      setPeakRate(String(unit.peak_rate));
      setExtensionFee(String(unit.extension_fee));
      setMaxPax(String(unit.max_pax));
      setHasAc(unit.has_ac);
      setNotes(unit.notes || "");
      setUnitStatus((unit as any).unit_status || "Available");
    }
  };

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) handleOpen(); onOpenChange(o); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground">Edit {unit.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nightly Rate (₱)</Label>
              <Input type="number" value={nightlyRate} onChange={(e) => setNightlyRate(e.target.value)} className="bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Peak Rate (₱)</Label>
              <Input type="number" value={peakRate} onChange={(e) => setPeakRate(e.target.value)} className="bg-background border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Extension Fee (₱)</Label>
              <Input type="number" value={extensionFee} onChange={(e) => setExtensionFee(e.target.value)} className="bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max PAX</Label>
              <Input type="number" value={maxPax} onChange={(e) => setMaxPax(e.target.value)} className="bg-background border-border" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={unitStatus} onValueChange={setUnitStatus}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Under Construction">Under Construction</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Switch checked={hasAc} onCheckedChange={setHasAc} />
            <Label className="text-xs text-foreground">Air Conditioned</Label>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-background border-border resize-none h-20" />
          </div>
          <Button
            className="w-full bg-primary text-primary-foreground"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await updateUnit.mutateAsync({
                  id: unit.id,
                  nightly_rate: parseFloat(nightlyRate),
                  peak_rate: parseFloat(peakRate),
                  extension_fee: parseFloat(extensionFee),
                  max_pax: parseInt(maxPax),
                  has_ac: hasAc,
                  notes: notes || null,
                  unit_status: unitStatus,
                });
                toast.success("Unit updated");
                onOpenChange(false);
              } catch (err: any) {
                toast.error(err.message ?? "Failed to update");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
