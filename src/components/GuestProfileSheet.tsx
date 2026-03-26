import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useGuestBookings, type Guest } from "@/hooks/useGuests";
import { supabase } from "@/integrations/supabase/client";
import { CalendarCheck, Phone, Mail, MapPin, PawPrint, Star, IdCard } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  "New Guest": "bg-muted text-muted-foreground",
  "Returning": "bg-primary/20 text-primary",
  "Loyal 3+": "bg-accent text-accent-foreground",
  "VIP 5+": "bg-chart-1/20 text-chart-1",
};

const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface GuestProfileSheetProps {
  guest: Guest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuestProfileSheet({ guest, open, onOpenChange }: GuestProfileSheetProps) {
  const { data: bookings = [], isLoading } = useGuestBookings(guest?.id);

  if (!guest) return null;

  const totalSpent = bookings.reduce((s, b: any) => s + (b.total_amount ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="font-display text-xl text-foreground">{guest.guest_name}</SheetTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={`text-[10px] ${TIER_COLORS[guest.parang_dati_tier] || ""}`}>
              {guest.parang_dati_tier}
            </Badge>
            {guest.guest_segment && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {guest.guest_segment}
              </Badge>
            )}
            {guest.pets && (
              <PawPrint className="h-3.5 w-3.5 text-primary" />
            )}
          </div>
        </SheetHeader>

        {/* Contact Info */}
        <div className="space-y-2 mb-4">
          {guest.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> {guest.phone}
            </div>
          )}
          {guest.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {guest.email}
            </div>
          )}
          {guest.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {guest.location}
            </div>
          )}
          {guest.birthday_month && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5" /> Birthday: {MONTHS[guest.birthday_month]}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-lg font-display text-foreground">{guest.total_stays}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Stays</div>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-lg font-display text-foreground">{bookings.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bookings</div>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-lg font-display text-foreground">₱{totalSpent.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Spent</div>
          </div>
        </div>

        {guest.notes && (
          <div className="rounded-lg border border-border p-3 mb-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
            <div className="text-sm text-foreground">{guest.notes}</div>
          </div>
        )}

        <Separator className="my-4" />

        {/* Booking History */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Booking History</h3>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : bookings.length === 0 ? (
            <div className="text-sm text-muted-foreground">No bookings linked to this guest yet.</div>
          ) : (
            <div className="space-y-2">
              {bookings.map((b: any) => (
                <div key={b.id} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{b.booking_ref}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        b.booking_status === "Checked Out"
                          ? "text-primary"
                          : b.booking_status === "Cancelled"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {b.booking_status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarCheck className="h-3 w-3" />
                    {format(parseISO(b.check_in), "MMM d")} – {format(parseISO(b.check_out), "MMM d, yyyy")}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{(b as any).units?.name ?? "—"}</span>
                    <span className="text-foreground font-medium">₱{b.total_amount.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
