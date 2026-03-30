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
    const { text, units } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No text provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const unitList = units && Array.isArray(units)
      ? units.map((u: any) => `"${u.name}" (id: ${u.id}, max_pax: ${u.max_pax})`).join(", ")
      : "No units available";

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `You are a booking text parser for a resort/property management system. Extract booking information from pasted text (could be a message from a guest, a chat conversation, notes, etc).

Available units: ${unitList}

Today's date: ${today}

Return a JSON object with these fields (use null for anything you can't determine):
{
  "guest_name": string | null,
  "phone": string | null,
  "email": string | null,
  "check_in": "YYYY-MM-DD" | null,
  "check_out": "YYYY-MM-DD" | null,
  "pax": number | null,
  "unit_id": string | null,
  "unit_name": string | null,
  "booking_source": "Facebook Direct" | "Airbnb" | "Walk-in" | "Referral" | "Instagram" | "TikTok" | "Other" | null,
  "notes": string | null,
  "pets": boolean,
  "has_car": boolean,
  "deposit_paid": number | null,
  "total_amount": number | null,
  "payment_status": "Unpaid" | "Partial DP" | "Fully Paid" | null,
  "booking_status": "Confirmed" | "Inquiry" | "Hold" | null
}

Rules:
- Match unit names flexibly (e.g. "villa 1" matches "Villa 1", "v1" might match "Villa 1")
- If the text mentions a deposit or downpayment amount, set deposit_paid and payment_status to "Partial DP"
- If dates use formats like "March 15" without a year, assume the current or next occurrence
- If only one date is mentioned, try to infer if it's check-in; set check_out to the next day if unclear
- Extract any extra notes or special requests into the notes field
- If the text looks like a Facebook message, set booking_source to "Facebook Direct"
- If pet is mentioned, set pets to true
- If car/vehicle/parking is mentioned, set has_car to true
- Default booking_status to "Confirmed" unless the text suggests it's just an inquiry
- Return ONLY the JSON object, no markdown, no explanation`;

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to parse text" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Parse error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to parse booking text" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
