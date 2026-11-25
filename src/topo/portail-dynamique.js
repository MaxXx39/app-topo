// Plans de chantier (0.320.2) : portail réglable : portail à 2 vantaux, portillon à 1 vantail ou portail coulissant, avec la
// largeur de passage au choix. Il offre à l'accroche (et à la prise pour le déplacer) le milieu de chacun de ses poteaux et
// le milieu de l'ouverture : une clôture se colle sur l'axe des poteaux.
import { portailGeneral } from './symboles-dessines.js';
import { versSymbole } from './symboles-retouches.js';

export const CLE_PORTAIL = 'dyn:portail';
export const GENRES_PORTAIL = [['portail', 'Portail (2 vantaux)'], ['portillon', 'Portillon (1 vantail)'], ['coulissant', 'Portail coulissant']];
/** Largeur de passage (m) : départ, mini, maxi, selon le genre. */
export const PASSAGE_PORTAIL = { portail: { depart: 5, min: 2, max: 14 }, portillon: { depart: 1, min: 0.6, max: 2.5 }, coulissant: { depart: 4, min: 2, max: 14 } };
const memoire = new Map();

/** Réglages valides d'un portail posé : { genre, passage (m), charniere }. */
export function reglagesPortail(o = {}) {
  const genre = PASSAGE_PORTAIL[o.genre] ? o.genre : 'portail';
  const lim = PASSAGE_PORTAIL[genre];
  const passage = Math.min(lim.max, Math.max(lim.min, Number(o.passage) || lim.depart));
  return { genre, passage: Math.round(passage * 100) / 100, charniere: o.charniere === 'droite' ? 'droite' : 'gauche' };
}

/** Symbole { cle, nom, primitives, boite, prises } d'un portail posé : prises = milieu des 2 poteaux et de l'ouverture. */
export function portailDynamique(o = {}) {
  const r = reglagesPortail(o);
  const cle = `${r.genre}|${r.passage}|${r.charniere}`;
  if (memoire.has(cle)) return memoire.get(cle);
  if (memoire.size > 80) memoire.clear();
  const nom = `${GENRES_PORTAIL.find(([v]) => v === r.genre)[1].replace(/ \(.*\)/, '')} ${r.passage.toFixed(2)} m`;
  const sym = versSymbole(nom, 'Sécurité', portailGeneral(r), { prefixe: 'dyn:', centre: false });
  const d = r.passage / 2 + 0.15;
  memoire.set(cle, { ...sym, cle: CLE_PORTAIL, nom, prises: [[-d, 0], [d, 0], [0, 0]] });
  return memoire.get(cle);
}
