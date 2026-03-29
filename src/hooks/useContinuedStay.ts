import { useMemo } from "react";
import type { Booking } from "@/hooks/useBookings";

/**
 * Detects "continued stay" bookings — same guest checking into another room
 * on the same day they check out of a previous one (or vice versa).
 *
 * Returns a Set of booking IDs that are part of a continued stay chain.
 */
export function buildContinuedStaySet(bookings: Booking[]): Set<string> {
  const continuedIds = new Set<string>();

  // Index bookings by guest identifier (guest_id preferred, fallback to guest_name)
  const byGuest = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (b.booking_status === "Cancelled" || b.deleted_at) continue;
    const key = b.guest_id || b.guest_name.trim().toLowerCase();
    if (!byGuest.has(key)) byGuest.set(key, []);
    byGuest.get(key)!.push(b);
  }

  for (const [, guestBookings] of byGuest) {
    if (guestBookings.length < 2) continue;
    // Sort by check_in
    const sorted = [...guestBookings].sort((a, b) => a.check_in.localeCompare(b.check_in));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        // Check if booking j starts on the same day booking i ends (±1 day)
        const aOut = sorted[i].check_out;
        const bIn = sorted[j].check_in;
        if (bIn === aOut || bIn === sorted[i].check_out) {
          // Same-day transition: check_out of A === check_in of B
          continuedIds.add(sorted[i].id);
          continuedIds.add(sorted[j].id);
        }
      }
    }
  }

  return continuedIds;
}

export function useContinuedStaySet(bookings: Booking[]): Set<string> {
  return useMemo(() => buildContinuedStaySet(bookings), [bookings]);
}
