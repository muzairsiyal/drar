create table public.wishlist_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create unique index wishlist_lists_one_default_idx
  on public.wishlist_lists (user_id)
  where is_default;

create table public.wishlist_list_items (
  wishlist_id uuid not null references public.wishlist_lists(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

insert into public.wishlist_lists (user_id, name, is_default)
select distinct user_id, 'Wishlist', true
from public.wishlist_items
on conflict (user_id, name) do nothing;

insert into public.wishlist_list_items (wishlist_id, product_id, created_at)
select lists.id, items.product_id, items.created_at
from public.wishlist_items items
join public.wishlist_lists lists
  on lists.user_id = items.user_id
 and lists.name = 'Wishlist'
on conflict (wishlist_id, product_id) do nothing;

alter table public.wishlist_lists enable row level security;
alter table public.wishlist_list_items enable row level security;

revoke all on public.wishlist_lists, public.wishlist_list_items from anon, authenticated;
grant select, insert, update, delete on public.wishlist_lists, public.wishlist_list_items to authenticated;
grant all on public.wishlist_lists, public.wishlist_list_items to service_role;

create policy "Customers manage own wishlist lists"
on public.wishlist_lists for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Customers manage items in own wishlist lists"
on public.wishlist_list_items for all to authenticated
using (
  exists (
    select 1 from public.wishlist_lists
    where wishlist_lists.id = wishlist_list_items.wishlist_id
      and wishlist_lists.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.wishlist_lists
    where wishlist_lists.id = wishlist_list_items.wishlist_id
      and wishlist_lists.user_id = (select auth.uid())
  )
);
