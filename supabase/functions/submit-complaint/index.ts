import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function response(request: Request, status: number, body: Record<string, unknown>) {
  const origin = request.headers.get("origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
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
  if (!Deno.env.get("SUPABASE_URL") || !Deno.env.get("SUPABASE_ANON_KEY") || !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    console.error("Complaint function is missing Supabase environment configuration");
    return response(request, 503, { error: "Support form is not configured yet" });
  }

  let rawBody: string;
  let input: Record<string, unknown>;
  try {
    rawBody = await request.text();
  } catch {
    return response(request, 400, { error: "Could not read request body" });
  }
  if (new TextEncoder().encode(rawBody).length > 12_288) return response(request, 413, { error: "Request is too large" });
  try {
    input = JSON.parse(rawBody);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected a JSON object");
  } catch {
    return response(request, 400, { error: "Invalid JSON body" });
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const orderReference = typeof input.order_reference === "string" ? input.order_reference.trim() : "";
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (name.length < 1 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
    || phone.length > 40 || orderReference.length > 80 || subject.length < 1 || subject.length > 160
    || message.length < 5 || message.length > 5000) {
    return response(request, 400, { error: "Please provide valid support details" });
  }

  const authorization = request.headers.get("authorization");
  let userId: string | null = null;
  if (authorization) {
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    if (!accessToken || accessToken === authorization) return response(request, 401, { error: "Invalid authorization header" });
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.getUser(accessToken);
    if (error || !data.user) return response(request, 401, { error: "Your session is invalid or expired" });
    userId = data.user.id;
  }

  const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await serviceClient
    .from("support_tickets")
    .insert({
      user_id: userId,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      order_reference: orderReference,
      subject,
      message,
    })
    .select("id, status, created_at")
    .single();

  if (error || !data) {
    console.error("Support ticket creation failed", error?.message ?? "No ticket was returned");
    return response(request, 500, { error: "We could not send your message. Please try again later." });
  }
  return response(request, 201, { ticket: data });
});
