// Voegt alle migraties samen tot één bestand dat je in één keer in de Supabase SQL Editor plakt.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'supabase/migrations';
const parts = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => `-- ════════ ${f} ════════\n${readFileSync(`${dir}/${f}`, 'utf8')}`);

writeFileSync(
  'supabase/setup-productie.sql',
  `-- BE STRONG — volledige database-installatie (GEGENEREERD door scripts/gen-setup-sql.mjs).
-- Gebruik: Supabase › SQL Editor › New query › alles plakken › Run. Eén keer uitvoeren op een leeg project.\n\n` +
    parts.join('\n\n'),
);
console.log(`supabase/setup-productie.sql gemaakt uit ${parts.length} migraties.`);
