-- Standaard meettypes (user_id null). Dezelfde ids staan in src/data/measurementTypes.ts.
insert into public.measurement_types (id, user_id, key, name, unit, kind, sort_order) values
  ('6f1c2a10-0000-4000-8000-000000000001', null, 'bodyweight',  'Lichaamsgewicht', 'kg', 'mass',    1),
  ('6f1c2a10-0000-4000-8000-000000000002', null, 'body_fat',    'Vetpercentage',   '%',  'percent', 2),
  ('6f1c2a10-0000-4000-8000-000000000003', null, 'muscle_mass', 'Spiermassa',      'kg', 'mass',    3),
  ('6f1c2a10-0000-4000-8000-000000000004', null, 'waist',       'Taille',          'cm', 'length',  4),
  ('6f1c2a10-0000-4000-8000-000000000005', null, 'chest',       'Borst',           'cm', 'length',  5),
  ('6f1c2a10-0000-4000-8000-000000000006', null, 'arm',         'Arm',             'cm', 'length',  6),
  ('6f1c2a10-0000-4000-8000-000000000007', null, 'thigh',       'Bovenbeen',       'cm', 'length',  7),
  ('6f1c2a10-0000-4000-8000-000000000008', null, 'hip',         'Heup',            'cm', 'length',  8)
on conflict (id) do update set key = excluded.key, name = excluded.name, unit = excluded.unit,
  kind = excluded.kind, sort_order = excluded.sort_order;
