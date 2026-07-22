-- Customer badge colours (Andrew, 20 Jul 2026): each customer gets a fill
-- and font colour so their badge is recognisable at a glance on the
-- production board. Stored as hex; defaults are the TIC lime pairing.
alter table customers
  add column badge_bg text not null default '#B0CB1F',
  add column badge_text text not null default '#24292E';

alter table customers
  add constraint customers_badge_bg_hex check (badge_bg ~ '^#[0-9a-fA-F]{6}$'),
  add constraint customers_badge_text_hex check (badge_text ~ '^#[0-9a-fA-F]{6}$');
