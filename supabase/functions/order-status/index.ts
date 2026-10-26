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

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return response(request, 204, {});
  if (request.method !== "POST") return response(request, 405, { error: "Method not allowed" });
  const origin = request.headers.get("origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (origin && !allowedOrigins.includes(origin)) return response(request, 403, { error: "Origin is not allowed" });
  if (!Deno.env.get("SUPABASE_URL") || !Deno.env.get("SUPABASE_ANON_KEY") || !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    console.error("Order status function is missing Supabase environment configuration");
    return response(request, 503, { error: "Order tracking is not configured yet" });
  }

  let rawBody: string;
  let input: Record<string, unknown>;
  try {
    rawBody = await request.text();
  } catch {
    return response(request, 400, { error: "Could not read request body" });
  }
  if (new TextEncoder().encode(rawBody).length > 4096) return response(request, 413, { error: "Request is too large" });
  try {
    input = JSON.parse(rawBody);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected a JSON object");
  } catch {
    return response(request, 400, { error: "Invalid JSON body" });
  }

  const orderNumber = typeof input.order_number === "string" ? input.order_number.trim() : "";
  const trackingToken = typeof input.tracking_token === "string" ? input.tracking_token.trim() : "";
  if (orderNumber.length < 5 || orderNumber.length > 40) return response(request, 400, { error: "Enter a valid order number" });

  const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userId: string | null = null;
  const authorization = request.headers.get("authorization");
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
  if (!userId && !/^[0-9a-f]{64}$/i.test(trackingToken)) {
    return response(request, 401, { error: "A valid guest tracking token is required" });
  }

  let query = serviceClient.from("orders")
    .select("id, order_number, status, payment_method, payment_status, subtotal_pkr, shipping_pkr, total_pkr, created_at")
    .eq("order_number", orderNumber);
  query = userId
    ? query.eq("user_id", userId)
    : query.eq("guest_tracking_token_hash", await hashToken(trackingToken));
  const { data: order, error } = await query.maybeSingle();
  if (error) {
    console.error("Order status lookup failed", error.message);
    return response(request, 500, { error: "We could not look up this order right now" });
  }
  if (!order) return response(request, 404, { error: "Order not found" });

  const [{ data: items, error: itemsError }, { data: history, error: historyError }, { data: statuses, error: statusesError }] = await Promise.all([
    serviceClient
    .from("order_items")
    .select("product_name, unit_price_pkr, quantity, line_total_pkr")
    .eq("order_id", order.id),
    serviceClient
      .from("order_status_history")
      .select("status, changed_at")
      .eq("order_id", order.id)
      .order("changed_at", { ascending: true })
      .order("id", { ascending: true }),
    serviceClient
      .from("order_statuses")
      .select("label, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (itemsError || historyError || statusesError) {
    console.error("Order details lookup failed", itemsError?.message ?? historyError?.message ?? statusesError?.message);
    return response(request, 500, { error: "We could not load this order right now" });
  }
  return response(request, 200, { order: { ...order, items, history, statuses } });
});
