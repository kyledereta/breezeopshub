import { useState, useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { useBookings, useDeletedBookings, type Booking } from "@/hooks/useBookings";
import { useUnits } from "@/hooks/useUnits";
import { BookingModal } from "@/components/BookingModal";
import { BookingDetailSheet } from "@/components/BookingDetailSheet";
import { GroupBookingEditor } from "@/components/GroupBookingEditor";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csvExport";
import { Constants } from "@/integrations/supabase/types";

function getPaymentBadgeClass(status: string) {
  switch (status) {
    case "Fully Paid": return "bg-[hsl(142,71%,45%)]/20 text-[hsl(142,71%,45%)] border-[hsl(142,71%,45%)]/30";
    case "Airbnb Paid": return "bg-airbnb-pink/20 text-airbnb-pink border-airbnb-pink/30";
    case "Partial DP": return "bg-[hsl(48,96%,53%)]/20 text-[hsl(48,96%,40%)] border-[hsl(48,96%,53%)]/30";
    case "Unpaid": return "bg-[hsl(0,100%,50%)]/20 text-[hsl(0,100%,50%)] border-[hsl(0,100%,50%)]/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "Confirmed": return "bg-primary/20 text-primary border-primary/30";
    case "Checked In": return "bg-ocean/20 text-ocean border-ocean/30";
    case "Checked Out": return "bg-muted text-muted-foreground border-border";
    case "Inquiry": return "bg-warning-orange/20 text-warning-orange border-warning-orange/30";
    case "Cancelled": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function BookingsPage() {
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth().toString());
  const [filterYear, setFilterYear] = useState(now.getFullYear().toString());

  const rangeStart = useMemo(() => {
    if (filterMonth === "all") return undefined;
    return format(startOfMonth(new Date(parseInt(filterYear), parseInt(filterMonth))), "yyyy-MM-dd");
  }, [filterMonth, filterYear]);

  const rangeEnd = useMemo(() => {
    if (filterMonth === "all") return undefined;
    return format(endOfMonth(new Date(parseInt(filterYear), parseInt(filterMonth))), "yyyy-MM-dd");
  }, [filterMonth, filterYear]);

  const { data: allBookings = [], isLoading: bookingsLoading } = useBookings(rangeStart, rangeEnd);
  const { data: deletedBookings = [] } = useDeletedBookings();
  const { data: units = [], isLoading: unitsLoading } = useUnits();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupEditorBookings, setGroupEditorBookings] = useState<Booking[]>([]);

  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  // Build a map of group IDs to all unit names for grouped bookings
  const groupUnitNames = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of allBookings) {
      const gid = (b as any).booking_group_id;
      if (!gid) continue;
      const name = unitMap.get(b.unit_id ?? "") ?? "";
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid)!.push(name);
    }
    return map;
  }, [allBookings, unitMap]);

  const filteredBookings = useMemo(() => {
    return allBookings
      .filter((b) => {
        // Hide secondary (non-primary) grouped bookings — they show under the primary
        if ((b as any).booking_group_id && (b as any).is_primary === false) return false;
        if (statusFilter !== "all" && b.booking_status !== statusFilter) return false;
        if (paymentFilter !== "all" && b.payment_status !== paymentFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          const unitName = unitMap.get(b.unit_id ?? "") ?? "";
          return (
            b.guest_name.toLowerCase().includes(q) ||
            b.booking_ref.toLowerCase().includes(q) ||
            unitName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.check_in.localeCompare(a.check_in));
  }, [allBookings, search, statusFilter, paymentFilter, unitMap]);

  const isLoading = bookingsLoading || unitsLoading;

  const openView = (booking: Booking) => {
    setSelectedBooking(booking);
    setSheetOpen(true);
  };

  const openEdit = (booking: Booking) => {
    setSheetOpen(false);
    setSelectedBooking(booking);
    setModalOpen(true);
  };

  const openNew = () => {
    setSelectedBooking(null);
    setModalOpen(true);
  };

  return (
    <AppLayout onNewBooking={openNew}>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0 gap-1">
          <h1 className="text-xl sm:text-3xl font-display text-foreground tracking-wide">All Bookings</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                const headers = ["Ref", "Guest", "Unit", "Check-in", "Check-out", "Pax", "Total", "Downpayment", "Payment", "Status", "Source"];
                const rows = filteredBookings.map((b) => [
                  b.booking_ref, b.guest_name, unitMap.get(b.unit_id ?? "") ?? "", b.check_in, b.check_out,
                  String(b.pax), String(b.total_amount), String(b.deposit_paid), b.payment_status, b.booking_status, b.booking_source,
                ]);
                downloadCsv("bookings.csv", headers, rows);
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Export
            </Button>
            <span className="text-xs sm:text-sm text-muted-foreground">{filteredBookings.length} bookings</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 border-b border-border shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search guest, ref, unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Month filter */}
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[130px] bg-background border-border">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Months</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {format(new Date(2024, i, 1), "MMMM")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Year filter */}
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[100px] bg-background border-border">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {Array.from({ length: 5 }, (_, i) => {
                  const year = now.getFullYear() - 1 + i;
                  return <SelectItem key={year} value={year.toString()}>{year}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-background border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Statuses</SelectItem>
                {Constants.public.Enums.booking_status.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[140px] bg-background border-border">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Payments</SelectItem>
                {Constants.public.Enums.payment_status.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-muted-foreground text-sm">Loading...</span>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-card border-b border-border hover:bg-card">
                      <TableHead className="text-xs text-muted-foreground font-medium">Ref</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Guest</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Unit</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Check-in</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Check-out</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium text-center">PAX</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Status</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Payment</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium text-right">Total</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
                      <TableRow
                        key={booking.id}
                        className="cursor-pointer hover:bg-muted/20 border-b border-border"
                        onClick={() => openView(booking)}
                      >
                        <TableCell className="text-xs text-muted-foreground font-mono">{booking.booking_ref}</TableCell>
                        <TableCell className="text-sm font-medium text-foreground">{booking.guest_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(booking as any).booking_group_id
                            ? (groupUnitNames.get((booking as any).booking_group_id) ?? []).join(" + ")
                            : unitMap.get(booking.unit_id ?? "") ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-foreground">{format(parseISO(booking.check_in), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-xs text-foreground">{format(parseISO(booking.check_out), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-xs text-foreground text-center">{booking.pax}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 whitespace-nowrap", getStatusBadgeClass(booking.booking_status))}>
                            {booking.booking_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 whitespace-nowrap", getPaymentBadgeClass(booking.payment_status))}>
                            {booking.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-foreground text-right font-medium">₱{booking.total_amount.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{booking.booking_source}</TableCell>
                      </TableRow>
                    ))}
                    {filteredBookings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-sm text-muted-foreground">
                          No bookings found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="sm:hidden divide-y divide-border">
                {filteredBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="px-4 py-3 active:bg-muted/20 cursor-pointer"
                    onClick={() => openView(booking)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground truncate mr-2">{booking.guest_name}</span>
                      <span className="text-xs text-foreground font-medium shrink-0">₱{booking.total_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-muted-foreground">
                        {(booking as any).booking_group_id
                          ? (groupUnitNames.get((booking as any).booking_group_id) ?? []).join(" + ")
                          : unitMap.get(booking.unit_id ?? "") ?? "—"}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">{booking.booking_ref}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        {format(parseISO(booking.check_in), "MMM d")} → {format(parseISO(booking.check_out), "MMM d")}
                        <span className="ml-1.5">· {booking.pax} pax</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0", getStatusBadgeClass(booking.booking_status))}>
                          {booking.booking_status}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0", getPaymentBadgeClass(booking.payment_status))}>
                          {booking.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredBookings.length === 0 && (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    No bookings found
                  </div>
                )}
              </div>

              {/* Deleted / Cancelled Section */}
              {deletedBookings.length > 0 && (
                <div className="border-t border-border">
                  <button
                    onClick={() => setShowDeleted(!showDeleted)}
                    className="w-full flex items-center gap-2 px-4 sm:px-6 py-3 text-left hover:bg-muted/20 transition-colors"
                  >
                    {showDeleted ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">
                      Deleted / Cancelled Bookings
                    </span>
                    <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive ml-1">
                      {deletedBookings.length}
                    </Badge>
                  </button>
                  {showDeleted && (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-destructive/5 border-b border-border hover:bg-destructive/5">
                          <TableHead className="text-xs text-muted-foreground font-medium">Ref</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium">Guest</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium">Unit</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium">Dates</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium text-right">Total</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium">Reason</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium">Deleted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deletedBookings.map((booking) => (
                          <TableRow
                            key={booking.id}
                            className="cursor-pointer hover:bg-destructive/5 border-b border-border opacity-70"
                            onClick={() => openView(booking)}
                          >
                            <TableCell className="text-xs text-muted-foreground font-mono">{booking.booking_ref}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{booking.guest_name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{unitMap.get(booking.unit_id ?? "") ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(parseISO(booking.check_in), "MMM d")} → {format(parseISO(booking.check_out), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground text-right">₱{booking.total_amount.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {booking.deletion_reason || "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {booking.deleted_at ? format(parseISO(booking.deleted_at), "MMM d, yyyy") : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <BookingDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        booking={selectedBooking}
        onEdit={openEdit}
        onEditGroup={(groupBookings) => {
          setSheetOpen(false);
          setGroupEditorBookings(groupBookings);
          setGroupEditorOpen(true);
        }}
      />

      <BookingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        booking={selectedBooking}
      />

      <GroupBookingEditor
        open={groupEditorOpen}
        onOpenChange={setGroupEditorOpen}
        groupBookings={groupEditorBookings}
      />
    </AppLayout>
  );
}
