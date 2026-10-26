import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function response(request: Request, status: number, body: Record<string, unknown>) {
  const origin = request.headers.get("origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const headers = new Headers(jsonHeaders);
  headers.set("Vary", "Origin");
  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return response(request, 204, {});
  if (request.method !== "POST") return response(request, 405, { error: "Method not allowed" });
  const origin = request.headers.get("origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (origin && !allowedOrigins.includes(origin)) return response(request, 403, { error: "Origin is not allowed" });

  let input: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > 2048) return response(request, 413, { error: "Request is too large" });
    input = JSON.parse(rawBody);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected a JSON object");
  } catch {
    return response(request, 400, { error: "Invalid JSON body" });
  }

  if (!Deno.env.get("SUPABASE_URL") || !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    console.error("Newsletter function is missing Supabase environment configuration");
    return response(request, 503, { error: "Newsletter sign-up is not configured yet" });
  }
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (input.action === "subscribe") {
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response(request, 400, { error: "Enter a valid email address" });
    }
    const { error } = await client.from("newsletter_subscribers").upsert(
      { email, active: true, unsubscribed_at: null },
      { onConflict: "email" },
    );
    if (error) {
      console.error("Newsletter subscription failed", error.message);
      return response(request, 500, { error: "We could not save your subscription. Please try again." });
    }
    return response(request, 200, { subscribed: true });
  }

  if (input.action === "unsubscribe") {
    const token = typeof input.token === "string" ? input.token : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return response(request, 400, { error: "This unsubscribe link is invalid" });
    }
    const { error } = await client.from("newsletter_subscribers")
      .update({ active: false, unsubscribed_at: new Date().toISOString() })
      .eq("unsubscribe_token", token)
      .eq("active", true);
    if (error) {
      console.error("Newsletter unsubscribe failed", error.message);
      return response(request, 500, { error: "We could not process this unsubscribe request" });
    }
    return response(request, 200, { unsubscribed: true });
  }

  return response(request, 400, { error: "Choose a valid newsletter action" });
});
