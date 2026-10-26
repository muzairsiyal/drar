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
    console.error("Order function is missing Supabase environment configuration");
    return response(request, 503, { error: "Checkout is not configured yet" });
  }

  let rawBody: string;
  let input: Record<string, unknown>;
  try {
    rawBody = await request.text();
  } catch {
    return response(request, 400, { error: "Could not read request body" });
  }
  if (new TextEncoder().encode(rawBody).length > 16_384) return response(request, 413, { error: "Request is too large" });
  try {
    input = JSON.parse(rawBody);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected a JSON object");
  } catch {
    return response(request, 400, { error: "Invalid JSON body" });
  }

  const customer = input.customer;
  const items = input.items;
  if (!customer || typeof customer !== "object" || Array.isArray(customer) || !Array.isArray(items) || items.length < 1 || items.length > 30) {
    return response(request, 400, { error: "Customer details and order items are required" });
  }
  if (input.payment_method !== "cod") {
    return response(request, 400, { error: "Online payments are not enabled yet" });
  }

  const fields = customer as Record<string, unknown>;
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
  const phone = typeof fields.phone === "string" ? fields.phone.trim() : "";
  const address = typeof fields.address === "string" ? fields.address.trim() : "";
  const city = typeof fields.city === "string" ? fields.city.trim() : "";
  if (name.length < 1 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
    || phone.length < 5 || phone.length > 40 || address.length < 5 || address.length > 500
    || city.length < 1 || city.length > 100) {
    return response(request, 400, { error: "Please provide valid customer and delivery details" });
  }

  const normalizedItems: Array<{ product_id: number; quantity: number }> = [];
  const productIds = new Set<number>();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return response(request, 400, { error: "Invalid order item" });
    const productId = (item as Record<string, unknown>).product_id;
    const quantity = (item as Record<string, unknown>).quantity;
    if (typeof productId !== "number" || !Number.isSafeInteger(productId) || productId < 1
      || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return response(request, 400, { error: "Invalid product or quantity" });
    }
    if (productIds.has(productId)) return response(request, 400, { error: "Duplicate products are not allowed in the order" });
    productIds.add(productId);
    normalizedItems.push({ product_id: productId, quantity });
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

  const trackingToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await serviceClient.rpc("create_cod_order", {
    p_user_id: userId,
    p_customer_name: name,
    p_customer_email: email,
    p_customer_phone: phone,
    p_delivery_address: address,
    p_delivery_city: city,
    p_items: normalizedItems,
    p_tracking_token_hash: await hashToken(trackingToken),
  });

  if (error || !data?.[0]) {
    console.error("COD order creation failed", error?.message ?? "No order was returned");
    return response(request, 400, { error: "We could not place your order. Check availability and try again." });
  }

  const order = data[0] as { id: string; order_number: string; subtotal_pkr: number; shipping_pkr: number; total_pkr: number; status: string };
  return response(request, 201, {
    order: {
      id: order.id,
      order_number: order.order_number,
      subtotal_pkr: order.subtotal_pkr,
      shipping_pkr: order.shipping_pkr,
      total_pkr: order.total_pkr,
      payment_method: "cod",
      payment_status: "unpaid",
      status: order.status,
    },
    guest_tracking_token: userId ? null : trackingToken,
  });
});
