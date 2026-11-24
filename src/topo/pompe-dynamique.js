// Plans de chantier (0.305.0) : camion pompe à béton réglable : mât plié ou déplié, longueur du mât, mât tourné par rapport
// au camion (comme la tourelle d'une pelle). Caisse blanche avec « Pompe » (demande de l'utilisateur du 24.11).
import { pompeABeton } from './symboles-vehicules.js';
import { versSymbole } from './symboles-retouches.js';

export const CLE_POMPE = 'dyn:pompe';
export const LONGUEUR_POMPE = { min: 16, max: 66, depart: 28 };
const memoire = new Map();

/** Symbole d'une pompe { deploye (bool), longueur (m du mât déplié), tourelle (° du mât) } ; point de base = centre du camion. */
export function pompeDynamique(o = {}) {
  const deploye = o.deploye !== false;
  const longueur = Math.max(LONGUEUR_POMPE.min, Math.min(LONGUEUR_POMPE.max, Number(o.longueur) || LONGUEUR_POMPE.depart));
  const tourelle = deploye ? Math.round((Number(o.tourelle) || 0) * 10) / 10 : 0;
  const cle = `${deploye}|${longueur}|${tourelle}`;
  if (memoire.has(cle)) return memoire.get(cle);
  if (memoire.size > 60) memoire.clear();
  // Le nom sert aussi de nom de bloc DXF : il porte les réglages.
  const nom = deploye ? `Pompe à béton ${longueur} m${tourelle ? ` T${Math.round(tourelle)}` : ''}` : 'Pompe à béton (pliée)';
  const sym = versSymbole(nom, 'Véhicules', pompeABeton(deploye, { longueur, tourelle }), { prefixe: 'dyn:', centre: false });
  memoire.set(cle, { ...sym, cle: CLE_POMPE, nom });
  return memoire.get(cle);
}
