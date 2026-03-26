import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { useBookings, type Booking } from "@/hooks/useBookings";
import { useUnits } from "@/hooks/useUnits";
import { BookingModal } from "@/components/BookingModal";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Constants } from "@/integrations/supabase/types";

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
    case "Checked Out": return "bg-muted text-muted-foreground border-border";
    case "Inquiry": return "bg-warning-orange/20 text-warning-orange border-warning-orange/30";
    case "Cancelled": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function BookingsPage() {
  const { data: allBookings = [], isLoading: bookingsLoading } = useBookings();
  const { data: units = [], isLoading: unitsLoading } = useUnits();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  const filteredBookings = useMemo(() => {
    return allBookings
      .filter((b) => {
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

  const openEdit = (booking: Booking) => {
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h1 className="text-3xl font-display text-foreground tracking-wide">All Bookings</h1>
          <span className="text-sm text-muted-foreground">{filteredBookings.length} bookings</span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search guest, ref, unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-background border-border">
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
            <SelectTrigger className="w-[150px] bg-background border-border">
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

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-muted-foreground text-sm">Loading...</span>
            </div>
          ) : (
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
                    onClick={() => openEdit(booking)}
                  >
                    <TableCell className="text-xs text-muted-foreground font-mono">{booking.booking_ref}</TableCell>
                    <TableCell className="text-sm font-medium text-foreground">{booking.guest_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{unitMap.get(booking.unit_id ?? "") ?? "—"}</TableCell>
                    <TableCell className="text-xs text-foreground">{format(parseISO(booking.check_in), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-xs text-foreground">{format(parseISO(booking.check_out), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-xs text-foreground text-center">{booking.pax}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getStatusBadgeClass(booking.booking_status))}>
                        {booking.booking_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getPaymentBadgeClass(booking.payment_status))}>
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
          )}
        </div>
      </div>

      <BookingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        booking={selectedBooking}
      />
    </AppLayout>
  );
}
