# Supabase setup

The static storefront uses the Supabase browser client from jsDelivr. Its project URL and **publishable** key are in `../supabase-client.js`. A publishable key is intended to be visible in the browser; database access is restricted by the migration's row-level security policies. Never put a service-role key or payment secret in that file.

## Current project deployment

The migrations `20261026170000_store_backend.sql`, `20261026180000_store_admin.sql`, `20261026190000_newsletter_events.sql`, and `20261026214000_customer_portal.sql` have been applied to project `qyoujyufbdymhenywnir` through the Supabase SQL Editor. The newsletter and event Edge Functions are deployed. The existing storefront Edge Functions are deployed with gateway JWT verification disabled because each function handles optional user authentication itself. `order-status` was updated to return order history and active status choices.

All three migrations were run manually, so they are not recorded in the Supabase CLI migration history. Before using `supabase db push` on this project, register these versions as already applied:

```powershell
npx supabase migration repair --status applied 20261026170000
npx supabase migration repair --status applied 20261026180000
npx supabase migration repair --status applied 20261026190000
npx supabase migration repair --status applied 20261026214000
npx supabase db push
```

The `ALLOWED_ORIGINS` secret currently contains the two local development origins (`http://127.0.0.1:8000` and `http://localhost:8000`). Add the exact production website origin before using the deployed checkout or support form.

## Deploy the database and functions

From the project root in PowerShell, install/use the Supabase CLI, authenticate, and link this project:

```powershell
npx supabase login
npx supabase link --project-ref qyoujyufdbymhenywnir
```

For a new Supabase project, apply the migration with `npx supabase db push`. For this project, first register the migration as applied using the command above; subsequent migrations can then be applied with `npx supabase db push`.

Deploy the server-side functions:

```powershell
npx supabase functions deploy create-order
npx supabase functions deploy order-status
npx supabase functions deploy submit-complaint
npx supabase functions deploy newsletter
npx supabase functions deploy send-newsletter-event
```

Set the allowed origins to the exact origins from which the deployed storefront and local development server will be opened. Replace the example domain with the real one:

```powershell
npx supabase secrets set ALLOWED_ORIGINS="https://your-domain.example,http://127.0.0.1:8000,http://localhost:8000"
```

The functions use Supabase's injected `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` server-side environment variables. Do not paste or commit those secrets.

## Configure newsletter email delivery

The storefront newsletter uses single opt-in. Subscriptions are stored in Supabase and event announcements are sent by the `send-newsletter-event` Edge Function through Resend. Before sending:

1. Create a Resend account, verify a sending domain you control, and create an API key.
2. In Supabase Dashboard → Edge Functions → Secrets, set `RESEND_API_KEY`, `NEWSLETTER_FROM_EMAIL` (for example, `DR.AR <news@your-verified-domain.example>`), and `PUBLIC_SITE_URL` (the canonical public storefront URL; include the HTML filename in the path if the site is not served from the domain root).
3. Ensure `ALLOWED_ORIGINS` includes the storefront's exact origin.
4. Apply the newsletter migration and deploy the `newsletter` and `send-newsletter-event` functions (already done for the current project).

Never add the Resend key to storefront code or share it in chat. The admin's Newsletter & events page saves drafts separately; an administrator must explicitly send each announcement. Delivery records prevent retrying email already marked as sent. Each message includes an unsubscribe link.

## Create the first administrator

First create your own account through the website and confirm its email if confirmation is enabled. Find that account's UUID in Supabase Authentication, then run this in the Supabase SQL Editor, replacing the example UUID:

```sql
update public.profiles
set role = 'admin'
where id = '00000000-0000-0000-0000-000000000000';
```

## Access the private admin console

Open `/admin.html` on the same website. It provides sign-in only (there is no admin signup); access is granted only to accounts whose `public.profiles.role` is `admin`. Promote the owner account using the SQL above. The console manages products, categories, orders, editable order statuses, support messages, reviews, and store settings. Removing an order status archives it so existing order and tracking history keeps its label.

## Configure authentication redirects

In Supabase Authentication URL Configuration, set the deployed storefront as the Site URL and add its URL plus the local development URL to the allowed redirect URLs. Email confirmation behavior and production email delivery are configured in Supabase Authentication.

## Current scope and remaining work

- Connected in the storefront: public catalog and published reviews, optional email/password accounts, guest and account-backed named wishlists, the customer portal (purchases, tracking, inquiries, and profile settings), guest COD order submission, guest tracking, support ticket submission, and newsletter signup/unsubscribe.
- Admin console: `/admin.html`, protected by the signed-in profile's admin role. It manages products, categories, orders/statuses, support, reviews, store settings, newsletter subscribers, and event announcement drafts.
- COD and support calls require the database migration and their Edge Functions to be deployed first; they are now deployed to the configured Supabase project.
- Online payment is intentionally disabled until a merchant gateway is selected. Gateway checkout and verified payment webhooks must be implemented server-side before enabling it.
- Newsletter signup, unsubscribe, admin event drafts, and delivery functions are deployed. Live email campaigns still require a Resend API key, verified sender address, and the `PUBLIC_SITE_URL` Supabase secrets. Review database policies and complete the payment flow before launch.
- Order emails and operational account recovery/notification workflows are not yet implemented.
