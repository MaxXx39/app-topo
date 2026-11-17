// Test laser (0.269.0) : « Enreg. » range le point visé dans le levé libre « LV-Test laser » (points TL-n),
// pour le voir sur le plan ; l'export CSV reprend toutes les mesures de la séance (stations, laser, cap…).
import { creerListeDeLevee, nommerListeDeLevee } from './leve-direct.js';
import { nouvelIdentifiant, PREFIXE_LEVE } from './surface.js';
import { fixe3 } from './format.js';

export const NOM_LEVE_TEST_LASER = `${PREFIXE_LEVE}Test laser`;

/**
 * Range un point { est, nord, altitude, methode ('cap' / 'deux stations') } dans « LV-Test laser » (créé s'il manque).
 * nomsPris : noms déjà utilisés dans le projet. Renvoie { levee, point } ou { erreur }.
 */
export function rangerPointLaser(projet, point, nomsPris = new Set(), maintenant = new Date()) {
  if (!point || !Number.isFinite(point.est) || !Number.isFinite(point.nord)) return { erreur: 'aucun point calculé' };
  projet.autres ??= [];
  let levee = projet.autres.find((a) => a.nom === NOM_LEVE_TEST_LASER);
  if (!levee) {
    const leve = creerListeDeLevee(projet);
    levee = { id: nouvelIdentifiant(), nom: NOM_LEVE_TEST_LASER, nature: 'autres', leveId: leve.id, contour: [], lignesRupture: [], points: [] };
    projet.autres.push(levee);
    nommerListeDeLevee(projet, levee);
  }
  const leve = projet.leves.find((l) => l.id === levee.leveId);
  if (!leve) return { erreur: 'liste du levé « Test laser » introuvable' };
  const numeros = leve.points.map((p) => /^TL-(\d+)$/.exec(p.nom)?.[1]).filter(Boolean).map(Number);
  let numero = Math.max(0, ...numeros) + 1;
  while (nomsPris.has(`TL-${numero}`)) numero += 1;
  const mm = (v) => Math.round(v * 1000) / 1000;
  const nouveau = {
    nom: `TL-${numero}`,
    est: mm(point.est),
    nord: mm(point.nord),
    altitude: Number.isFinite(point.altitude) ? mm(point.altitude) : null,
    creeLe: maintenant.toISOString(),
    remarque: `Test laser (${point.methode ?? 'cap'})`,
  };
  leve.points.push(nouveau);
  levee.points.push(nouveau.nom);
  return { levee, point: nouveau };
}

const COLONNES = [
  ['heure', 'Heure'], ['essai', 'Essai'], ['nom', 'Nom'],
  ['est', 'Est'], ['nord', 'Nord'], ['altitude', 'Altitude'],
  ['stationEst', 'Station Est'], ['stationNord', 'Station Nord'], ['stationAltitude', 'Station altitude'],
  ['distance', 'Distance laser'], ['angle', 'Angle vertical'],
  ['cap', 'Cap lu'], ['ecartTypeCap', 'Écart-type cap'], ['correction', 'Correction cap'], ['azimut', 'Azimut'],
  ['inclinaison', 'Inclinaison canne'], ['ecart', 'Écart cap - azimut'],
  ['dEst', 'dEst'], ['dNord', 'dNord'], ['d2d', 'Écart 2D'], ['dAlt', 'Écart altitude'], ['remarque', 'Remarque'],
];

const DECIMALES_ANGLE = new Set(['angle', 'cap', 'ecartTypeCap', 'correction', 'azimut', 'inclinaison', 'ecart']);

function champCsv(cle, valeur) {
  if (valeur == null || valeur === '') return '';
  if (typeof valeur === 'number') return DECIMALES_ANGLE.has(cle) ? valeur.toFixed(3) : fixe3(valeur);
  const texte = String(valeur);
  return /[;"\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

/** CSV (séparateur « ; », point décimal) des lignes de la séance : objets aux clés de COLONNES. */
export function csvTestLaser(lignes) {
  const tete = COLONNES.map(([, titre]) => titre).join(';');
  const corps = lignes.map((l) => COLONNES.map(([cle]) => champCsv(cle, l[cle])).join(';'));
  return [tete, ...corps].join('\r\n') + '\r\n';
}
