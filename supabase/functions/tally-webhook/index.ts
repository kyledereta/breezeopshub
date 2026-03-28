import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("Tally webhook payload:", JSON.stringify(payload));

    // Tally sends data in { data: { fields: [...] } } format
    const fields = payload?.data?.fields || [];

    function getField(label: string): string {
      const field = fields.find(
        (f: any) =>
          f.label?.toLowerCase().trim() === label.toLowerCase().trim()
      );
      if (!field) return "";
      if (field.value !== undefined && field.value !== null) {
        if (typeof field.value === "object" && field.value.url) {
          return field.value.url;
        }
        if (Array.isArray(field.value)) {
          if (field.value.length > 0 && field.value[0]?.url) {
            return field.value[0].url;
          }
          return field.value.join(", ");
        }
        return String(field.value);
      }
      return "";
    }

    // Helper to get option/checkbox field values
    function getOptionField(label: string): string[] {
      const field = fields.find(
        (f: any) =>
          f.label?.toLowerCase().trim() === label.toLowerCase().trim()
      );
      if (!field) return [];
      if (Array.isArray(field.value)) return field.value.map((v: any) => String(v));
      if (field.options && Array.isArray(field.options)) {
        // For checkboxes/multiple choice, Tally sends selected option IDs in value
        const selectedIds = Array.isArray(field.value) ? field.value : [field.value];
        return field.options
          .filter((o: any) => selectedIds.includes(o.id))
          .map((o: any) => o.text || o.name || String(o.id));
      }
      if (field.value) return [String(field.value)];
      return [];
    }

    // Guest details
    const guestName = getField("full name") || getField("guest name") || getField("name") || "Unknown Guest";
    const facebookName = getField("facebook name") || null;
    const phone = getField("contact number") || getField("phone") || getField("phone number") || null;
    const email = getField("email address") || getField("email") || null;
    const birthdayMonthStr = getField("birthday month") || "";

    // Stay details
    const checkIn = getField("check-in date") || getField("check in") || getField("check-in") || getField("check in date") || getField("arrival");
    const checkOut = getField("check-out date") || getField("check out") || getField("check-out") || getField("check out date") || getField("departure");
    const paxStr = getField("number of guests (pax)") || getField("pax") || getField("guests") || getField("number of guests") || "1";
    const promoCode = getField("promo code") || null;

    // Pet
    const petOptions = getOptionField("are you traveling with a pet?");
    const hasPet = petOptions.some(v => v.toLowerCase() === "yes");

    // Government ID upload
    const govIdUrl = getField("upload a valid government id") || getField("government id") || getField("valid id") || null;

    // Payment method
    const paymentMethod = getField("payment") || getField("payment method") || null;

    // Payment receipts
    const bankReceipt = getField("bank transfer payment receipt") || null;
    const gcashReceipt = getField("gcash payment receipt") || null;
    const paymentScreenshot = bankReceipt || gcashReceipt || getField("payment screenshot") || getField("proof of payment") || getField("payment proof") || getField("screenshot") || null;

    // Marketing consent
    const marketingOptions = getOptionField("would you like to receive promotions, updates, and news from breeze resort zambales");
    const marketingConsent = marketingOptions.some(v => v.toLowerCase() === "yes");

    // Unit (if present in form)
    const unitName = getField("unit") || getField("room") || getField("accommodation") || "";

    const pax = parseInt(paxStr, 10) || 1;

    // Parse birthday month
    let birthdayMonth: number | null = null;
    if (birthdayMonthStr) {
      const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
      const idx = monthNames.indexOf(birthdayMonthStr.toLowerCase().trim());
      if (idx !== -1) birthdayMonth = idx + 1;
      else {
        const parsed = parseInt(birthdayMonthStr, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) birthdayMonth = parsed;
      }
    }

    // Try to match unit by name
    let unitId: string | null = null;
    if (unitName) {
      const { data: unitData } = await supabase
        .from("units")
        .select("id")
        .ilike("name", `%${unitName}%`)
        .limit(1)
        .single();
      if (unitData) unitId = unitData.id;
    }

    // Handle file uploads - download and store in Supabase storage
    async function storeFile(url: string, bucket: string): Promise<string | null> {
      if (!url || !url.startsWith("http")) return url;
      try {
        const imgResponse = await fetch(url);
        const imgBlob = await imgResponse.blob();
        const ext = url.includes(".png") ? "png" : "jpg";
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, imgBlob, { contentType: imgBlob.type || `image/${ext}` });
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);
          return urlData.publicUrl;
        }
      } catch (err) {
        console.error(`Failed to store file from ${url}:`, err);
      }
      return url;
    }

    const screenshotUrl = paymentScreenshot ? await storeFile(paymentScreenshot, "payment-screenshots") : null;
    const storedGovIdUrl = govIdUrl ? await storeFile(govIdUrl, "guest-ids") : null;

    // Parse dates
    function parseDate(dateStr: string): string | null {
      if (!dateStr) return null;
      const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) return dateStr.substring(0, 10);
      const usMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
      return dateStr;
    }

    const parsedCheckIn = parseDate(checkIn);
    const parsedCheckOut = parseDate(checkOut);

    if (!parsedCheckIn || !parsedCheckOut) {
      return new Response(
        JSON.stringify({ error: "Missing check-in or check-out date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map payment method to our format
    let mappedPaymentMethod: string | null = null;
    if (paymentMethod) {
      const pm = paymentMethod.toLowerCase();
      if (pm.includes("gcash")) mappedPaymentMethod = "GCash";
      else if (pm.includes("bank") || pm.includes("eastwest")) mappedPaymentMethod = "Bank Transfer";
      else mappedPaymentMethod = paymentMethod;
    }

    const { data, error } = await supabase.from("form_submissions").insert({
      guest_name: guestName,
      phone,
      email,
      check_in: parsedCheckIn,
      check_out: parsedCheckOut,
      unit_id: unitId,
      pax,
      payment_screenshot_url: screenshotUrl,
      status: "Pending",
      raw_payload: payload,
      facebook_name: facebookName,
      birthday_month: birthdayMonth,
      has_pet: hasPet,
      gov_id_url: storedGovIdUrl,
      promo_code: promoCode,
      payment_method: mappedPaymentMethod,
      marketing_consent: marketingConsent,
    }).select().single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
