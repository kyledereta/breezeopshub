import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useBookings } from "@/hooks/useBookings";
import { useGuests } from "@/hooks/useGuests";
import { useUnits } from "@/hooks/useUnits";
import { Search, Calendar, Users, BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GlobalSearchProps {
  onBookingSelect?: (bookingId: string) => void;
}

export function GlobalSearch({ onBookingSelect }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: bookings = [] } = useBookings();
  const { data: guests = [] } = useGuests();
  const { data: units = [] } = useUnits();

  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    units.forEach((u) => m.set(u.id, u.name));
    return m;
  }, [units]);

  // Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground border-border h-8 px-3"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="pointer-events-none ml-2 inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="sm:hidden h-8 w-8 text-muted-foreground"
      >
        <Search className="h-4 w-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search bookings, guests, units..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Bookings">
            {bookings.slice(0, 8).map((b) => (
              <CommandItem
                key={b.id}
                value={`${b.guest_name} ${b.booking_ref} ${unitMap.get(b.unit_id ?? "") ?? ""}`}
                onSelect={() => {
                  setOpen(false);
                  navigate("/bookings");
                }}
              >
                <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground">{b.guest_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{b.booking_ref}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(parseISO(b.check_in), "MMM d")} · {unitMap.get(b.unit_id ?? "") ?? ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Guests">
            {guests.slice(0, 8).map((g) => (
              <CommandItem
                key={g.id}
                value={`${g.guest_name} ${g.phone ?? ""} ${g.email ?? ""}`}
                onSelect={() => {
                  setOpen(false);
                  navigate("/guests");
                }}
              >
                <Users className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground">{g.guest_name}</span>
                  {g.phone && <span className="text-xs text-muted-foreground ml-2">{g.phone}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{g.parang_dati_tier}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Units">
            {units.map((u) => (
              <CommandItem
                key={u.id}
                value={`${u.name} ${u.area}`}
                onSelect={() => {
                  setOpen(false);
                  navigate("/availability");
                }}
              >
                <BedDouble className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">{u.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{u.area} · {u.max_pax} pax · ₱{u.nightly_rate.toLocaleString()}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
