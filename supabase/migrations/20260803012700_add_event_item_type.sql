-- Allow item type "event" alongside existing idea types.
alter table public.items
  drop constraint if exists items_type_check;

alter table public.items
  add constraint items_type_check
  check (type in ('restaurant','food_idea','tourist_spot','movie','city','event'));
