import { useState, useMemo, useCallback } from "react";
import { useUnits, groupUnitsByArea } from "@/hooks/useUnits";
import { Calculator, ChevronDown, ChevronUp, RotateCcw, Plus, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

const EXTRAS = [
  { key: "extra_pax", label: "Extra Pax", defaultFee: 0, hasQty: true },
  { key: "early_checkin", label: "Early Check-in", defaultFee: 500, hasQty: false },
  { key: "karaoke", label: "Karaoke", defaultFee: 0, hasQty: false },
  { key: "kitchen_use", label: "Kitchen Use", defaultFee: 0, hasQty: false },
  { key: "bonfire", label: "Bonfire", defaultFee: 0, hasQty: false },
  { key: "atv", label: "ATV Ride", defaultFee: 600, hasQty: false },
  { key: "banana_boat", label: "Banana Boat", defaultFee: 150, hasQty: true },
  { key: "towel_rent", label: "Towel Rental", defaultFee: 0, hasQty: true },
  { key: "water_jug", label: "Water Jug", defaultFee: 0, hasQty: true },
  { key: "utensil_rental", label: "Utensil Rental", defaultFee: 0, hasQty: false },
  { key: "pet_fee", label: "Pet Fee", defaultFee: 0, hasQty: false },
  { key: "daytour", label: "Day Tour Fee", defaultFee: 0, hasQty: false },
  { key: "extension", label: "Extension Fee", defaultFee: 0, hasQty: false },
  { key: "other", label: "Other Extras", defaultFee: 0, hasQty: false },
] as const;

type ExtrasState = Record<string, { enabled: boolean; fee: number; qty: number }>;

interface UnitEntry {
  id: string;
  unitId: string;
  nights: number;
  pax: number;
  checkIn: string;
  checkOut: string;
  extras: ExtrasState;
}

function createDefaultExtras(): ExtrasState {
  const init: ExtrasState = {};
  for (const e of EXTRAS) {
    init[e.key] = { enabled: false, fee: e.defaultFee, qty: 1 };
  }
  return init;
}

function createUnitEntry(): UnitEntry {
  return {
    id: crypto.randomUUID(),
    unitId: "",
    nights: 1,
    pax: 2,
    checkIn: "",
    checkOut: "",
    extras: createDefaultExtras(),
  };
}

export function QuickCalculator() {
  const { data: units = [] } = useUnits();
  const grouped = useMemo(() => groupUnitsByArea(units), [units]);

  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<UnitEntry[]>(() => [createUnitEntry()]);
  const [discount, setDiscount] = useState(0);
  const [depositPaid, setDepositPaid] = useState(0);
  const [copied, setCopied] = useState(false);
  const [groupCheckIn, setGroupCheckIn] = useState("");
  const [groupCheckOut, setGroupCheckOut] = useState("");
  const [groupNights, setGroupNights] = useState(1);

  const isGroup = entries.length > 1;

  const updateEntry = useCallback((entryId: string, patch: Partial<UnitEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...patch } : e)));
  }, []);

  const toggleExtra = useCallback((entryId: string, key: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, extras: { ...e.extras, [key]: { ...e.extras[key], enabled: !e.extras[key].enabled } } }
          : e
      )
    );
  }, []);

  const setExtraFee = useCallback((entryId: string, key: string, fee: number) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, extras: { ...e.extras, [key]: { ...e.extras[key], fee } } } : e
      )
    );
  }, []);

  const setExtraQty = useCallback((entryId: string, key: string, qty: number) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, extras: { ...e.extras, [key]: { ...e.extras[key], qty: Math.max(qty, 1) } } }
          : e
      )
    );
  }, []);

  const addUnit = () => setEntries((prev) => [...prev, createUnitEntry()]);
  const removeUnit = (entryId: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== entryId);
      return next.length === 0 ? [createUnitEntry()] : next;
    });
  };

  const getAccommodation = (entry: UnitEntry) => {
    const unit = units.find((u) => u.id === entry.unitId);
    if (!unit) return 0;
    const nights = isGroup ? groupNights : entry.nights;
    return unit.nightly_rate * nights;
  };

  const getExtrasTotal = (entry: UnitEntry) => {
    let total = 0;
    for (const e of EXTRAS) {
      const s = entry.extras[e.key];
      if (s.enabled) total += s.fee * (e.hasQty ? s.qty : 1);
    }
    return total;
  };

  const getEntryTotal = (entry: UnitEntry) => getAccommodation(entry) + getExtrasTotal(entry);

  const subtotal = useMemo(() => entries.reduce((s, e) => s + getEntryTotal(e), 0), [entries, units, groupNights, isGroup]);
  const grandTotal = Math.max(subtotal - discount, 0);
  const balance = Math.max(grandTotal - depositPaid, 0);

  const handleReset = () => {
    setEntries([createUnitEntry()]);
    setDiscount(0);
    setDepositPaid(0);
    setGroupCheckIn("");
    setGroupCheckOut("");
    setGroupNights(1);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      return format(parseISO(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const handleCopy = () => {
    const lines: string[] = [];

    // For group bookings, show shared dates at top
    if (isGroup) {
      if (groupCheckIn || groupCheckOut) {
        const ci = groupCheckIn ? formatDate(groupCheckIn) : "—";
        const co = groupCheckOut ? formatDate(groupCheckOut) : "—";
        lines.push(`📅 ${ci} → ${co} (${groupNights}n)`);
      } else {
        lines.push(`📅 ${groupNights} night(s)`);
      }
      lines.push("");
    }

    for (const entry of entries) {
      const unit = units.find((u) => u.id === entry.unitId);
      if (!unit) continue;

      const unitLine = `${unit.name} (${entry.pax} pax)`;
      lines.push(unitLine);

      if (!isGroup) {
        if (entry.checkIn || entry.checkOut) {
          const ci = entry.checkIn ? formatDate(entry.checkIn) : "—";
          const co = entry.checkOut ? formatDate(entry.checkOut) : "—";
          lines.push(`${ci} → ${co} (${entry.nights}n)`);
        } else {
          lines.push(`${entry.nights} night(s)`);
        }
      }

      lines.push(`Accommodation: ₱${getAccommodation(entry).toLocaleString()}`);

      const enabledExtras = EXTRAS.filter((e) => entry.extras[e.key].enabled);
      if (enabledExtras.length > 0) {
        for (const e of enabledExtras) {
          const s = entry.extras[e.key];
          const amt = s.fee * (e.hasQty ? s.qty : 1);
          const qtyLabel = e.hasQty && s.qty > 1 ? ` x${s.qty}` : "";
          lines.push(`${e.label}${qtyLabel}: ₱${amt.toLocaleString()}`);
        }
      }

      lines.push(`Unit Total: ₱${getEntryTotal(entry).toLocaleString()}`);
      lines.push("");
    }

    if (isGroup) {
      lines.push(`Subtotal (${entries.length} units): ₱${subtotal.toLocaleString()}`);
    }
    if (discount > 0) {
      lines.push(`Discount: -₱${discount.toLocaleString()}`);
    }
    lines.push(`Total: ₱${grandTotal.toLocaleString()}`);
    if (depositPaid > 0) {
      lines.push(`Deposit Paid: ₱${depositPaid.toLocaleString()}`);
      lines.push(`Balance Due: ₱${balance.toLocaleString()}`);
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      toast.success("Summary copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Quick Calculator</span>
          {grandTotal > 0 && !expanded && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
              ₱{grandTotal.toLocaleString()}{isGroup ? ` (${entries.length} units)` : ""}
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Group-level dates & nights */}
          {isGroup && (
            <div className="rounded-md border border-border p-3 bg-muted/30 space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Group Dates</span>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Check-in</Label>
                  <Input
                    type="date"
                    value={groupCheckIn}
                    onChange={(e) => setGroupCheckIn(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Check-out</Label>
                  <Input
                    type="date"
                    value={groupCheckOut}
                    onChange={(e) => setGroupCheckOut(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Nights</Label>
                  <Input
                    type="number"
                    min={1}
                    value={groupNights}
                    onChange={(e) => setGroupNights(Math.max(1, Number(e.target.value)))}
                    className="h-8 w-14 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {entries.map((entry, idx) => (
            <UnitEntryCard
              key={entry.id}
              entry={entry}
              index={idx}
              units={units}
              grouped={grouped}
              isGroup={isGroup}
              accommodation={getAccommodation(entry)}
              extrasTotal={getExtrasTotal(entry)}
              entryTotal={getEntryTotal(entry)}
              onUpdate={updateEntry}
              onToggleExtra={toggleExtra}
              onSetExtraFee={setExtraFee}
              onSetExtraQty={setExtraQty}
              onRemove={() => removeUnit(entry.id)}
            />
          ))}

          {/* Add unit button */}
          <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 border-dashed" onClick={addUnit}>
            <Plus className="h-3 w-3" />
            Add Unit {isGroup ? `(${entries.length + 1})` : "(Group Booking)"}
          </Button>

          {/* Discount & Deposit */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Discount</Label>
              <Input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                className="h-8 text-xs"
                placeholder="₱0"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Deposit Paid</Label>
              <Input
                type="number"
                min={0}
                value={depositPaid}
                onChange={(e) => setDepositPaid(Math.max(0, Number(e.target.value)))}
                className="h-8 text-xs"
                placeholder="₱0"
              />
            </div>
          </div>

          {/* Grand Summary */}
          <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-xs">
            {isGroup && entries.map((entry) => {
              const unit = units.find((u) => u.id === entry.unitId);
              const total = getEntryTotal(entry);
              if (!unit || total === 0) return null;
              return (
                <div key={entry.id} className="flex justify-between text-muted-foreground">
                  <span>{unit.name} ({entry.pax} pax)</span>
                  <span>₱{total.toLocaleString()}</span>
                </div>
              );
            })}
            {!isGroup && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Accommodation</span>
                  <span>₱{getAccommodation(entries[0]).toLocaleString()}</span>
                </div>
                {getExtrasTotal(entries[0]) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Extras</span>
                    <span>₱{getExtrasTotal(entries[0]).toLocaleString()}</span>
                  </div>
                )}
              </>
            )}
            {isGroup && (
              <div className="flex justify-between text-muted-foreground border-t border-border pt-1">
                <span>Subtotal ({entries.length} units)</span>
                <span>₱{subtotal.toLocaleString()}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Discount</span>
                <span>-₱{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5">
              <span>Total</span>
              <span>₱{grandTotal.toLocaleString()}</span>
            </div>
            {depositPaid > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Deposit Paid</span>
                  <span>-₱{depositPaid.toLocaleString()}</span>
                </div>
                <div className={cn("flex justify-between font-bold text-sm", balance > 0 ? "text-destructive" : "text-primary")}>
                  <span>Balance Due</span>
                  <span>₱{balance.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy Summary"}
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 text-xs text-muted-foreground gap-1.5" onClick={handleReset}>
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Per-unit card ─── */

interface UnitEntryCardProps {
  entry: UnitEntry;
  index: number;
  units: ReturnType<typeof useUnits>["data"] & {};
  grouped: ReturnType<typeof groupUnitsByArea>;
  isGroup: boolean;
  accommodation: number;
  extrasTotal: number;
  entryTotal: number;
  onUpdate: (id: string, patch: Partial<UnitEntry>) => void;
  onToggleExtra: (id: string, key: string) => void;
  onSetExtraFee: (id: string, key: string, fee: number) => void;
  onSetExtraQty: (id: string, key: string, qty: number) => void;
  onRemove: () => void;
}

function UnitEntryCard({
  entry, index, units, grouped, isGroup,
  accommodation, extrasTotal, entryTotal,
  onUpdate, onToggleExtra, onSetExtraFee, onSetExtraQty, onRemove,
}: UnitEntryCardProps) {
  const selectedUnit = units.find((u) => u.id === entry.unitId);
  const nightlyRate = selectedUnit ? selectedUnit.nightly_rate : 0;
  const [extrasOpen, setExtrasOpen] = useState(false);

  return (
    <div className={cn("space-y-2", isGroup && "rounded-md border border-border p-3 bg-background")}>
      {isGroup && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Unit {index + 1}
          </span>
          <div className="flex items-center gap-2">
            {entryTotal > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                ₱{entryTotal.toLocaleString()}
              </Badge>
            )}
            <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Unit & Pax */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Unit</Label>
          <Select value={entry.unitId} onValueChange={(v) => onUpdate(entry.id, { unitId: v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {grouped.map(({ area, units: areaUnits }) => (
                <div key={area}>
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{area}</div>
                  {areaUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.name} — ₱{u.nightly_rate.toLocaleString()}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Pax</Label>
          <Input
            type="number"
            min={1}
            value={entry.pax}
            onChange={(e) => onUpdate(entry.id, { pax: Math.max(1, Number(e.target.value)) })}
            className="h-8 w-16 text-xs"
          />
        </div>
      </div>

      {/* Dates & Nights — only show for single bookings */}
      {!isGroup && (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Check-in</Label>
            <Input
              type="date"
              value={entry.checkIn}
              onChange={(e) => onUpdate(entry.id, { checkIn: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Check-out</Label>
            <Input
              type="date"
              value={entry.checkOut}
              onChange={(e) => onUpdate(entry.id, { checkOut: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Nights</Label>
            <Input
              type="number"
              min={1}
              value={entry.nights}
              onChange={(e) => onUpdate(entry.id, { nights: Math.max(1, Number(e.target.value)) })}
              className="h-8 w-14 text-xs"
            />
          </div>
        </div>
      )}

      {/* Rate info */}
      {selectedUnit && (
        <div className="text-xs text-muted-foreground">
          ₱{nightlyRate.toLocaleString()} × {entry.nights}n = <span className="font-semibold text-foreground">₱{accommodation.toLocaleString()}</span>
        </div>
      )}

      {/* Extras toggle */}
      <button
        onClick={() => setExtrasOpen(!extrasOpen)}
        className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {extrasOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Add-ons{extrasTotal > 0 ? ` (₱${extrasTotal.toLocaleString()})` : ""}
      </button>

      {extrasOpen && (
        <div className="grid grid-cols-2 gap-1.5">
          {EXTRAS.map((e) => {
            const s = entry.extras[e.key];
            return (
              <div
                key={e.key}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors",
                  s.enabled ? "border-primary/30 bg-primary/5" : "border-border"
                )}
              >
                <Checkbox
                  checked={s.enabled}
                  onCheckedChange={() => onToggleExtra(entry.id, e.key)}
                  className="h-3 w-3"
                />
                <span className="text-[11px] text-foreground flex-1 truncate">{e.label}</span>
                {s.enabled && (
                  <div className="flex items-center gap-1">
                    {e.hasQty && (
                      <Input
                        type="number"
                        min={1}
                        value={s.qty}
                        onChange={(ev) => onSetExtraQty(entry.id, e.key, Number(ev.target.value))}
                        className="h-5 w-8 text-[10px] px-1 text-center"
                        onClick={(ev) => ev.stopPropagation()}
                      />
                    )}
                    <Input
                      type="number"
                      min={0}
                      value={s.fee}
                      onChange={(ev) => onSetExtraFee(entry.id, e.key, Number(ev.target.value))}
                      className="h-5 w-14 text-[10px] px-1 text-right"
                      onClick={(ev) => ev.stopPropagation()}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
