import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parse, differenceInCalendarDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useUnits, groupUnitsByArea } from "@/hooks/useUnits";
import { useCreateBooking, useUpdateBooking } from "@/hooks/useBookingMutations";
import type { Booking } from "@/hooks/useBookings";
import { Constants, type Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateGuestRef } from "@/lib/guestRef";
import { Upload, X, FileImage, PawPrint, AlertTriangle, Music, Plus, Car, Link2, Clock, ClipboardPaste, Loader2, Wand2, Bike, Ship, Flame, UtensilsCrossed, CookingPot, Droplets, Bath, Sun } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { logBookingChanges } from "@/hooks/useBookingAuditLog";

type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type BookingStatus = Database["public"]["Enums"]["booking_status"];
type BookingSource = Database["public"]["Enums"]["booking_source"];
type DepositStatus = Database["public"]["Enums"]["deposit_status"];

const BIRTH_MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const bookingSchema = z.object({
  guest_name: z.string().trim().min(1, "Guest name is required").max(100),
  unit_id: z.string().optional().or(z.literal("")),
  check_in: z.string().min(1, "Check-in date is required"),
  check_out: z.string().min(1, "Check-out date is required"),
  pax: z.coerce.number().min(0).max(50),
  total_amount: z.coerce.number().min(0),
  deposit_paid: z.coerce.number().min(0),
  deposit_deducted_amount: z.coerce.number().min(0),
  security_deposit: z.coerce.number().min(0),
  utensil_rental_fee: z.coerce.number().min(0),
  extra_pax_fee: z.coerce.number().min(0),
  discount_given: z.coerce.number().min(0),
  discount_type: z.string(),
  discount_reason: z.string().max(200).optional().or(z.literal("")),
  payment_status: z.string(),
  booking_status: z.string(),
  booking_source: z.string(),
  mode_of_payment: z.string().optional().or(z.literal("")),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  utensil_rental: z.boolean(),
  pets: z.boolean(),
  deposit_status: z.string(),
  deposit_deducted_reason: z.string().max(300).optional().or(z.literal("")),
  karaoke: z.boolean(),
  karaoke_fee: z.coerce.number().min(0),
  pet_fee: z.coerce.number().min(0),
  kitchen_use: z.boolean(),
  kitchen_use_fee: z.coerce.number().min(0),
  water_jug: z.boolean(),
  water_jug_qty: z.coerce.number().min(0),
  water_jug_fee: z.coerce.number().min(0),
  towel_rent: z.boolean(),
  towel_rent_qty: z.coerce.number().min(0),
  towel_rent_fee: z.coerce.number().min(0),
  bonfire: z.boolean(),
  bonfire_fee: z.coerce.number().min(0),
  atv: z.boolean(),
  atv_fee: z.coerce.number().min(0),
  banana_boat: z.boolean(),
  banana_boat_fee: z.coerce.number().min(0),
  early_checkin: z.boolean(),
  early_checkin_fee: z.coerce.number().min(0),
  daytour: z.boolean(),
  is_daytour_booking: z.boolean(),
  daytour_fee: z.coerce.number().min(0),
  other_extras_fee: z.coerce.number().min(0),
  other_extras_note: z.string().max(300).optional().or(z.literal("")),
  late_checkout: z.boolean(),
}).refine((data) => {
  if (data.is_daytour_booking) return true;
  return data.check_out > data.check_in;
}, {
  message: "Check-out must be after check-in",
  path: ["check_out"],
}).refine((data) => {
  if (data.is_daytour_booking) return true;
  return !!data.unit_id;
}, {
  message: "Select a unit",
  path: ["unit_id"],
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export interface SubmissionPrefill {
  guest_name: string;
  facebook_name?: string | null;
  phone?: string | null;
  email?: string | null;
  check_in: string;
  check_out: string;
  unit_id?: string | null;
  pax: number;
  has_pet?: boolean;
  payment_method?: string | null;
  promo_code?: string | null;
  birthday_month?: number | null;
  submissionId: string;
}

export interface GroupContext {
  booking_group_id: string;
  parentBookingId: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  email?: string;
  phone?: string;
  booking_source?: string;
}

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking?: Booking | null;
  defaultUnitId?: string;
  defaultDate?: Date;
  prefillSubmission?: SubmissionPrefill | null;
  onCreated?: (booking: { id: string; booking_ref: string }) => void;
  groupContext?: GroupContext | null;
}

export function BookingModal({
  open,
  onOpenChange,
  booking,
  defaultUnitId,
  defaultDate,
  prefillSubmission,
  onCreated,
  groupContext,
}: BookingModalProps) {
  const { data: units = [] } = useUnits();
  const groupedUnits = useMemo(() => groupUnitsByArea(units), [units]);
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const queryClient = useQueryClient();
  const isEditing = !!booking;
  const [idFiles, setIdFiles] = useState<File[]>([]);
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [showOverlapConfirm, setShowOverlapConfirm] = useState(false);
  const [pendingSubmitValues, setPendingSubmitValues] = useState<BookingFormValues | null>(null);
  // Duplicate guest detection for group booking prompt
  const [showGroupPrompt, setShowGroupPrompt] = useState(false);
  const [matchingGroupBooking, setMatchingGroupBooking] = useState<{ id: string; booking_group_id: string | null; unit_id: string | null; check_in: string; check_out: string; booking_ref: string } | null>(null);
  const [unitSearch, setUnitSearch] = useState("");
  const [unitPopoverOpen, setUnitPopoverOpen] = useState(false);
  const [guestSuggestions, setGuestSuggestions] = useState<{ id: string; guest_name: string; phone: string | null; email: string | null; pets: boolean; birthday_month: number | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const originalValuesRef = useRef<Record<string, any> | null>(null);
  // Multi-unit support
  const [additionalUnitIds, setAdditionalUnitIds] = useState<string[]>([]);
  const [addUnitPopoverOpen, setAddUnitPopoverOpen] = useState(false);
  const [addUnitSearch, setAddUnitSearch] = useState("");
  // Group sibling bookings (when editing a group booking)
  const [groupSiblings, setGroupSiblings] = useState<{ id: string; unit_id: string; is_primary: boolean; total_amount: number; deposit_paid: number; payment_status: string; extras_paid_status: Record<string, boolean>; booking_ref: string }[]>([]);
  // Pet additional fee
  const [additionalPet, setAdditionalPet] = useState(false);
  // Birthday month for guest verification
  const [birthMonthFilter, setBirthMonthFilter] = useState(0);
  // Car details
  const [hasCar, setHasCar] = useState(false);
  const [carDetails, setCarDetails] = useState<{ type: string; color: string; plate: string; parking?: string }[]>([]);
  // Extras paid status tracking
  const [extrasPaidStatus, setExtrasPaidStatus] = useState<Record<string, boolean>>({});
  // Payment restructure: DP mode, remaining mode, remaining paid toggle
  const [dpModeOfPayment, setDpModeOfPayment] = useState("");
  const [remainingModeOfPayment, setRemainingModeOfPayment] = useState("");
  const [remainingPaid, setRemainingPaid] = useState(false);
  // Track if user chose to join an existing group
  const [joinGroupTarget, setJoinGroupTarget] = useState<{ id: string; booking_group_id: string | null } | null>(null);
  // Units booked during the selected date range (for availability filtering)
  const [bookedUnitIds, setBookedUnitIds] = useState<Set<string>>(new Set());
  // Nested modal for adding a unit to an existing group
  const [showAddUnitToGroupModal, setShowAddUnitToGroupModal] = useState(false);
  // Quick Paste mode
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  const toggleExtraPaid = (key: string) => {
    setExtrasPaidStatus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Load existing ID files when editing
  useEffect(() => {
    if (!open) { setIdFiles([]); setExistingIds([]); setAdditionalUnitIds([]); setAdditionalPet(false); setBirthMonthFilter(0); setHasCar(false); setCarDetails([]); setExtrasPaidStatus({}); setGroupSiblings([]); setJoinGroupTarget(null); setMatchingGroupBooking(null); setShowGroupPrompt(false); setPasteMode(false); setPasteText(""); setIsParsing(false); return; }
    if (booking) {
      supabase.storage.from("guest-ids").list(booking.id).then(({ data }) => {
        if (data) setExistingIds(data.map((f) => `${booking.id}/${f.name}`));
      });
      // Load group siblings when editing a group booking
      if ((booking as any).booking_group_id) {
        supabase
          .from("bookings")
          .select("id, unit_id, is_primary, total_amount, deposit_paid, payment_status, extras_paid_status, booking_ref")
          .eq("booking_group_id", (booking as any).booking_group_id)
          .is("deleted_at", null)
          .then(({ data }) => {
            if (data) {
              setGroupSiblings(data.filter((b) => b.id !== booking.id).map((b) => ({
                id: b.id,
                unit_id: b.unit_id || "",
                is_primary: b.is_primary,
                total_amount: b.total_amount ?? 0,
                deposit_paid: b.deposit_paid ?? 0,
                payment_status: b.payment_status ?? "Unpaid",
                extras_paid_status: (b.extras_paid_status && typeof b.extras_paid_status === 'object' ? b.extras_paid_status : {}) as Record<string, boolean>,
                booking_ref: b.booking_ref ?? "",
              })));
            }
          });
      }
    }
  }, [open, booking]);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guest_name: "",
      unit_id: "",
      check_in: "",
      check_out: "",
      pax: 1,
      total_amount: 0,
      deposit_paid: 0,
      deposit_deducted_amount: 0,
      security_deposit: 0,
      utensil_rental_fee: 0,
      extra_pax_fee: 0,
      discount_given: 0,
      discount_type: "fixed",
      discount_reason: "",
      payment_status: "Unpaid",
      booking_status: "Inquiry",
      booking_source: "Facebook Direct",
      mode_of_payment: "",
      email: "",
      phone: "",
      notes: "",
      utensil_rental: false,
      pets: false,
      deposit_status: "Pending",
      deposit_deducted_reason: "",
      karaoke: false,
      karaoke_fee: 0,
      pet_fee: 0,
      kitchen_use: false,
      kitchen_use_fee: 0,
      water_jug: false,
      water_jug_qty: 0,
      water_jug_fee: 0,
      towel_rent: false,
      towel_rent_qty: 0,
      towel_rent_fee: 0,
      bonfire: false,
      bonfire_fee: 0,
      atv: false,
      atv_fee: 0,
      banana_boat: false,
      banana_boat_fee: 0,
      early_checkin: false,
      early_checkin_fee: 0,
      daytour: false,
      is_daytour_booking: false,
      daytour_fee: 0,
      other_extras_fee: 0,
      other_extras_note: "",
      late_checkout: false,
    },
  });

  const watchDepositStatus = form.watch("deposit_status");
  const watchUtensilRental = form.watch("utensil_rental");
  const watchUnitId = form.watch("unit_id");
  const watchCheckIn = form.watch("check_in");
  const watchCheckOut = form.watch("check_out");
  const watchPax = form.watch("pax");
  const watchDiscountType = form.watch("discount_type");
  const watchDiscountGiven = form.watch("discount_given");
  const watchDiscountReason = form.watch("discount_reason");
  const watchKaraoke = form.watch("karaoke");
  const watchPets = form.watch("pets");
  const watchKitchenUse = form.watch("kitchen_use");
  const watchWaterJug = form.watch("water_jug");
  const watchTowelRent = form.watch("towel_rent");
  const watchBonfire = form.watch("bonfire");
  const watchAtv = form.watch("atv");
  const watchBananaBoat = form.watch("banana_boat");
  const watchEarlyCheckin = form.watch("early_checkin");
  const watchDaytour = form.watch("daytour");
  const watchIsDaytourBooking = form.watch("is_daytour_booking");
  const watchDaytourFee = form.watch("daytour_fee");
  const watchOtherExtrasFee = form.watch("other_extras_fee");
  const watchDepositDeductedAmount = form.watch("deposit_deducted_amount");

  // Get combined max_pax across all selected units
  const combinedMaxPax = useMemo(() => {
    const allIds = [watchUnitId, ...additionalUnitIds, ...groupSiblings.map((s) => s.unit_id)].filter(Boolean);
    const selectedUnits = units.filter((u) => allIds.includes(u.id));
    return selectedUnits.reduce((sum, u) => sum + u.max_pax, 0);
  }, [units, watchUnitId, additionalUnitIds, groupSiblings]);

  const selectedUnit = useMemo(() => units.find((u) => u.id === watchUnitId), [units, watchUnitId]);
  const extraPax = combinedMaxPax > 0 ? Math.max(0, watchPax - combinedMaxPax) : 0;

  // Auto-set pax to unit's max_pax when unit is selected (new bookings only, not when adding to group)
  useEffect(() => {
    if (isEditing || groupContext) return;
    if (combinedMaxPax > 0) {
      form.setValue("pax", combinedMaxPax);
    }
  }, [combinedMaxPax, isEditing, form]);

  // Watch payment status (used by auto-sync effect below)
  const watchPaymentStatus = form.watch("payment_status");

  // Check for booking conflicts (all selected units)
  useEffect(() => {
    const allUnitIds = [watchUnitId, ...additionalUnitIds].filter(Boolean);
    if (allUnitIds.length === 0 || !watchCheckIn || !watchCheckOut) {
      setConflictWarning(null);
      return;
    }
    const checkConflict = async () => {
      let query = supabase
        .from("bookings")
        .select("id, guest_name, check_in, check_out, unit_id")
        .in("unit_id", allUnitIds)
        .not("booking_status", "eq", "Cancelled")
        .lt("check_in", watchCheckOut)
        .gt("check_out", watchCheckIn);

      if (booking) {
        query = query.neq("id", booking.id);
      }

      const { data } = await query;
      if (data && data.length > 0) {
        const conflicts = data.map((b) => {
          const unitName = units.find((u) => u.id === b.unit_id)?.name || "Unit";
          return `${unitName}: ${b.guest_name} (${b.check_in} → ${b.check_out})`;
        }).join("; ");
        setConflictWarning(`⚠️ Overlaps: ${conflicts}`);
      } else {
        setConflictWarning(null);
      }
    };
    checkConflict();
  }, [watchUnitId, additionalUnitIds, watchCheckIn, watchCheckOut, booking, units]);

  // Fetch units that are booked for the selected date range (for availability filtering)
  useEffect(() => {
    if (!watchCheckIn || !watchCheckOut) {
      setBookedUnitIds(new Set());
      return;
    }
    const fetchBooked = async () => {
      let query = supabase
        .from("bookings")
        .select("unit_id")
        .not("booking_status", "eq", "Cancelled")
        .is("deleted_at", null)
        .lt("check_in", watchCheckOut)
        .gt("check_out", watchCheckIn);
      if (booking) query = query.neq("id", booking.id);
      const { data } = await query;
      const ids = new Set((data || []).map(b => b.unit_id).filter(Boolean) as string[]);
      setBookedUnitIds(ids);
    };
    fetchBooked();
  }, [watchCheckIn, watchCheckOut, booking]);

  // Auto-set utensil rental fee to ₱500 when toggled on
  useEffect(() => {
    if (watchUtensilRental) {
      const currentFee = form.getValues("utensil_rental_fee");
      if (currentFee === 0) {
        form.setValue("utensil_rental_fee", 500);
      }
    }
  }, [watchUtensilRental, form]);

  // Auto-set security deposit default based on unit type (includes additional units)
  useEffect(() => {
    if (isEditing) return;
    const allIds = [watchUnitId, ...additionalUnitIds].filter(Boolean);
    const selectedUnits = units.filter((u) => allIds.includes(u.id));
    if (selectedUnits.length === 0) return;
    const hasVilla = selectedUnits.some((u) => u.name.toLowerCase().includes("villa"));
    form.setValue("security_deposit", hasVilla ? 1000 : 500);
  }, [watchUnitId, additionalUnitIds, isEditing, form, units]);

  // Auto-set karaoke fee when toggled
  useEffect(() => {
    if (watchKaraoke) {
      if (form.getValues("karaoke_fee") === 0) {
        form.setValue("karaoke_fee", 1500);
      }
    } else {
      form.setValue("karaoke_fee", 0);
    }
  }, [watchKaraoke, form]);

  // Auto-set kitchen use fee when toggled
  useEffect(() => {
    if (watchKitchenUse) {
      if (form.getValues("kitchen_use_fee") === 0) {
        form.setValue("kitchen_use_fee", 500);
      }
    } else {
      form.setValue("kitchen_use_fee", 0);
    }
  }, [watchKitchenUse, form]);

  // Auto-set water jug fee when toggled or qty changes
  const watchWaterJugQty = form.watch("water_jug_qty");
  useEffect(() => {
    if (watchWaterJug) {
      const qty = Number(watchWaterJugQty) || 0;
      if (qty === 0) {
        form.setValue("water_jug_qty", 1);
        form.setValue("water_jug_fee", 100);
      } else {
        form.setValue("water_jug_fee", qty * 100);
      }
    } else {
      form.setValue("water_jug_qty", 0);
      form.setValue("water_jug_fee", 0);
    }
  }, [watchWaterJug, watchWaterJugQty, form]);

  // Auto-set towel rent fee when toggled or qty changes
  const watchTowelRentQty = form.watch("towel_rent_qty");
  useEffect(() => {
    if (watchTowelRent) {
      const qty = Number(watchTowelRentQty) || 0;
      if (qty === 0) {
        form.setValue("towel_rent_qty", 1);
        form.setValue("towel_rent_fee", 100);
      } else {
        form.setValue("towel_rent_fee", qty * 100);
      }
    } else {
      form.setValue("towel_rent_qty", 0);
      form.setValue("towel_rent_fee", 0);
    }
  }, [watchTowelRent, watchTowelRentQty, form]);

  // Auto-set bonfire fee when toggled
  useEffect(() => {
    if (watchBonfire) {
      if (form.getValues("bonfire_fee") === 0) {
        form.setValue("bonfire_fee", 300);
      }
    } else {
      form.setValue("bonfire_fee", 0);
    }
  }, [watchBonfire, form]);

  // Auto-set ATV fee when toggled
  useEffect(() => {
    if (watchAtv) {
      if (form.getValues("atv_fee") === 0) {
        form.setValue("atv_fee", 600);
      }
    } else {
      form.setValue("atv_fee", 0);
    }
  }, [watchAtv, form]);

  // Auto-set banana boat fee when toggled
  useEffect(() => {
    if (watchBananaBoat) {
      if (form.getValues("banana_boat_fee") === 0) {
        form.setValue("banana_boat_fee", 150);
      }
    } else {
      form.setValue("banana_boat_fee", 0);
    }
  }, [watchBananaBoat, form]);

  // Auto-set early check-in fee when toggled
  useEffect(() => {
    if (watchEarlyCheckin) {
      if (form.getValues("early_checkin_fee") === 0) {
        form.setValue("early_checkin_fee", 500);
      }
    } else {
      form.setValue("early_checkin_fee", 0);
    }
  }, [watchEarlyCheckin, form]);

  // Reset daytour options when toggled off; auto-set dates when toggled on
  useEffect(() => {
    if (!watchDaytour) {
      form.setValue("daytour_fee", 0);
      form.setValue("is_daytour_booking", false);
    }
  }, [watchDaytour, form]);

  // When is_daytour_booking is toggled on, auto-set check-in to today and check-out to next day
  useEffect(() => {
    if (watchIsDaytourBooking) {
      const today = format(new Date(), "yyyy-MM-dd");
      const checkIn = form.getValues("check_in");
      if (!checkIn) {
        form.setValue("check_in", today);
      }
      const ciDate = checkIn ? parse(checkIn, "yyyy-MM-dd", new Date()) : new Date();
      const nextDay = format(new Date(ciDate.getTime() + 86400000), "yyyy-MM-dd");
      form.setValue("check_out", nextDay);
    }
  }, [watchIsDaytourBooking, form]);

  // Auto-set pet fee based on additional pet
  useEffect(() => {
    if (watchPets && additionalPet) {
      form.setValue("pet_fee", 300);
    } else {
      form.setValue("pet_fee", 0);
      if (!watchPets) setAdditionalPet(false);
    }
  }, [watchPets, additionalPet, form]);

  // Watch all fee fields for auto-total calculation
  const watchUtensilFee = form.watch("utensil_rental_fee");
  const watchKaraokeFee = form.watch("karaoke_fee");
  const watchKitchenFee = form.watch("kitchen_use_fee");
  const watchPetFee = form.watch("pet_fee");
  const watchExtraPaxFee = form.watch("extra_pax_fee");
  const watchWaterJugFee = form.watch("water_jug_fee");
  const watchTowelRentFee = form.watch("towel_rent_fee");
  const watchBonfireFee = form.watch("bonfire_fee");
  const watchAtvFee = form.watch("atv_fee");
  const watchBananaBoatFee = form.watch("banana_boat_fee");
  const watchEarlyCheckinFee = form.watch("early_checkin_fee");

  // Auto-calculate total amount based on nightly rate × nights + all extras - discount
  // Supports multi-unit: sums nightly rates across all selected units
  useEffect(() => {
    if (!watchCheckIn || !watchCheckOut) return;
    const allIds = [watchUnitId, ...additionalUnitIds].filter(Boolean);
    const selectedUnits = units.filter((u) => allIds.includes(u.id));
    if (selectedUnits.length === 0 && !watchIsDaytourBooking) return;
    try {
      const checkInDate = parse(watchCheckIn, "yyyy-MM-dd", new Date());
      const checkOutDate = parse(watchCheckOut, "yyyy-MM-dd", new Date());
      const nights = differenceInCalendarDays(checkOutDate, checkInDate);
      if (nights <= 0) return;

      const base = watchIsDaytourBooking ? 0 : selectedUnits.reduce((sum, u) => sum + u.nightly_rate * nights, 0);
      const extras =
        (watchUtensilRental ? Number(watchUtensilFee) || 0 : 0) +
        (watchKaraoke ? Number(watchKaraokeFee) || 0 : 0) +
        (watchKitchenUse ? Number(watchKitchenFee) || 0 : 0) +
        (watchPets ? Number(watchPetFee) || 0 : 0) +
        (Number(watchExtraPaxFee) || 0) +
        (watchWaterJug ? Number(watchWaterJugFee) || 0 : 0) +
        (watchTowelRent ? Number(watchTowelRentFee) || 0 : 0) +
        (watchBonfire ? Number(watchBonfireFee) || 0 : 0) +
        (watchAtv ? Number(watchAtvFee) || 0 : 0) +
        (watchBananaBoat ? Number(watchBananaBoatFee) || 0 : 0) +
        (watchEarlyCheckin ? Number(watchEarlyCheckinFee) || 0 : 0) +
        (watchDaytour ? Number(watchDaytourFee) || 0 : 0) +
        (Number(watchOtherExtrasFee) || 0);

      const discountAmount =
        watchDiscountType === "percentage"
          ? Math.round(((base + extras) * Number(watchDiscountGiven)) / 100)
          : Number(watchDiscountGiven) || 0;

      const total = Math.max(0, base + extras - discountAmount);
      form.setValue("total_amount", total);
      // Auto-sync deposit when Fully Paid
      if (form.getValues("payment_status") === "Fully Paid") {
        form.setValue("deposit_paid", total);
      }
    } catch {
      // Invalid dates, skip
    }
  }, [
    units, watchUnitId, additionalUnitIds,
    watchCheckIn, watchCheckOut,
    watchUtensilRental, watchUtensilFee,
    watchKaraoke, watchKaraokeFee,
    watchKitchenUse, watchKitchenFee,
    watchPets, watchPetFee,
    watchExtraPaxFee,
    watchWaterJug, watchWaterJugFee,
    watchTowelRent, watchTowelRentFee,
    watchBonfire, watchBonfireFee,
    watchAtv, watchAtvFee,
    watchBananaBoat, watchBananaBoatFee,
    watchEarlyCheckin, watchEarlyCheckinFee,
    watchDaytour, watchDaytourFee, watchOtherExtrasFee,
    watchIsDaytourBooking,
    watchDiscountType, watchDiscountGiven,
    form,
  ]);

  // Auto-sync payment_status based on deposit, extras paid, and remaining paid
  const watchTotalAmount = form.watch("total_amount");
  const watchDepositPaid = form.watch("deposit_paid");

  useEffect(() => {
    const total = Number(watchTotalAmount) || 0;
    const deposit = Number(watchDepositPaid) || 0;
    if (total <= 0) return;

    // Calculate paid extras
    let paidExtrasTotal = 0;
    if (watchUtensilRental && extrasPaidStatus.utensil_rental) paidExtrasTotal += Number(watchUtensilFee) || 0;
    if (watchKaraoke && extrasPaidStatus.karaoke) paidExtrasTotal += Number(watchKaraokeFee) || 0;
    if (watchKitchenUse && extrasPaidStatus.kitchen_use) paidExtrasTotal += Number(watchKitchenFee) || 0;
    if (watchWaterJug && extrasPaidStatus.water_jug) paidExtrasTotal += Number(watchWaterJugFee) || 0;
    if (watchTowelRent && extrasPaidStatus.towel_rent) paidExtrasTotal += Number(watchTowelRentFee) || 0;
    if (watchBonfire && extrasPaidStatus.bonfire) paidExtrasTotal += Number(watchBonfireFee) || 0;
    if (watchAtv && extrasPaidStatus.atv) paidExtrasTotal += Number(watchAtvFee) || 0;
    if (watchBananaBoat && extrasPaidStatus.banana_boat) paidExtrasTotal += Number(watchBananaBoatFee) || 0;
    if (watchEarlyCheckin && extrasPaidStatus.early_checkin) paidExtrasTotal += Number(watchEarlyCheckinFee) || 0;
    if (watchPets && additionalPet && extrasPaidStatus.pet_fee) paidExtrasTotal += Number(watchPetFee) || 0;
    if (watchDaytour && extrasPaidStatus.daytour) paidExtrasTotal += Number(watchDaytourFee) || 0;
    if (extrasPaidStatus.other_extras) paidExtrasTotal += Number(watchOtherExtrasFee) || 0;
    if (watchDepositStatus === "Deducted" && extrasPaidStatus.deposit_deduction) paidExtrasTotal += Number(watchDepositDeductedAmount) || 0;

    const remaining = total - deposit - paidExtrasTotal;
    const fullySettled = remaining <= 0 || remainingPaid;

   // Don't override Airbnb Paid or Refunded
    if (watchPaymentStatus === "Airbnb Paid" || watchPaymentStatus === "Refunded") return;



    let newStatus: string;
    if (fullySettled) {
      newStatus = "Fully Paid";
    } else if (deposit > 0 || paidExtrasTotal > 0) {
      newStatus = "Partial DP";
    } else {
      newStatus = "Unpaid";
    }

    if (newStatus !== watchPaymentStatus) {
      form.setValue("payment_status", newStatus);
    }
  }, [
    watchTotalAmount, watchDepositPaid, remainingPaid, extrasPaidStatus,
    watchUtensilRental, watchUtensilFee, watchKaraoke, watchKaraokeFee,
    watchKitchenUse, watchKitchenFee, watchWaterJug, watchWaterJugFee,
    watchTowelRent, watchTowelRentFee, watchBonfire, watchBonfireFee,
    watchAtv, watchAtvFee, watchBananaBoat, watchBananaBoatFee,
    watchEarlyCheckin, watchEarlyCheckinFee,
    watchPets, watchPetFee, additionalPet, watchDaytour, watchDaytourFee,
    watchOtherExtrasFee, watchPaymentStatus, watchDepositStatus, watchDepositDeductedAmount, form,
  ]);

  // Auto-set source to Airbnb and remaining paid when "Airbnb Paid" is selected
  useEffect(() => {
    if (watchPaymentStatus === "Airbnb Paid") {
      form.setValue("booking_source", "Airbnb");
      setRemainingPaid(true);
    }
  }, [watchPaymentStatus, form]);

  useEffect(() => {
    if (!open) return;

    if (booking) {
      const vals = {
        guest_name: booking.guest_name,
        unit_id: booking.unit_id ?? "",
        check_in: booking.check_in,
        check_out: booking.check_out,
        pax: booking.pax,
        total_amount: booking.total_amount,
        deposit_paid: booking.deposit_paid,
        deposit_deducted_amount: (booking as any).deposit_deducted_amount ?? 0,
        security_deposit: (booking as any).security_deposit ?? 0,
        utensil_rental_fee: (booking as any).utensil_rental_fee ?? 0,
        extra_pax_fee: (booking as any).extra_pax_fee ?? 0,
        discount_given: booking.discount_given ?? 0,
        discount_type: (booking as any).discount_type ?? "fixed",
        discount_reason: booking.discount_reason ?? "",
        payment_status: booking.payment_status,
        booking_status: booking.booking_status,
        booking_source: booking.booking_source,
        mode_of_payment: (booking as any).mode_of_payment ?? "",
        email: booking.email ?? "",
        phone: booking.phone ?? "",
        notes: booking.notes ?? "",
        utensil_rental: (booking as any).utensil_rental ?? false,
        pets: (booking as any).pets ?? false,
        deposit_status: (booking as any).deposit_status ?? "Pending",
        deposit_deducted_reason: (booking as any).deposit_deducted_reason ?? "",
        karaoke: (booking as any).karaoke ?? false,
        karaoke_fee: (booking as any).karaoke_fee ?? 0,
        pet_fee: (booking as any).pet_fee ?? 0,
        kitchen_use: (booking as any).kitchen_use ?? false,
        kitchen_use_fee: (booking as any).kitchen_use_fee ?? 0,
        water_jug: (booking as any).water_jug ?? false,
        water_jug_qty: (booking as any).water_jug_qty ?? 0,
        water_jug_fee: (booking as any).water_jug_fee ?? 0,
        towel_rent: (booking as any).towel_rent ?? false,
        towel_rent_qty: (booking as any).towel_rent_qty ?? 0,
        towel_rent_fee: (booking as any).towel_rent_fee ?? 0,
        bonfire: (booking as any).bonfire ?? false,
        bonfire_fee: (booking as any).bonfire_fee ?? 0,
        atv: (booking as any).atv ?? false,
        atv_fee: (booking as any).atv_fee ?? 0,
        banana_boat: (booking as any).banana_boat ?? false,
        banana_boat_fee: (booking as any).banana_boat_fee ?? 0,
        early_checkin: (booking as any).early_checkin ?? false,
        early_checkin_fee: (booking as any).early_checkin_fee ?? 0,
        daytour: (booking as any).daytour ?? false,
        is_daytour_booking: (booking as any).is_daytour_booking ?? false,
        daytour_fee: (booking as any).daytour_fee ?? 0,
        other_extras_fee: (booking as any).other_extras_fee ?? 0,
        other_extras_note: (booking as any).other_extras_note ?? "",
        late_checkout: (booking as any).late_checkout ?? false,
      };
      form.reset(vals);
      originalValuesRef.current = { ...vals };
      setAdditionalPet((booking as any).pet_fee > 0);
      const bookingCars = (booking as any).car_details;
      if (bookingCars && Array.isArray(bookingCars) && bookingCars.length > 0) {
        setHasCar(true);
        setCarDetails(bookingCars);
      } else {
        setHasCar((booking as any).has_car ?? false);
        setCarDetails([]);
      }
      setExtrasPaidStatus((booking as any).extras_paid_status && typeof (booking as any).extras_paid_status === 'object' ? (booking as any).extras_paid_status : {});
      setDpModeOfPayment((booking as any).dp_mode_of_payment ?? (booking as any).mode_of_payment ?? "");
      setRemainingModeOfPayment((booking as any).remaining_mode_of_payment ?? "");
      setRemainingPaid((booking as any).remaining_paid ?? false);
    } else {
      const pf = prefillSubmission;
      const gc = groupContext;
      const guestName = gc
        ? gc.guest_name
        : pf
        ? (pf.facebook_name ? `${pf.guest_name} (${pf.facebook_name})` : pf.guest_name)
        : "";
      originalValuesRef.current = null;
      form.reset({
        guest_name: guestName,
        unit_id: pf?.unit_id ?? defaultUnitId ?? "",
        check_in: gc?.check_in ?? pf?.check_in ?? (defaultDate ? format(defaultDate, "yyyy-MM-dd") : ""),
        check_out: gc?.check_out ?? pf?.check_out ?? "",
        pax: gc ? 0 : (pf?.pax ?? 1),
        total_amount: 0,
        deposit_paid: 0,
        deposit_deducted_amount: 0,
        security_deposit: 0,
        utensil_rental_fee: 0,
        extra_pax_fee: 0,
        discount_given: 0,
        discount_type: "fixed",
        discount_reason: "",
        payment_status: pf ? "Partial DP" : "Unpaid",
        booking_status: "Confirmed",
        booking_source: gc?.booking_source ?? "Facebook Direct",
        mode_of_payment: "",
        email: gc?.email ?? pf?.email ?? "",
        phone: gc?.phone ?? pf?.phone ?? "",
        notes: "",
        utensil_rental: false,
        pets: pf?.has_pet ?? false,
        deposit_status: "Pending",
        deposit_deducted_reason: "",
        karaoke: false,
        karaoke_fee: 0,
        pet_fee: 0,
        kitchen_use: false,
        kitchen_use_fee: 0,
        water_jug: false,
        water_jug_qty: 0,
        water_jug_fee: 0,
        towel_rent: false,
        towel_rent_qty: 0,
        towel_rent_fee: 0,
        bonfire: false,
        bonfire_fee: 0,
        atv: false,
        atv_fee: 0,
        banana_boat: false,
        banana_boat_fee: 0,
        early_checkin: false,
        early_checkin_fee: 0,
        daytour: false,
        is_daytour_booking: false,
        daytour_fee: 0,
        other_extras_fee: 0,
        other_extras_note: "",
        late_checkout: false,
      });
      setAdditionalUnitIds([]);
      setAdditionalPet(false);
      setBirthMonthFilter(gc ? 0 : (pf?.birthday_month ?? 0));
      setDpModeOfPayment(pf?.payment_method ?? "");
      setRemainingModeOfPayment("");
      setRemainingPaid(false);
    }
  }, [open, booking, defaultUnitId, defaultDate, prefillSubmission, groupContext, form]);

  async function handleFormSubmit(values: BookingFormValues) {
    // Check for overlap/unavailable units - show confirmation if needed
    const allUnitIds = [values.unit_id, ...additionalUnitIds].filter(Boolean);
    const unavailableUnits = units.filter((u) => allUnitIds.includes(u.id) && u.unit_status !== "Available");
    
    if (conflictWarning || unavailableUnits.length > 0) {
      setPendingSubmitValues(values);
      setShowOverlapConfirm(true);
      return;
    }

    // If groupContext is set, skip duplicate detection and auto-join the group
    if (groupContext) {
      const target = { id: groupContext.parentBookingId, booking_group_id: groupContext.booking_group_id };
      onSubmit(values, target);
      return;
    }

    // When creating (not editing), check if same guest name has an existing booking on overlapping dates
    if (!isEditing) {
      const guestName = values.guest_name.trim();
      if (guestName && values.check_in && values.check_out) {
        const { data: matchingBookings } = await supabase
          .from("bookings")
          .select("id, booking_group_id, unit_id, check_in, check_out, booking_ref, guest_name")
          .ilike("guest_name", guestName)
          .not("booking_status", "eq", "Cancelled")
          .is("deleted_at", null)
          .lt("check_in", values.check_out)
          .gt("check_out", values.check_in);

        if (matchingBookings && matchingBookings.length > 0) {
          const match = matchingBookings[0];
          // If match is part of a group, fetch ALL units in that group
          let allGroupUnits: string[] = [];
          if (match.booking_group_id) {
            const { data: groupBookings } = await supabase
              .from("bookings")
              .select("unit_id")
              .eq("booking_group_id", match.booking_group_id)
              .is("deleted_at", null);
            if (groupBookings) {
              allGroupUnits = groupBookings
                .map((gb) => gb.unit_id)
                .filter(Boolean)
                .map((uid) => units.find((u) => u.id === uid)?.name ?? "Unknown");
            }
          } else {
            const unitName = match.unit_id ? units.find((u) => u.id === match.unit_id)?.name : null;
            if (unitName) allGroupUnits = [unitName];
          }
          setMatchingGroupBooking({ ...match, _groupUnitNames: allGroupUnits } as any);
          setPendingSubmitValues(values);
          setShowGroupPrompt(true);
          return;
        }
      }
    }

    onSubmit(values);
  }

  async function onSubmit(values: BookingFormValues, overrideJoinTarget?: { id: string; booking_group_id: string | null } | null) {
    const effectiveJoinTarget = overrideJoinTarget !== undefined ? overrideJoinTarget : joinGroupTarget;
    try {
      const payload = {
        guest_name: values.guest_name,
        unit_id: values.unit_id || null,
        check_in: values.check_in,
        check_out: values.check_out,
        pax: values.pax,
        total_amount: values.total_amount,
        deposit_paid: values.deposit_paid,
        payment_status: values.payment_status as PaymentStatus,
        booking_status: values.booking_status as BookingStatus,
        booking_source: values.booking_source as BookingSource,
        mode_of_payment: dpModeOfPayment || null,
        dp_mode_of_payment: dpModeOfPayment || null,
        remaining_mode_of_payment: remainingModeOfPayment || null,
        remaining_paid: remainingPaid,
        email: values.email || null,
        phone: values.phone || null,
        notes: values.notes || null,
        utensil_rental: values.utensil_rental,
        utensil_rental_fee: values.utensil_rental ? values.utensil_rental_fee : 0,
        pets: values.pets,
        deposit_status: values.deposit_status as DepositStatus,
        deposit_deducted_amount: values.deposit_status === "Deducted" ? values.deposit_deducted_amount : 0,
        deposit_deducted_reason: values.deposit_status === "Deducted" ? (values.deposit_deducted_reason || null) : null,
        security_deposit: values.security_deposit,
        extra_pax_fee: values.extra_pax_fee,
        discount_given: values.discount_given,
        discount_type: values.discount_type,
        discount_reason: values.discount_reason || null,
        karaoke: values.karaoke,
        karaoke_fee: values.karaoke ? values.karaoke_fee : 0,
        pet_fee: values.pets ? values.pet_fee : 0,
        kitchen_use: values.kitchen_use,
        kitchen_use_fee: values.kitchen_use ? values.kitchen_use_fee : 0,
        water_jug: values.water_jug,
        water_jug_qty: values.water_jug ? values.water_jug_qty : 0,
        water_jug_fee: values.water_jug ? values.water_jug_fee : 0,
        towel_rent: values.towel_rent,
        towel_rent_qty: values.towel_rent ? values.towel_rent_qty : 0,
        towel_rent_fee: values.towel_rent ? values.towel_rent_fee : 0,
        bonfire: values.bonfire,
        bonfire_fee: values.bonfire ? values.bonfire_fee : 0,
        atv: values.atv,
        atv_fee: values.atv ? values.atv_fee : 0,
        banana_boat: values.banana_boat,
        banana_boat_fee: values.banana_boat ? values.banana_boat_fee : 0,
        early_checkin: values.early_checkin,
        early_checkin_fee: values.early_checkin ? values.early_checkin_fee : 0,
        daytour: values.daytour,
        is_daytour_booking: values.is_daytour_booking,
        daytour_fee: values.daytour ? values.daytour_fee : 0,
        other_extras_fee: values.other_extras_fee || 0,
        other_extras_note: values.other_extras_note || null,
        late_checkout: values.late_checkout,
        has_car: hasCar,
        car_details: hasCar && carDetails.length > 0 ? carDetails : [],
        extras_paid_status: extrasPaidStatus,
      };

      // Upload ID files if any
      let uploadedIds: string[] = [];
      if (idFiles.length > 0) {
        for (const file of idFiles) {
          const filePath = `${isEditing ? booking.id : "temp"}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("guest-ids")
            .upload(filePath, file);
          if (uploadError) throw uploadError;
          uploadedIds.push(filePath);
        }
      }

      // Auto-link guest: find existing or create new guest record
      let guestId: string | null = null;
      try {
        // Try to find by name (case-insensitive) + optional birthday month verification
        let guestQuery = supabase
          .from("guests")
          .select("id")
          .ilike("guest_name", values.guest_name.trim());
        
        if (birthMonthFilter > 0) {
          guestQuery = guestQuery.eq("birthday_month", birthMonthFilter);
        }

        const { data: existingGuests } = await guestQuery.limit(1);

        if (existingGuests && existingGuests.length > 0) {
          guestId = existingGuests[0].id;
        } else {
          // Fallback: try name-only match if birthday filter was used
          if (birthMonthFilter > 0) {
            const { data: nameOnly } = await supabase
              .from("guests")
              .select("id")
              .ilike("guest_name", values.guest_name.trim())
              .limit(1);
            if (nameOnly && nameOnly.length > 0) {
              guestId = nameOnly[0].id;
            }
          }
          
          if (!guestId) {
            // Create new guest
            const { data: newGuest } = await supabase
              .from("guests")
              .insert({
                guest_name: values.guest_name.trim(),
                guest_ref: generateGuestRef(),
                phone: values.phone || null,
                email: values.email || null,
                pets: values.pets,
                birthday_month: birthMonthFilter > 0 ? birthMonthFilter : null,
              })
              .select("id")
              .single();
            if (newGuest) guestId = newGuest.id;
          }
        }
      } catch {
        // Non-critical: continue without linking
      }

      const fullPayload = { ...payload, guest_id: guestId };

      if (isEditing) {
        await updateBooking.mutateAsync({ id: booking.id, ...fullPayload });
        // Sync only guest info, dates, and status to sibling bookings (NOT financial data)
        if ((booking as any).booking_group_id) {
          const syncPayload = {
            guest_name: fullPayload.guest_name,
            check_in: fullPayload.check_in,
            check_out: fullPayload.check_out,
            booking_status: fullPayload.booking_status,
            booking_source: fullPayload.booking_source,
            email: fullPayload.email,
            phone: fullPayload.phone,
            guest_id: fullPayload.guest_id,
          };
          await supabase
            .from("bookings")
            .update(syncPayload)
            .eq("booking_group_id", (booking as any).booking_group_id)
            .neq("id", booking.id);
        }

        // Add new units to the group during edit
        if (additionalUnitIds.length > 0) {
          const groupId = (booking as any).booking_group_id || crypto.randomUUID();
          // If this booking wasn't part of a group yet, update it to be the primary
          if (!(booking as any).booking_group_id) {
            await supabase
              .from("bookings")
              .update({ booking_group_id: groupId, is_primary: true } as any)
              .eq("id", booking.id);
          }
          const { unit_id, ...syncPayload } = fullPayload;
          for (const unitId of additionalUnitIds) {
            await createBooking.mutateAsync({
              ...syncPayload,
              unit_id: unitId,
              booking_group_id: groupId,
              is_primary: false,
              total_amount: 0,
              deposit_paid: 0,
              security_deposit: 0,
              discount_given: 0,
              extra_pax_fee: 0,
              utensil_rental_fee: 0,
              karaoke_fee: 0,
              pet_fee: 0,
              kitchen_use_fee: 0,
              water_jug_fee: 0,
              towel_rent_fee: 0,
               bonfire_fee: 0,
               atv_fee: 0,
               banana_boat_fee: 0,
               early_checkin_fee: 0,
               extension_fee: 0,
               daytour_fee: 0,
               other_extras_fee: 0,
             } as any);
           }
           toast.success(`${additionalUnitIds.length} unit(s) added to group`);
        }

        // Log audit trail
        if (originalValuesRef.current) {
          await logBookingChanges(booking.id, originalValuesRef.current, fullPayload);
          queryClient.invalidateQueries({ queryKey: ["booking_audit_log", booking.id] });
        }
        toast.success("Booking updated");
      } else {
        // Check if joining an existing group
        if (effectiveJoinTarget) {
          const groupId = effectiveJoinTarget.booking_group_id || crypto.randomUUID();
          // If the target booking wasn't in a group yet, update it to become primary in the group
          if (!effectiveJoinTarget.booking_group_id) {
            await supabase
              .from("bookings")
              .update({ booking_group_id: groupId, is_primary: true } as any)
              .eq("id", effectiveJoinTarget.id);
          }
          // Create new booking as secondary in the group — keeps its own total_amount
          const createdBooking = await createBooking.mutateAsync({
            ...fullPayload,
            unit_id: values.unit_id || null,
            booking_group_id: groupId,
            is_primary: false,
            deposit_paid: 0,
            security_deposit: 0,
            discount_given: 0,
          } as any);
          toast.success("Booking added to existing group");
          setJoinGroupTarget(null);
          if (prefillSubmission && createdBooking) {
            await supabase
              .from("form_submissions")
              .update({ status: "Approved", booking_id: createdBooking.id } as any)
              .eq("id", prefillSubmission.submissionId);
            queryClient.invalidateQueries({ queryKey: ["form_submissions"] });
            onCreated?.({ id: createdBooking.id, booking_ref: createdBooking.booking_ref });
          }
        } else {
          // Create one booking per selected unit (multi-unit support)
          const allUnitIds = [values.unit_id, ...additionalUnitIds];
          let createdBooking: any = null;
          if (allUnitIds.length > 1) {
            const groupId = crypto.randomUUID();
            // Primary booking (first unit) holds all payment/total info
            createdBooking = await createBooking.mutateAsync({
              ...fullPayload,
              unit_id: allUnitIds[0],
              booking_group_id: groupId,
              is_primary: true,
            } as any);
            // Secondary bookings share dates/guest but zero out financials
            for (const unitId of allUnitIds.slice(1)) {
              await createBooking.mutateAsync({
                ...fullPayload,
                unit_id: unitId,
                booking_group_id: groupId,
                is_primary: false,
                total_amount: 0,
                deposit_paid: 0,
                security_deposit: 0,
                discount_given: 0,
                extra_pax_fee: 0,
                utensil_rental_fee: 0,
                karaoke_fee: 0,
                pet_fee: 0,
                kitchen_use_fee: 0,
                water_jug_fee: 0,
                towel_rent_fee: 0,
                 bonfire_fee: 0,
                 atv_fee: 0,
                 banana_boat_fee: 0,
                 early_checkin_fee: 0,
                 extension_fee: 0,
                 daytour_fee: 0,
                 other_extras_fee: 0,
               } as any);
            }
          } else {
            createdBooking = await createBooking.mutateAsync(fullPayload);
          }
          toast.success(allUnitIds.length > 1 ? `${allUnitIds.length} units booked as one group` : "Booking created");

          // If created from a form submission, mark it as approved
          if (prefillSubmission && createdBooking) {
            await supabase
              .from("form_submissions")
              .update({ status: "Approved", booking_id: createdBooking.id } as any)
              .eq("id", prefillSubmission.submissionId);
            queryClient.invalidateQueries({ queryKey: ["form_submissions"] });
            onCreated?.({ id: createdBooking.id, booking_ref: createdBooking.booking_ref });
          }
        }
      }

      // Update guest total_stays and tier after checkout
      if (guestId && values.booking_status === "Checked Out") {
        try {
          const { count } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("guest_id", guestId)
            .eq("booking_status", "Checked Out");
          
          const stays = count ?? 0;
          const tier = stays >= 5 ? "VIP 5+" : stays >= 3 ? "Loyal 3+" : stays >= 2 ? "Returning" : "New Guest";
          
          await supabase
            .from("guests")
            .update({ total_stays: stays, parang_dati_tier: tier })
            .eq("id", guestId);
        } catch {
          // Non-critical
        }
      }

      queryClient.invalidateQueries({ queryKey: ["guests"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    }
  }

  const isPending = createBooking.isPending || updateBooking.isPending;

  // Quick Paste: parse text via edge function
  const handleParseText = async () => {
    if (!pasteText.trim()) {
      toast.error("Paste some text first");
      return;
    }
    setIsParsing(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("parse-booking-text", {
        body: {
          text: pasteText,
          units: units.map((u) => ({ id: u.id, name: u.name, max_pax: u.max_pax })),
        },
      });
      if (fnError) throw fnError;
      if (!fnData?.success || !fnData?.data) throw new Error("Failed to parse");

      const p = fnData.data;
      // Prefill form fields
      if (p.guest_name) form.setValue("guest_name", p.guest_name);
      if (p.phone) form.setValue("phone", p.phone);
      if (p.email) form.setValue("email", p.email);
      if (p.check_in) form.setValue("check_in", p.check_in);
      if (p.check_out) form.setValue("check_out", p.check_out);
      if (p.pax != null) form.setValue("pax", p.pax);
      if (p.unit_id) form.setValue("unit_id", p.unit_id);
      if (p.booking_source) form.setValue("booking_source", p.booking_source);
      if (p.booking_status) form.setValue("booking_status", p.booking_status);
      if (p.notes) form.setValue("notes", p.notes);
      if (p.pets) form.setValue("pets", true);
      if (p.has_car) setHasCar(true);
      if (p.deposit_paid != null && p.deposit_paid > 0) form.setValue("deposit_paid", p.deposit_paid);
      if (p.total_amount != null && p.total_amount > 0) form.setValue("total_amount", p.total_amount);
      if (p.payment_status) form.setValue("payment_status", p.payment_status);

      setPasteMode(false);
      toast.success("Booking details extracted! Review and save.");
    } catch (err: any) {
      console.error("Parse error:", err);
      toast.error("Could not parse text. Try editing manually.");
    } finally {
      setIsParsing(false);
    }
  };

  // Available units for additional selection (exclude already selected)
  const availableUnitsForAdd = useMemo(() => {
    const selectedIds = new Set([watchUnitId, ...additionalUnitIds, ...groupSiblings.map((s) => s.unit_id)]);
    return units.filter((u) => !selectedIds.has(u.id));
  }, [units, watchUnitId, additionalUnitIds, groupSiblings]);

  const filteredAddUnits = useMemo(() => {
    const groups = groupUnitsByArea(availableUnitsForAdd);
    return groups
      .map(({ area, units: areaUnits }) => ({
        area,
        units: areaUnits.filter((u) =>
          u.name.toLowerCase().includes(addUnitSearch.toLowerCase())
        ),
      }))
      .filter((g) => g.units.length > 0);
  }, [availableUnitsForAdd, addUnitSearch]);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-xl text-foreground">
              {isEditing ? "Edit Booking" : "New Booking"}
            </DialogTitle>
            {!isEditing && !groupContext && (
              <Button
                type="button"
                variant={pasteMode ? "default" : "outline"}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setPasteMode(!pasteMode)}
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                {pasteMode ? "Manual" : "Quick Paste"}
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Quick Paste Mode */}
        {pasteMode && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              Paste a message, chat conversation, or booking notes below. AI will extract the booking details automatically.
            </p>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"e.g.\nHi, I'd like to book Villa 1 for March 15-17.\n2 adults, 1 kid. My name is Juan Dela Cruz.\nContact: 0917-123-4567\nWill send DP of 2000 via GCash."}
              className="min-h-[150px] bg-background border-border text-sm"
              disabled={isParsing}
            />
            <Button
              type="button"
              className="w-full gap-2"
              onClick={handleParseText}
              disabled={isParsing || !pasteText.trim()}
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Extract Booking Details
                </>
              )}
            </Button>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            {/* Guest Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Guest Info
              </h3>
              <FormField
                control={form.control}
                name="guest_name"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="text-xs text-muted-foreground">Guest Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Full name"
                        className="bg-background border-border"
                        autoComplete="off"
                        onChange={async (e) => {
                          field.onChange(e);
                          const q = e.target.value.trim();
                          if (q.length >= 2) {
                            const { data } = await supabase
                              .from("guests")
                              .select("id, guest_name, phone, email, pets, birthday_month")
                              .ilike("guest_name", `%${q}%`)
                              .limit(5);
                            setGuestSuggestions(data || []);
                            setShowSuggestions(true);
                          } else {
                            setShowSuggestions(false);
                          }
                        }}
                        onFocus={() => { if (guestSuggestions.length > 0) setShowSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      />
                    </FormControl>
                    {showSuggestions && guestSuggestions.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg max-h-40 overflow-auto">
                        {guestSuggestions.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              form.setValue("guest_name", g.guest_name);
                              if (g.phone) form.setValue("phone", g.phone);
                              if (g.email) form.setValue("email", g.email);
                              form.setValue("pets", g.pets);
                              if (g.birthday_month) setBirthMonthFilter(g.birthday_month);
                              setShowSuggestions(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-foreground">{g.guest_name}</span>
                              {g.birthday_month ? (
                                <span className="text-[10px] text-primary">🎂 {BIRTH_MONTHS[g.birthday_month]}</span>
                              ) : null}
                            </div>
                            <span className="text-xs text-muted-foreground">{g.phone || g.email || ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="Optional" className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Optional" className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* Birthday Month - for guest verification */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Birthday Month (for guest verification)</label>
                <Select
                  value={String(birthMonthFilter)}
                  onValueChange={(v) => setBirthMonthFilter(Number(v))}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="0">— Not set</SelectItem>
                    {BIRTH_MONTHS.slice(1).map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Stay Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Stay Details
              </h3>

              {/* Daytour Booking Toggle */}
              <FormField
                control={form.control}
                name="is_daytour_booking"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue("daytour", true);
                          }
                        }}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 text-sm font-medium text-foreground cursor-pointer">
                      Daytour Booking
                    </FormLabel>
                    {field.value && (
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-primary font-semibold">
                        No overnight stay
                      </span>
                    )}
                  </FormItem>
                )}
              />

              {/* Check-in / Check-out / PAX — now ABOVE unit selection */}
              {!watchIsDaytourBooking && (
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="check_in"
                  render={({ field }) => {
                    const dateValue = field.value ? parse(field.value, "yyyy-MM-dd", new Date()) : undefined;
                    return (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Check-in</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal bg-background border-border",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(dateValue!, "MMM d, yyyy") : <span>Pick date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateValue}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="check_out"
                  render={({ field }) => {
                    const dateValue = field.value ? parse(field.value, "yyyy-MM-dd", new Date()) : undefined;
                    const checkInValue = form.getValues("check_in");
                    const minDate = checkInValue ? parse(checkInValue, "yyyy-MM-dd", new Date()) : undefined;
                    return (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Check-out</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal bg-background border-border",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(dateValue!, "MMM d, yyyy") : <span>Pick date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateValue}
                              onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                              disabled={(date) => minDate ? date <= minDate : false}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="pax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">PAX</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={1} max={50} className="bg-background border-border" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              )}

              {/* Daytour: date + PAX */}
              {watchIsDaytourBooking && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="check_in"
                    render={({ field }) => {
                      const dateValue = field.value ? parse(field.value, "yyyy-MM-dd", new Date()) : undefined;
                      return (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal bg-background border-border",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? format(dateValue!, "MMM d, yyyy") : <span>Pick date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateValue}
                                onSelect={(date) => {
                                  if (date) {
                                    field.onChange(format(date, "yyyy-MM-dd"));
                                    const nextDay = format(new Date(date.getTime() + 86400000), "yyyy-MM-dd");
                                    form.setValue("check_out", nextDay);
                                  }
                                }}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="pax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">PAX</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={1} max={50} className="bg-background border-border" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Unit Selection — filtered by availability for selected dates */}
              <FormField
                control={form.control}
                name="unit_id"
                render={({ field }) => {
                  const selectedUnitName = units.find((u) => u.id === field.value);
                  const filteredGroups = groupedUnits
                    .map(({ area, units: areaUnits }) => ({
                      area,
                      units: areaUnits.filter((u) =>
                        u.name.toLowerCase().includes(unitSearch.toLowerCase()) &&
                        (field.value === u.id || !bookedUnitIds.has(u.id))
                      ),
                    }))
                    .filter((g) => g.units.length > 0);

                  return (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        Unit
                        {watchCheckIn && watchCheckOut && bookedUnitIds.size > 0 && (
                          <span className="ml-1 text-primary font-normal">
                            (available only)
                          </span>
                        )}
                      </FormLabel>
                      <Popover open={unitPopoverOpen} onOpenChange={setUnitPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between bg-background border-border font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {selectedUnitName
                                ? `${selectedUnitName.name} · ${selectedUnitName.max_pax} PAX · ₱${selectedUnitName.nightly_rate.toLocaleString()}`
                                : "Select a unit"}
                              <CalendarIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <div className="p-2 border-b border-border">
                            <Input
                              placeholder="Search units..."
                              value={unitSearch}
                              onChange={(e) => setUnitSearch(e.target.value)}
                              className="h-8 bg-background border-border text-sm"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-60 overflow-auto p-1" onWheel={(e) => e.stopPropagation()}>
                            {filteredGroups.length === 0 && (
                              <p className="text-xs text-muted-foreground p-3 text-center">
                                {watchCheckIn && watchCheckOut ? "No available units for these dates" : "No units found"}
                              </p>
                            )}
                            {filteredGroups.map(({ area, units: areaUnits }) => (
                              <div key={area}>
                                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-primary font-semibold">
                                  {area}
                                </div>
                                {areaUnits.map((unit) => (
                                  <button
                                    key={unit.id}
                                    type="button"
                                    className={cn(
                                      "w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-muted/50 flex items-center justify-between",
                                      field.value === unit.id && "bg-primary/10 text-primary"
                                    )}
                                    onClick={() => {
                                      field.onChange(unit.id);
                                      setUnitPopoverOpen(false);
                                      setUnitSearch("");
                                    }}
                                  >
                                    <span>{unit.name}</span>
                                    <span className="text-xs text-muted-foreground">{unit.max_pax} PAX · ₱{unit.nightly_rate.toLocaleString()}</span>
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Group / Additional Units */}
              <div className="space-y-2">
                {isEditing && groupSiblings.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      Linked Units
                    </p>
                    {groupSiblings.map((sib) => {
                      const u = units.find((x) => x.id === sib.unit_id);
                      return (
                        <div
                          key={sib.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground">
                              {u?.name || "Unit"} · {u?.max_pax ?? "?"} PAX
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {sib.booking_ref} · ₱{sib.total_amount.toLocaleString()} · {sib.payment_status}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await supabase
                                  .from("bookings")
                                  .update({ deleted_at: new Date().toISOString(), deletion_reason: "Removed from group" })
                                  .eq("id", sib.id);
                                setGroupSiblings((prev) => prev.filter((s) => s.id !== sib.id));
                                queryClient.invalidateQueries({ queryKey: ["bookings"] });
                                toast.success(`${u?.name || "Unit"} removed from group`);
                              } catch {
                                toast.error("Failed to remove unit from group");
                              }
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {additionalUnitIds.length > 0 && (
                  <div className="space-y-1.5">
                    {additionalUnitIds.map((uid) => {
                      const u = units.find((x) => x.id === uid);
                      return (
                        <div
                          key={uid}
                          className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                        >
                          <span className="text-sm text-foreground">
                            {u?.name || "Unit"} · {u?.max_pax ?? "?"} PAX · ₱{u?.nightly_rate?.toLocaleString() ?? "0"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setAdditionalUnitIds((prev) => prev.filter((id) => id !== uid))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {isEditing && (booking as any)?.booking_group_id && availableUnitsForAdd.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs border-dashed border-border text-muted-foreground hover:text-primary"
                    onClick={() => setShowAddUnitToGroupModal(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add another unit
                  </Button>
                )}
                {(!isEditing || !(booking as any)?.booking_group_id) && availableUnitsForAdd.length > 0 && (
                  <Popover open={addUnitPopoverOpen} onOpenChange={setAddUnitPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs border-dashed border-border text-muted-foreground hover:text-primary"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add another unit
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start">
                      <div className="p-2 border-b border-border">
                        <Input
                          placeholder="Search units..."
                          value={addUnitSearch}
                          onChange={(e) => setAddUnitSearch(e.target.value)}
                          className="h-8 bg-background border-border text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-auto p-1" onWheel={(e) => e.stopPropagation()}>
                        {filteredAddUnits.length === 0 && (
                          <p className="text-xs text-muted-foreground p-3 text-center">No more units</p>
                        )}
                        {filteredAddUnits.map(({ area, units: areaUnits }) => (
                          <div key={area}>
                            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-primary font-semibold">
                              {area}
                            </div>
                            {areaUnits.map((unit) => (
                              <button
                                key={unit.id}
                                type="button"
                                className="w-full text-left px-3 py-1.5 text-sm rounded-sm hover:bg-muted/50 flex justify-between"
                                onClick={() => {
                                  setAdditionalUnitIds((prev) => [...prev, unit.id]);
                                  setAddUnitPopoverOpen(false);
                                  setAddUnitSearch("");
                                }}
                              >
                                <span>{unit.name}</span>
                                <span className="text-xs text-muted-foreground">₱{unit.nightly_rate.toLocaleString()}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {conflictWarning && (
                <div className="flex items-center gap-2 rounded-lg border border-warning-orange/50 bg-warning-orange/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-warning-orange shrink-0" />
                  <p className="text-xs text-warning-orange">{conflictWarning}</p>
                </div>
              )}

              {/* Late Check-out Approval */}
              {!watchIsDaytourBooking && (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-foreground">Late Check-out Approved</span>
                </div>
                <FormField
                  control={form.control}
                  name="late_checkout"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-0 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="scale-75"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              )}

              {/* Extra PAX fee */}
              {extraPax > 0 && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs text-primary font-medium">
                    +{extraPax} extra guest{extraPax > 1 ? "s" : ""} beyond {combinedMaxPax} combined max PAX
                  </p>
                  <FormField
                    control={form.control}
                    name="extra_pax_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Extra PAX Fee (₱)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={0} step="any" className="bg-background border-border" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <Separator className="bg-border" />

            {/* Extras */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Extras
              </h3>
              
              {/* Multi-select extras dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-xs h-9 bg-background border-border">
                    <span className="text-muted-foreground">
                      {[
                        watchUtensilRental && "Utensils",
                        watchKaraoke && "Karaoke",
                        watchKitchenUse && "Kitchen",
                        watchWaterJug && "Water Jug",
                        watchTowelRent && "Towel",
                        watchBonfire && "Bonfire",
                        watchAtv && "ATV",
                        watchBananaBoat && "Banana Boat",
                        watchEarlyCheckin && "Early Check-in",
                        watchDaytour && "Day Tour",
                        Number(watchOtherExtrasFee) > 0 && "Others",
                      ].filter(Boolean).join(", ") || "Select extras..."}
                    </span>
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 space-y-1" align="start">
                  {[
                    { key: "utensil_rental" as const, label: "Utensil Rental", desc: "₱500/set", icon: UtensilsCrossed },
                    { key: "karaoke" as const, label: "Karaoke", desc: "₱1,500", icon: Music },
                    { key: "kitchen_use" as const, label: "Kitchen Use", desc: "₱500", icon: CookingPot },
                    { key: "water_jug" as const, label: "Water Jug", desc: "₱100/jug", icon: Droplets },
                    { key: "towel_rent" as const, label: "Towel Rent", desc: "₱100/pc", icon: Bath },
                    { key: "bonfire" as const, label: "Bonfire Setup", desc: "₱300", icon: Flame },
                    { key: "atv" as const, label: "ATV Ride", desc: "₱600/30min", icon: Bike },
                    { key: "banana_boat" as const, label: "Banana Boat", desc: "₱150/head", icon: Ship },
                    { key: "early_checkin" as const, label: "Early Check-in", desc: "₱500", icon: Clock },
                    { key: "daytour" as const, label: "Day Tour", desc: "Manual fee", icon: Sun },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={form.watch(item.key)}
                        onCheckedChange={(v) => form.setValue(item.key, !!v)}
                      />
                      <div className="flex-1 flex items-center gap-1.5">
                        <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-foreground">{item.label}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">{item.desc}</span>
                      </div>
                    </label>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Selected extras: quantity / fee inputs */}
              <div className="space-y-2">
                {watchUtensilRental && (
                  <FormField
                    control={form.control}
                    name="utensil_rental_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Utensil Rental Fee (₱)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="number" min={0} step="any" className="bg-background border-border flex-1" />
                          </FormControl>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.utensil_rental ? "Paid" : "Unpaid"}</span>
                            <Switch checked={!!extrasPaidStatus.utensil_rental} onCheckedChange={() => toggleExtraPaid("utensil_rental")} className="scale-75" />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                {watchKaraoke && (
                  <FormField
                    control={form.control}
                    name="karaoke_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Karaoke Fee (₱)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="number" min={0} step="any" className="bg-background border-border flex-1" />
                          </FormControl>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.karaoke ? "Paid" : "Unpaid"}</span>
                            <Switch checked={!!extrasPaidStatus.karaoke} onCheckedChange={() => toggleExtraPaid("karaoke")} className="scale-75" />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                {watchKitchenUse && (
                  <FormField
                    control={form.control}
                    name="kitchen_use_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Kitchen Use Fee (₱)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="number" min={0} step="any" className="bg-background border-border flex-1" />
                          </FormControl>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.kitchen_use ? "Paid" : "Unpaid"}</span>
                            <Switch checked={!!extrasPaidStatus.kitchen_use} onCheckedChange={() => toggleExtraPaid("kitchen_use")} className="scale-75" />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                {watchWaterJug && (
                  <FormField
                    control={form.control}
                    name="water_jug_qty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Number of Water Jugs</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="number" min={1} step={1} className="bg-background border-border flex-1" />
                          </FormControl>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.water_jug ? "Paid" : "Unpaid"}</span>
                            <Switch checked={!!extrasPaidStatus.water_jug} onCheckedChange={() => toggleExtraPaid("water_jug")} className="scale-75" />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Total: ₱{((Number(field.value) || 0) * 100).toLocaleString()}</p>
                      </FormItem>
                    )}
                  />
                )}
                {watchTowelRent && (
                  <FormField
                    control={form.control}
                    name="towel_rent_qty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Number of Towels</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="number" min={1} step={1} className="bg-background border-border flex-1" />
                          </FormControl>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.towel_rent ? "Paid" : "Unpaid"}</span>
                            <Switch checked={!!extrasPaidStatus.towel_rent} onCheckedChange={() => toggleExtraPaid("towel_rent")} className="scale-75" />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Total: ₱{((Number(field.value) || 0) * 100).toLocaleString()}</p>
                      </FormItem>
                    )}
                  />
                )}
                {watchBonfire && (
                  <FormField
                    control={form.control}
                    name="bonfire_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Bonfire Setup Fee (₱)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="number" min={0} step="any" className="bg-background border-border flex-1" />
                          </FormControl>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.bonfire ? "Paid" : "Unpaid"}</span>
                            <Switch checked={!!extrasPaidStatus.bonfire} onCheckedChange={() => toggleExtraPaid("bonfire")} className="scale-75" />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                {watchAtv && (
                  <FormField
                    control={form.control}
                    name="atv_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">ATV Ride Fee (₱)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="number" min={0} step="any" className="bg-background border-border flex-1" />
                          </FormControl>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.atv ? "Paid" : "Unpaid"}</span>
                            <Switch checked={!!extrasPaidStatus.atv} onCheckedChange={() => toggleExtraPaid("atv")} className="scale-75" />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                {watchBananaBoat && (
                  <FormField
                    control={form.control}
                    name="banana_boat_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Banana Boat Fee (₱)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="number" min={0} step="any" className="bg-background border-border flex-1" />
                          </FormControl>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.banana_boat ? "Paid" : "Unpaid"}</span>
                            <Switch checked={!!extrasPaidStatus.banana_boat} onCheckedChange={() => toggleExtraPaid("banana_boat")} className="scale-75" />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                {watchEarlyCheckin && (
                  <FormField
                    control={form.control}
                    name="early_checkin_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Early Check-in Fee (₱)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="number" min={0} step="any" className="bg-background border-border flex-1" />
                          </FormControl>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.early_checkin ? "Paid" : "Unpaid"}</span>
                            <Switch checked={!!extrasPaidStatus.early_checkin} onCheckedChange={() => toggleExtraPaid("early_checkin")} className="scale-75" />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                {watchPets && additionalPet && (
                  <FormField
                    control={form.control}
                    name="pet_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Additional Pet Fee (₱)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="number" min={0} step="any" className="bg-background border-border flex-1" />
                          </FormControl>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.pet_fee ? "Paid" : "Unpaid"}</span>
                            <Switch checked={!!extrasPaidStatus.pet_fee} onCheckedChange={() => toggleExtraPaid("pet_fee")} className="scale-75" />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                {watchDaytour && (
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="daytour_fee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Day Tour Fee (₱)</FormLabel>
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input {...field} type="number" min={0} step="any" className="bg-background border-border flex-1" />
                            </FormControl>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.daytour ? "Paid" : "Unpaid"}</span>
                              <Switch checked={!!extrasPaidStatus.daytour} onCheckedChange={() => toggleExtraPaid("daytour")} className="scale-75" />
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={watchIsDaytourBooking}
                        onCheckedChange={(v) => form.setValue("is_daytour_booking", !!v)}
                      />
                      <span className="text-xs text-muted-foreground">Day Tour Only (no nightly rate, fees only)</span>
                    </div>
                  </div>
                )}
                {/* Other Extras */}
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="other_extras_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Other Extras Fee (₱)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input {...field} type="number" min={0} step="any" className="bg-background border-border flex-1" />
                          </FormControl>
                          {Number(watchOtherExtrasFee) > 0 && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.other_extras ? "Paid" : "Unpaid"}</span>
                              <Switch checked={!!extrasPaidStatus.other_extras} onCheckedChange={() => toggleExtraPaid("other_extras")} className="scale-75" />
                            </div>
                          )}
                        </div>
                      </FormItem>
                    )}
                  />
                  {Number(watchOtherExtrasFee) > 0 && (
                    <FormField
                      control={form.control}
                      name="other_extras_note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Other Extras Description</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Extra mattress, videoke extension..." className="bg-background border-border" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Pets toggle - kept as separate button */}
              <FormField
                control={form.control}
                name="pets"
                render={({ field }) => (
                  <FormItem className="space-y-0 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div>
                        <FormLabel className="text-xs text-foreground">With Pets</FormLabel>
                        <p className="text-[10px] text-muted-foreground">
                          <PawPrint className="h-3 w-3 inline" /> Pet included
                        </p>
                      </div>
                    </div>
                    {watchPets && (
                      <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
                        <Checkbox
                          checked={additionalPet}
                          onCheckedChange={(v) => setAdditionalPet(!!v)}
                        />
                        <span className="text-xs text-muted-foreground">Additional pet (+₱300)</span>
                      </div>
                    )}
                  </FormItem>
                )}
              />

            </div>

            <Separator className="bg-border" />

            {/* Booking & Payment */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Booking & Payment
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="booking_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border">
                          {Constants.public.Enums.booking_status.filter((s) => s !== "Inquiry").map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payment_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Payment</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border">
                          {Constants.public.Enums.payment_status.filter(s => s !== "Unpaid Extras").map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="booking_source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border">
                          {Constants.public.Enums.booking_source.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
              {/* Total Amount */}
              <FormField
                control={form.control}
                name="total_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Total Amount (₱)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={0} step="any" className="bg-background border-border" />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Downpayment Row */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="deposit_paid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Downpayment (₱)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={0} step="any" className="bg-background border-border" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">DP Mode of Payment</label>
                  <Select onValueChange={setDpModeOfPayment} value={dpModeOfPayment}>
                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Gcash">Gcash</SelectItem>
                      <SelectItem value="EastWest Bank">EastWest Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Remaining Balance Row */}
              {(() => {
                // Use auto-computed total_amount from the form (synced by the auto-calc effect)
                const totalAmt = Number(form.watch("total_amount")) || 0;
                const dpAmt = Number(form.watch("deposit_paid")) || 0;
                const remaining = totalAmt - dpAmt;
                if (remaining <= 0) return null;
                return (
                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Remaining Balance</span>
                      <span className="text-sm font-semibold text-destructive">₱{remaining.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Mode of Payment</label>
                        <Select onValueChange={setRemainingModeOfPayment} value={remainingModeOfPayment}>
                          <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent className="bg-popover border-border">
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Gcash">Gcash</SelectItem>
                            <SelectItem value="EastWest Bank">EastWest Bank</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={remainingPaid} onCheckedChange={setRemainingPaid} />
                        <span className={`text-xs font-medium ${remainingPaid ? "text-primary" : "text-destructive"}`}>
                          {remainingPaid ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Discount */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="discount_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Discount Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover border-border">
                            <SelectItem value="fixed">Fixed (₱)</SelectItem>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discount_given"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">
                          Discount {watchDiscountType === "percentage" ? "(%)" : "(₱)"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={0}
                            max={watchDiscountType === "percentage" ? 100 : undefined}
                            step={watchDiscountType === "percentage" ? 1 : 100}
                            className="bg-background border-border"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discount_reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Reason</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" className="bg-background border-border" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                {watchDiscountGiven > 0 && watchDiscountType === "percentage" && (
                  <p className="text-xs text-muted-foreground">
                    = ₱{Math.round((form.getValues("total_amount") * watchDiscountGiven) / 100).toLocaleString()} off
                  </p>
                )}
              </div>
              {/* Security Deposit */}
              <Separator className="bg-border/50" />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="deposit_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Security Deposit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Collected">Collected</SelectItem>
                          <SelectItem value="Returned">Returned</SelectItem>
                          <SelectItem value="Deducted">Deducted</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="security_deposit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Deposit Amount (₱)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={0} step="any" className="bg-background border-border" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              {watchDepositStatus === "Deducted" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="deposit_deducted_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Amount Deducted (₱)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min={0} step="any" className="bg-background border-border" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deposit_deducted_reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Deduction Reason</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Damaged linens..." className="bg-background border-border" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  {Number(form.watch("deposit_deducted_amount")) > 0 && (
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        Damage/Deduction Charge: ₱{Number(form.watch("deposit_deducted_amount")).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] text-muted-foreground">{extrasPaidStatus.deposit_deduction ? "Paid" : "Unpaid"}</span>
                        <Switch checked={!!extrasPaidStatus.deposit_deduction} onCheckedChange={() => toggleExtraPaid("deposit_deduction")} className="scale-75" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator className="bg-border" />

            {/* Guest ID Upload */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Guest ID
              </h3>
              {/* Existing files */}
              {existingIds.length > 0 && (
                <div className="space-y-1.5">
                  {existingIds.map((path) => (
                    <div key={path} className="flex items-center justify-between text-xs bg-background border border-border rounded-md px-3 py-2">
                      <div className="flex items-center gap-2 text-muted-foreground truncate">
                        <FileImage className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{path.split("/").pop()}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await supabase.storage.from("guest-ids").remove([path]);
                          setExistingIds((prev) => prev.filter((p) => p !== path));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {/* New files */}
              {idFiles.length > 0 && (
                <div className="space-y-1.5">
                  {idFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-background border border-border rounded-md px-3 py-2">
                      <div className="flex items-center gap-2 text-muted-foreground truncate">
                        <FileImage className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => setIdFiles((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-3 cursor-pointer hover:border-primary/50 transition-colors text-xs text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>Upload ID photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) setIdFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }}
                />
              </label>
            </div>

            {/* Car Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <Checkbox checked={hasCar} onCheckedChange={(v) => {
                  setHasCar(!!v);
                  if (v && carDetails.length === 0) {
                    setCarDetails([{ type: "", color: "", plate: "", parking: "" }]);
                  }
                  if (!v) setCarDetails([]);
                }} />
                <div>
                  <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5" /> With Car/s
                  </span>
                  <p className="text-[10px] text-muted-foreground">Guest arrived with vehicle</p>
                </div>
              </div>
              {hasCar && (
                <div className="space-y-2">
                  {carDetails.map((car, idx) => (
                    <div key={idx} className="rounded-md border border-border p-2.5 space-y-2 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Car {idx + 1}</span>
                        {carDetails.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            onClick={() => setCarDetails((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Type (e.g. SUV)"
                          value={car.type}
                          onChange={(e) => {
                            const updated = [...carDetails];
                            updated[idx] = { ...updated[idx], type: e.target.value };
                            setCarDetails(updated);
                          }}
                          className="h-8 text-xs bg-background border-border"
                        />
                        <Input
                          placeholder="Color"
                          value={car.color}
                          onChange={(e) => {
                            const updated = [...carDetails];
                            updated[idx] = { ...updated[idx], color: e.target.value };
                            setCarDetails(updated);
                          }}
                          className="h-8 text-xs bg-background border-border"
                        />
                        <Input
                          placeholder="Plate No."
                          value={car.plate}
                          onChange={(e) => {
                            const updated = [...carDetails];
                            updated[idx] = { ...updated[idx], plate: e.target.value };
                            setCarDetails(updated);
                          }}
                          className="h-8 text-xs bg-background border-border"
                        />
                      </div>
                      <Select
                        value={car.parking || ""}
                        onValueChange={(val) => {
                          const updated = [...carDetails];
                          updated[idx] = { ...updated[idx], parking: val };
                          setCarDetails(updated);
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background border-border">
                          <SelectValue placeholder="Parking location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Beach Villas Front">Beach Villas Front</SelectItem>
                          <SelectItem value="Pool Villas Front">Pool Villas Front</SelectItem>
                          <SelectItem value="Main Parking">Main Parking</SelectItem>
                          <SelectItem value="Owner's Villa Parking">Owner's Villa Parking</SelectItem>
                          <SelectItem value="Front Desk Parking">Front Desk Parking</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs w-full"
                    onClick={() => setCarDetails((prev) => [...prev, { type: "", color: "", plate: "", parking: "" }])}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Another Car
                  </Button>
                </div>
              )}
            </div>

            <Separator className="bg-border" />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Special requests, reminders..."
                      className="bg-background border-border resize-none h-20"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Computation Summary */}
            {(() => {
              const allIds = [watchUnitId, ...additionalUnitIds].filter(Boolean);
              const selectedUnits = units.filter((u) => allIds.includes(u.id));
              if (selectedUnits.length === 0 || !watchCheckIn || !watchCheckOut) return null;
              try {
                const checkInDate = parse(watchCheckIn, "yyyy-MM-dd", new Date());
                const checkOutDate = parse(watchCheckOut, "yyyy-MM-dd", new Date());
                const nights = differenceInCalendarDays(checkOutDate, checkInDate);
                if (nights <= 0) return null;

                const unitBreakdowns = watchIsDaytourBooking ? [] : selectedUnits.map((u) => ({
                  name: u.name,
                  subtotal: u.nightly_rate * nights,
                  rate: u.nightly_rate,
                }));
                const base = unitBreakdowns.reduce((s, b) => s + b.subtotal, 0);
                const extras =
                  (watchUtensilRental ? Number(watchUtensilFee) || 0 : 0) +
                  (watchKaraoke ? Number(watchKaraokeFee) || 0 : 0) +
                  (watchKitchenUse ? Number(watchKitchenFee) || 0 : 0) +
                  (watchPets ? Number(watchPetFee) || 0 : 0) +
                  (Number(watchExtraPaxFee) || 0) +
                  (watchWaterJug ? Number(watchWaterJugFee) || 0 : 0) +
                  (watchTowelRent ? Number(watchTowelRentFee) || 0 : 0) +
                  (watchBonfire ? Number(watchBonfireFee) || 0 : 0) +
                  (watchAtv ? Number(watchAtvFee) || 0 : 0) +
                  (watchBananaBoat ? Number(watchBananaBoatFee) || 0 : 0) +
                  (watchDaytour ? Number(watchDaytourFee) || 0 : 0) +
                  (Number(watchOtherExtrasFee) || 0);
                const discountAmount =
                  watchDiscountType === "percentage"
                    ? Math.round(((base + extras) * Number(watchDiscountGiven)) / 100)
                    : Number(watchDiscountGiven) || 0;
                const total = Math.max(0, base + extras - discountAmount);

                // Compute all values upfront
                const depositPaid = Number(form.watch("deposit_paid")) || 0;

                // Build extras list with paid status
                const extrasList: { name: string; amount: number; paid: boolean }[] = [];
                if (watchUtensilRental && Number(watchUtensilFee) > 0) extrasList.push({ name: "Utensil Rental", amount: Number(watchUtensilFee), paid: !!extrasPaidStatus.utensil_rental });
                if (watchKaraoke && Number(watchKaraokeFee) > 0) extrasList.push({ name: "Karaoke", amount: Number(watchKaraokeFee), paid: !!extrasPaidStatus.karaoke });
                if (watchKitchenUse && Number(watchKitchenFee) > 0) extrasList.push({ name: "Kitchen Use", amount: Number(watchKitchenFee), paid: !!extrasPaidStatus.kitchen_use });
                if (watchPets && Number(watchPetFee) > 0) extrasList.push({ name: "Additional Pet", amount: Number(watchPetFee), paid: !!extrasPaidStatus.pet_fee });
                if (Number(watchExtraPaxFee) > 0) extrasList.push({ name: "Extra PAX Fee", amount: Number(watchExtraPaxFee), paid: false });
                if (watchWaterJug && Number(watchWaterJugFee) > 0) extrasList.push({ name: `Water Jug (×${Number(form.watch("water_jug_qty")) || 0})`, amount: Number(watchWaterJugFee), paid: !!extrasPaidStatus.water_jug });
                if (watchTowelRent && Number(watchTowelRentFee) > 0) extrasList.push({ name: `Towel Rent (×${Number(form.watch("towel_rent_qty")) || 0})`, amount: Number(watchTowelRentFee), paid: !!extrasPaidStatus.towel_rent });
                if (watchBonfire && Number(watchBonfireFee) > 0) extrasList.push({ name: "Bonfire Setup", amount: Number(watchBonfireFee), paid: !!extrasPaidStatus.bonfire });
                if (watchEarlyCheckin && Number(watchEarlyCheckinFee) > 0) extrasList.push({ name: "Early Check-in", amount: Number(watchEarlyCheckinFee), paid: !!extrasPaidStatus.early_checkin });
                if (Number(watchDaytourFee) > 0) extrasList.push({ name: "Daytour Fee", amount: Number(watchDaytourFee), paid: !!extrasPaidStatus.daytour });
                if (Number(watchOtherExtrasFee) > 0) extrasList.push({ name: form.watch("other_extras_note") || "Other Extras", amount: Number(watchOtherExtrasFee), paid: !!extrasPaidStatus.other_extras });
                if (watchDepositStatus === "Deducted" && Number(watchDepositDeductedAmount) > 0) extrasList.push({ name: form.watch("deposit_deducted_reason") || "Damage/Deduction", amount: Number(watchDepositDeductedAmount), paid: !!extrasPaidStatus.deposit_deduction });

                const paidExtrasTotal = extrasList.filter(e => e.paid).reduce((s, e) => s + e.amount, 0);
                const unpaidExtras = extrasList.filter(e => !e.paid);
                const remaining = Math.max(0, total - depositPaid - paidExtrasTotal);
                const effectiveRemaining = remainingPaid ? 0 : remaining;

                return (
                  <div key={JSON.stringify(extrasPaidStatus) + String(remainingPaid)} className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Computation Summary
                      {watchIsDaytourBooking && <span className="ml-2 bg-ocean text-white text-[8px] px-1.5 py-0.5 rounded font-bold">DAY TOUR</span>}
                    </h3>

                    {/* 1. Accommodation */}
                    {unitBreakdowns.map((ub) => (
                      <div key={ub.name} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{ub.name} (₱{ub.rate.toLocaleString()} × {nights}n)</span>
                        <span className="text-foreground">₱{ub.subtotal.toLocaleString()}</span>
                      </div>
                    ))}

                    {/* 2. Downpayment */}
                    {depositPaid > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Downpayment</span>
                        <span className="text-foreground">-₱{depositPaid.toLocaleString()}</span>
                      </div>
                    )}

                    {/* 3. Extras Breakdown */}
                    {extrasList.length > 0 && (
                      <>
                        <Separator className="bg-primary/20" />
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Extras ({extrasList.length})
                        </div>
                        {extrasList.map((e) => (
                          <div key={e.name} className="flex justify-between text-xs">
                            <span className={e.paid ? "text-primary" : "text-muted-foreground"}>
                              {e.paid ? "✓ " : "• "}{e.name}
                            </span>
                            <span className={e.paid ? "text-primary" : "text-foreground"}>
                              ₱{e.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {paidExtrasTotal > 0 && (
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-primary">Extras Paid</span>
                            <span className="text-primary">-₱{paidExtrasTotal.toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}

                    {discountAmount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Discount{watchDiscountReason ? ` — ${watchDiscountReason}` : ""}
                        </span>
                        <span className="text-destructive">-₱{discountAmount.toLocaleString()}</span>
                      </div>
                    )}

                    {/* Total */}
                    <Separator className="bg-primary/20" />
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-primary">Total</span>
                      <span className="text-primary">₱{total.toLocaleString()}</span>
                    </div>

                    {/* 4. Remaining */}
                    {remaining > 0 && (
                      <>
                        {remainingPaid ? (
                          <div className="flex justify-between text-xs">
                            <span className="text-primary">Remaining Paid ✓</span>
                            <span className="text-primary">-₱{remaining.toLocaleString()}</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between text-sm font-semibold">
                              <span className="text-destructive">Remaining</span>
                              <span className="text-destructive">₱{remaining.toLocaleString()}</span>
                            </div>
                            {unpaidExtras.length > 0 && (
                              <div className="text-[10px] text-warning-orange mt-0.5">
                                Pending: {unpaidExtras.map(e => e.name).join(", ")}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* 5. Fully Settled */}
                    <Separator className="bg-primary/20" />
                    <div className="flex justify-between text-sm font-bold">
                      <span className={effectiveRemaining > 0 ? "text-destructive" : "text-primary"}>
                        {effectiveRemaining > 0 ? "Balance Due" : "Fully Settled ✓"}
                      </span>
                      <span className={effectiveRemaining > 0 ? "text-destructive" : "text-primary"}>
                        ₱{effectiveRemaining.toLocaleString()}
                      </span>
                    </div>

                    {/* 6. Group Summary — consolidated within computation summary */}
                    {isEditing && groupSiblings.length > 0 && (() => {
                      const groupEntries = [
                        {
                          unitName: selectedUnit?.name || "This Unit",
                          total: total,
                          deposit: depositPaid,
                          paymentStatus: form.watch("payment_status"),
                          isCurrent: true,
                        },
                        ...groupSiblings.map((sib) => {
                          const u = units.find((x) => x.id === sib.unit_id);
                          const sibNights = differenceInCalendarDays(
                            parse(sib.check_out, "yyyy-MM-dd", new Date()),
                            parse(sib.check_in, "yyyy-MM-dd", new Date())
                          );
                          const sibBase = sib.is_daytour_booking ? 0 : (u?.nightly_rate || 0) * sibNights;
                          const sibExtras =
                            (sib.utensil_rental ? sib.utensil_rental_fee : 0) +
                            (sib.karaoke ? sib.karaoke_fee : 0) +
                            (sib.kitchen_use ? sib.kitchen_use_fee : 0) +
                            (sib.pets ? sib.pet_fee : 0) +
                            (sib.extra_pax_fee || 0) +
                            (sib.water_jug ? sib.water_jug_fee : 0) +
                            (sib.towel_rent ? sib.towel_rent_fee : 0) +
                            (sib.bonfire ? sib.bonfire_fee : 0) +
                            (sib.atv ? sib.atv_fee : 0) +
                            (sib.banana_boat ? sib.banana_boat_fee : 0) +
                            (sib.daytour ? sib.daytour_fee : 0) +
                            (sib.early_checkin ? sib.early_checkin_fee : 0) +
                            (sib.other_extras_fee || 0) +
                            (sib.extension_fee || 0);
                          const sibDiscountAmt = sib.discount_type === "percentage"
                            ? Math.round((sibBase + sibExtras) * (sib.discount_given / 100))
                            : (sib.discount_given || 0);
                          const sibComputedTotal = Math.max(0, sibBase + sibExtras - sibDiscountAmt);
                          return {
                            unitName: u?.name || "Unit",
                            total: sibComputedTotal > 0 ? sibComputedTotal : sib.total_amount,
                            deposit: sib.deposit_paid,
                            paymentStatus: sib.payment_status,
                            isCurrent: false,
                          };
                        }),
                      ];

                      const grandTotal = groupEntries.reduce((s, e) => s + e.total, 0);
                      const grandDeposit = groupEntries.reduce((s, e) => s + e.deposit, 0);
                      const grandBalance = Math.max(0, grandTotal - grandDeposit);
                      const allSettled = groupEntries.every((e) => e.paymentStatus === "Fully Paid" || e.paymentStatus === "Airbnb Paid");

                      return (
                        <>
                          <Separator className="bg-primary/30 my-1" />
                          <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 pt-1">
                            <Link2 className="h-3 w-3" /> Group Summary
                            <span className="font-normal text-muted-foreground">({groupEntries.length} units)</span>
                          </div>

                          {groupEntries.map((entry, idx) => (
                            <div key={idx} className={cn(
                              "flex items-center justify-between text-xs rounded px-2 py-1",
                              entry.isCurrent ? "bg-primary/10 border border-primary/20" : "bg-muted/30"
                            )}>
                              <div className="flex items-center gap-1.5">
                                <span className="text-foreground font-medium">{entry.unitName}</span>
                                {entry.isCurrent && <span className="text-[8px] bg-primary/20 text-primary px-1 rounded">editing</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">₱{entry.total.toLocaleString()}</span>
                                {entry.deposit > 0 && (
                                  <span className="text-[10px] text-primary font-medium">DP ₱{entry.deposit.toLocaleString()}</span>
                                )}
                                <span className={cn(
                                  "text-[10px] font-medium px-1.5 py-0.5 rounded",
                                  entry.paymentStatus === "Fully Paid" || entry.paymentStatus === "Airbnb Paid"
                                    ? "bg-primary/20 text-primary"
                                    : entry.paymentStatus === "Partial DP"
                                    ? "bg-warning-orange/20 text-warning-orange"
                                    : "bg-destructive/20 text-destructive"
                                )}>
                                  {entry.paymentStatus}
                                </span>
                              </div>
                            </div>
                          ))}

                          <div className="flex justify-between text-sm font-semibold pt-1">
                            <span className="text-primary">Group Total</span>
                            <span className="text-primary">₱{grandTotal.toLocaleString()}</span>
                          </div>
                          {grandDeposit > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Total Deposits</span>
                              <span className="text-foreground">-₱{grandDeposit.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-bold">
                            <span className={allSettled ? "text-primary" : "text-destructive"}>
                              {allSettled ? "All Settled ✓" : "Group Balance"}
                            </span>
                            <span className={allSettled ? "text-primary" : "text-destructive"}>
                              ₱{grandBalance.toLocaleString()}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                );
              } catch {
                return null;
              }
            })()}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isPending
                  ? "Saving..."
                  : isEditing
                  ? "Update Booking"
                  : additionalUnitIds.length > 0
                  ? `Create ${1 + additionalUnitIds.length} Bookings`
                  : "Create Booking"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* Overlap / Unavailable Confirmation Dialog */}
    <Dialog open={showOverlapConfirm} onOpenChange={setShowOverlapConfirm}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-orange" />
            Booking Warning
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          {conflictWarning && <p>{conflictWarning}</p>}
          {(() => {
            const allUnitIds = [watchUnitId, ...additionalUnitIds].filter(Boolean);
            const unavailable = units.filter((u) => allUnitIds.includes(u.id) && u.unit_status !== "Available");
            if (unavailable.length > 0) {
              return <p>⚠️ Unavailable units: {unavailable.map((u) => `${u.name} (${u.unit_status})`).join(", ")}</p>;
            }
            return null;
          })()}
          <p className="text-foreground font-medium">Do you want to proceed anyway?</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => { setShowOverlapConfirm(false); setPendingSubmitValues(null); }} className="text-muted-foreground">
            Cancel
          </Button>
          <Button
            className="bg-warning-orange text-white hover:bg-warning-orange/90"
            onClick={() => {
              setShowOverlapConfirm(false);
              if (pendingSubmitValues) {
                onSubmit(pendingSubmitValues);
                setPendingSubmitValues(null);
              }
            }}
          >
            Proceed Anyway
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Group Booking Detection Prompt */}
    <Dialog open={showGroupPrompt} onOpenChange={(o) => { if (!o) { setShowGroupPrompt(false); setMatchingGroupBooking(null); setPendingSubmitValues(null); } }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Existing Booking Detected
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">{pendingSubmitValues?.guest_name}</span> already has a booking
            {matchingGroupBooking ? ` (${matchingGroupBooking.booking_ref})` : ""} on overlapping dates
            {matchingGroupBooking ? ` (${matchingGroupBooking.check_in} → ${matchingGroupBooking.check_out})` : ""}.
          </p>
          {(() => {
            const groupUnitNames: string[] = (matchingGroupBooking as any)?._groupUnitNames ?? [];
            if (groupUnitNames.length > 0) {
              return <p>Units in booking: <span className="font-medium text-foreground">{groupUnitNames.join(" + ")}</span></p>;
            }
            return null;
          })()}
          <p className="text-foreground font-medium">Would you like to add this as a combined/grouped booking?</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              setShowGroupPrompt(false);
              setMatchingGroupBooking(null);
              setJoinGroupTarget(null);
              if (pendingSubmitValues) {
                onSubmit(pendingSubmitValues);
                setPendingSubmitValues(null);
              }
            }}
          >
            No, Create Separate
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setShowGroupPrompt(false);
              if (matchingGroupBooking && pendingSubmitValues) {
                const target = { id: matchingGroupBooking.id, booking_group_id: matchingGroupBooking.booking_group_id };
                setJoinGroupTarget(target);
                onSubmit(pendingSubmitValues, target);
                setPendingSubmitValues(null);
              }
              setMatchingGroupBooking(null);
            }}
          >
            Yes, Add to Group
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Nested BookingModal for adding a unit to an existing group */}
    {isEditing && booking && (booking as any).booking_group_id && (
      <BookingModal
        open={showAddUnitToGroupModal}
        onOpenChange={(o) => {
          setShowAddUnitToGroupModal(o);
          if (!o) {
            // Refresh group siblings after closing
            supabase
              .from("bookings")
              .select("id, unit_id, is_primary, total_amount, deposit_paid, payment_status, extras_paid_status, booking_ref")
              .eq("booking_group_id", (booking as any).booking_group_id)
              .is("deleted_at", null)
              .then(({ data }) => {
                if (data) {
                  setGroupSiblings(data.filter((b) => b.id !== booking.id).map((b) => ({
                    id: b.id,
                    unit_id: b.unit_id || "",
                    is_primary: b.is_primary,
                    total_amount: b.total_amount ?? 0,
                    deposit_paid: b.deposit_paid ?? 0,
                    payment_status: b.payment_status ?? "Unpaid",
                    extras_paid_status: (b.extras_paid_status && typeof b.extras_paid_status === 'object' ? b.extras_paid_status : {}) as Record<string, boolean>,
                    booking_ref: b.booking_ref ?? "",
                  })));
                }
              });
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
          }
        }}
        groupContext={{
          booking_group_id: (booking as any).booking_group_id,
          parentBookingId: booking.id,
          guest_name: form.getValues("guest_name"),
          check_in: form.getValues("check_in"),
          check_out: form.getValues("check_out"),
          email: form.getValues("email") || undefined,
          phone: form.getValues("phone") || undefined,
          booking_source: form.getValues("booking_source") || undefined,
        }}
      />
    )}
    </>
  );
}
