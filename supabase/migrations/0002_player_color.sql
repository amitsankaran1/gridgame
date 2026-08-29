-- Players pick their own dot colour. One colour, everywhere: it lives on the
-- player and is joined at read time, so changing it repaints past boards too.
-- Deliberately not snapshotted the way plots.initials is — initials identify you
-- on a given week, colour is just how you like to look.
alter table players add column if not exists color text
  check (color is null or color in
    ('clay','moss','plum','sky','ochre','teal','rose','slate'));
