import { useState, useMemo } from "react";
import { useUnits, groupUnitsByArea } from "@/hooks/useUnits";
import { Calculator, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

export function QuickCalculator() {
  const { data: units = [] } = useUnits();
  const grouped = useMemo(() => groupUnitsByArea(units), [units]);

  const [expanded, setExpanded] = useState(false);
  const [unitId, setUnitId] = useState<string>("");
  const [nights, setNights] = useState(1);
  const [usePeakRate, setUsePeakRate] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [depositPaid, setDepositPaid] = useState(0);

  // Extras state: { [key]: { enabled, fee, qty } }
  const [extras, setExtras] = useState<Record<string, { enabled: boolean; fee: number; qty: number }>>(() => {
    const init: Record<string, { enabled: boolean; fee: number; qty: number }> = {};
    for (const e of EXTRAS) {
      init[e.key] = { enabled: false, fee: e.defaultFee, qty: 1 };
    }
    return init;
  });

  const selectedUnit = units.find((u) => u.id === unitId);
  const nightlyRate = selectedUnit ? (usePeakRate ? selectedUnit.peak_rate : selectedUnit.nightly_rate) : 0;
  const accommodationTotal = nightlyRate * nights;

  const extrasTotal = useMemo(() => {
    let total = 0;
    for (const e of EXTRAS) {
      const s = extras[e.key];
      if (s.enabled) {
        total += s.fee * (e.hasQty ? s.qty : 1);
      }
    }
    return total;
  }, [extras]);

  const subtotal = accommodationTotal + extrasTotal;
  const grandTotal = Math.max(subtotal - discount, 0);
  const balance = Math.max(grandTotal - depositPaid, 0);

  const toggleExtra = (key: string) => {
    setExtras((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  };
  const setExtraFee = (key: string, fee: number) => {
    setExtras((prev) => ({ ...prev, [key]: { ...prev[key], fee } }));
  };
  const setExtraQty = (key: string, qty: number) => {
    setExtras((prev) => ({ ...prev, [key]: { ...prev[key], qty: Math.max(qty, 1) } }));
  };

  const handleReset = () => {
    setUnitId("");
    setNights(1);
    setUsePeakRate(false);
    setDiscount(0);
    setDepositPaid(0);
    const init: Record<string, { enabled: boolean; fee: number; qty: number }> = {};
    for (const e of EXTRAS) {
      init[e.key] = { enabled: false, fee: e.defaultFee, qty: 1 };
    }
    setExtras(init);
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Quick Calculator</span>
          {grandTotal > 0 && !expanded && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
              ₱{grandTotal.toLocaleString()}
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Unit & Nights row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Unit</Label>
              <Select value={unitId} onValueChange={setUnitId}>
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
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Nights</Label>
              <Input
                type="number"
                min={1}
                value={nights}
                onChange={(e) => setNights(Math.max(1, Number(e.target.value)))}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Rate info */}
          {selectedUnit && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  Rate: ₱{nightlyRate.toLocaleString()} × {nights}n = <span className="font-semibold text-foreground">₱{accommodationTotal.toLocaleString()}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="peak"
                  checked={usePeakRate}
                  onCheckedChange={(v) => setUsePeakRate(!!v)}
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor="peak" className="text-[10px] text-muted-foreground cursor-pointer">
                  Peak (₱{selectedUnit.peak_rate.toLocaleString()})
                </Label>
              </div>
            </div>
          )}

          {/* Extras */}
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Add-ons / Extras</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {EXTRAS.map((e) => {
                const s = extras[e.key];
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
                      onCheckedChange={() => toggleExtra(e.key)}
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
                            onChange={(ev) => setExtraQty(e.key, Number(ev.target.value))}
                            className="h-5 w-8 text-[10px] px-1 text-center"
                            onClick={(ev) => ev.stopPropagation()}
                          />
                        )}
                        <Input
                          type="number"
                          min={0}
                          value={s.fee}
                          onChange={(ev) => setExtraFee(e.key, Number(ev.target.value))}
                          className="h-5 w-14 text-[10px] px-1 text-right"
                          onClick={(ev) => ev.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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

          {/* Summary */}
          <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Accommodation</span>
              <span>₱{accommodationTotal.toLocaleString()}</span>
            </div>
            {extrasTotal > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Extras</span>
                <span>₱{extrasTotal.toLocaleString()}</span>
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

          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground gap-1.5" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}
