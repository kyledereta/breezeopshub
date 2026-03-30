import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { PawPrint, UtensilsCrossed, AlertTriangle, Edit, Users, CalendarDays, StickyNote, Banknote, Trash2, Link2, Car, Download, RefreshCw } from "lucide-react";
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

export function BookingDetailSheet({ open, onOpenChange, booking, onEdit }: BookingDetailSheetProps) {
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

  // For grouped bookings, show all unit names
  const groupedUnitNames = useMemo(() => {
    const gid = (booking as any)?.booking_group_id;
    if (!gid) return null;
    return allBookings
      .filter((b) => (b as any).booking_group_id === gid)
      .map((b) => units.find((u) => u.id === b.unit_id)?.name ?? "Unknown");
  }, [allBookings, booking, units]);

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

  const extraPax = selectedUnit && booking
    ? Math.max(0, booking.pax - selectedUnit.max_pax)
    : 0;

  const unitMap = useMemo(() => {
    const m: Record<string, string> = {};
    units.forEach((u) => { m[u.id] = u.name; });
    return m;
  }, [units]);

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
      bonfire: "Bonfire", bonfire_fee: "Bonfire Fee", early_checkin: "Early Check-in", early_checkin_fee: "Early Check-in Fee", extension_fee: "Extension Fee",
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
    generateBookingConfirmationPdf({
      bookingRef: booking.booking_ref,
      guestName: booking.guest_name,
      checkIn: format(parseISO(booking.check_in), "MMMM d, yyyy"),
      checkOut: format(parseISO(booking.check_out), "MMMM d, yyyy"),
      unitName,
      pax: booking.pax,
      paymentMethod: (booking as any).dp_mode_of_payment || (booking as any).mode_of_payment || null,
      phone: booking.phone,
      email: booking.email,
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[420px] sm:w-[480px] bg-card border-border p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-display text-foreground">
                Booking Details
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
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => onEdit(booking)}
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            </div>
            {/* Booking Reference */}
            <div className="mt-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-1.5 text-center">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Booking Ref</span>
              <p className="text-sm font-bold text-primary tracking-wider">{booking.booking_ref}</p>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-6 py-5 space-y-5">
              {/* Guest & Unit Header */}
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">
                  {booking.guest_name}'s Group of {booking.pax}
                </h2>
                <p className="text-sm text-muted-foreground">
                  in <span className="font-medium text-foreground">{unitName}</span>
                </p>
                {(booking as any).booking_group_id && (
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
                  <Badge variant="outline" className={cn("text-xs", getPaymentBadgeStyle(booking.payment_status))}>
                    {booking.payment_status}
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

              {/* Fees */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5" /> Financials
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="font-medium text-foreground">₱{booking.total_amount.toLocaleString()}</span>
                  </div>
                  {booking.deposit_paid > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Downpayment</span>
                      <span className="text-foreground">₱{booking.deposit_paid.toLocaleString()}</span>
                    </div>
                  )}
                  {extraPax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> Extra PAX Fee (+{extraPax} guest{extraPax > 1 ? "s" : ""})
                      </span>
                      <span className="text-foreground">₱{booking.extra_pax_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {booking.extra_pax_fee > 0 && extraPax === 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Extra PAX Fee</span>
                      <span className="text-foreground">₱{booking.extra_pax_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {booking.utensil_rental && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <UtensilsCrossed className="h-3 w-3" /> Utensil Rental
                      </span>
                      <span className="text-foreground">₱{booking.utensil_rental_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {booking.karaoke && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Karaoke</span>
                      <span className="text-foreground">₱{booking.karaoke_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {booking.kitchen_use && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kitchen Use</span>
                      <span className="text-foreground">₱{booking.kitchen_use_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {booking.pet_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pet Fee</span>
                      <span className="text-foreground">₱{booking.pet_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {(booking as any).water_jug && (booking as any).water_jug_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Water Jug (×{(booking as any).water_jug_qty})</span>
                      <span className="text-foreground">₱{(booking as any).water_jug_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {(booking as any).towel_rent && (booking as any).towel_rent_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Towel Rent (×{(booking as any).towel_rent_qty})</span>
                      <span className="text-foreground">₱{(booking as any).towel_rent_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {(booking as any).bonfire && (booking as any).bonfire_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bonfire Setup</span>
                      <span className="text-foreground">₱{(booking as any).bonfire_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {(booking as any).early_checkin && (booking as any).early_checkin_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Early Check-in</span>
                      <span className="text-foreground">₱{(booking as any).early_checkin_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {(booking as any).daytour_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Daytour Fee</span>
                      <span className="text-foreground">₱{(booking as any).daytour_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {(booking as any).other_extras_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Other Extras{(booking as any).other_extras_note ? ` (${(booking as any).other_extras_note})` : ""}</span>
                      <span className="text-foreground">₱{(booking as any).other_extras_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {(booking as any).extension_fee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Extension Fee</span>
                      <span className="text-foreground">₱{(booking as any).extension_fee.toLocaleString()}</span>
                    </div>
                  )}
                  {(booking as any).security_deposit > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Security Deposit</span>
                      <span className="text-foreground">₱{(booking as any).security_deposit.toLocaleString()}</span>
                    </div>
                  )}
                  {booking.discount_given > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount ({booking.discount_type})</span>
                      <span className="text-foreground">
                        -{booking.discount_type === "percentage" ? `${booking.discount_given}%` : `₱${booking.discount_given.toLocaleString()}`}
                        {booking.discount_reason && <span className="text-[10px] text-muted-foreground ml-1">({booking.discount_reason})</span>}
                      </span>
                    </div>
                  )}
                  {/* Balance Due */}
                  {booking.deposit_paid > 0 && booking.total_amount - booking.deposit_paid > 0 && (
                    <>
                      <Separator className="bg-border/50 my-1" />
                      <div className="flex justify-between font-medium">
                        <span className="text-destructive">Balance Due</span>
                        <span className="text-destructive">₱{(booking.total_amount - booking.deposit_paid).toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
                {/* Extras */}
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  {booking.pets && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-warning-orange/30 text-warning-orange">
                      <PawPrint className="h-3 w-3" /> With Pets
                    </Badge>
                  )}
                  {booking.deposit_status !== "Pending" && (
                    <Badge variant="outline" className={cn("text-[10px]",
                      booking.deposit_status === "Returned" ? "border-ocean/30 text-ocean" : "border-destructive/30 text-destructive"
                    )}>
                      Deposit {booking.deposit_status}
                      {booking.deposit_status === "Deducted" && booking.deposit_deducted_amount > 0 && ` (₱${booking.deposit_deducted_amount.toLocaleString()})`}
                    </Badge>
                  )}
                </div>
                {/* Car Details */}
                {(booking as any).has_car && (booking as any).car_details && Array.isArray((booking as any).car_details) && (booking as any).car_details.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Car className="h-3 w-3" /> Vehicles
                    </h4>
                    {((booking as any).car_details as { type: string; color: string; plate: string }[]).map((car, i) => (
                      <div key={i} className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                        {car.type && <span className="font-medium text-foreground">{car.type}</span>}
                        {car.color && <span> · {car.color}</span>}
                        {car.plate && <span> · <span className="font-mono text-foreground">{car.plate}</span></span>}
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
