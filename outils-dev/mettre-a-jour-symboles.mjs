// Outil pour Claude (0.320.2) : met à jour (ou ajoute) dans la bibliothèque livrée (symboles-base.json) des symboles dessinés
// dans Topo (symboles-retouches.js), sans avoir le DXF de blocs d'origine (Base_2023.dxf).
// Usage : node outils-dev/mettre-a-jour-symboles.mjs "Cône" "Fourgon benne"
import { readFileSync, writeFileSync } from 'node:fs';
import { retoucherBibliotheque } from '../src/topo/symboles-retouches.js';

const noms = process.argv.slice(2);
if (!noms.length) throw new Error('Donnez le nom d\'au moins un symbole.');
const chemin = new URL('../src/plans-chantier/symboles-base.json', import.meta.url);
const base = JSON.parse(readFileSync(chemin, 'utf8'));
const refaits = retoucherBibliotheque(structuredClone(base.symboles));
for (const nom of noms) {
  const neuf = refaits.filter((s) => s.nom === nom).at(-1);
  if (!neuf) throw new Error(`« ${nom} » : pas dans symboles-retouches.js`);
  const i = base.symboles.findIndex((s) => s.nom === nom);
  if (i >= 0) base.symboles[i] = { ...neuf, cle: base.symboles[i].cle };
  else base.symboles.push(neuf);
  console.log(`${i >= 0 ? 'Remplacé' : 'Ajouté'} : ${nom} (${neuf.primitives.length} primitives)`);
}
writeFileSync(chemin, JSON.stringify(base));
