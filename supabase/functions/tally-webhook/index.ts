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
      // Handle different field types
      if (field.value !== undefined && field.value !== null) {
        if (typeof field.value === "object" && field.value.url) {
          return field.value.url;
        }
        if (Array.isArray(field.value)) {
          // File uploads come as arrays
          if (field.value.length > 0 && field.value[0]?.url) {
            return field.value[0].url;
          }
          return field.value.join(", ");
        }
        return String(field.value);
      }
      return "";
    }

    const guestName = getField("guest name") || getField("name") || getField("full name") || "Unknown Guest";
    const phone = getField("phone") || getField("phone number") || getField("contact number") || null;
    const email = getField("email") || getField("email address") || null;
    const checkIn = getField("check in") || getField("check-in") || getField("check in date") || getField("arrival");
    const checkOut = getField("check out") || getField("check-out") || getField("check out date") || getField("departure");
    const unitName = getField("unit") || getField("room") || getField("accommodation") || "";
    const paxStr = getField("pax") || getField("guests") || getField("number of guests") || "1";
    const paymentScreenshot = getField("payment screenshot") || getField("proof of payment") || getField("payment proof") || getField("screenshot") || null;

    const pax = parseInt(paxStr, 10) || 1;

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

    // Handle payment screenshot - if it's a URL, download and store it
    let screenshotUrl = paymentScreenshot;
    if (paymentScreenshot && paymentScreenshot.startsWith("http")) {
      try {
        const imgResponse = await fetch(paymentScreenshot);
        const imgBlob = await imgResponse.blob();
        const ext = paymentScreenshot.includes(".png") ? "png" : "jpg";
        const fileName = `${crypto.randomUUID()}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("payment-screenshots")
          .upload(fileName, imgBlob, {
            contentType: imgBlob.type || `image/${ext}`,
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from("payment-screenshots")
            .getPublicUrl(uploadData.path);
          screenshotUrl = urlData.publicUrl;
        }
      } catch (imgErr) {
        console.error("Failed to download payment screenshot:", imgErr);
        // Keep original URL as fallback
      }
    }

    // Parse dates - try common formats
    function parseDate(dateStr: string): string | null {
      if (!dateStr) return null;
      // Try ISO format first
      const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) return dateStr.substring(0, 10);
      // Try MM/DD/YYYY
      const usMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
      // Try DD/MM/YYYY
      const euMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (euMatch) return `${euMatch[3]}-${euMatch[2].padStart(2, "0")}-${euMatch[1].padStart(2, "0")}`;
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
