/**
 * Utility to extract unpaid extras from a booking's extras_paid_status JSON.
 */
export interface UnpaidExtra {
  name: string;
  amount: number;
}

export function getUnpaidExtras(booking: any): UnpaidExtra[] {
  const extras: UnpaidExtra[] = [];
  const paid: Record<string, boolean> = 
    booking.extras_paid_status && typeof booking.extras_paid_status === "object"
      ? (booking.extras_paid_status as Record<string, boolean>)
      : {};

  if (booking.utensil_rental && !paid.utensil_rental && booking.utensil_rental_fee > 0) {
    extras.push({ name: "Utensil Rental", amount: booking.utensil_rental_fee });
  }
  if (booking.karaoke && !paid.karaoke && booking.karaoke_fee > 0) {
    extras.push({ name: "Karaoke", amount: booking.karaoke_fee });
  }
  if (booking.kitchen_use && !paid.kitchen_use && booking.kitchen_use_fee > 0) {
    extras.push({ name: "Kitchen Use", amount: booking.kitchen_use_fee });
  }
  if (booking.water_jug && !paid.water_jug && booking.water_jug_fee > 0) {
    extras.push({ name: "Water Jug", amount: booking.water_jug_fee });
  }
  if (booking.towel_rent && !paid.towel_rent && booking.towel_rent_fee > 0) {
    extras.push({ name: "Towel Rent", amount: booking.towel_rent_fee });
  }
  if (booking.bonfire && !paid.bonfire && booking.bonfire_fee > 0) {
    extras.push({ name: "Bonfire", amount: booking.bonfire_fee });
  }
  if (booking.atv && !paid.atv && booking.atv_fee > 0) {
    extras.push({ name: "ATV Ride", amount: booking.atv_fee });
  }
  if (booking.banana_boat && !paid.banana_boat && booking.banana_boat_fee > 0) {
    extras.push({ name: "Banana Boat", amount: booking.banana_boat_fee });
  }
  if (booking.early_checkin && !paid.early_checkin && booking.early_checkin_fee > 0) {
    extras.push({ name: "Early Check-in", amount: booking.early_checkin_fee });
  }
  if (booking.pets && !paid.pet_fee && booking.pet_fee > 0) {
    extras.push({ name: "Pet Fee", amount: booking.pet_fee });
  }
  if (booking.daytour && !paid.daytour && booking.daytour_fee > 0) {
    extras.push({ name: "Daytour", amount: booking.daytour_fee });
  }
  if (!paid.other_extras && booking.other_extras_fee > 0) {
    extras.push({ name: booking.other_extras_note || "Other Extras", amount: booking.other_extras_fee });
  }
  if (booking.deposit_status === "Deducted" && !paid.deposit_deduction && booking.deposit_deducted_amount > 0) {
    extras.push({ name: booking.deposit_deducted_reason || "Damage/Deduction", amount: booking.deposit_deducted_amount });
  }

  return extras;
}

export function getUnpaidExtrasTotal(booking: any): number {
  return getUnpaidExtras(booking).reduce((sum, e) => sum + e.amount, 0);
}

export function hasUnpaidExtras(booking: any): boolean {
  return getUnpaidExtras(booking).length > 0;
}
