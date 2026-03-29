import { useMemo } from "react";
import type { Booking } from "@/hooks/useBookings";

export interface ContinuedStayInfo {
  /** The unit name(s) this booking continues FROM (previous stay) */
  fromUnitId?: string;
  /** The unit name(s) this booking continues TO (next stay) */
  toUnitId?: string;
}

/**
 * Detects "continued stay" bookings — same guest checking into another room
 * on the same day they check out of a previous one (or vice versa).
 *
 * Returns a Set of booking IDs that are part of a continued stay chain.
 */
export function buildContinuedStaySet(bookings: Booking[]): Set<string> {
  const continuedIds = new Set<string>();

  const byGuest = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (b.booking_status === "Cancelled" || b.deleted_at) continue;
    const key = b.guest_id || b.guest_name.trim().toLowerCase();
    if (!byGuest.has(key)) byGuest.set(key, []);
    byGuest.get(key)!.push(b);
  }

  for (const [, guestBookings] of byGuest) {
    if (guestBookings.length < 2) continue;
    const sorted = [...guestBookings].sort((a, b) => a.check_in.localeCompare(b.check_in));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const aOut = sorted[i].check_out;
        const bIn = sorted[j].check_in;
        if (bIn === aOut) {
          continuedIds.add(sorted[i].id);
          continuedIds.add(sorted[j].id);
        }
      }
    }
  }

  return continuedIds;
}

/**
 * Builds a map of bookingId → ContinuedStayInfo with from/to unit references.
 */
export function buildContinuedStayMap(bookings: Booking[]): Map<string, ContinuedStayInfo> {
  const result = new Map<string, ContinuedStayInfo>();

  const byGuest = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (b.booking_status === "Cancelled" || b.deleted_at) continue;
    const key = b.guest_id || b.guest_name.trim().toLowerCase();
    if (!byGuest.has(key)) byGuest.set(key, []);
    byGuest.get(key)!.push(b);
  }

  for (const [, guestBookings] of byGuest) {
    if (guestBookings.length < 2) continue;
    const sorted = [...guestBookings].sort((a, b) => a.check_in.localeCompare(b.check_in));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].check_in === sorted[i].check_out) {
          // sorted[i] continues TO sorted[j]
          const infoI = result.get(sorted[i].id) || {};
          infoI.toUnitId = sorted[j].unit_id ?? undefined;
          result.set(sorted[i].id, infoI);

          // sorted[j] continues FROM sorted[i]
          const infoJ = result.get(sorted[j].id) || {};
          infoJ.fromUnitId = sorted[i].unit_id ?? undefined;
          result.set(sorted[j].id, infoJ);
        }
      }
    }
  }

  return result;
}

export function useContinuedStaySet(bookings: Booking[]): Set<string> {
  return useMemo(() => buildContinuedStaySet(bookings), [bookings]);
}

export function useContinuedStayMap(bookings: Booking[]): Map<string, ContinuedStayInfo> {
  return useMemo(() => buildContinuedStayMap(bookings), [bookings]);
}
