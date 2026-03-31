import { useState, useEffect, useMemo } from "react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUnits } from "@/hooks/useUnits";
import { useUpdateBooking } from "@/hooks/useBookingMutations";
import type { Booking } from "@/hooks/useBookings";
import { Constants } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Users,
  ChevronDown,
  CalendarIcon,
  Link2,
  Banknote,
  Copy,
  ArrowRightLeft,
} from "lucide-react";

interface GroupBookingEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupBookings: Booking[];
}

interface UnitState {
  id: string;
  unit_id: string;
  booking_ref: string;
  pax: number;
  total_amount: number;
  deposit_paid: number;
  payment_status: string;
  security_deposit: number;
  discount_given: number;
  discount_type: string;
  discount_reason: string;
  extra_pax_fee: number;
  utensil_rental: boolean;
  utensil_rental_fee: number;
  karaoke: boolean;
  karaoke_fee: number;
  kitchen_use: boolean;
  kitchen_use_fee: number;
  pet_fee: number;
  pets: boolean;
  water_jug: boolean;
  water_jug_qty: number;
  water_jug_fee: number;
  towel_rent: boolean;
  towel_rent_qty: number;
  towel_rent_fee: number;
  bonfire: boolean;
  bonfire_fee: number;
  atv: boolean;
  atv_fee: number;
  banana_boat: boolean;
  banana_boat_fee: number;
  early_checkin: boolean;
  early_checkin_fee: number;
  daytour_fee: number;
  extension_fee: number;
  other_extras_fee: number;
  other_extras_note: string;
  late_checkout: boolean;
  mode_of_payment: string;
  dp_mode_of_payment: string;
  remaining_mode_of_payment: string;
  remaining_paid: boolean;
  deposit_status: string;
  deposit_deducted_amount: number;
  deposit_deducted_reason: string;
  extras_paid_status: Record<string, boolean>;
}

function bookingToUnitState(b: Booking): UnitState {
  return {
    id: b.id,
    unit_id: b.unit_id || "",
    booking_ref: b.booking_ref,
    pax: b.pax,
    total_amount: b.total_amount,
    deposit_paid: b.deposit_paid,
    payment_status: b.payment_status,
    security_deposit: b.security_deposit || 0,
    discount_given: b.discount_given || 0,
    discount_type: (b as any).discount_type || "fixed",
    discount_reason: b.discount_reason || "",
    extra_pax_fee: b.extra_pax_fee || 0,
    utensil_rental: (b as any).utensil_rental || false,
    utensil_rental_fee: (b as any).utensil_rental_fee || 0,
    karaoke: b.karaoke || false,
    karaoke_fee: b.karaoke_fee || 0,
    kitchen_use: b.kitchen_use || false,
    kitchen_use_fee: b.kitchen_use_fee || 0,
    pet_fee: b.pet_fee || 0,
    pets: b.pets || false,
    water_jug: b.water_jug || false,
    water_jug_qty: b.water_jug_qty || 0,
    water_jug_fee: b.water_jug_fee || 0,
    towel_rent: b.towel_rent || false,
    towel_rent_qty: b.towel_rent_qty || 0,
    towel_rent_fee: b.towel_rent_fee || 0,
    bonfire: b.bonfire || false,
    bonfire_fee: b.bonfire_fee || 0,
    atv: (b as any).atv || false,
    atv_fee: (b as any).atv_fee || 0,
    banana_boat: (b as any).banana_boat || false,
    banana_boat_fee: (b as any).banana_boat_fee || 0,
    early_checkin: b.early_checkin || false,
    early_checkin_fee: b.early_checkin_fee || 0,
    daytour_fee: b.daytour_fee || 0,
    extension_fee: b.extension_fee || 0,
    other_extras_fee: b.other_extras_fee || 0,
    other_extras_note: (b as any).other_extras_note || "",
    late_checkout: b.late_checkout || false,
    mode_of_payment: (b as any).mode_of_payment || "",
    dp_mode_of_payment: (b as any).dp_mode_of_payment || "",
    remaining_mode_of_payment: (b as any).remaining_mode_of_payment || "",
    remaining_paid: (b as any).remaining_paid || false,
    deposit_status: b.deposit_status || "Pending",
    deposit_deducted_amount: b.deposit_deducted_amount || 0,
    deposit_deducted_reason: (b as any).deposit_deducted_reason || "",
    extras_paid_status: (b as any).extras_paid_status && typeof (b as any).extras_paid_status === "object"
      ? (b as any).extras_paid_status
      : {},
  };
}

function computeUnitTotal(us: UnitState, nightlyRate: number, nights: number): number {
  const base = nightlyRate * nights;
  const extras =
    (us.utensil_rental ? us.utensil_rental_fee : 0) +
    (us.karaoke ? us.karaoke_fee : 0) +
    (us.kitchen_use ? us.kitchen_use_fee : 0) +
    (us.pets ? us.pet_fee : 0) +
    us.extra_pax_fee +
    (us.water_jug ? us.water_jug_fee : 0) +
    (us.towel_rent ? us.towel_rent_fee : 0) +
    (us.bonfire ? us.bonfire_fee : 0) +
    (us.atv ? us.atv_fee : 0) +
    (us.banana_boat ? us.banana_boat_fee : 0) +
    (us.early_checkin ? us.early_checkin_fee : 0) +
    us.daytour_fee +
    us.other_extras_fee +
    us.extension_fee;

  const discountAmt = us.discount_type === "percentage"
    ? Math.round(((base + extras) * us.discount_given) / 100)
    : us.discount_given;

  return Math.max(0, base + extras - discountAmt);
}

export function GroupBookingEditor({ open, onOpenChange, groupBookings }: GroupBookingEditorProps) {
  const { data: units = [] } = useUnits();
  const updateBooking = useUpdateBooking();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<"group" | "individual">("group");

  const [guestName, setGuestName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [bookingStatus, setBookingStatus] = useState("Confirmed");
  const [bookingSource, setBookingSource] = useState("Facebook Direct");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [unitStates, setUnitStates] = useState<UnitState[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || groupBookings.length === 0) return;
    const p = groupBookings.find((b) => b.is_primary) || groupBookings[0];
    setGuestName(p.guest_name);
    setCheckIn(p.check_in);
    setCheckOut(p.check_out);
    setBookingStatus(p.booking_status);
    setBookingSource(p.booking_source);
    setEmail(p.email || "");
    setPhone(p.phone || "");
    setNotes(p.notes || "");
    setUnitStates(groupBookings.map(bookingToUnitState));
    setExpandedUnits(new Set());
  }, [open, groupBookings]);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    try {
      return differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn));
    } catch {
      return 0;
    }
  }, [checkIn, checkOut]);

  const updateUnit = (bookingId: string, updates: Partial<UnitState>) => {
    setUnitStates((prev) =>
      prev.map((us) => (us.id === bookingId ? { ...us, ...updates } : us))
    );
  };

  const applyToAll = (updates: Partial<UnitState>) => {
    setUnitStates((prev) => prev.map((us) => ({ ...us, ...updates })));
  };

  const unitTotals = useMemo(() => {
    return unitStates.map((us) => {
      const unit = units.find((u) => u.id === us.unit_id);
      const rate = unit?.nightly_rate || 0;
      const computed = computeUnitTotal(us, rate, nights);
      return { ...us, computedTotal: computed };
    });
  }, [unitStates, units, nights]);

  const grandTotal = unitTotals.reduce((s, ut) => s + ut.computedTotal, 0);
  const grandDeposit = unitStates.reduce((s, us) => s + us.deposit_paid, 0);
  const grandBalance = Math.max(0, grandTotal - grandDeposit);
  const totalPax = unitStates.reduce((s, us) => s + us.pax, 0);

  const toggleUnit = (id: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const us of unitStates) {
        const unit = units.find((u) => u.id === us.unit_id);
        const rate = unit?.nightly_rate || 0;
        const computedTotal = computeUnitTotal(us, rate, nights);

        const payload: any = {
          guest_name: guestName,
          check_in: checkIn,
          check_out: checkOut,
          booking_status: bookingStatus,
          booking_source: bookingSource,
          email: email || null,
          phone: phone || null,
          notes: notes || null,
          pax: us.pax,
          total_amount: computedTotal,
          deposit_paid: us.deposit_paid,
          payment_status: us.payment_status,
          security_deposit: us.security_deposit,
          discount_given: us.discount_given,
          discount_type: us.discount_type,
          discount_reason: us.discount_reason || null,
          extra_pax_fee: us.extra_pax_fee,
          utensil_rental: us.utensil_rental,
          utensil_rental_fee: us.utensil_rental ? us.utensil_rental_fee : 0,
          karaoke: us.karaoke,
          karaoke_fee: us.karaoke ? us.karaoke_fee : 0,
          kitchen_use: us.kitchen_use,
          kitchen_use_fee: us.kitchen_use ? us.kitchen_use_fee : 0,
          pets: us.pets,
          pet_fee: us.pets ? us.pet_fee : 0,
          water_jug: us.water_jug,
          water_jug_qty: us.water_jug ? us.water_jug_qty : 0,
          water_jug_fee: us.water_jug ? us.water_jug_fee : 0,
          towel_rent: us.towel_rent,
          towel_rent_qty: us.towel_rent ? us.towel_rent_qty : 0,
          towel_rent_fee: us.towel_rent ? us.towel_rent_fee : 0,
          bonfire: us.bonfire,
          bonfire_fee: us.bonfire ? us.bonfire_fee : 0,
          atv: us.atv,
          atv_fee: us.atv ? us.atv_fee : 0,
          banana_boat: us.banana_boat,
          banana_boat_fee: us.banana_boat ? us.banana_boat_fee : 0,
          early_checkin: us.early_checkin,
          early_checkin_fee: us.early_checkin ? us.early_checkin_fee : 0,
          daytour_fee: us.daytour_fee,
          extension_fee: us.extension_fee,
          other_extras_fee: us.other_extras_fee,
          other_extras_note: us.other_extras_note || null,
          late_checkout: us.late_checkout,
          mode_of_payment: us.dp_mode_of_payment || null,
          dp_mode_of_payment: us.dp_mode_of_payment || null,
          remaining_mode_of_payment: us.remaining_mode_of_payment || null,
          remaining_paid: us.remaining_paid,
          deposit_status: us.deposit_status,
          deposit_deducted_amount: us.deposit_status === "Deducted" ? us.deposit_deducted_amount : 0,
          deposit_deducted_reason: us.deposit_status === "Deducted" ? (us.deposit_deducted_reason || null) : null,
          extras_paid_status: us.extras_paid_status,
        };

        await updateBooking.mutateAsync({ id: us.id, ...payload });
      }

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success(`Updated ${unitStates.length} bookings in group`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to update group booking");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const PAYMENT_MODES = ["GCash", "BDO", "BPI", "Cash", "Maya", "Other"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-lg font-display text-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Edit Group Booking
            </div>
            <div className="flex gap-2">
              <Button 
                variant={editMode === "group" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setEditMode("group")}
                className="text-xs"
              >
                Group Edit
              </Button>
              <Button 
                variant={editMode === "individual" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setEditMode("individual")}
                className="text-xs"
              >
                Individual Edit
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-5">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Shared Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Guest Name</Label>
                  <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="bg-background border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Check-in</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-background border-border">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkIn ? format(parseISO(checkIn), "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border">
                      <Calendar mode="single" selected={checkIn ? parseISO(checkIn) : undefined} onSelect={(d) => d && setCheckIn(format(d, "yyyy-MM-dd"))} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Check-out</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-background border-border">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkOut ? format(parseISO(checkOut), "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border">
                      <Calendar mode="single" selected={checkOut ? parseISO(checkOut) : undefined} onSelect={(d) => d && setCheckOut(format(d, "yyyy-MM-dd"))} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5" /> {editMode === "group" ? "Apply to All Units" : "Per-Unit Details"}
              </h3>

              {editMode === "group" && (
                <div className="bg-muted/30 p-3 rounded-lg border border-border grid grid-cols-2 gap-3">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => applyToAll({ utensil_rental: !unitStates[0]?.utensil_rental })}>
                    <Copy className="h-3 w-3 mr-2" /> Toggle Utensils
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => applyToAll({ karaoke: !unitStates[0]?.karaoke })}>
                    <Copy className="h-3 w-3 mr-2" /> Toggle Karaoke
                  </Button>
                </div>
              )}

              {unitTotals.map((ut) => {
                const unit = units.find((u) => u.id === ut.unit_id);
                const unitName = unit?.name || "Unassigned";
                const isExpanded = editMode === "individual" ? expandedUnits.has(ut.id) : true;
                const rate = unit?.nightly_rate || 0;

                return (
                  <Collapsible key={ut.id} open={isExpanded} onOpenChange={() => toggleUnit(ut.id)}>
                    {editMode === "individual" && (
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors">
                          <div className="flex items-center gap-2">
                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                            <span className="text-sm font-semibold text-foreground">{unitName}</span>
                          </div>
                          <span className="text-sm font-medium text-foreground">₱{ut.computedTotal.toLocaleString()}</span>
                        </div>
                      </CollapsibleTrigger>
                    )}

                    <CollapsibleContent>
                      <div className={cn("rounded-b-lg border border-border bg-muted/10 p-4 space-y-3", editMode === "group" && "rounded-lg border-t")}>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">PAX</Label>
                            <Input type="number" value={ut.pax} onChange={(e) => updateUnit(ut.id, { pax: Number(e.target.value) || 0 })} className="bg-background border-border" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Downpayment</Label>
                            <Input type="number" value={ut.deposit_paid} onChange={(e) => updateUnit(ut.id, { deposit_paid: Number(e.target.value) || 0 })} className="bg-background border-border" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded border border-border px-2 py-1.5">
                          <span className="text-xs text-foreground">Utensil Rental</span>
                          <Switch checked={ut.utensil_rental} onCheckedChange={(v) => updateUnit(ut.id, { utensil_rental: v })} />
                        </div>
                        <div className="flex items-center justify-between rounded border border-border px-2 py-1.5">
                          <span className="text-xs text-foreground">Karaoke</span>
                          <Switch checked={ut.karaoke} onCheckedChange={(v) => updateUnit(ut.id, { karaoke: v })} />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
