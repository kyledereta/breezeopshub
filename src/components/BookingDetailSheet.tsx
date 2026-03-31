import { useMemo, useState, useEffect } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useUnits } from "@/hooks/useUnits";
import { useBookings, type Booking } from "@/hooks/useBookings";
import { useBookingAuditLog } from "@/hooks/useBookingAuditLog";
import { useSoftDeleteBooking } from "@/hooks/useBookingMutations";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PawPrint, UtensilsCrossed, AlertTriangle, Edit, Users, CalendarDays, StickyNote, Banknote, Trash2, Link2, Car, Download, RefreshCw, Copy } from "lucide-react";
import { useContinuedStayMap } from "@/hooks/useContinuedStay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { generateBookingConfirmationPdf } from "@/lib/bookingConfirmationPdf";


interface BookingDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  onEdit: (booking: Booking) => void;
  onEditGroup?: (groupBookings: Booking[]) => void;
}

function getPaymentBadgeStyle(status: string) {
  switch (status) {
    case "Fully Paid": return "bg-primary/20 text-primary border-primary/30";
    case "Airbnb Paid": return "bg-airbnb-pink/20 text-airbnb-pink border-airbnb-pink/30";
    case "Partial DP": return "bg-warning-orange/20 text-warning-orange border-warning-orange/30";
    case "Unpaid": return "bg-destructive/20 text-destructive border-destructive/30";
    case "Refunded": return "bg-muted text-muted-foreground border-border";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case "Confirmed": return "bg-primary/20 text-primary border-primary/30";
    case "Checked In": return "bg-ocean/20 text-ocean border-ocean/30";
    case "Checked Out": return "bg-muted text-muted-foreground border-border";
    case "Cancelled": return "bg-destructive/20 text-destructive border-destructive/30";
    case "Hold": return "bg-warning-orange/20 text-warning-orange border-warning-orange/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

/** Build fee line items for a single booking */
function buildFeeLines(b: Booking, unitName: string, nights: number, unitRate: number) {
  const eps = (b as any).extras_paid_status && typeof (b as any).extras_paid_status === "object"
    ? (b as any).extras_paid_status as Record<string, boolean>
    : {} as Record<string, boolean>;

  const lines: { label: string; amount: number; paidKey?: string }[] = [];

  // Room charge
  if (!(b as any).is_daytour_booking && unitRate > 0) {
    lines.push({ label: `${unitName} (₱${unitRate.toLocaleString()} × ${nights}n)`, amount: unitRate * nights });
  }

  // Extras
  if (b.extra_pax_fee > 0) lines.push({ label: "Extra PAX Fee", amount: b.extra_pax_fee });
  if ((b as any).daytour_fee > 0) lines.push({ label: "Daytour Fee", amount: (b as any).daytour_fee, paidKey: "daytour" });
  if (b.utensil_rental && b.utensil_rental_fee > 0) lines.push({ label: "Utensil Rental", amount: b.utensil_rental_fee, paidKey: "utensil_rental" });
  if (b.karaoke && b.karaoke_fee > 0) lines.push({ label: "Karaoke", amount: b.karaoke_fee, paidKey: "karaoke" });
  if (b.kitchen_use && b.kitchen_use_fee > 0) lines.push({ label: "Kitchen Use", amount: b.kitchen_use_fee, paidKey: "kitchen_use" });
  if (b.pet_fee > 0) lines.push({ label: "Pet Fee", amount: b.pet_fee, paidKey: "pet_fee" });
  if ((b as any).water_jug && (b as any).water_jug_fee > 0) lines.push({ label: `Water Jug (×${(b as any).water_jug_qty})`, amount: (b as any).water_jug_fee, paidKey: "water_jug" });
  if ((b as any).towel_rent && (b as any).towel_rent_fee > 0) lines.push({ label: `Towel Rent (×${(b as any).towel_rent_qty})`, amount: (b as any).towel_rent_fee, paidKey: "towel_rent" });
  if ((b as any).bonfire && (b as any).bonfire_fee > 0) lines.push({ label: "Bonfire Setup", amount: (b as any).bonfire_fee, paidKey: "bonfire" });
  if ((b as any).atv && (b as any).atv_fee > 0) lines.push({ label: "ATV Ride", amount: (b as any).atv_fee, paidKey: "atv" });
  if ((b as any).banana_boat && (b as any).banana_boat_fee > 0) lines.push({ label: "Banana Boat", amount: (b as any).banana_boat_fee, paidKey: "banana_boat" });
  if ((b as any).early_checkin && (b as any).early_checkin_fee > 0) lines.push({ label: "Early Check-in", amount: (b as any).early_checkin_fee, paidKey: "early_checkin" });
  if ((b as any).other_extras_fee > 0) lines.push({ label: (b as any).other_extras_note ? `Other (${(b as any).other_extras_note})` : "Other Extras", amount: (b as any).other_extras_fee, paidKey: "other_extras" });
  if ((b as any).extension_fee > 0) lines.push({ label: "Extension Fee", amount: (b as any).extension_fee });

  return { lines, eps };
}

export function BookingDetailSheet({ open, onOpenChange, booking, onEdit, onEditGroup }: BookingDetailSheetProps) {
  const { data: units = [] } = useUnits();
  const { data: allBookings = [] } = useBookings(
    booking?.check_in,
    booking?.check_out
  );
  const { data: allBookingsGlobal = [] } = useBookings();
  const continuedStayMap = useContinuedStayMap(allBookingsGlobal);
  const unitNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    units.forEach((u) => { m[u.id] = u.name; });
    return m;
  }, [units]);
  const { data: auditLog = [] } = useBookingAuditLog(booking?.id);
  const softDelete = useSoftDeleteBooking();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  // Fetch all group siblings for grouped bookings
  const [groupBookings, setGroupBookings] = useState<Booking[]>([]);
  const groupId = (booking as any)?.booking_group_id;
  const isGrouped = !!groupId;

  useEffect(() => {
    if (!open || !groupId) {
      setGroupBookings([]);
      return;
    }
    supabase
      .from("bookings")
      .select("*")
      .eq("booking_group_id", groupId)
      .is("deleted_at", null)
      .then(({ data }) => {
        if (data) setGroupBookings(data as Booking[]);
      });
  }, [open, groupId]);

  // All bookings in the group (including current), sorted primary first
  const allGroupBookings = useMemo(() => {
    if (!isGrouped || groupBookings.length === 0) return booking ? [booking] : [];
    // Deduplicate and sort primary first
    const map = new Map<string, Booking>();
    groupBookings.forEach((b) => map.set(b.id, b));
    if (booking) map.set(booking.id, booking); // ensure current is fresh
    return Array.from(map.values()).sort((a, b) => (b as any).is_primary === true ? 1 : -1);
  }, [isGrouped, groupBookings, booking]);

  // For grouped bookings, show all unit names
  const groupedUnitNames = useMemo(() => {
    if (!isGrouped) return null;
    return allGroupBookings
      .map((b) => units.find((u) => u.id === b.unit_id)?.name ?? "Unknown");
  }, [allGroupBookings, isGrouped, units]);

  const unitName = useMemo(() => {
    if (groupedUnitNames && groupedUnitNames.length > 0) return groupedUnitNames.join(" + ");
    if (!booking?.unit_id) return "Unassigned";
    return units.find((u) => u.id === booking.unit_id)?.name ?? "Unknown";
  }, [units, booking, groupedUnitNames]);

  const selectedUnit = useMemo(() => {
    if (!booking?.unit_id) return null;
    return units.find((u) => u.id === booking.unit_id) ?? null;
  }, [units, booking]);

  // Check for overlapping bookings
  const overlaps = useMemo(() => {
    if (!booking) return [];
    return allBookings.filter(
      (b) =>
        b.id !== booking.id &&
        b.unit_id === booking.unit_id &&
        b.check_in < booking.check_out &&
        b.check_out > booking.check_in
    );
  }, [allBookings, booking]);

  const nights = booking
    ? differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in))
    : 0;

  const unitMap = useMemo(() => {
    const m: Record<string, string> = {};
    units.forEach((u) => { m[u.id] = u.name; });
    return m;
  }, [units]);

  // Compute the combined PAX for the group
  const totalGroupPax = isGrouped && booking
    ? allGroupBookings.reduce((s, b) => s + b.pax, 0)
    : (booking?.pax ?? 0);

  // Determine overall group payment status
  const groupPaymentStatus = useMemo(() => {
    if (!isGrouped || !booking) return booking?.payment_status ?? "Unpaid";
    const allPaid = allGroupBookings.every((b) => b.payment_status === "Fully Paid" || b.payment_status === "Airbnb Paid");
    if (allPaid) return "Fully Paid";
    const anyPartial = allGroupBookings.some((b) => b.deposit_paid > 0);
    if (anyPartial) return "Partial DP";
    return "Unpaid";
  }, [isGrouped, allGroupBookings, booking]);

  if (!booking) return null;

  const handleDelete = async () => {
    if (!deleteReason.trim()) {
      toast.error("Please provide a reason for deletion");
      return;
    }
    try {
      await softDelete.mutateAsync({ id: booking.id, reason: deleteReason.trim() });
      toast.success("Booking deleted successfully");
      setDeleteDialogOpen(false);
      setDeleteReason("");
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete booking");
    }
  };

  const fieldLabel = (f: string) => {
    const map: Record<string, string> = {
      guest_name: "Guest Name", unit_id: "Unit", check_in: "Check-in", check_out: "Check-out",
      pax: "PAX", total_amount: "Total Amount", deposit_paid: "Downpayment", payment_status: "Payment",
      booking_status: "Status", booking_source: "Source", email: "Email", phone: "Phone",
      notes: "Notes", utensil_rental: "Utensil Rental", utensil_rental_fee: "Utensil Fee",
      pets: "Pets", pet_fee: "Pet Fee", deposit_status: "Security Deposit", deposit_deducted_amount: "Deducted Amount",
      extra_pax_fee: "Extra PAX Fee", discount_given: "Discount", discount_type: "Discount Type",
      discount_reason: "Discount Reason", karaoke: "Karaoke", karaoke_fee: "Karaoke Fee",
      kitchen_use: "Kitchen Use", kitchen_use_fee: "Kitchen Use Fee",
      water_jug: "Water Jug", water_jug_qty: "Water Jug Qty", water_jug_fee: "Water Jug Fee",
      towel_rent: "Towel Rent", towel_rent_qty: "Towel Rent Qty", towel_rent_fee: "Towel Rent Fee",
      bonfire: "Bonfire", bonfire_fee: "Bonfire Fee", atv: "ATV Ride", atv_fee: "ATV Fee", banana_boat: "Banana Boat", banana_boat_fee: "Banana Boat Fee", early_checkin: "Early Check-in", early_checkin_fee: "Early Check-in Fee", extension_fee: "Extension Fee",
      security_deposit: "Security Deposit Amount", daytour_fee: "Daytour Fee",
      other_extras_fee: "Other Extras Fee", other_extras_note: "Other Extras Note",
      mode_of_payment: "Mode of Payment",
    };
    return map[f] || f;
  };

  const formatAuditValue = (fieldName: string, value: string | null) => {
    if (!value) return "—";
    if (fieldName === "unit_id") return unitMap[value] || value;
    return value;
  };

  const handleDownloadConfirmation = () => {
    if (!booking) return;

    const extras: { label: string; amount: number }[] = [];
    if (booking.extra_pax_fee > 0) extras.push({ label: "Extra PAX Fee", amount: booking.extra_pax_fee });
    if (booking.daytour_fee > 0) extras.push({ label: "Daytour Fee", amount: booking.daytour_fee });
    if (booking.utensil_rental && booking.utensil_rental_fee > 0) extras.push({ label: "Utensil Rental", amount: booking.utensil_rental_fee });
    if (booking.karaoke && booking.karaoke_fee > 0) extras.push({ label: "Karaoke", amount: booking.karaoke_fee });
    if (booking.kitchen_use && booking.kitchen_use_fee > 0) extras.push({ label: "Kitchen Use", amount: booking.kitchen_use_fee });
    if (booking.pet_fee > 0) extras.push({ label: "Pet Fee", amount: booking.pet_fee });
    if (booking.water_jug && booking.water_jug_fee > 0) extras.push({ label: `Water Jug (×${booking.water_jug_qty})`, amount: booking.water_jug_fee });
    if (booking.towel_rent && booking.towel_rent_fee > 0) extras.push({ label: `Towel Rent (×${booking.towel_rent_qty})`, amount: booking.towel_rent_fee });
    if (booking.bonfire && booking.bonfire_fee > 0) extras.push({ label: "Bonfire Setup", amount: booking.bonfire_fee });
    if ((booking as any).atv && (booking as any).atv_fee > 0) extras.push({ label: "ATV Ride", amount: (booking as any).atv_fee });
    if ((booking as any).banana_boat && (booking as any).banana_boat_fee > 0) extras.push({ label: "Banana Boat", amount: (booking as any).banana_boat_fee });
    if (booking.early_checkin && booking.early_checkin_fee > 0) extras.push({ label: "Early Check-in", amount: booking.early_checkin_fee });
    if (booking.extension_fee > 0) extras.push({ label: "Extension Fee", amount: booking.extension_fee });
    if (booking.other_extras_fee > 0) extras.push({ label: booking.other_extras_note || "Other Extras", amount: booking.other_extras_fee });

    generateBookingConfirmationPdf({
      bookingRef: booking.booking_ref,
      guestName: booking.guest_name,
      checkIn: format(parseISO(booking.check_in), "MMMM d, yyyy"),
      checkOut: format(parseISO(booking.check_out), "MMMM d, yyyy"),
      nights,
      unitName,
      pax: booking.pax,
      paymentMethod: booking.dp_mode_of_payment || booking.mode_of_payment || null,
      phone: booking.phone,
      email: booking.email,
      bookingStatus: booking.booking_status,
      bookingSource: booking.booking_source,
      paymentStatus: booking.payment_status,
      totalAmount: booking.total_amount,
      depositPaid: booking.deposit_paid,
      discountGiven: booking.discount_given,
      discountType: booking.discount_type,
      discountReason: booking.discount_reason,
      securityDeposit: booking.security_deposit,
      extras,
      notes: booking.notes,
      hasCar: booking.has_car,
      isDaytour: booking.is_daytour_booking,
      lateCheckout: booking.late_checkout,
      earlyCheckin: booking.early_checkin,
    });
  };


  /** Render financials for a single (non-grouped) booking */
  const renderSingleFinancials = () => {
    const eps = (booking as any).extras_paid_status && typeof (booking as any).extras_paid_status === "object"
      ? (booking as any).extras_paid_status as Record<string, boolean>
      : {} as Record<string, boolean>;

    const lines: { label: string; amount: number; paidKey?: string }[] = [];
    lines.push({ label: "Total Amount", amount: booking.total_amount });
    if (booking.deposit_paid > 0) lines.push({ label: "Downpayment", amount: booking.deposit_paid });
    if (booking.extra_pax_fee > 0) lines.push({ label: "Extra PAX Fee", amount: booking.extra_pax_fee });
    if ((booking as any).daytour_fee > 0) lines.push({ label: "Daytour Fee", amount: (booking as any).daytour_fee, paidKey: "daytour" });
    if (booking.utensil_rental && booking.utensil_rental_fee > 0) lines.push({ label: "Utensil Rental", amount: booking.utensil_rental_fee, paidKey: "utensil_rental" });
    if (booking.karaoke && booking.karaoke_fee > 0) lines.push({ label: "Karaoke", amount: booking.karaoke_fee, paidKey: "karaoke" });
    if (booking.kitchen_use && booking.kitchen_use_fee > 0) lines.push({ label: "Kitchen Use", amount: booking.kitchen_use_fee, paidKey: "kitchen_use" });
    if (booking.pet_fee > 0) lines.push({ label: "Pet Fee", amount: booking.pet_fee, paidKey: "pet_fee" });
    if ((booking as any).water_jug && (booking as any).water_jug_fee > 0) lines.push({ label: `Water Jug (×${(booking as any).water_jug_qty})`, amount: (booking as any).water_jug_fee, paidKey: "water_jug" });
    if ((booking as any).towel_rent && (booking as any).towel_rent_fee > 0) lines.push({ label: `Towel Rent (×${(booking as any).towel_rent_qty})`, amount: (booking as any).towel_rent_fee, paidKey: "towel_rent" });
    if ((booking as any).bonfire && (booking as any).bonfire_fee > 0) lines.push({ label: "Bonfire Setup", amount: (booking as any).bonfire_fee, paidKey: "bonfire" });
    if ((booking as any).atv && (booking as any).atv_fee > 0) lines.push({ label: "ATV Ride", amount: (booking as any).atv_fee, paidKey: "atv" });
    if ((booking as any).banana_boat && (booking as any).banana_boat_fee > 0) lines.push({ label: "Banana Boat", amount: (booking as any).banana_boat_fee, paidKey: "banana_boat" });
    if ((booking as any).early_checkin && (booking as any).early_checkin_fee > 0) lines.push({ label: "Early Check-in", amount: (booking as any).early_checkin_fee, paidKey: "early_checkin" });
    if ((booking as any).other_extras_fee > 0) lines.push({ label: (booking as any).other_extras_note ? `Other (${(booking as any).other_extras_note})` : "Other Extras", amount: (booking as any).other_extras_fee, paidKey: "other_extras" });
    if ((booking as any).extension_fee > 0) lines.push({ label: "Extension Fee", amount: (booking as any).extension_fee });
    if ((booking as any).security_deposit > 0) lines.push({ label: "Security Deposit", amount: (booking as any).security_deposit });
    if (booking.deposit_status === "Deducted" && booking.deposit_deducted_amount > 0) lines.push({ label: booking.deposit_deducted_reason || "Damage/Deduction", amount: booking.deposit_deducted_amount, paidKey: "deposit_deduction" });
    if (booking.discount_given > 0) lines.push({ label: `Discount (${booking.discount_type})${booking.discount_reason ? ` — ${booking.discount_reason}` : ""}`, amount: -(booking.discount_type === "percentage" ? booking.discount_given : booking.discount_given) });

    const balanceDue = Math.max(0, booking.total_amount - booking.deposit_paid);
    const isFullySettled = booking.payment_status === "Fully Paid" || booking.payment_status === "Airbnb Paid" || (booking as any).remaining_paid === true;

    return (
      <div className="space-y-1.5 text-sm">
        {lines.map((line, i) => {
          const isTotal = line.label === "Total Amount";
          const isDiscount = line.amount < 0;
          return (
            <div key={i} className="flex justify-between items-center">
              <span className={cn("text-muted-foreground flex items-center gap-1", isTotal && "text-foreground")}>
                {line.label}
              </span>
              <span className={cn("text-foreground", isTotal && "font-medium", isDiscount && "text-primary")}>
                {isDiscount
                  ? (booking.discount_type === "percentage" ? `-${Math.abs(line.amount)}%` : `-₱${Math.abs(line.amount).toLocaleString()}`)
                  : `₱${line.amount.toLocaleString()}`
                }
              </span>
            </div>
          );
        })}
        {balanceDue > 0 && (
          <>
            <Separator className="bg-border/50 my-1" />
            <div className="flex justify-between font-medium">
              <span className={isFullySettled ? "text-primary" : "text-warning-orange"}>Balance Due</span>
              <span className={isFullySettled ? "text-primary" : "text-warning-orange"}>₱{balanceDue.toLocaleString()}</span>
            </div>
            {isFullySettled && <p className="text-[10px] text-primary font-medium">✓ Fully Settled</p>}
          </>
        )}
        {balanceDue === 0 && booking.total_amount > 0 && (
          <>
            <Separator className="bg-border/50 my-1" />
            <div className="flex justify-between font-medium">
              <span className="text-primary">Balance Due</span>
              <span className="text-primary">₱0</span>
            </div>
            <p className="text-[10px] text-primary font-medium">✓ Fully Settled</p>
          </>
        )}
      </div>
    );
  };

  /** Render consolidated financials for grouped bookings */
  const renderGroupFinancials = () => {
    // Compute per-unit totals from fee lines (NOT total_amount which may contain group total on primary)
    const unitTotals: { gb: Booking; computedTotal: number; lines: { label: string; amount: number; paidKey?: string }[] }[] = [];

    allGroupBookings.forEach((gb) => {
      const unit = units.find((u) => u.id === gb.unit_id);
      const uName = unit?.name || "Unassigned";
      const uRate = unit?.nightly_rate || 0;
      const n = differenceInDays(parseISO(gb.check_out), parseISO(gb.check_in));
      const { lines } = buildFeeLines(gb, uName, n, uRate);
      let computedTotal = lines.reduce((s, l) => s + l.amount, 0);
      if (gb.discount_given > 0) {
        computedTotal -= gb.discount_type === "percentage"
          ? computedTotal * (gb.discount_given / 100)
          : gb.discount_given;
      }
      unitTotals.push({ gb, computedTotal: Math.max(0, computedTotal), lines });
    });

    const grandTotal = unitTotals.reduce((s, ut) => s + ut.computedTotal, 0);
    const grandDeposit = allGroupBookings.reduce((s, b) => s + b.deposit_paid, 0);
    const grandSecurity = allGroupBookings.reduce((s, b) => s + (b.security_deposit || 0), 0);
    const grandBalance = Math.max(0, grandTotal - grandDeposit);
    const allSettled = allGroupBookings.every(
      (b) => b.payment_status === "Fully Paid" || b.payment_status === "Airbnb Paid" || (b as any).remaining_paid === true
    );

    return (
      <div className="space-y-3 text-sm">
        {unitTotals.map(({ gb, computedTotal, lines }) => {
          const unit = units.find((u) => u.id === gb.unit_id);
          const uName = unit?.name || "Unassigned";

          return (
            <div key={gb.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{uName}</span>
                  <span className="text-[9px] text-muted-foreground">{gb.booking_ref}</span>
                </div>
                <Badge variant="outline" className={cn("text-[9px]", getPaymentBadgeStyle(gb.payment_status))}>
                  {gb.payment_status}
                </Badge>
              </div>

              {lines.map((line, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="text-foreground">₱{line.amount.toLocaleString()}</span>
                </div>
              ))}

              {gb.discount_given > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Discount{gb.discount_reason ? ` — ${gb.discount_reason}` : ""}
                  </span>
                  <span className="text-primary">
                    {gb.discount_type === "percentage"
                      ? `-${gb.discount_given}%`
                      : `-₱${gb.discount_given.toLocaleString()}`}
                  </span>
                </div>
              )}

              <Separator className="bg-border/30" />
              <div className="flex justify-between text-xs font-medium">
                <span className="text-foreground">Unit Total</span>
                <span className="text-foreground">₱{computedTotal.toLocaleString()}</span>
              </div>
              {gb.deposit_paid > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-primary">Downpayment</span>
                  <span className="text-primary">₱{gb.deposit_paid.toLocaleString()}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Combined summary */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Link2 className="h-3 w-3" /> Combined Summary
            <span className="font-normal text-muted-foreground">({allGroupBookings.length} units)</span>
          </div>

          <Separator className="bg-primary/20" />

          <div className="flex justify-between text-sm font-semibold">
            <span className="text-primary">Group Total</span>
            <span className="text-primary">₱{grandTotal.toLocaleString()}</span>
          </div>

          {grandDeposit > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total Deposits</span>
              <span className="text-foreground">-₱{grandDeposit.toLocaleString()}</span>
            </div>
          )}

          {grandSecurity > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Security Deposits</span>
              <span className="text-foreground">₱{grandSecurity.toLocaleString()}</span>
            </div>
          )}

          <Separator className="bg-primary/20" />

          <div className="flex justify-between text-sm font-bold">
            <span className={allSettled ? "text-primary" : "text-destructive"}>
              {allSettled ? "✓ All Settled" : "Group Balance"}
            </span>
            <span className={allSettled ? "text-primary" : "text-destructive"}>
              ₱{grandBalance.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[420px] sm:w-[480px] bg-card border-border p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-display text-foreground">
                {isGrouped ? "Group Booking" : "Booking Details"}
              </SheetTitle>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleDownloadConfirmation}
                  title="Download booking confirmation PDF"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
                {isGrouped && onEditGroup && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => onEditGroup(allGroupBookings)}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Edit Group
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => onEdit(booking)}
                >
                  <Edit className="h-3.5 w-3.5" />
                  {isGrouped ? "Edit This Unit" : "Edit"}
                </Button>
              </div>
            </div>
            {/* Booking Reference */}
            <div className="mt-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-1.5 text-center relative group">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {isGrouped ? "Primary Booking Ref" : "Booking Ref"}
              </span>
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-sm font-bold text-primary tracking-wider">{booking.booking_ref}</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(booking.booking_ref);
                    toast.success("Booking ref copied!");
                  }}
                  className="text-muted-foreground hover:text-primary transition-colors"
                  title="Copy booking ref"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-6 py-5 space-y-5">
              {/* Guest & Unit Header */}
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">
                  {booking.guest_name}'s Group of {totalGroupPax}
                </h2>
                <p className="text-sm text-muted-foreground">
                  in <span className="font-medium text-foreground">{unitName}</span>
                </p>
                {isGrouped && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] text-primary font-medium">Combined Booking (Multi-Unit)</span>
                  </div>
                )}
                {(() => {
                  const csInfo = continuedStayMap.get(booking.id);
                  if (!csInfo) return null;
                  const fromName = csInfo.fromUnitId ? unitNameMap[csInfo.fromUnitId] : null;
                  const toName = csInfo.toUnitId ? unitNameMap[csInfo.toUnitId] : null;
                  return (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {fromName && (
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="h-3.5 w-3.5 text-ocean" />
                          <span className="text-[10px] text-ocean font-medium">Continued from {fromName}</span>
                        </div>
                      )}
                      {toName && (
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="h-3.5 w-3.5 text-ocean" />
                          <span className="text-[10px] text-ocean font-medium">Continues to {toName}</span>
                        </div>
                      )}
                      {!fromName && !toName && (
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="h-3.5 w-3.5 text-ocean" />
                          <span className="text-[10px] text-ocean font-medium">Continued Stay</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={cn("text-xs", getStatusBadgeStyle(booking.booking_status))}>
                    {booking.booking_status}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs", getPaymentBadgeStyle(isGrouped ? groupPaymentStatus : booking.payment_status))}>
                    {isGrouped ? groupPaymentStatus : booking.payment_status}
                  </Badge>
                </div>
              </div>

              <Separator className="bg-border" />

              {/* Check-in Dates */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Stay Details
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Check-in</p>
                    <p className="text-sm font-medium text-foreground">{format(parseISO(booking.check_in), "MMM d, yyyy")}</p>
                    <p className="text-[10px] text-muted-foreground">1:00 PM</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Check-out</p>
                    <p className="text-sm font-medium text-foreground">{format(parseISO(booking.check_out), "MMM d, yyyy")}</p>
                    <p className="text-[10px] text-muted-foreground">11:00 AM</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {nights} night{nights !== 1 ? "s" : ""} · via {booking.booking_source}
                  {(booking as any).mode_of_payment && ` · ${(booking as any).mode_of_payment}`}
                </p>
              </div>

              {/* Overlap Notice */}
              {overlaps.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-warning-orange/50 bg-warning-orange/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-warning-orange shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-warning-orange">Overlap Detected</p>
                    {overlaps.map((o) => (
                      <p key={o.id} className="text-[11px] text-warning-orange/80">
                        {o.guest_name}: {format(parseISO(o.check_in), "MMM d")} → {format(parseISO(o.check_out), "MMM d")}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="bg-border" />

              {/* Financials */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5" /> {isGrouped ? "Group Financials" : "Financials"}
                </h3>
                {isGrouped ? renderGroupFinancials() : renderSingleFinancials()}

                {/* Extras badges */}
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  {booking.pets && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-warning-orange/30 text-warning-orange">
                      <PawPrint className="h-3 w-3" /> With Pets
                    </Badge>
                  )}
                  {booking.deposit_status !== "Pending" && (
                    <Badge variant="outline" className={cn("text-[10px]",
                      booking.deposit_status === "Returned" ? "border-ocean/30 text-ocean" :
                      booking.deposit_status === "Collected" ? "border-primary/30 text-primary" :
                      "border-destructive/30 text-destructive"
                    )}>
                      Deposit {booking.deposit_status}
                      {booking.deposit_status === "Deducted" && booking.deposit_deducted_amount > 0 && ` (₱${booking.deposit_deducted_amount.toLocaleString()})`}
                    </Badge>
                  )}
                  {(booking as any).post_checkout_settlement && (
                    <Badge variant="outline" className="text-[10px] border-warning-orange/30 text-warning-orange">
                      Post-Checkout Settlement
                    </Badge>
                  )}
                </div>
                {/* Car Details */}
                {(booking as any).has_car && (booking as any).car_details && Array.isArray((booking as any).car_details) && (booking as any).car_details.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Car className="h-3 w-3" /> Vehicles
                    </h4>
                    {((booking as any).car_details as { type: string; color: string; plate: string; parking?: string }[]).map((car, i) => (
                      <div key={i} className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                        {car.type && <span className="font-medium text-foreground">{car.type}</span>}
                        {car.color && <span> · {car.color}</span>}
                        {car.plate && <span> · <span className="font-mono text-foreground">{car.plate}</span></span>}
                        {car.parking && <span> · 📍 {car.parking}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Deletion info */}
              {booking.deleted_at && (
                <>
                  <Separator className="bg-border" />
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                    <p className="text-xs font-semibold text-destructive">Deleted</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(booking.deleted_at), "MMM d, yyyy h:mm a")}
                    </p>
                    {booking.deletion_reason && (
                      <p className="text-xs text-muted-foreground">Reason: {booking.deletion_reason}</p>
                    )}
                  </div>
                </>
              )}

              {/* Notes */}
              {booking.notes && (
                <>
                  <Separator className="bg-border" />
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <StickyNote className="h-3.5 w-3.5" /> Notes
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{booking.notes}</p>
                  </div>
                </>
              )}

              {/* Contact */}
              {(booking.email || booking.phone) && (
                <>
                  <Separator className="bg-border" />
                  <div className="space-y-1 text-sm">
                    {booking.phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="text-foreground">{booking.phone}</span>
                      </div>
                    )}
                    {booking.email && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span className="text-foreground">{booking.email}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Audit Log / History */}
              <Separator className="bg-border" />
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Logs
                </h3>
                {auditLog.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No changes recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {auditLog.map((entry) => (
                      <div key={entry.id} className="rounded-md border border-border bg-background px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground">{fieldLabel(entry.field_name)}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(parseISO(entry.changed_at), "MMM d, yyyy h:mm a")}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          <span className="line-through">{formatAuditValue(entry.field_name, entry.old_value)}</span>
                          <span className="mx-1.5">→</span>
                          <span className="text-foreground font-medium">{formatAuditValue(entry.field_name, entry.new_value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Booking ref & timestamps */}
              <div className="text-[10px] text-muted-foreground space-y-0.5 pt-2">
                <p>Ref: {booking.booking_ref}</p>
                <p>Created: {format(parseISO(booking.created_at), "MMM d, yyyy h:mm a")}</p>
                <p>Updated: {format(parseISO(booking.updated_at), "MMM d, yyyy h:mm a")}</p>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete this booking?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will cancel <span className="font-medium text-foreground">{booking.guest_name}</span>'s booking
              ({booking.booking_ref}). The booking will be moved to the deleted/cancelled section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Reason for deletion *</label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. Guest requested cancellation, duplicate booking..."
              className="bg-background border-border resize-none h-20"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!deleteReason.trim() || softDelete.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {softDelete.isPending ? "Deleting..." : "Delete Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
