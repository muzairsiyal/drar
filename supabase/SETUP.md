# Supabase setup

The static storefront uses the Supabase browser client from jsDelivr. Its project URL and **publishable** key are in `../supabase-client.js`. A publishable key is intended to be visible in the browser; database access is restricted by the migration's row-level security policies. Never put a service-role key or payment secret in that file.

## Current project deployment

The migrations `20261026170000_store_backend.sql`, `20261026180000_store_admin.sql`, `20261026190000_newsletter_events.sql`, and `20261026214000_customer_portal.sql` have been applied to project `qyoujyufbdymhenywnir` through the Supabase SQL Editor. The newsletter and event Edge Functions are deployed. The existing storefront Edge Functions are deployed with gateway JWT verification disabled because each function handles optional user authentication itself. `order-status` was updated to return order history and active status choices.

The four listed migrations were run manually, so they are not recorded in the Supabase CLI migration history. Before using `supabase db push` on this project, register these versions as already applied:

```powershell
npx supabase migration repair --status applied 20261026170000
npx supabase migration repair --status applied 20261026180000
npx supabase migration repair --status applied 20261026190000
npx supabase migration repair --status applied 20261026214000
npx supabase db push
```

The `ALLOWED_ORIGINS` secret currently contains the two local development origins (`http://127.0.0.1:8000` and `http://localhost:8000`). Add the exact production website origin before using the deployed checkout or support form.

## Website content CMS

The storefront CMS is defined in `migrations/20261028190000_site_content_cms.sql`. It creates a single `site_content` row with separate draft and published JSON documents. Visitors can read only published content; updates are restricted by RLS to authenticated accounts whose `profiles.role` is `admin`.

Apply this migration in the Supabase SQL Editor (the existing migrations were applied manually). The admin console then exposes **Website content**, where an administrator can edit homepage sections and display order, navigation, footer, support contact details, and FAQ categories; upload approved images to the existing public `product-images` bucket; save drafts; and publish. Draft changes do not appear on the storefront until published.

The brand-history and factory sections are initially disabled because no approved story, factory facts, or imagery have been provided. Add verified content and approved images, then publish those sections when ready. Do not publish unsupported production, capacity, exclusivity, or owner claims.

The current public website reads `published_content` directly from Supabase. If the migration has not been applied yet, the storefront logs the CMS read error and continues to use its built-in default content; this does not disable checkout or customer accounts.

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

## Configure authentication redirects and recovery email

In Supabase Authentication URL Configuration, set the deployed storefront as the Site URL and add its URL plus the local development URL to the allowed redirect URLs. Password recovery redirects to the storefront origin, so that origin must be allowlisted. Configure a production SMTP/email provider in Supabase Auth before expecting reliable recovery delivery; the storefront uses Supabase's time-limited recovery session and `updateUser` validation and does not create its own reset tokens.

Whether new users must confirm their email is a Supabase project setting, not a frontend option. If the owner chooses to allow immediate password login, disable email confirmation under Supabase Authentication → Providers → Email, after reviewing the account-security implications. The app does not bypass provider-enforced confirmation or rate limits. Keep Supabase's rate protections enabled; the login UI displays a provider-reported cooldown and a countdown only when the error contains a server-provided wait duration.

## Current scope and remaining work

- Connected in the storefront: public catalog and published reviews, optional email/password accounts, guest and account-backed named wishlists, the customer portal (purchases, tracking, inquiries, and profile settings), guest COD order submission, guest tracking, support ticket submission, newsletter signup/unsubscribe, FAQ/support content, and CMS-published site content.
- Admin console: `/admin.html`, protected by the signed-in profile's admin role. It manages products, categories, orders/statuses, support, reviews, website content, store settings, newsletter subscribers, and event announcement drafts.
- COD and support calls require the database migration and their Edge Functions to be deployed first; they are now deployed to the configured Supabase project.
- Online payment is intentionally disabled until a merchant gateway is selected. Gateway checkout and verified payment webhooks must be implemented server-side before enabling it.
- Newsletter signup, unsubscribe, admin event drafts, and delivery functions are deployed. Live email campaigns still require a Resend API key, verified sender address, and the `PUBLIC_SITE_URL` Supabase secrets. Review database policies and complete the payment flow before launch.
- Password recovery is implemented with Supabase Auth; production delivery depends on the project's email provider and redirect allowlist.
- Owner/brand-history and factory content remain unpublished until the owner supplies verified copy and approved images.
