import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";

const Index = () => {
  const [newBookingOpen, setNewBookingOpen] = useState(false);

  return (
    <AppLayout onNewBooking={() => setNewBookingOpen(true)}>
      <div className="h-[calc(100vh-3rem)]">
        <AvailabilityGrid
          onCellClick={(unitId, date) => {
            console.log("New booking for unit", unitId, "on", date);
            setNewBookingOpen(true);
          }}
          onBookingClick={(booking) => {
            console.log("View booking", booking.id);
          }}
        />
      </div>
    </AppLayout>
  );
};

export default Index;