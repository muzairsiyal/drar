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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]!);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return response(request, 204, {});
  if (request.method !== "POST") return response(request, 405, { error: "Method not allowed" });
  const origin = request.headers.get("origin");
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (origin && !allowedOrigins.includes(origin)) return response(request, 403, { error: "Origin is not allowed" });
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("NEWSLETTER_FROM_EMAIL");
  const siteUrl = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/+$/, "");
  if (!apiKey || !from || !siteUrl || !Deno.env.get("SUPABASE_URL") || !Deno.env.get("SUPABASE_ANON_KEY") || !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    console.error("Newsletter sender is missing Resend or Supabase configuration");
    return response(request, 503, { error: "Email sending is not configured. Set the newsletter sender secrets first." });
  }

  let input: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > 2048) return response(request, 413, { error: "Request is too large" });
    input = JSON.parse(rawBody);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected a JSON object");
  } catch {
    return response(request, 400, { error: "Invalid JSON body" });
  }
  const eventId = Number(input.event_id);
  if (!Number.isSafeInteger(eventId) || eventId < 1) return response(request, 400, { error: "Choose a valid event" });

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");
  if (!accessToken || accessToken === authorization) return response(request, 401, { error: "Administrator sign-in is required" });
  const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) return response(request, 401, { error: "Administrator session is invalid or expired" });

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", authData.user.id).single();
  if (profileError || profile?.role !== "admin") return response(request, 403, { error: "Administrator access is required" });

  const { data: event, error: eventError } = await client.from("newsletter_events")
    .select("id,title,message,location,event_at,status")
    .eq("id", eventId)
    .single();
  if (eventError || !event) return response(request, 404, { error: "Event was not found" });
  if (!["draft", "failed"].includes(event.status)) {
    return response(request, 409, { error: "This event is already being sent or has been sent" });
  }
  const { data: startedEvent, error: startError } = await client.from("newsletter_events")
    .update({ status: "sending", sent_at: null })
    .eq("id", eventId)
    .eq("status", event.status)
    .select("id")
    .maybeSingle();
  if (startError) {
    console.error("Could not start newsletter event", startError.message);
    return response(request, 500, { error: "Could not start sending this event" });
  }
  if (!startedEvent) return response(request, 409, { error: "This event has already started sending" });

  const { data: subscribers, error: subscribersError } = await client.from("newsletter_subscribers")
    .select("id,email,unsubscribe_token")
    .eq("active", true)
    .order("id");
  if (subscribersError) {
    console.error("Could not load newsletter subscribers", subscribersError.message);
    await client.from("newsletter_events").update({ status: "failed" }).eq("id", eventId);
    return response(request, 500, { error: "Could not load newsletter subscribers" });
  }
  if (!subscribers.length) {
    await client.from("newsletter_events").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", eventId);
    return response(request, 200, { sent: 0, failed: 0, message: "There are no active subscribers yet" });
  }

  const { error: deliveryError } = await client.from("newsletter_deliveries").upsert(
    subscribers.map((subscriber) => ({
      event_id: eventId,
      subscriber_id: subscriber.id,
      recipient_email: subscriber.email,
      status: "pending",
    })),
    { onConflict: "event_id,recipient_email", ignoreDuplicates: true },
  );
  if (deliveryError) {
    console.error("Could not prepare newsletter deliveries", deliveryError.message);
    await client.from("newsletter_events").update({ status: "failed" }).eq("id", eventId);
    return response(request, 500, { error: "Could not prepare event recipients" });
  }

  const { data: deliveries, error: loadError } = await client.from("newsletter_deliveries")
    .select("id,recipient_email,subscriber_id,status")
    .eq("event_id", eventId)
    .neq("status", "sent")
    .order("recipient_email");
  if (loadError) {
    console.error("Could not load pending newsletter deliveries", loadError.message);
    await client.from("newsletter_events").update({ status: "failed" }).eq("id", eventId);
    return response(request, 500, { error: "Could not load pending event recipients" });
  }
  const subscriberByEmail = new Map(subscribers.map((subscriber) => [subscriber.email, subscriber]));
  const activeDeliveries = deliveries.filter((delivery) => subscriberByEmail.has(delivery.recipient_email));
  const eventDate = event.event_at ? new Date(event.event_at).toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "";
  const content = `${event.message}${event.location ? `\n\nLocation: ${event.location}` : ""}${eventDate ? `\n\nWhen: ${eventDate}` : ""}`;
  let sent = 0;
  let failed = 0;

  for (let start = 0; start < activeDeliveries.length; start += 100) {
    const batch = activeDeliveries.slice(start, start + 100);
    const messages = batch.map((delivery) => {
      const subscriber = subscriberByEmail.get(delivery.recipient_email);
      const unsubscribeUrl = new URL(siteUrl);
      unsubscribeUrl.hash = subscriber ? `/newsletter/unsubscribe/${subscriber.unsubscribe_token}` : "/newsletter";
      const unsubscribeLink = unsubscribeUrl.toString();
      return {
        from,
        to: [delivery.recipient_email],
        subject: `DR.AR: ${event.title}`,
        text: `${content}\n\nYou received this because you subscribed to DR.AR news.\nUnsubscribe: ${unsubscribeLink}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#26382d;line-height:1.7"><p style="letter-spacing:.18em">DR.AR · THOUGHTFULLY YOURS</p><h1>${escapeHtml(event.title)}</h1><p>${escapeHtml(content).replace(/\n/g, "<br>")}</p><hr><p style="font-size:12px;color:#68756a">You received this because you subscribed to DR.AR news. <a href="${escapeHtml(unsubscribeLink)}">Unsubscribe</a></p></div>`,
      };
    });
    const attemptedAt = new Date().toISOString();
    let resendResponse: Response | null = null;
    let requestError = "";
    try {
      resendResponse = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
    } catch (error) {
      requestError = error instanceof Error ? error.message : "Could not reach the email provider";
    }
    let result: { data?: Array<{ id?: string }> ; message?: string };
    try {
      result = resendResponse ? await resendResponse.json() : {};
    } catch {
      result = {};
    }
    const providerIds = Array.isArray(result.data) ? result.data : [];
    const batchSucceeded = Boolean(resendResponse?.ok && providerIds.length === batch.length);
    for (let index = 0; index < batch.length; index++) {
      const delivery = batch[index];
      const success = batchSucceeded && Boolean(providerIds[index]?.id);
      const { error } = await client.from("newsletter_deliveries").update({
        status: success ? "sent" : "failed",
        provider_id: success ? providerIds[index].id : null,
        error: success ? null : String(requestError || result.message || `Email provider returned HTTP ${resendResponse?.status ?? "network error"}`).slice(0, 1000),
        attempted_at: attemptedAt,
        sent_at: success ? attemptedAt : null,
      }).eq("id", delivery.id);
      if (error) {
        console.error("Could not record newsletter delivery", delivery.id, error.message);
        failed++;
      } else if (success) sent++;
      else failed++;
    }
  }

  const finalStatus = failed ? "failed" : "sent";
  const { error: finishError } = await client.from("newsletter_events")
    .update({ status: finalStatus, sent_at: failed ? null : new Date().toISOString() })
    .eq("id", eventId);
  if (finishError) {
    console.error("Could not finish newsletter event", finishError.message);
    return response(request, 500, { error: "Emails were processed but the event status could not be saved", sent, failed });
  }
  return response(request, 200, { sent, failed });
});
