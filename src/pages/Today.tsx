import React, { useMemo, useState, useCallback, useEffect } from "react";
import { getUnpaidExtras, getUnpaidExtrasTotal, hasUnpaidExtras } from "@/lib/unpaidExtras";
import { format, parseISO, addDays, eachDayOfInterval, isWithinInterval, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useBookings, type Booking } from "@/hooks/useBookings";
import { useUpdateBooking } from "@/hooks/useBookingMutations";
import { useUnits, groupUnitsByArea } from "@/hooks/useUnits";
import { useGuests } from "@/hooks/useGuests";
import {
  LogIn, LogOut, Home, Users, BedDouble, GripVertical, Clock,
  AlertCircle, X, Pencil, Tent, TreePalm, Crown, Fan, Snowflake, CalendarDays,
  DollarSign, AlertTriangle, ArrowRight, Link2, ChevronDown, ChevronUp, Sun, RefreshCw,
  CircleDollarSign, SprayCan,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookingModal } from "@/components/BookingModal";
import { FormSubmissionsSection } from "@/components/FormSubmissionsSection";
import { useContinuedStaySet, useContinuedStayMap, type ContinuedStayInfo } from "@/hooks/useContinuedStay";
import { DaySummaryDialog } from "@/components/DaySummaryDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function getPaymentBadgeClass(status: string) {
  switch (status) {
    case "Fully Paid": return "bg-primary/20 text-primary border-primary/30";
    case "Airbnb Paid": return "bg-airbnb-pink/20 text-airbnb-pink border-airbnb-pink/30";
    case "Partial DP": return "bg-warning-orange/20 text-warning-orange border-warning-orange/30";
    case "Unpaid": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "Confirmed": return "bg-primary/20 text-primary border-primary/30";
    case "Checked In": return "bg-ocean/20 text-ocean border-ocean/30";
    case "Checked Out": return "bg-coral/20 text-coral border-coral/30";
    case "Inquiry": return "bg-warning-orange/20 text-warning-orange border-warning-orange/30";
    case "Hold": return "bg-muted text-muted-foreground border-border";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

interface GuestCardProps {
  booking: Booking;
  unitName: string;
  draggable?: boolean;
  onEdit?: () => void;
  noLateCheckout?: boolean;
  groupBookingId?: string | null;
  groupUnitNames?: string[];
  isContinuedStay?: boolean;
  continuedStayInfo?: ContinuedStayInfo;
  unitMap?: Map<string, string>;
  groupTotalAmount?: number;
  groupTotalPax?: number;
  isDeparture?: boolean;
  onToggleSettlement?: (bookingId: string, value: boolean) => void;
  onClearDeparture?: (bookingId: string) => void;
}

function GuestCard({ booking, unitName, draggable, onEdit, noLateCheckout, groupBookingId, groupUnitNames, isContinuedStay, continuedStayInfo, unitMap: cardUnitMap, groupTotalAmount, groupTotalPax, isDeparture, onToggleSettlement, onClearDeparture }: GuestCardProps) {
  const [wasDragged, setWasDragged] = useState(false);
  const isGrouped = !!groupBookingId;
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        setWasDragged(true);
        e.dataTransfer.setData("bookingId", booking.id);
        if (groupBookingId) {
          e.dataTransfer.setData("groupId", groupBookingId);
        }
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setTimeout(() => setWasDragged(false), 100)}
      onClick={() => {
        if (!wasDragged && onEdit) onEdit();
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors p-3 group",
        noLateCheckout && "border-warning-orange/40",
        isGrouped && "border-l-2 border-l-primary",
        draggable ? "cursor-grab active:cursor-grabbing" : onEdit ? "cursor-pointer" : ""
      )}
    >
      {draggable && (
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground truncate">{booking.guest_name}</span>
          {isGrouped && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-primary/10 text-primary border-primary/30">
              <Link2 className="h-2.5 w-2.5 mr-1" />
              Group
            </Badge>
          )}
          {isContinuedStay && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-ocean/10 text-ocean border-ocean/30">
              <RefreshCw className="h-2.5 w-2.5 mr-1" />
              Continued
              {continuedStayInfo && cardUnitMap && (
                <span className="ml-1 font-normal">
                  {continuedStayInfo.fromUnitId
                    ? `from ${cardUnitMap.get(continuedStayInfo.fromUnitId) ?? "?"}`
                    : ""}
                  {continuedStayInfo.toUnitId
                    ? `→ ${cardUnitMap.get(continuedStayInfo.toUnitId) ?? "?"}`
                    : ""}
                </span>
              )}
            </Badge>
          )}
          {booking.is_daytour_booking && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-ocean/20 text-ocean border-ocean/30 font-bold">
              DT
            </Badge>
          )}
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", getPaymentBadgeClass(booking.payment_status))}>
            {booking.payment_status}
          </Badge>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", getStatusBadgeClass(booking.booking_status))}>
            {booking.booking_status}
          </Badge>
          {(booking as any).post_checkout_settlement && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-warning-orange/20 text-warning-orange border-warning-orange/30">
              <CircleDollarSign className="h-2.5 w-2.5 mr-1" />
              Needs Settlement
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1 min-w-0">
            <BedDouble className="h-3 w-3 shrink-0" />
            <span className="truncate">{groupUnitNames && groupUnitNames.length > 1 ? groupUnitNames.join(" + ") : unitName}</span>
          </span>
          <span className="shrink-0">{groupTotalPax !== undefined ? groupTotalPax : booking.pax} PAX</span>
          <span className="shrink-0">₱{(groupTotalAmount !== undefined ? groupTotalAmount : booking.total_amount).toLocaleString()}</span>
          {booking.is_daytour_booking ? (
            <span className="shrink-0">{format(parseISO(booking.check_in), "MMM d")}</span>
          ) : (
            <span className="shrink-0">
              {format(parseISO(booking.check_in), "MMM d")} → {format(parseISO(booking.check_out), "MMM d")}
            </span>
          )}
        </div>
        {noLateCheckout && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-warning-orange font-medium">
            <Clock className="h-3 w-3" />
            No late check-out — next guest arriving tomorrow
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isDeparture && onToggleSettlement && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              (booking as any).post_checkout_settlement
                ? "text-warning-orange hover:text-warning-orange/80"
                : "text-muted-foreground opacity-0 group-hover:opacity-100"
            )}
            title={(booking as any).post_checkout_settlement ? "Mark as settled" : "Flag for post-checkout settlement"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSettlement(booking.id, !(booking as any).post_checkout_settlement);
            }}
          >
            <CircleDollarSign className="h-3.5 w-3.5" />
          </Button>
        )}
        {isDeparture && onClearDeparture && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
            title="Clear from departures"
            onClick={(e) => {
              e.stopPropagation();
              onClearDeparture(booking.id);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        {onEdit && (
          <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );
}

interface GroupedGuestCardProps {
  primaryBooking: Booking;
  siblingBookings: Booking[];
  unitMap: Map<string, string>;
  groupUnitNames: string[];
  draggable?: boolean;
  onEdit: (b: Booking) => void;
  noLateCheckoutUnitIds?: Set<string>;
  continuedStayIds?: Set<string>;
  continuedStayMap?: Map<string, ContinuedStayInfo>;
  isDeparture?: boolean;
  onToggleSettlement?: (bookingId: string, value: boolean) => void;
  onClearDeparture?: (bookingId: string) => void;
}

function GroupedGuestCard({ primaryBooking, siblingBookings, unitMap, groupUnitNames, draggable, onEdit, noLateCheckoutUnitIds, continuedStayIds, continuedStayMap, isDeparture, onToggleSettlement, onClearDeparture }: GroupedGuestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const allGroupBookings = [primaryBooking, ...siblingBookings];
  const groupTotalAmount = allGroupBookings.reduce((sum, b) => sum + b.total_amount, 0);
  const groupTotalPax = primaryBooking.pax;
  const isContinuedStay = continuedStayIds?.has(primaryBooking.id);

  return (
    <div className="space-y-1">
      {/* Main summary card */}
      <div
        draggable={draggable}
        onDragStart={(e) => {
          e.dataTransfer.setData("bookingId", primaryBooking.id);
          if (primaryBooking.booking_group_id) {
            e.dataTransfer.setData("groupId", primaryBooking.booking_group_id);
          }
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => onEdit(primaryBooking)}
        className={cn(
          "flex items-center gap-2 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors p-3 group border-l-2 border-l-primary",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        )}
      >
        {draggable && <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground truncate">{primaryBooking.guest_name}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-primary/10 text-primary border-primary/30">
              <Link2 className="h-2.5 w-2.5 mr-1" />
              Group
            </Badge>
            {isContinuedStay && (() => {
              const info = continuedStayMap?.get(primaryBooking.id);
              return (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-ocean/10 text-ocean border-ocean/30">
                  <RefreshCw className="h-2.5 w-2.5 mr-1" />
                  Continued
                  {info && (
                    <span className="ml-1 font-normal">
                      {info.fromUnitId ? `from ${unitMap.get(info.fromUnitId) ?? "?"}` : ""}
                      {info.toUnitId ? `→ ${unitMap.get(info.toUnitId) ?? "?"}` : ""}
                    </span>
                  )}
                </Badge>
              );
            })()}
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", getPaymentBadgeClass(primaryBooking.payment_status))}>
              {primaryBooking.payment_status}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", getStatusBadgeClass(primaryBooking.booking_status))}>
              {primaryBooking.booking_status}
            </Badge>
            {(primaryBooking as any).post_checkout_settlement && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 bg-warning-orange/20 text-warning-orange border-warning-orange/30">
                <CircleDollarSign className="h-2.5 w-2.5 mr-1" />
                Needs Settlement
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1 min-w-0">
              <BedDouble className="h-3 w-3 shrink-0" />
              <span className="truncate">{groupUnitNames.join(" + ")}</span>
            </span>
            <span className="shrink-0">{groupTotalPax} PAX</span>
            <span className="shrink-0">₱{groupTotalAmount.toLocaleString()}</span>
            {primaryBooking.is_daytour_booking ? (
              <span className="shrink-0">{format(parseISO(primaryBooking.check_in), "MMM d")}</span>
            ) : (
              <span className="shrink-0">
                {format(parseISO(primaryBooking.check_in), "MMM d")} → {format(parseISO(primaryBooking.check_out), "MMM d")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {isDeparture && onToggleSettlement && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                (primaryBooking as any).post_checkout_settlement
                  ? "text-warning-orange hover:text-warning-orange/80"
                  : "text-muted-foreground opacity-0 group-hover:opacity-100"
              )}
              title={(primaryBooking as any).post_checkout_settlement ? "Mark as settled" : "Flag for post-checkout settlement"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSettlement(primaryBooking.id, !(primaryBooking as any).post_checkout_settlement);
              }}
            >
              <CircleDollarSign className="h-3.5 w-3.5" />
            </Button>
          )}
          {isDeparture && onClearDeparture && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
              title="Clear from departures"
              onClick={(e) => {
                e.stopPropagation();
                onClearDeparture(primaryBooking.id);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      {/* Individual unit cards */}
      {expanded && allGroupBookings.map((b) => (
        <div key={b.id} className="ml-5 border-l-2 border-primary/20 pl-2">
          <div
            onClick={() => onEdit(b)}
            className="flex items-center gap-2 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors p-2.5 cursor-pointer group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <BedDouble className="h-3 w-3 shrink-0" />
                  <span className="font-medium text-foreground">{unitMap.get(b.unit_id ?? "") ?? "—"}</span>
                </span>
                {b.is_primary && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 bg-primary/10 text-primary border-primary/30">Primary</Badge>
                )}
                <span className="shrink-0">{b.pax} PAX</span>
                <span className="shrink-0">₱{b.total_amount.toLocaleString()}</span>
                {!!b.unit_id && noLateCheckoutUnitIds?.has(b.unit_id) && (
                  <span className="flex items-center gap-0.5 text-warning-orange">
                    <Clock className="h-2.5 w-2.5" />
                    No late checkout
                  </span>
                )}
              </div>
            </div>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

type DropZone = "arrivals" | "inhouse" | "departures";

export default function TodayPage() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: allBookings = [], isLoading: bookingsLoading } = useBookings();
  const continuedStayIds = useContinuedStaySet(allBookings);
  const continuedStayMap = useContinuedStayMap(allBookings);
  const { data: units = [], isLoading: unitsLoading } = useUnits();
  const { data: guests = [] } = useGuests();
  const updateBooking = useUpdateBooking();
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState<DropZone | null>(null);
  const [manualDepartureIds, setManualDepartureIds] = useState<string[]>([]);
  const [clearedDepartureIds, setClearedDepartureIds] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem("cleared_departures_" + format(new Date(), "yyyy-MM-dd"));
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Persist cleared departures to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("cleared_departures_" + todayStr, JSON.stringify(clearedDepartureIds));
  }, [clearedDepartureIds, todayStr]);
  const [clearedTurnoverIds, setClearedTurnoverIds] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem("cleared_turnover_" + format(new Date(), "yyyy-MM-dd"));
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  useEffect(() => {
    sessionStorage.setItem("cleared_turnover_" + todayStr, JSON.stringify(clearedTurnoverIds));
  }, [clearedTurnoverIds, todayStr]);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [showDaySummary, setShowDaySummary] = useState(false);
  const [showCheckoutReminder, setShowCheckoutReminder] = useState(false);
  const [showArrivalsSummary, setShowArrivalsSummary] = useState(false);
  const [showInHouseSummary, setShowInHouseSummary] = useState(false);
  const [turnoverExpanded, setTurnoverExpanded] = useState(true);

   const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  // Build group unit names map: groupId → [unit names]
  const groupUnitNamesMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const b of allBookings) {
      const gid = b.booking_group_id;
      if (!gid) continue;
      if (!m.has(gid)) m.set(gid, []);
      const name = unitMap.get(b.unit_id ?? "") ?? "Unknown";
      const arr = m.get(gid)!;
      if (!arr.includes(name)) arr.push(name);
    }
    return m;
  }, [allBookings, unitMap]);

  // Map groupId → sibling (non-primary) bookings
  const groupSiblingsMap = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of allBookings) {
      const gid = b.booking_group_id;
      if (!gid || b.is_primary) continue;
      if (!m.has(gid)) m.set(gid, []);
      m.get(gid)!.push(b);
    }
    return m;
  }, [allBookings]);

  const { checkIns, baseCheckOuts, dueDepartures, inHouse, pendingBalances, todayRevenue, upcomingArrivals, overbookings, noLateCheckoutUnitIds, daytourGuests, turnoverUnits } = useMemo(() => {
    const checkIns: Booking[] = [];
    const baseCheckOuts: Booking[] = [];
    const dueDepartures: Booking[] = [];
    const inHouse: Booking[] = [];
    const pendingBalances: Booking[] = [];
    const upcomingArrivals: Booking[] = [];
    const daytourGuests: Booking[] = [];
    let todayRevenue = 0;

    const today = new Date();
    const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
    const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");
    const day2Str = format(addDays(today, 2), "yyyy-MM-dd");
    const day3Str = format(addDays(today, 3), "yyyy-MM-dd");

    for (const b of allBookings) {
      if (b.booking_status === "Cancelled") continue;
      const ci = b.check_in;
      const co = b.check_out;
      const isSecondaryGroup = b.booking_group_id && b.is_primary === false;

      // In-house counts ALL bookings (including secondary) for accurate occupancy
      if (b.booking_status === "Checked In" && ci <= todayStr && co >= todayStr) {
        inHouse.push(b);
      }

      // Skip secondary grouped bookings for display sections only
      if (isSecondaryGroup) continue;

      // Show arrivals: today's check-ins OR past-due arrivals (not yet checked in, checkout still ahead)
      if (ci <= todayStr && co >= todayStr && b.booking_status !== "Checked In" && b.booking_status !== "Checked Out") {
        checkIns.push(b);
      }
      if (co === todayStr && b.booking_status === "Checked Out") {
        baseCheckOuts.push(b);
      }
      if (co === todayStr && b.booking_status === "Checked In") {
        dueDepartures.push(b);
      }
      if (b.payment_status === "Unpaid" || b.payment_status === "Partial DP" || hasUnpaidExtras(b)) {
        pendingBalances.push(b);
      }
      // Today's revenue: bookings checked in today (revenue attributed to check-in month)
      if (ci === todayStr && (b.booking_status === "Checked In" || b.booking_status === "Checked Out" || b.booking_status === "Confirmed")) {
        todayRevenue += b.total_amount;
      }
      // Upcoming arrivals: next 3 days
      if ((ci === tomorrowStr || ci === day2Str || ci === day3Str) && b.booking_status !== "Checked In" && b.booking_status !== "Checked Out") {
        upcomingArrivals.push(b);
      }
    }

    // Detect units that have a booking arriving tomorrow (no late checkout allowed)
    const noLateCheckoutUnitIds = new Set<string>();
    for (const b of allBookings) {
      if (b.booking_status === "Cancelled" || !b.unit_id) continue;
      if (b.check_in === tomorrowStr) {
        noLateCheckoutUnitIds.add(b.unit_id);
      }
    }

    // Overbooking detection: find units with 2+ overlapping active bookings
    const overbookings: { unitId: string; bookings: Booking[] }[] = [];
    const activeBookings = allBookings.filter(b => b.booking_status !== "Cancelled" && b.booking_status !== "Checked Out" && b.unit_id);
    const unitBookingsMap = new Map<string, Booking[]>();
    for (const b of activeBookings) {
      const arr = unitBookingsMap.get(b.unit_id!) || [];
      arr.push(b);
      unitBookingsMap.set(b.unit_id!, arr);
    }
    for (const [unitId, bookings] of unitBookingsMap) {
      if (bookings.length < 2) continue;
      const conflicts: Booking[] = [];
      for (let i = 0; i < bookings.length; i++) {
        for (let j = i + 1; j < bookings.length; j++) {
          const a = bookings[i], bk = bookings[j];
          // Overlap: a.check_in < b.check_out AND b.check_in < a.check_out
          if (a.check_in < bk.check_out && bk.check_in < a.check_out) {
            if (!conflicts.includes(a)) conflicts.push(a);
            if (!conflicts.includes(bk)) conflicts.push(bk);
          }
        }
      }
      if (conflicts.length > 0) overbookings.push({ unitId, bookings: conflicts });
    }

    // Day tour guests: daytour bookings for today that aren't cancelled
    for (const b of allBookings) {
      if (b.booking_status === "Cancelled" || b.deleted_at) continue;
      if (!b.is_daytour_booking) continue;
      if (b.check_in === todayStr) {
        daytourGuests.push(b);
      }
    }

    // Turnover units: units departing today that need cleaning
    const departuresToday = allBookings.filter(b =>
      b.booking_status !== "Cancelled" && !b.deleted_at && b.unit_id &&
      b.check_out === todayStr
    );
    const departingUnitIds = new Set(departuresToday.map(b => b.unit_id!));
    const turnoverUnits: { unitId: string; departingGuest: string; nextBooking: Booking | null; urgency: "urgent" | "tomorrow" | "none" }[] = [];

    for (const unitId of departingUnitIds) {
      const departingBooking = departuresToday.find(b => b.unit_id === unitId)!;
      // Find next booking for this unit
      const nextBooking = allBookings
        .filter(b => b.unit_id === unitId && b.booking_status !== "Cancelled" && !b.deleted_at && b.check_in >= todayStr && b.id !== departingBooking.id)
        .sort((a, b) => a.check_in.localeCompare(b.check_in))[0] ?? null;

      let urgency: "urgent" | "tomorrow" | "none" = "none";
      if (nextBooking) {
        if (nextBooking.check_in === todayStr) urgency = "urgent";
        else if (nextBooking.check_in === tomorrowStr) urgency = "tomorrow";
      }

      turnoverUnits.push({
        unitId,
        departingGuest: departingBooking.guest_name,
        nextBooking,
        urgency,
      });
    }

    // Sort: urgent first, then tomorrow, then none
    turnoverUnits.sort((a, b) => {
      const order = { urgent: 0, tomorrow: 1, none: 2 };
      return order[a.urgency] - order[b.urgency];
    });

    return { checkIns, baseCheckOuts, dueDepartures, inHouse, pendingBalances, todayRevenue, upcomingArrivals, overbookings, noLateCheckoutUnitIds, daytourGuests, turnoverUnits };
  }, [allBookings, todayStr]);

  const visibleDepartures = useMemo(() => {
    const byId = new Map<string, Booking>();

    // Include already checked-out guests
    for (const booking of baseCheckOuts) {
      if (!clearedDepartureIds.includes(booking.id)) {
        byId.set(booking.id, booking);
      }
    }

    for (const bookingId of manualDepartureIds) {
      const booking = allBookings.find((item) => item.id === bookingId);
      if (booking && !clearedDepartureIds.includes(booking.id)) {
        byId.set(booking.id, booking);
      }
    }

    return Array.from(byId.values());
  }, [allBookings, baseCheckOuts, dueDepartures, manualDepartureIds, clearedDepartureIds]);

  const handleDrop = useCallback(
    (zone: DropZone, e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const bookingId = e.dataTransfer.getData("bookingId");
      const groupId = e.dataTransfer.getData("groupId");
      if (!bookingId) return;

      let newStatus: string | null = null;
      if (zone === "inhouse") newStatus = "Checked In";
      else if (zone === "departures") newStatus = "Checked Out";
      else if (zone === "arrivals") newStatus = "Confirmed";

      if (!newStatus) return;

      // Collect all booking IDs to update (group or single) with their previous statuses
      const updates: { id: string; previousStatus: string }[] = [];
      if (groupId) {
        const groupBookings = allBookings.filter((b) => b.booking_group_id === groupId);
        for (const gb of groupBookings) {
          if (gb.booking_status !== newStatus) updates.push({ id: gb.id, previousStatus: gb.booking_status });
        }
      } else {
        const booking = allBookings.find((b) => b.id === bookingId);
        if (!booking || booking.booking_status === newStatus) return;
        updates.push({ id: bookingId, previousStatus: booking.booking_status });
      }

      if (updates.length === 0) return;

      const booking = allBookings.find((b) => b.id === bookingId)!;
      const idsToUpdate = updates.map((u) => u.id);

      if (zone === "departures") {
        for (const id of idsToUpdate) {
          setManualDepartureIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
          setClearedDepartureIds((prev) => prev.filter((cid) => cid !== id));
        }
      } else {
        setManualDepartureIds((prev) => prev.filter((id) => !idsToUpdate.includes(id)));
      }

      // Undo handler: revert all bookings to their previous statuses
      const undoMove = () => {
        for (const { id, previousStatus } of updates) {
          updateBooking.mutate(
            { id, booking_status: previousStatus as any },
            {
              onSuccess: id === bookingId
                ? () => toast.success(`Reverted ${booking.guest_name} → ${previousStatus}`)
                : undefined,
            }
          );
        }
        // Restore departure tracking state
        if (zone === "departures") {
          setManualDepartureIds((prev) => prev.filter((id) => !idsToUpdate.includes(id)));
        } else {
          // If we moved them OUT of departures, put them back
          for (const { id, previousStatus } of updates) {
            if (previousStatus === "Checked Out") {
              setManualDepartureIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
              setClearedDepartureIds((prev) => prev.filter((cid) => cid !== id));
            }
          }
        }
      };

      // Update all bookings in the group
      for (const id of idsToUpdate) {
        updateBooking.mutate(
          { id, booking_status: newStatus as any },
          {
            onSuccess: id === bookingId
              ? () => toast.success(
                  `${booking.guest_name}${idsToUpdate.length > 1 ? ` (${idsToUpdate.length} units)` : ""} → ${newStatus}`,
                  {
                    action: {
                      label: "Undo",
                      onClick: undoMove,
                    },
                    duration: 8000,
                  }
                )
              : undefined,
            onError: id === bookingId
              ? (err) => toast.error(`Failed to update: ${err.message}`)
              : undefined,
          }
        );
      }
    },
    [allBookings, updateBooking]
  );

  const handleToggleSettlement = useCallback((bookingId: string, value: boolean) => {
    updateBooking.mutate(
      { id: bookingId, post_checkout_settlement: value } as any,
      {
        onSuccess: () => toast.success(value ? "Flagged for post-checkout settlement" : "Settlement flag cleared"),
        onError: (err) => toast.error(`Failed to update: ${err.message}`),
      }
    );
  }, [updateBooking]);

  const handleClearDepartures = useCallback(() => {
    setClearedDepartureIds((prev) => Array.from(new Set([...prev, ...visibleDepartures.map((b) => b.id)])));
    setManualDepartureIds([]);
  }, [visibleDepartures]);

  const handleClearSingleDeparture = useCallback((bookingId: string) => {
    setClearedDepartureIds((prev) => prev.includes(bookingId) ? prev : [...prev, bookingId]);
    setManualDepartureIds((prev) => prev.filter((id) => id !== bookingId));
  }, []);

  const handleDragOver = useCallback((zone: DropZone, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(zone);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(null), []);

  // Pax: only count from primary bookings to avoid double-counting grouped guests
  const totalPaxInHouse = inHouse.filter((b) => b.is_primary).reduce((sum, b) => sum + b.pax, 0);
  // Use unique occupied unit count for occupancy (avoids double-counting group bookings)
  const occupiedUnitCount = new Set(inHouse.filter((b) => b.unit_id).map((b) => b.unit_id)).size;
  const availableUnitCount = units.filter((u) => (u.unit_status || "Available") === "Available").length;
  const occupancyRate = availableUnitCount > 0 ? Math.round((occupiedUnitCount / availableUnitCount) * 100) : 0;
  // Display list: only show primary bookings (secondary ones appear via expand)
  const inHouseDisplay = inHouse.filter((b) => !b.booking_group_id || b.is_primary);
  const pendingTotal = pendingBalances.reduce((s, b) => {
    const balance = b.total_amount - b.deposit_paid;
    const unpaidExtrasAmt = getUnpaidExtrasTotal(b);
    // If fully paid but has unpaid extras, show only the extras amount
    if (balance <= 0 && unpaidExtrasAmt > 0) return s + unpaidExtrasAmt;
    return s + Math.max(balance, 0);
  }, 0);
  const isLoading = bookingsLoading || unitsLoading;

  // Build unit → area lookup
  const unitAreaMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.area));
    return m;
  }, [units]);

  // Helper: group bookings by area
  const groupByArea = useCallback((bookingsList: Booking[]) => {
    const areaOrder = ["Owner's Villa", "Pool Area", "Beach Area"];
    const grouped = new Map<string, Booking[]>();
    for (const b of bookingsList) {
      const area = b.unit_id ? (unitAreaMap.get(b.unit_id) ?? "Other") : "Other";
      if (!grouped.has(area)) grouped.set(area, []);
      grouped.get(area)!.push(b);
    }
    // Sort by area order
    const sorted: { area: string; bookings: Booking[] }[] = [];
    for (const area of areaOrder) {
      if (grouped.has(area)) sorted.push({ area, bookings: grouped.get(area)! });
    }
    // Add any remaining areas
    for (const [area, bookings] of grouped) {
      if (!areaOrder.includes(area)) sorted.push({ area, bookings });
    }
    return sorted;
  }, [unitAreaMap]);

  const arrivalsGrouped = useMemo(() => groupByArea(checkIns), [checkIns, groupByArea]);
  const inHouseGrouped = useMemo(() => groupByArea(inHouseDisplay), [inHouseDisplay, groupByArea]);

  const groupedUnits = useMemo(() => groupUnitsByArea(units), [units]);

  // Show checkout reminder popup when there are due departures
  useEffect(() => {
    if (dueDepartures.length > 0 && !isLoading) {
      const dismissed = sessionStorage.getItem("checkout_reminder_dismissed_" + todayStr);
      if (!dismissed) {
        setShowCheckoutReminder(true);
      }
    }
  }, [dueDepartures.length, isLoading, todayStr]);

  // Compute available units for today and each day this week
  const weekDays = useMemo(() => {
    const today = new Date();
    return eachDayOfInterval({ start: today, end: addDays(today, 6) });
  }, []);

  const unitAvailability = useMemo(() => {
    // For each unit, check which days it's available
    return units.map((unit) => {
      const unitStatus = unit.unit_status || "Available";
      const isUnitUnavailable = unitStatus !== "Available";
      const dayStatus = weekDays.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        if (isUnitUnavailable) {
          return { date: day, dateStr: dayStr, available: false };
        }
        const isOccupied = allBookings.some((b) => {
          if (b.booking_status === "Cancelled") return false;
          if (b.unit_id !== unit.id) return false;
          const ci = parseISO(b.check_in);
          const co = parseISO(b.check_out);
          return isWithinInterval(day, { start: ci, end: co }) && !isSameDay(day, co);
        });
        return { date: day, dateStr: dayStr, available: !isOccupied };
      });
      const availableToday = dayStatus[0]?.available ?? true;
      const availableDaysCount = dayStatus.filter((d) => d.available).length;
      return { unit, dayStatus, availableToday, availableDaysCount };
    });
  }, [units, allBookings, weekDays]);

  const availableTodayCount = unitAvailability.filter((u) => u.availableToday).length;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0 gap-1">
          <div
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowDaySummary(true)}
            title="Click to view today's summary"
          >
            <h1 className="text-xl sm:text-3xl font-display text-foreground tracking-wide">Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Check-in 1 PM · Check-out 11 AM</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Home} label="Occupancy" value={`${occupancyRate}%`} sub={`${occupiedUnitCount} / ${availableUnitCount} units`} />
              <StatCard icon={Users} label="In-House" value={`${totalPaxInHouse} pax`} sub={`${inHouseDisplay.length} bookings`} />
              <StatCard
                icon={AlertCircle}
                label="Pending"
                value={`₱${pendingTotal.toLocaleString()}`}
                sub={`${pendingBalances.length} bookings`}
                alert={pendingBalances.length > 0}
                onClick={() => navigate("/balances")}
              />
              <StatCard icon={Users} label="Guests" value={String(checkIns.length + inHouse.length + visibleDepartures.length)} sub="Today's bookings" onClick={() => navigate("/guests")} />
            </div>

            {/* Form Submissions */}
            <FormSubmissionsSection unitMap={unitMap} />

            {/* Overbooking Warnings */}
            {overbookings.length > 0 && (
              <div className="rounded-lg border border-warning-orange/50 bg-warning-orange/5 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-warning-orange mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" /> Overbooking Alert ({overbookings.length} {overbookings.length === 1 ? "unit" : "units"})
                </h3>
                <div className="space-y-2">
                  {overbookings.map(({ unitId, bookings: conflicts }) => (
                    <div key={unitId} className="text-sm">
                      <span className="font-medium text-foreground">{unitMap.get(unitId) ?? "Unknown Unit"}</span>
                      <span className="text-muted-foreground ml-1 text-xs">— {conflicts.length} overlapping bookings:</span>
                      <div className="ml-4 mt-1 space-y-0.5">
                        {conflicts.map((b) => (
                          <div key={b.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="text-foreground font-medium">{b.guest_name}</span>
                            <span>{format(parseISO(b.check_in), "MMM d")} → {format(parseISO(b.check_out), "MMM d")}</span>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getStatusBadgeClass(b.booking_status))}>{b.booking_status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <GripVertical className="h-3 w-3" />
              Drag guests between columns to update status
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Section
                icon={LogIn} title="Arrivals" count={checkIns.length} color="text-primary"
                onTitleClick={() => setShowArrivalsSummary(true)}
                isDropTarget={dragOver === "arrivals"}
                onDrop={(e) => handleDrop("arrivals", e)}
                onDragOver={(e) => handleDragOver("arrivals", e)}
                onDragLeave={handleDragLeave}
              >
                {checkIns.length === 0 ? (
                  <EmptyState text="No arrivals today" />
                ) : (
                  arrivalsGrouped.map(({ area, bookings: areaBookings }) => (
                    <div key={area}>
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">{area}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      {areaBookings.map((b) => b.booking_group_id ? (
                        <GroupedGuestCard key={b.id} primaryBooking={b} siblingBookings={groupSiblingsMap.get(b.booking_group_id) ?? []} unitMap={unitMap} groupUnitNames={groupUnitNamesMap.get(b.booking_group_id) ?? []} draggable onEdit={setEditingBooking} noLateCheckoutUnitIds={noLateCheckoutUnitIds} continuedStayIds={continuedStayIds} continuedStayMap={continuedStayMap} />
                      ) : (
                        <GuestCard key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} draggable onEdit={() => setEditingBooking(b)} isContinuedStay={continuedStayIds.has(b.id)} continuedStayInfo={continuedStayMap.get(b.id)} unitMap={unitMap} />
                      ))}
                    </div>
                  ))
                )}
              </Section>

              <Section
                icon={Home} title="In-House" count={inHouse.length} color="text-ocean"
                onTitleClick={() => setShowInHouseSummary(true)}
                extraBadge={dueDepartures.length > 0 ? { label: `${dueDepartures.length} due out`, color: "bg-coral/20 text-coral" } : undefined}
                isDropTarget={dragOver === "inhouse"}
                onDrop={(e) => handleDrop("inhouse", e)}
                onDragOver={(e) => handleDragOver("inhouse", e)}
                onDragLeave={handleDragLeave}
              >
                {inHouseDisplay.length === 0 ? (
                  <EmptyState text="No guests in-house" />
                ) : (
                  inHouseGrouped.map(({ area, bookings: areaBookings }) => (
                    <div key={area}>
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-ocean font-semibold">{area}</span>
                        <div className="flex-1 h-px bg-border" />
            </div>

                      {areaBookings.map((b) => b.booking_group_id ? (
                        <GroupedGuestCard key={b.id} primaryBooking={b} siblingBookings={groupSiblingsMap.get(b.booking_group_id) ?? []} unitMap={unitMap} groupUnitNames={groupUnitNamesMap.get(b.booking_group_id) ?? []} draggable onEdit={setEditingBooking} noLateCheckoutUnitIds={noLateCheckoutUnitIds} continuedStayIds={continuedStayIds} continuedStayMap={continuedStayMap} />
                      ) : (
                        <GuestCard key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} draggable onEdit={() => setEditingBooking(b)} noLateCheckout={!!b.unit_id && noLateCheckoutUnitIds.has(b.unit_id)} isContinuedStay={continuedStayIds.has(b.id)} continuedStayInfo={continuedStayMap.get(b.id)} unitMap={unitMap} />
                      ))}
                    </div>
                  ))
                )}
              </Section>

              <Section
                icon={LogOut} title="Departures" count={visibleDepartures.length} color="text-coral"
                isDropTarget={dragOver === "departures"}
                onDrop={(e) => handleDrop("departures", e)}
                onDragOver={(e) => handleDragOver("departures", e)}
                onDragLeave={handleDragLeave}
                onClear={visibleDepartures.length > 0 ? handleClearDepartures : undefined}
              >
                {visibleDepartures.length === 0 ? (
                  <EmptyState text="No departures yet" />
                ) : (
                  visibleDepartures.map((b) => b.booking_group_id ? (
                    <GroupedGuestCard key={b.id} primaryBooking={b} siblingBookings={groupSiblingsMap.get(b.booking_group_id) ?? []} unitMap={unitMap} groupUnitNames={groupUnitNamesMap.get(b.booking_group_id) ?? []} onEdit={setEditingBooking} noLateCheckoutUnitIds={noLateCheckoutUnitIds} continuedStayIds={continuedStayIds} continuedStayMap={continuedStayMap} isDeparture onToggleSettlement={handleToggleSettlement} onClearDeparture={handleClearSingleDeparture} />
                  ) : (
                    <GuestCard key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} onEdit={() => setEditingBooking(b)} noLateCheckout={!!b.unit_id && noLateCheckoutUnitIds.has(b.unit_id)} isContinuedStay={continuedStayIds.has(b.id)} continuedStayInfo={continuedStayMap.get(b.id)} unitMap={unitMap} isDeparture onToggleSettlement={handleToggleSettlement} onClearDeparture={handleClearSingleDeparture} />
                  ))
                )}
              </Section>
            </div>

            {/* Day Tour Guests */}
            {daytourGuests.length > 0 && (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-warning-orange" />
                    <span className="text-sm font-medium text-foreground">Day Tour Guests</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      {daytourGuests.length}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {daytourGuests.reduce((s, b) => s + b.pax, 0)} total pax
                  </span>
                </div>
                <div className="p-2 space-y-1.5">
                  {daytourGuests.map((b) => (
                    <GuestCard key={b.id} booking={b} unitName={b.unit_id ? (unitMap.get(b.unit_id) ?? "—") : "Day Tour"} onEdit={() => setEditingBooking(b)} isContinuedStay={continuedStayIds.has(b.id)} continuedStayInfo={continuedStayMap.get(b.id)} unitMap={unitMap} />
                  ))}
                </div>
              </div>
            )}
            {/* Turnover / Cleaning Attention */}
            {(() => {
              const pendingTurnover = turnoverUnits.filter(t => !clearedTurnoverIds.includes(t.unitId));
              return pendingTurnover.length > 0 ? (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <SprayCan className="h-4 w-4 text-warning-orange" />
                    <span className="text-sm font-medium text-foreground">Turnover — Needs Cleaning</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      {pendingTurnover.length}
                    </Badge>
                    {pendingTurnover.some(t => t.urgency === "urgent") && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-destructive/20 text-destructive border-destructive/30">
                        {pendingTurnover.filter(t => t.urgency === "urgent").length} urgent
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="p-2 space-y-1.5">
                  {pendingTurnover.map((t) => (
                    <label
                      key={t.unitId}
                      className={cn(
                        "flex items-center gap-3 rounded-md border px-3 py-2.5 text-xs transition-colors cursor-pointer hover:bg-muted/30",
                        t.urgency === "urgent"
                          ? "border-destructive/40 bg-destructive/5"
                          : t.urgency === "tomorrow"
                          ? "border-warning-orange/40 bg-warning-orange/5"
                          : "border-border bg-background"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border text-primary accent-primary shrink-0"
                        onChange={() => {
                          setClearedTurnoverIds(prev => [...prev, t.unitId]);
                          toast.success(`${unitMap.get(t.unitId) ?? "Unit"} marked as cleaned`);
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <BedDouble className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground">{unitMap.get(t.unitId) ?? "Unknown"}</span>
                          {t.urgency === "urgent" && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-destructive/20 text-destructive border-destructive/30">
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                              Same-day arrival
                            </Badge>
                          )}
                          {t.urgency === "tomorrow" && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-warning-orange/20 text-warning-orange border-warning-orange/30">
                              <Clock className="h-2.5 w-2.5 mr-0.5" />
                              Tomorrow arrival
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <LogOut className="h-2.5 w-2.5" />
                            Departing: <span className="text-foreground font-medium">{t.departingGuest}</span>
                          </span>
                          {t.nextBooking && (
                            <>
                              <span className="mx-0.5">→</span>
                              <span className="flex items-center gap-1">
                                <LogIn className="h-2.5 w-2.5" />
                                Next: <span className="text-foreground font-medium">{t.nextBooking.guest_name}</span>
                                <span>({format(parseISO(t.nextBooking.check_in), "MMM d")})</span>
                              </span>
                            </>
                          )}
                          {!t.nextBooking && (
                            <span className="text-primary/70">No upcoming booking</span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              ) : null;
            })()}
            {upcomingArrivals.length > 0 && (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Upcoming Arrivals</span>
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      Next 3 days
                    </span>
                  </div>
                </div>
                <div className="p-2 space-y-1.5">
                  {upcomingArrivals.map((b) => (
                     b.booking_group_id ? (
                      <GroupedGuestCard key={b.id} primaryBooking={b} siblingBookings={groupSiblingsMap.get(b.booking_group_id) ?? []} unitMap={unitMap} groupUnitNames={groupUnitNamesMap.get(b.booking_group_id) ?? []} onEdit={setEditingBooking} noLateCheckoutUnitIds={noLateCheckoutUnitIds} continuedStayIds={continuedStayIds} continuedStayMap={continuedStayMap} />
                    ) : (
                      <GuestCard key={b.id} booking={b} unitName={unitMap.get(b.unit_id ?? "") ?? "—"} onEdit={() => setEditingBooking(b)} isContinuedStay={continuedStayIds.has(b.id)} continuedStayInfo={continuedStayMap.get(b.id)} unitMap={unitMap} />
                    )
                  ))}
                </div>
              </div>
            )}

            {pendingBalances.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive mb-3 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" /> Pending Balances ({pendingBalances.length})
                </h3>
                <div className="space-y-2">
                  {pendingBalances.slice(0, 5).map((b) => {
                    const balance = b.total_amount - b.deposit_paid;
                    const unpaidExtrasList = getUnpaidExtras(b);
                    const unpaidExtrasAmt = unpaidExtrasList.reduce((s, e) => s + e.amount, 0);
                    const displayAmount = balance > 0 ? balance : unpaidExtrasAmt;
                    return (
                      <div key={b.id} className="space-y-0.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="min-w-0">
                            <span className="text-foreground font-medium">{b.guest_name}</span>
                            <span className="text-muted-foreground ml-2 text-xs">{b.booking_ref}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-destructive font-medium">₱{displayAmount.toLocaleString()}</span>
                            <Badge variant="outline" className="ml-2 text-[10px]">{b.payment_status}</Badge>
                          </div>
                        </div>
                        {unpaidExtrasList.length > 0 && (
                          <div className="text-[10px] text-warning-orange pl-2">
                            Unpaid: {unpaidExtrasList.map(e => e.name).join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {pendingBalances.length > 5 && (
                    <button className="text-xs text-primary hover:underline" onClick={() => navigate("/balances")}>
                      View all {pendingBalances.length} →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Available Units - Today & Week */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Unit Availability</span>
                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                    {availableTodayCount} free today
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate("/availability")}
                >
                  Full grid →
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium min-w-[140px] sticky left-0 z-10 bg-muted/30">Unit</th>
                      {weekDays.map((day) => (
                        <th key={day.toISOString()} className="text-center px-2 py-2 text-muted-foreground font-medium min-w-[52px]">
                          <div className="text-[10px] leading-none">{format(day, "EEE")}</div>
                          <div className="mt-0.5">{format(day, "d")}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedUnits.map(({ area, units: areaUnits }) => (
                      <React.Fragment key={area}>
                        <tr>
                          <td
                            colSpan={weekDays.length + 1}
                            className="bg-secondary/50 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-primary font-semibold border-t border-border sticky left-0"
                          >
                            {area}
                          </td>
                        </tr>
                        {areaUnits.map((unit) => {
                          const ua = unitAvailability.find((u) => u.unit.id === unit.id);
                          return (
                            <tr key={unit.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                              <td className="px-3 py-1.5 sticky left-0 z-10 bg-card">
                                <div className="flex items-center gap-1.5">
                                  {(() => {
                                    const Icon = unit.name.includes("Villa") && unit.name.includes("Owner") ? Crown
                                      : unit.name.includes("Villa") ? Home
                                      : unit.name.includes("Teepee") ? Tent
                                      : unit.name.includes("Kubo") ? TreePalm
                                      : Home;
                                    return <Icon className="h-3 w-3 text-muted-foreground shrink-0" />;
                                  })()}
                                  <span className="font-medium text-foreground truncate">{unit.name}</span>
                                  {unit.has_ac ? (
                                    <Snowflake className="h-2.5 w-2.5 text-ocean shrink-0" />
                                  ) : (
                                    <Fan className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                  <span>{unit.max_pax} pax</span>
                                  <span>₱{unit.nightly_rate.toLocaleString()}/night</span>
                                </div>
                              </td>
                              {ua?.dayStatus.map((ds) => (
                                <td key={ds.dateStr} className="text-center px-1 py-1.5">
                                  {ds.available ? (
                                    <span className="inline-block w-6 h-6 rounded-md bg-primary/20 text-primary text-[10px] font-bold leading-6">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="inline-block w-6 h-6 rounded-md bg-destructive/15 text-destructive/60 text-[10px] font-bold leading-6">
                                      ✕
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <BookingModal
          open={!!editingBooking}
          onOpenChange={(open) => { if (!open) setEditingBooking(null); }}
          booking={editingBooking}
        />

        <DaySummaryDialog
          open={showDaySummary}
          onOpenChange={setShowDaySummary}
          date={new Date()}
          bookings={allBookings}
          units={units}
          onBookingClick={(b) => { setShowDaySummary(false); setEditingBooking(b); }}
        />

        {/* 10AM Checkout Reminder Popup */}
        <AlertDialog open={showCheckoutReminder} onOpenChange={setShowCheckoutReminder}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-coral">
                <Clock className="h-5 w-5" />
                Checkout Reminder — Due by 10:00 AM
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    The following guests are due to check out by <span className="font-semibold text-foreground">10:00 AM</span> today. Please remind them to vacate their rooms on time.
                  </p>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {dueDepartures.map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <div>
                          <span className="text-sm font-medium text-foreground">{b.guest_name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{unitMap.get(b.unit_id ?? "") ?? "—"}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-coral/20 text-coral border-coral/30">Due out</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => {
                  setShowCheckoutReminder(false);
                  sessionStorage.setItem("checkout_reminder_dismissed_" + todayStr, "1");
                }}
              >
                Got it, will remind them
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Arrivals Summary Dialog */}
        <Dialog open={showArrivalsSummary} onOpenChange={setShowArrivalsSummary}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-lg">
                <LogIn className="h-5 w-5 text-primary" />
                Arrivals Summary
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <div className="text-lg font-bold text-foreground">{checkIns.length}</div>
                  <div className="text-[10px] text-muted-foreground">Total Arrivals</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <div className="text-lg font-bold text-foreground">{checkIns.reduce((s, b) => s + b.pax, 0)}</div>
                  <div className="text-[10px] text-muted-foreground">Total Pax</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <div className="text-lg font-bold text-foreground">₱{checkIns.reduce((s, b) => s + b.total_amount, 0).toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">Total Revenue</div>
                </div>
              </div>
              {arrivalsGrouped.map(({ area, bookings: areaBookings }) => (
                <div key={area}>
                  <div className="flex items-center gap-2 px-1 py-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">{area}</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground">{areaBookings.length} bookings · {areaBookings.reduce((s, b) => s + b.pax, 0)} pax</span>
                  </div>
                  <div className="space-y-1">
                    {areaBookings.map((b) => {
                      const gid = b.booking_group_id;
                      const groupUnits = gid ? groupUnitNamesMap.get(gid) : null;
                      const siblings = gid ? groupSiblingsMap.get(gid) : null;
                      const groupTotal = gid ? [b, ...(siblings ?? [])].reduce((s, x) => s + x.total_amount, 0) : b.total_amount;
                      return (
                        <div
                          key={b.id}
                          onClick={() => { setShowArrivalsSummary(false); setEditingBooking(b); }}
                          className={cn(
                            "flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs cursor-pointer hover:border-primary/30 transition-colors",
                            gid && "border-l-2 border-l-primary"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground truncate">{b.guest_name}</span>
                              {gid && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/30">
                                  <Link2 className="h-2 w-2 mr-0.5" />Group
                                </Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground text-[10px] flex items-center gap-1 flex-wrap">
                              <BedDouble className="h-2.5 w-2.5" />
                              {groupUnits && groupUnits.length > 1 ? groupUnits.join(" + ") : (unitMap.get(b.unit_id ?? "") ?? "—")}
                              <span className="mx-0.5">·</span>
                              {b.pax} pax
                              {gid && <span className="mx-0.5">· ₱{groupTotal.toLocaleString()}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Badge variant="outline" className={cn("text-[9px]", getPaymentBadgeClass(b.payment_status))}>{b.payment_status}</Badge>
                            <Badge variant="outline" className={cn("text-[9px]", getStatusBadgeClass(b.booking_status))}>{b.booking_status}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {checkIns.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No arrivals today</p>}
            </div>
          </DialogContent>
        </Dialog>

        {/* In-House Summary Dialog */}
        <Dialog open={showInHouseSummary} onOpenChange={setShowInHouseSummary}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-lg">
                <Home className="h-5 w-5 text-ocean" />
                In-House Summary
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <div className="text-lg font-bold text-foreground">{occupiedUnitCount}/{availableUnitCount}</div>
                  <div className="text-[10px] text-muted-foreground">Units Occupied</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <div className="text-lg font-bold text-foreground">{totalPaxInHouse}</div>
                  <div className="text-[10px] text-muted-foreground">Total Pax</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <div className="text-lg font-bold text-foreground">{dueDepartures.length}</div>
                  <div className="text-[10px] text-muted-foreground">Due Out Today</div>
                </div>
              </div>
              {inHouseGrouped.map(({ area, bookings: areaBookings }) => (
                <div key={area}>
                  <div className="flex items-center gap-2 px-1 py-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-ocean font-semibold">{area}</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground">{areaBookings.length} bookings · {areaBookings.reduce((s, b) => s + b.pax, 0)} pax</span>
                  </div>
                  <div className="space-y-1">
                    {areaBookings.map((b) => {
                      const gid = b.booking_group_id;
                      const groupUnits = gid ? groupUnitNamesMap.get(gid) : null;
                      const siblings = gid ? groupSiblingsMap.get(gid) : null;
                      const groupTotal = gid ? [b, ...(siblings ?? [])].reduce((s, x) => s + x.total_amount, 0) : b.total_amount;
                      return (
                        <div
                          key={b.id}
                          onClick={() => { setShowInHouseSummary(false); setEditingBooking(b); }}
                          className={cn(
                            "flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs cursor-pointer hover:border-primary/30 transition-colors",
                            gid && "border-l-2 border-l-primary"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground truncate">{b.guest_name}</span>
                              {gid && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/30">
                                  <Link2 className="h-2 w-2 mr-0.5" />Group
                                </Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground text-[10px] flex items-center gap-1 flex-wrap">
                              <BedDouble className="h-2.5 w-2.5" />
                              {groupUnits && groupUnits.length > 1 ? groupUnits.join(" + ") : (unitMap.get(b.unit_id ?? "") ?? "—")}
                              <span className="mx-0.5">·</span>
                              {b.pax} pax
                              <span className="mx-0.5">·</span>
                              {format(parseISO(b.check_in), "MMM d")} → {format(parseISO(b.check_out), "MMM d")}
                              {gid && <span className="mx-0.5">· ₱{groupTotal.toLocaleString()}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Badge variant="outline" className={cn("text-[9px]", getPaymentBadgeClass(b.payment_status))}>{b.payment_status}</Badge>
                            {!!b.unit_id && noLateCheckoutUnitIds.has(b.unit_id) && (
                              <Badge variant="outline" className="text-[9px] bg-warning-orange/20 text-warning-orange border-warning-orange/30">No late CO</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {inHouseDisplay.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No guests in-house</p>}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value, sub, alert, onClick }: {
  icon: any; label: string; value: string; sub?: string; alert?: boolean; onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        alert ? "border-destructive/50 bg-destructive/5" : "border-border bg-card",
        onClick && "cursor-pointer hover:bg-muted/30"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("h-3.5 w-3.5", alert ? "text-destructive" : "text-primary")} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-xl font-display text-foreground">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

interface SectionProps {
  icon: any; title: string; count: number; color: string; children: React.ReactNode;
  isDropTarget?: boolean; onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void; onDragLeave?: () => void;
  onClear?: () => void;
  extraBadge?: { label: string; color: string };
  onTitleClick?: () => void;
}

function Section({ icon: Icon, title, count, color, children, isDropTarget, onDrop, onDragOver, onDragLeave, onClear, extraBadge, onTitleClick }: SectionProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-colors",
        isDropTarget ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border"
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div
          className={cn("flex items-center gap-2", onTitleClick && "cursor-pointer hover:opacity-80 transition-opacity")}
          onClick={onTitleClick}
        >
          <Icon className={cn("h-4 w-4", color)} />
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">{count}</span>
          {extraBadge && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", extraBadge.color)}>{extraBadge.label}</span>
          )}
        </div>
        {onClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
            onClick={onClear}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>
      <div className="p-2 space-y-1.5 max-h-[400px] overflow-y-auto min-h-[60px]">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-6 text-xs text-muted-foreground">{text}</div>;
}
