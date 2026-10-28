create table public.site_content (
  id boolean primary key default true check (id),
  draft_content jsonb not null,
  published_content jsonb not null,
  updated_at timestamptz not null default now(),
  published_at timestamptz not null default now()
);

insert into public.site_content (id, draft_content, published_content)
values (
  true,
  '{
    "header": {
      "logo_text": "DR.AR",
      "logo_image_url": "",
      "nav_items": [
        {"label":"Home","url":"#/","visible":true},
        {"label":"Shop","url":"#/shop","visible":true},
        {"label":"Reviews","url":"#/reviews","visible":true},
        {"label":"Support","url":"#/complaints","visible":true},
        {"label":"Track order","url":"#/track","visible":true},
        {"label":"Wishlist","url":"#/wishlist","visible":true}
      ],
      "cta_label": "",
      "cta_url": ""
    },
    "homepage_sections": [
      {"key":"hero","type":"hero","enabled":true,"sort_order":0,"eyebrow":"Thoughtfully yours · DR.AR","title":"Care that feels like you.","description":"Considered skincare essentials, thoughtfully formulated to make your everyday ritual feel a little more intentional.","image_url":"","image_alt":"","cta_label":"Explore the collection","cta_url":"#/shop"},
      {"key":"brand_history","type":"story","enabled":false,"sort_order":1,"eyebrow":"Brand story","title":"Our story","description":"","image_url":"","image_alt":"","cta_label":"","cta_url":""},
      {"key":"factory","type":"factory","enabled":false,"sort_order":2,"eyebrow":"Our manufacturing","title":"Made with care","description":"","image_url":"","image_alt":"","cta_label":"","cta_url":""},
      {"key":"philosophy","type":"story","enabled":true,"sort_order":3,"eyebrow":"Our philosophy","title":"A little more intention. A lot more you.","description":"We believe care should feel personal, uncomplicated and grounded in thoughtful choices. DR.AR brings together everyday essentials and a calmer approach to your daily ritual.","image_url":"","image_alt":"","cta_label":"Find your everyday","cta_url":"#/shop"},
      {"key":"benefits","type":"benefits","enabled":true,"sort_order":4,"eyebrow":"The DR.AR difference","title":"Made for your everyday.","description":"","image_url":"","image_alt":"","cta_label":"","cta_url":"","items":[{"title":"Thoughtful by design","text":"Products selected around simple routines and considered care."},{"title":"Clarity over clutter","text":"A focused collection that keeps your daily ritual uncomplicated."},{"title":"Care that feels personal","text":"Find your favourites and build a routine that works for you."}]},
      {"key":"reviews","type":"reviews","enabled":true,"sort_order":5,"eyebrow":"Kind words, shared","title":"What our customers say.","description":"","image_url":"","image_alt":"","cta_label":"Read all reviews","cta_url":"#/reviews"},
      {"key":"newsletter","type":"newsletter","enabled":true,"sort_order":6,"eyebrow":"A note from DR.AR","title":"Make room for your ritual.","description":"Join our newsletter for thoughtful updates, product news and local DR.AR events.","image_url":"","image_alt":"","cta_label":"Subscribe","cta_url":""}
    ],
    "footer": {
      "brand_description":"Thoughtfully considered skincare, haircare and oral care essentials. Care for your everyday ritual.",
      "copyright":"© 2026 DR.AR. All rights reserved.",
      "contact_email":"hello@drar.com",
      "contact_phone":"+92 314 1298954",
      "location":"Karachi, Pakistan",
      "social_links":[
        {"label":"Instagram","url":"https://www.instagram.com/"},
        {"label":"Facebook","url":""},
        {"label":"LinkedIn","url":""},
        {"label":"TikTok","url":""}
      ],
      "links":[
        {"label":"Customer Reviews","url":"#/reviews","visible":true},
        {"label":"Wishlist","url":"#/wishlist","visible":true},
        {"label":"Shopping bag","url":"#/cart","visible":true},
        {"label":"Customer support","url":"#/complaints","visible":true}
      ]
    },
    "support": {
      "intro":"Find answers to common questions or contact our support team.",
      "contact_email":"hello@drar.com",
      "contact_phone":"+92 314 1298954",
      "whatsapp_number":"923141298954",
      "faq_categories":[
        {"name":"Products and care","items":[{"question":"Suitable for sensitive skin?","answer":"Yes, all formulas are pH balanced and fragrance-light."}]},
        {"name":"Orders and delivery","items":[{"question":"Shipping time?","answer":"2-4 working days across Pakistan."}]},
        {"name":"Returns","items":[{"question":"Return policy?","answer":"7-day returns on unopened items."}]}
      ]
    }
  }'::jsonb,
  '{
    "header": {
      "logo_text": "DR.AR",
      "logo_image_url": "",
      "nav_items": [
        {"label":"Home","url":"#/","visible":true},
        {"label":"Shop","url":"#/shop","visible":true},
        {"label":"Reviews","url":"#/reviews","visible":true},
        {"label":"Support","url":"#/complaints","visible":true},
        {"label":"Track order","url":"#/track","visible":true},
        {"label":"Wishlist","url":"#/wishlist","visible":true}
      ],
      "cta_label": "",
      "cta_url": ""
    },
    "homepage_sections": [
      {"key":"hero","type":"hero","enabled":true,"sort_order":0,"eyebrow":"Thoughtfully yours · DR.AR","title":"Care that feels like you.","description":"Considered skincare essentials, thoughtfully formulated to make your everyday ritual feel a little more intentional.","image_url":"","image_alt":"","cta_label":"Explore the collection","cta_url":"#/shop"},
      {"key":"brand_history","type":"story","enabled":false,"sort_order":1,"eyebrow":"Brand story","title":"Our story","description":"","image_url":"","image_alt":"","cta_label":"","cta_url":""},
      {"key":"factory","type":"factory","enabled":false,"sort_order":2,"eyebrow":"Our manufacturing","title":"Made with care","description":"","image_url":"","image_alt":"","cta_label":"","cta_url":""},
      {"key":"philosophy","type":"story","enabled":true,"sort_order":3,"eyebrow":"Our philosophy","title":"A little more intention. A lot more you.","description":"We believe care should feel personal, uncomplicated and grounded in thoughtful choices. DR.AR brings together everyday essentials and a calmer approach to your daily ritual.","image_url":"","image_alt":"","cta_label":"Find your everyday","cta_url":"#/shop"},
      {"key":"benefits","type":"benefits","enabled":true,"sort_order":4,"eyebrow":"The DR.AR difference","title":"Made for your everyday.","description":"","image_url":"","image_alt":"","cta_label":"","cta_url":"","items":[{"title":"Thoughtful by design","text":"Products selected around simple routines and considered care."},{"title":"Clarity over clutter","text":"A focused collection that keeps your daily ritual uncomplicated."},{"title":"Care that feels personal","text":"Find your favourites and build a routine that works for you."}]},
      {"key":"reviews","type":"reviews","enabled":true,"sort_order":5,"eyebrow":"Kind words, shared","title":"What our customers say.","description":"","image_url":"","image_alt":"","cta_label":"Read all reviews","cta_url":"#/reviews"},
      {"key":"newsletter","type":"newsletter","enabled":true,"sort_order":6,"eyebrow":"A note from DR.AR","title":"Make room for your ritual.","description":"Join our newsletter for thoughtful updates, product news and local DR.AR events.","image_url":"","image_alt":"","cta_label":"Subscribe","cta_url":""}
    ],
    "footer": {
      "brand_description":"Thoughtfully considered skincare, haircare and oral care essentials. Care for your everyday ritual.",
      "copyright":"© 2026 DR.AR. All rights reserved.",
      "contact_email":"hello@drar.com",
      "contact_phone":"+92 314 1298954",
      "location":"Karachi, Pakistan",
      "social_links":[
        {"label":"Instagram","url":"https://www.instagram.com/"},
        {"label":"Facebook","url":""},
        {"label":"LinkedIn","url":""},
        {"label":"TikTok","url":""}
      ],
      "links":[
        {"label":"Customer Reviews","url":"#/reviews","visible":true},
        {"label":"Wishlist","url":"#/wishlist","visible":true},
        {"label":"Shopping bag","url":"#/cart","visible":true},
        {"label":"Customer support","url":"#/complaints","visible":true}
      ]
    },
    "support": {
      "intro":"Find answers to common questions or contact our support team.",
      "contact_email":"hello@drar.com",
      "contact_phone":"+92 314 1298954",
      "whatsapp_number":"923141298954",
      "faq_categories":[
        {"name":"Products and care","items":[{"question":"Suitable for sensitive skin?","answer":"Yes, all formulas are pH balanced and fragrance-light."}]},
        {"name":"Orders and delivery","items":[{"question":"Shipping time?","answer":"2-4 working days across Pakistan."}]},
        {"name":"Returns","items":[{"question":"Return policy?","answer":"7-day returns on unopened items."}]}
      ]
    }
  }'::jsonb
)
on conflict (id) do nothing;

alter table public.site_content enable row level security;
revoke all on public.site_content from anon, authenticated;
grant select on public.site_content to authenticated;
grant update (draft_content, published_content, published_at) on public.site_content to authenticated;

create policy "Admins read website content"
on public.site_content for select to authenticated
using ((select public.is_admin()));

create view public.published_site_content
with (security_barrier = true)
as select published_content
from public.site_content
where id = true;

grant select on public.published_site_content to anon, authenticated;

create policy "Admins manage website content"
on public.site_content for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create trigger site_content_set_updated_at
before update on public.site_content
for each row execute function public.set_updated_at();

comment on table public.site_content is
'Single-row CMS document. Public visitors read the published-only view; admins manage draft_content and publish it.';
