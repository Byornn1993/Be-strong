// GitHub Pages kent geen SPA-rewrites. Een kopie van index.html als 404.html zorgt dat
// diepe links (bv. /be-strong/history/123) toch de app laden; React Router neemt het dan over.
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html ontbreekt — eerst vite build draaien.');
  process.exit(1);
}
copyFileSync('dist/index.html', 'dist/404.html');
// Geen Jekyll-verwerking op GitHub Pages (anders worden bestanden met _ genegeerd).
writeFileSync('dist/.nojekyll', '');
console.log('SPA-fallback: dist/404.html en dist/.nojekyll aangemaakt.');
