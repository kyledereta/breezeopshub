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
import { useUnits, groupUnitsByArea } from "@/hooks/useUnits";
import { useCreateBooking, useUpdateBooking } from "@/hooks/useBookingMutations";
import type { Booking } from "@/hooks/useBookings";
import { Constants, type Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateGuestRef } from "@/lib/guestRef";
import { Upload, X, FileImage, PawPrint, AlertTriangle, Music, Plus } from "lucide-react";
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
  unit_id: z.string().min(1, "Select a unit"),
  check_in: z.string().min(1, "Check-in date is required"),
  check_out: z.string().min(1, "Check-out date is required"),
  pax: z.coerce.number().min(1).max(50),
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
}).refine((data) => data.check_out > data.check_in, {
  message: "Check-out must be after check-in",
  path: ["check_out"],
});

type BookingFormValues = z.infer<typeof bookingSchema>;

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking?: Booking | null;
  defaultUnitId?: string;
  defaultDate?: Date;
}

export function BookingModal({
  open,
  onOpenChange,
  booking,
  defaultUnitId,
  defaultDate,
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
  const [unitSearch, setUnitSearch] = useState("");
  const [unitPopoverOpen, setUnitPopoverOpen] = useState(false);
  const [guestSuggestions, setGuestSuggestions] = useState<{ id: string; guest_name: string; phone: string | null; email: string | null; pets: boolean; birthday_month: number | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const originalValuesRef = useRef<Record<string, any> | null>(null);
  // Multi-unit support
  const [additionalUnitIds, setAdditionalUnitIds] = useState<string[]>([]);
  const [addUnitPopoverOpen, setAddUnitPopoverOpen] = useState(false);
  const [addUnitSearch, setAddUnitSearch] = useState("");
  // Pet additional fee
  const [additionalPet, setAdditionalPet] = useState(false);
  // Birthday month for guest verification
  const [birthMonthFilter, setBirthMonthFilter] = useState(0);

  // Load existing ID files when editing
  useEffect(() => {
    if (!open) { setIdFiles([]); setExistingIds([]); setAdditionalUnitIds([]); setAdditionalPet(false); setBirthMonthFilter(0); return; }
    if (booking) {
      supabase.storage.from("guest-ids").list(booking.id).then(({ data }) => {
        if (data) setExistingIds(data.map((f) => `${booking.id}/${f.name}`));
      });
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
      booking_source: "Other",
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
  const watchKaraoke = form.watch("karaoke");
  const watchPets = form.watch("pets");
  const watchKitchenUse = form.watch("kitchen_use");
  const watchWaterJug = form.watch("water_jug");
  const watchTowelRent = form.watch("towel_rent");
  const watchBonfire = form.watch("bonfire");

  // Get combined max_pax across all selected units
  const combinedMaxPax = useMemo(() => {
    const allIds = [watchUnitId, ...additionalUnitIds].filter(Boolean);
    const selectedUnits = units.filter((u) => allIds.includes(u.id));
    return selectedUnits.reduce((sum, u) => sum + u.max_pax, 0);
  }, [units, watchUnitId, additionalUnitIds]);

  const selectedUnit = useMemo(() => units.find((u) => u.id === watchUnitId), [units, watchUnitId]);
  const extraPax = combinedMaxPax > 0 ? Math.max(0, watchPax - combinedMaxPax) : 0;

  // Auto-set pax to unit's max_pax when unit is selected (new bookings only)
  useEffect(() => {
    if (isEditing) return;
    if (combinedMaxPax > 0) {
      form.setValue("pax", combinedMaxPax);
    }
  }, [combinedMaxPax, isEditing, form]);

  // Auto-set deposit_paid based on payment status
  const watchPaymentStatus = form.watch("payment_status");
  useEffect(() => {
    if (watchPaymentStatus === "Unpaid") {
      form.setValue("deposit_paid", 0);
    } else if (watchPaymentStatus === "Fully Paid") {
      const total = form.getValues("total_amount");
      form.setValue("deposit_paid", total);
    }
  }, [watchPaymentStatus, form]);

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

  // Auto-calculate total amount based on nightly rate × nights + all extras - discount
  // Supports multi-unit: sums nightly rates across all selected units
  useEffect(() => {
    if (!watchCheckIn || !watchCheckOut) return;
    const allIds = [watchUnitId, ...additionalUnitIds].filter(Boolean);
    const selectedUnits = units.filter((u) => allIds.includes(u.id));
    if (selectedUnits.length === 0) return;
    try {
      const checkInDate = parse(watchCheckIn, "yyyy-MM-dd", new Date());
      const checkOutDate = parse(watchCheckOut, "yyyy-MM-dd", new Date());
      const nights = differenceInCalendarDays(checkOutDate, checkInDate);
      if (nights <= 0) return;

      const base = selectedUnits.reduce((sum, u) => sum + u.nightly_rate * nights, 0);
      const extras =
        (watchUtensilRental ? Number(watchUtensilFee) || 0 : 0) +
        (watchKaraoke ? Number(watchKaraokeFee) || 0 : 0) +
        (watchKitchenUse ? Number(watchKitchenFee) || 0 : 0) +
        (watchPets ? Number(watchPetFee) || 0 : 0) +
        (Number(watchExtraPaxFee) || 0) +
        (watchWaterJug ? Number(watchWaterJugFee) || 0 : 0) +
        (watchTowelRent ? Number(watchTowelRentFee) || 0 : 0) +
        (watchBonfire ? Number(watchBonfireFee) || 0 : 0);

      const discountAmount =
        watchDiscountType === "percentage"
          ? Math.round(((base + extras) * Number(watchDiscountGiven)) / 100)
          : Number(watchDiscountGiven) || 0;

      const total = Math.max(0, base + extras - discountAmount);
      form.setValue("total_amount", total);
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
    watchDiscountType, watchDiscountGiven,
    form,
  ]);

  // Reset form when modal opens with new data
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
      };
      form.reset(vals);
      originalValuesRef.current = { ...vals };
      setAdditionalPet((booking as any).pet_fee > 0);
    } else {
      originalValuesRef.current = null;
      form.reset({
        guest_name: "",
        unit_id: defaultUnitId ?? "",
        check_in: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
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
        booking_source: "Other",
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
      });
      setAdditionalUnitIds([]);
      setAdditionalPet(false);
      setBirthMonthFilter(0);
    }
  }, [open, booking, defaultUnitId, defaultDate, form]);

  function handleFormSubmit(values: BookingFormValues) {
    // Check for overlap/unavailable units - show confirmation if needed
    const allUnitIds = [values.unit_id, ...additionalUnitIds].filter(Boolean);
    const unavailableUnits = units.filter((u) => allUnitIds.includes(u.id) && u.unit_status !== "Available");
    
    if (conflictWarning || unavailableUnits.length > 0) {
      setPendingSubmitValues(values);
      setShowOverlapConfirm(true);
      return;
    }
    onSubmit(values);
  }

  async function onSubmit(values: BookingFormValues) {
    try {
      const payload = {
        guest_name: values.guest_name,
        unit_id: values.unit_id,
        check_in: values.check_in,
        check_out: values.check_out,
        pax: values.pax,
        total_amount: values.total_amount,
        deposit_paid: values.deposit_paid,
        payment_status: values.payment_status as PaymentStatus,
        booking_status: values.booking_status as BookingStatus,
        booking_source: values.booking_source as BookingSource,
        mode_of_payment: values.mode_of_payment || null,
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
        // Sync secondary bookings in the same group
        if ((booking as any).booking_group_id && (booking as any).is_primary) {
          const sharedFields = {
            guest_name: fullPayload.guest_name,
            guest_id: fullPayload.guest_id,
            check_in: fullPayload.check_in,
            check_out: fullPayload.check_out,
            pax: fullPayload.pax,
            booking_status: fullPayload.booking_status,
            booking_source: fullPayload.booking_source,
            email: fullPayload.email,
            phone: fullPayload.phone,
            notes: fullPayload.notes,
            payment_status: fullPayload.payment_status,
          };
          await supabase
            .from("bookings")
            .update(sharedFields)
            .eq("booking_group_id", (booking as any).booking_group_id)
            .eq("is_primary", false);
        }
        // Log audit trail
        if (originalValuesRef.current) {
          await logBookingChanges(booking.id, originalValuesRef.current, fullPayload);
          queryClient.invalidateQueries({ queryKey: ["booking_audit_log", booking.id] });
        }
        toast.success("Booking updated");
      } else {
        // Create one booking per selected unit (multi-unit support)
        const allUnitIds = [values.unit_id, ...additionalUnitIds];
        if (allUnitIds.length > 1) {
          const groupId = crypto.randomUUID();
          // Primary booking (first unit) holds all payment/total info
          await createBooking.mutateAsync({
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
              extension_fee: 0,
            } as any);
          }
        } else {
          await createBooking.mutateAsync(fullPayload);
        }
        toast.success(allUnitIds.length > 1 ? `${allUnitIds.length} units booked as one group` : "Booking created");
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

  // Available units for additional selection (exclude already selected)
  const availableUnitsForAdd = useMemo(() => {
    const selectedIds = new Set([watchUnitId, ...additionalUnitIds]);
    return units.filter((u) => !selectedIds.has(u.id));
  }, [units, watchUnitId, additionalUnitIds]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">
            {isEditing ? "Edit Booking" : "New Booking"}
          </DialogTitle>
        </DialogHeader>

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
              <FormField
                control={form.control}
                name="unit_id"
                render={({ field }) => {
                  const selectedUnitName = units.find((u) => u.id === field.value);
                  const filteredGroups = groupedUnits
                    .map(({ area, units: areaUnits }) => ({
                      area,
                      units: areaUnits.filter((u) =>
                        u.name.toLowerCase().includes(unitSearch.toLowerCase())
                      ),
                    }))
                    .filter((g) => g.units.length > 0);

                  return (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Unit</FormLabel>
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
                          <div className="max-h-60 overflow-auto p-1">
                            {filteredGroups.length === 0 && (
                              <p className="text-xs text-muted-foreground p-3 text-center">No units found</p>
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

              {/* Additional Units (multi-unit) */}
              {!isEditing && (
                <div className="space-y-2">
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
                  {availableUnitsForAdd.length > 0 && (
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
                        <div className="max-h-48 overflow-auto p-1">
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
              )}

              {conflictWarning && (
                <div className="flex items-center gap-2 rounded-lg border border-warning-orange/50 bg-warning-orange/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-warning-orange shrink-0" />
                  <p className="text-xs text-warning-orange">{conflictWarning}</p>
                </div>
              )}
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
                      ].filter(Boolean).join(", ") || "Select extras..."}
                    </span>
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 space-y-1" align="start">
                  {[
                    { key: "utensil_rental" as const, label: "Utensil Rental", desc: "₱500/set" },
                    { key: "karaoke" as const, label: "Karaoke", desc: "₱1,500" },
                    { key: "kitchen_use" as const, label: "Kitchen Use", desc: "₱500" },
                    { key: "water_jug" as const, label: "Water Jug", desc: "₱100/jug" },
                    { key: "towel_rent" as const, label: "Towel Rent", desc: "₱100/pc" },
                    { key: "bonfire" as const, label: "Bonfire Setup", desc: "₱300" },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={form.watch(item.key)}
                        onCheckedChange={(v) => form.setValue(item.key, !!v)}
                      />
                      <div className="flex-1">
                        <span className="text-xs text-foreground">{item.label}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">{item.desc}</span>
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
                        <FormControl>
                          <Input {...field} type="number" min={0} step="any" className="bg-background border-border" />
                        </FormControl>
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
                        <FormControl>
                          <Input {...field} type="number" min={0} step="any" className="bg-background border-border" />
                        </FormControl>
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
                        <FormControl>
                          <Input {...field} type="number" min={0} step="any" className="bg-background border-border" />
                        </FormControl>
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
                        <FormControl>
                          <Input {...field} type="number" min={1} step={1} className="bg-background border-border" />
                        </FormControl>
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
                        <FormControl>
                          <Input {...field} type="number" min={1} step={1} className="bg-background border-border" />
                        </FormControl>
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
                        <FormControl>
                          <Input {...field} type="number" min={0} step="any" className="bg-background border-border" />
                        </FormControl>
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
                        <FormControl>
                          <Input {...field} type="number" min={0} step="any" className="bg-background border-border" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
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
                          {Constants.public.Enums.booking_status.map((s) => (
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
                          {Constants.public.Enums.payment_status.map((s) => (
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
              <div className="grid grid-cols-2 gap-3">
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
              </div>
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

                const unitBreakdowns = selectedUnits.map((u) => ({
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
                  (watchBonfire ? Number(watchBonfireFee) || 0 : 0);
                const discountAmount =
                  watchDiscountType === "percentage"
                    ? Math.round(((base + extras) * Number(watchDiscountGiven)) / 100)
                    : Number(watchDiscountGiven) || 0;
                const total = Math.max(0, base + extras - discountAmount);

                return (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">Computation Summary</h3>
                    {unitBreakdowns.map((ub) => (
                      <div key={ub.name} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{ub.name} (₱{ub.rate.toLocaleString()} × {nights}n)</span>
                        <span className="text-foreground">₱{ub.subtotal.toLocaleString()}</span>
                      </div>
                    ))}
                    {watchUtensilRental && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Utensil Rental</span>
                        <span className="text-foreground">₱{(Number(watchUtensilFee) || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {watchKaraoke && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Karaoke</span>
                        <span className="text-foreground">₱{(Number(watchKaraokeFee) || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {watchKitchenUse && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Kitchen Use</span>
                        <span className="text-foreground">₱{(Number(watchKitchenFee) || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {watchPets && Number(watchPetFee) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Additional Pet</span>
                        <span className="text-foreground">₱{(Number(watchPetFee) || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {Number(watchExtraPaxFee) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Extra PAX Fee</span>
                        <span className="text-foreground">₱{(Number(watchExtraPaxFee) || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {watchWaterJug && Number(watchWaterJugFee) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Water Jug (×{Number(form.watch("water_jug_qty")) || 0})</span>
                        <span className="text-foreground">₱{(Number(watchWaterJugFee) || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {watchTowelRent && Number(watchTowelRentFee) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Towel Rent (×{Number(form.watch("towel_rent_qty")) || 0})</span>
                        <span className="text-foreground">₱{(Number(watchTowelRentFee) || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {watchBonfire && Number(watchBonfireFee) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Bonfire Setup</span>
                        <span className="text-foreground">₱{(Number(watchBonfireFee) || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="text-destructive">-₱{discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <Separator className="bg-primary/20" />
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-primary">Total</span>
                      <span className="text-primary">₱{total.toLocaleString()}</span>
                    </div>
                    {(() => {
                      const depositPaid = Number(form.watch("deposit_paid")) || 0;
                      const balance = total - depositPaid;
                      if (depositPaid > 0 && balance > 0) {
                        return (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Deposit Paid</span>
                              <span className="text-foreground">-₱{depositPaid.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold">
                              <span className="text-destructive">Balance Due</span>
                              <span className="text-destructive">₱{balance.toLocaleString()}</span>
                            </div>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              } catch {
                return null;
              }
            })()}

            {/* Actions */}
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
  );
}
