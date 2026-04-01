import type { Unit } from "@/hooks/useUnits";
import type { Booking } from "@/hooks/useBookings";

export type OccupancyStatus = "occupied" | "arriving" | "departing" | "available" | "maintenance";

export function getStatusColor(status: OccupancyStatus) {
  switch (status) {
    case "occupied": return "bg-red-500/80 border-red-600 text-white";
    case "arriving": return "bg-amber-400/80 border-amber-500 text-amber-950";
    case "departing": return "bg-blue-400/80 border-blue-500 text-white";
    case "available": return "bg-emerald-500/80 border-emerald-600 text-white";
    case "maintenance": return "bg-muted border-muted-foreground/30 text-muted-foreground";
  }
}

export function getStatusLabel(status: OccupancyStatus) {
  switch (status) {
    case "occupied": return "Occupied";
    case "arriving": return "Arriving";
    case "departing": return "Departing";
    case "available": return "Available";
    case "maintenance": return "Unavailable";
  }
}

export function computeUnitStatusMap(
  units: Unit[],
  bookings: Booking[],
  todayStr: string
): Record<string, { status: OccupancyStatus; booking?: Booking; guestName?: string }> {
  const map: Record<string, { status: OccupancyStatus; booking?: Booking; guestName?: string }> = {};
  const activeBookings = bookings.filter(
    (b) => !b.deleted_at && !["Cancelled", "Rescheduled"].includes(b.booking_status)
  );

  for (const unit of units) {
    if (unit.unit_status !== "Available") {
      map[unit.id] = { status: "maintenance" };
      continue;
    }

    const unitBookings = activeBookings.filter((b) => b.unit_id === unit.id);
    const checkedIn = unitBookings.find(
      (b) => b.booking_status === "Checked In" && b.check_in <= todayStr && b.check_out >= todayStr
    );
    if (checkedIn) {
      map[unit.id] = { status: "occupied", booking: checkedIn, guestName: checkedIn.guest_name };
      continue;
    }

    const arriving = unitBookings.find(
      (b) => b.check_in === todayStr && ["Confirmed", "Inquiry"].includes(b.booking_status)
    );
    if (arriving) {
      map[unit.id] = { status: "arriving", booking: arriving, guestName: arriving.guest_name };
      continue;
    }

    const departing = unitBookings.find(
      (b) => b.check_out === todayStr && b.booking_status === "Checked In"
    );
    if (departing) {
      map[unit.id] = { status: "departing", booking: departing, guestName: departing.guest_name };
      continue;
    }

    const confirmed = unitBookings.find(
      (b) => b.check_in <= todayStr && b.check_out > todayStr && b.booking_status === "Confirmed"
    );
    if (confirmed) {
      map[unit.id] = { status: "occupied", booking: confirmed, guestName: confirmed.guest_name };
      continue;
    }

    map[unit.id] = { status: "available" };
  }
  return map;
}
