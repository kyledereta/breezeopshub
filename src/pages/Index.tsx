import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";
import { BookingModal } from "@/components/BookingModal";
import { BookingDetailSheet } from "@/components/BookingDetailSheet";
import { UnitDetailSheet } from "@/components/UnitDetailSheet";
import { GroupBookingEditor } from "@/components/GroupBookingEditor";
import type { Booking } from "@/hooks/useBookings";
import type { Unit } from "@/hooks/useUnits";

const Index = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [defaultUnitId, setDefaultUnitId] = useState<string>();
  const [defaultDate, setDefaultDate] = useState<Date>();
  const [unitSheetOpen, setUnitSheetOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupEditorBookings, setGroupEditorBookings] = useState<Booking[]>([]);

  const openNewBooking = (unitId?: string, date?: Date) => {
    setSelectedBooking(null);
    setDefaultUnitId(unitId);
    setDefaultDate(date);
    setModalOpen(true);
  };

  const openViewBooking = (booking: Booking) => {
    setUnitSheetOpen(false);
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

  const openViewUnit = (unit: Unit) => {
    setSheetOpen(false);
    setSelectedUnit(unit);
    setUnitSheetOpen(true);
  };

  return (
    <AppLayout onNewBooking={() => openNewBooking()}>
      <div className="h-[calc(100vh-3rem)]">
        <AvailabilityGrid
          onCellClick={(unitId, date) => openNewBooking(unitId, date)}
          onBookingClick={(booking) => openViewBooking(booking)}
          onUnitClick={(unit) => openViewUnit(unit)}
        />
      </div>

      <BookingDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        booking={selectedBooking}
        onEdit={openEditBooking}
        onEditGroup={(groupBookings) => {
          setSheetOpen(false);
          setGroupEditorBookings(groupBookings);
          setGroupEditorOpen(true);
        }}
      />

      <UnitDetailSheet
        open={unitSheetOpen}
        onOpenChange={setUnitSheetOpen}
        unit={selectedUnit}
      />

      <BookingModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        booking={selectedBooking}
        defaultUnitId={defaultUnitId}
        defaultDate={defaultDate}
      />

      <GroupBookingEditor
        open={groupEditorOpen}
        onOpenChange={setGroupEditorOpen}
        groupBookings={groupEditorBookings}
      />
    </AppLayout>
  );
};

export default Index;
