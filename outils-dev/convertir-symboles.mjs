// Fabrique la bibliothèque de symboles livrée avec Topo (src/plans-chantier/symboles-base.json) à partir du DXF de
// blocs de l'utilisateur (Base_2023.dxf, en mètres ; décision du 23.11 : symboles intégrés à l'appli).
// Usage : node outils-dev/convertir-symboles.mjs chemin/Base_2023.dxf
// Même convertisseur que l'import d'un DXF de blocs dans l'appli (topo/blocs-dxf.js + topo/symboles.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { lireBlocsDxf } from '../src/topo/blocs-dxf.js';
import { bibliothequeDepuisBlocs } from '../src/topo/symboles.js';
import { texteDuDxf } from '../src/topo/dxf-plan.js';

const chemin = process.argv[2];
if (!chemin) {
  console.error('Donne le chemin du DXF de blocs.');
  process.exit(1);
}
const { blocs, erreur } = lireBlocsDxf(texteDuDxf(new Uint8Array(readFileSync(chemin))));
if (erreur) {
  console.error(erreur);
  process.exit(1);
}
const symboles = bibliothequeDepuisBlocs(blocs, 'base:');
writeFileSync(new URL('../src/plans-chantier/symboles-base.json', import.meta.url), JSON.stringify({ source: 'Base_2023.dxf', symboles }));
console.log(`${symboles.length} symboles (${symboles.filter((s) => !s.cache).length} proposés) écrits.`);
