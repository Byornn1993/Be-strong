import type { MeasurementType } from '@/lib/db/types';

// Zelfde ids als supabase/migrations/20261023000500_measurement_types.sql
const base = { userId: null, serverUpdatedAt: null, deletedAt: null } as const;

export const BODYWEIGHT_TYPE_ID = '6f1c2a10-0000-4000-8000-000000000001';

export const STANDARD_MEASUREMENT_TYPES: MeasurementType[] = [
  { ...base, id: BODYWEIGHT_TYPE_ID, key: 'bodyweight', name: 'Lichaamsgewicht', unit: 'kg', kind: 'mass', sortOrder: 1 },
  { ...base, id: '6f1c2a10-0000-4000-8000-000000000002', key: 'body_fat', name: 'Vetpercentage', unit: '%', kind: 'percent', sortOrder: 2 },
  { ...base, id: '6f1c2a10-0000-4000-8000-000000000003', key: 'muscle_mass', name: 'Spiermassa', unit: 'kg', kind: 'mass', sortOrder: 3 },
  { ...base, id: '6f1c2a10-0000-4000-8000-000000000004', key: 'waist', name: 'Taille', unit: 'cm', kind: 'length', sortOrder: 4 },
  { ...base, id: '6f1c2a10-0000-4000-8000-000000000005', key: 'chest', name: 'Borst', unit: 'cm', kind: 'length', sortOrder: 5 },
  { ...base, id: '6f1c2a10-0000-4000-8000-000000000006', key: 'arm', name: 'Arm', unit: 'cm', kind: 'length', sortOrder: 6 },
  { ...base, id: '6f1c2a10-0000-4000-8000-000000000007', key: 'thigh', name: 'Bovenbeen', unit: 'cm', kind: 'length', sortOrder: 7 },
  { ...base, id: '6f1c2a10-0000-4000-8000-000000000008', key: 'hip', name: 'Heup', unit: 'cm', kind: 'length', sortOrder: 8 },
];
