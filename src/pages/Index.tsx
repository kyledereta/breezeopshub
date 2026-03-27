import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";
import { BookingModal } from "@/components/BookingModal";
import { BookingDetailSheet } from "@/components/BookingDetailSheet";
import type { Booking } from "@/hooks/useBookings";

const Index = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [defaultUnitId, setDefaultUnitId] = useState<string>();
  const [defaultDate, setDefaultDate] = useState<Date>();

  const openNewBooking = (unitId?: string, date?: Date) => {
    setSelectedBooking(null);
    setDefaultUnitId(unitId);
    setDefaultDate(date);
    setModalOpen(true);
  };

  const openViewBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setSheetOpen(true);
  };

  const openEditBooking = (booking: Booking) => {
    setSheetOpen(false);
    setSelectedBooking(booking);
    setDefaultUnitId(undefined);
    setDefaultDate(undefined);
    setModalOpen(true);
  };

  return (
    <AppLayout onNewBooking={() => openNewBooking()}>
      <div className="h-[calc(100vh-3rem)]">
        <AvailabilityGrid
          onCellClick={(unitId, date) => openNewBooking(unitId, date)}
          onBookingClick={(booking) => openViewBooking(booking)}
        />
      </div>

      <BookingDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        booking={selectedBooking}
        onEdit={openEditBooking}
      />

      <BookingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        booking={selectedBooking}
        defaultUnitId={defaultUnitId}
        defaultDate={defaultDate}
      />
    </AppLayout>
  );
};

export default Index;
