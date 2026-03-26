import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useUnits, type Unit } from "@/hooks/useUnits";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Plus, Target, Percent } from "lucide-react";
import { format, startOfMonth, addMonths } from "date-fns";

// ── Pricing Multipliers ──
function usePricingMultipliers() {
  return useQuery({
    queryKey: ["pricing_multipliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pricing_multipliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

function useUpsertMultiplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { id?: string; name: string; multiplier: number; description: string | null }) => {
      if (row.id) {
        const { error } = await supabase.from("pricing_multipliers").update({ name: row.name, multiplier: row.multiplier, description: row.description }).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pricing_multipliers").insert({ name: row.name, multiplier: row.multiplier, description: row.description });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing_multipliers"] }),
  });
}

// ── Monthly Targets ──
function useMonthlyTargets() {
  return useQuery({
    queryKey: ["monthly_targets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_targets").select("*").order("month");
      if (error) throw error;
      return data;
    },
  });
}

function useUpsertTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { id?: string; month: string; target_revenue: number; target_occupancy: number }) => {
      if (row.id) {
        const { error } = await supabase.from("monthly_targets").update({ target_revenue: row.target_revenue, target_occupancy: row.target_occupancy }).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("monthly_targets").insert({ month: row.month, target_revenue: row.target_revenue, target_occupancy: row.target_occupancy });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly_targets"] }),
  });
}

export default function SettingsPage() {
  const { data: units = [] } = useUnits();
  const { data: multipliers = [] } = usePricingMultipliers();
  const { data: targets = [] } = useMonthlyTargets();
  const upsertMultiplier = useUpsertMultiplier();
  const upsertTarget = useUpsertTarget();

  const [multModal, setMultModal] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [targetModal, setTargetModal] = useState<{ open: boolean; item: any }>({ open: false, item: null });

  // Generate next 6 months for target setup
  const upcomingMonths = useMemo(() => {
    const months: string[] = [];
    const now = startOfMonth(new Date());
    for (let i = 0; i < 6; i++) {
      months.push(format(addMonths(now, i), "yyyy-MM-dd"));
    }
    return months;
  }, []);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
          <h1 className="text-xl sm:text-3xl font-display text-foreground tracking-wide">Settings</h1>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-8">
          {/* Units Overview */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
              Units ({units.length})
            </h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Area</TableHead>
                    <TableHead className="text-muted-foreground text-right">Nightly</TableHead>
                    <TableHead className="text-muted-foreground text-right">Peak</TableHead>
                    <TableHead className="text-muted-foreground text-right">Extension</TableHead>
                    <TableHead className="text-muted-foreground text-center">Max Pax</TableHead>
                    <TableHead className="text-muted-foreground text-center">AC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((u) => (
                    <TableRow key={u.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{u.area}</TableCell>
                      <TableCell className="text-right text-foreground">₱{u.nightly_rate.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-foreground">₱{u.peak_rate.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">₱{u.extension_fee.toLocaleString()}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{u.max_pax}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{u.has_ac ? "✓" : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <Separator />

          {/* Pricing Multipliers */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                <Percent className="h-4 w-4" /> Pricing Multipliers
              </h2>
              <Button size="sm" variant="outline" onClick={() => setMultModal({ open: true, item: null })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground text-right">Multiplier</TableHead>
                    <TableHead className="text-muted-foreground">Description</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {multipliers.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No multipliers yet</TableCell></TableRow>
                  ) : (
                    multipliers.map((m) => (
                      <TableRow key={m.id} className="border-border">
                        <TableCell className="font-medium text-foreground">{m.name}</TableCell>
                        <TableCell className="text-right text-foreground">{m.multiplier}×</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{m.description || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setMultModal({ open: true, item: m })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <Separator />

          {/* Monthly Targets */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                <Target className="h-4 w-4" /> Monthly Targets
              </h2>
              <Button size="sm" variant="outline" onClick={() => setTargetModal({ open: true, item: null })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Month</TableHead>
                    <TableHead className="text-muted-foreground text-right">Revenue Target</TableHead>
                    <TableHead className="text-muted-foreground text-right">Occupancy Target</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No targets set</TableCell></TableRow>
                  ) : (
                    targets.map((t) => (
                      <TableRow key={t.id} className="border-border">
                        <TableCell className="font-medium text-foreground">{format(new Date(t.month), "MMMM yyyy")}</TableCell>
                        <TableCell className="text-right text-foreground">₱{t.target_revenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-foreground">{t.target_occupancy}%</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setTargetModal({ open: true, item: t })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </div>

      {/* Multiplier Modal */}
      <MultiplierModal
        open={multModal.open}
        onOpenChange={(open) => setMultModal((p) => ({ ...p, open }))}
        item={multModal.item}
        onSave={async (data) => {
          await upsertMultiplier.mutateAsync(data);
          toast.success(data.id ? "Multiplier updated" : "Multiplier added");
          setMultModal({ open: false, item: null });
        }}
      />

      {/* Target Modal */}
      <TargetModal
        open={targetModal.open}
        onOpenChange={(open) => setTargetModal((p) => ({ ...p, open }))}
        item={targetModal.item}
        months={upcomingMonths}
        onSave={async (data) => {
          await upsertTarget.mutateAsync(data);
          toast.success(data.id ? "Target updated" : "Target added");
          setTargetModal({ open: false, item: null });
        }}
      />
    </AppLayout>
  );
}

// ── Multiplier Modal ──
function MultiplierModal({ open, onOpenChange, item, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; item: any;
  onSave: (data: any) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [multiplier, setMultiplier] = useState("1.0");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset on open
  useState(() => {});
  const handleOpen = () => {
    if (item) { setName(item.name); setMultiplier(String(item.multiplier)); setDescription(item.description || ""); }
    else { setName(""); setMultiplier("1.0"); setDescription(""); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) handleOpen(); onOpenChange(o); }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground">{item ? "Edit" : "Add"} Multiplier</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Multiplier</Label>
            <Input type="number" step="0.1" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className="bg-background border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background border-border" />
          </div>
          <Button
            className="w-full bg-primary text-primary-foreground"
            disabled={!name.trim() || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ id: item?.id, name: name.trim(), multiplier: parseFloat(multiplier), description: description || null });
              } finally { setSaving(false); }
            }}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Target Modal ──
function TargetModal({ open, onOpenChange, item, months, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; item: any; months: string[];
  onSave: (data: any) => Promise<void>;
}) {
  const [month, setMonth] = useState("");
  const [revenue, setRevenue] = useState("0");
  const [occupancy, setOccupancy] = useState("0");
  const [saving, setSaving] = useState(false);

  const handleOpen = () => {
    if (item) { setMonth(item.month); setRevenue(String(item.target_revenue)); setOccupancy(String(item.target_occupancy)); }
    else { setMonth(months[0] || ""); setRevenue("0"); setOccupancy("0"); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) handleOpen(); onOpenChange(o); }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground">{item ? "Edit" : "Add"} Monthly Target</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!item && (
            <div>
              <Label className="text-xs text-muted-foreground">Month</Label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{format(new Date(m), "MMMM yyyy")}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">Revenue Target (₱)</Label>
            <Input type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} className="bg-background border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Occupancy Target (%)</Label>
            <Input type="number" value={occupancy} onChange={(e) => setOccupancy(e.target.value)} className="bg-background border-border" />
          </div>
          <Button
            className="w-full bg-primary text-primary-foreground"
            disabled={!month || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ id: item?.id, month, target_revenue: parseFloat(revenue), target_occupancy: parseFloat(occupancy) });
              } finally { setSaving(false); }
            }}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
