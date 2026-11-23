// Plans de chantier (0.297.0) : places de parking réservées, nombre de places côte à côte et couleur au choix.
// Chaque place : cadre de 2,5 × 5 m (fond transparent) et un grand P dessiné (tige + panse), tout de la même couleur.
import { plein, rectArrondi, arc } from './symboles-outils.js';
import { versSymbole } from './symboles-retouches.js';

export const CLE_PARKING = 'dyn:parking';
export const COULEUR_PARKING = '#1f5fae';
const memoire = new Map();

/** Lettre P (centrée en (cx, cy), hauteur h) : tige et panse, avec le trou de la panse. */
function lettreP(cx, cy, h, k) {
  const u = h / 1; // la lettre est dessinée pour h = 1 puis mise à l'échelle
  const P = (pts) => pts.map(([x, y]) => [cx + x * u, cy + y * u]);
  const dehors = [[-0.22, -0.5], [-0.22, 0.5], [0.04, 0.5], ...arc(0.04, 0.2, 0.3, 90, -90, 12), [0.04, -0.1], [-0.07, -0.1], [-0.07, -0.5]];
  const trou = [[-0.07, 0.4], [0.04, 0.4], ...arc(0.04, 0.2, 0.2, 90, -90, 10), [0.04, 0.0], [-0.07, 0.0]];
  return plein(k, 'peinture', P(dehors), P(trou));
}

/**
 * Symbole d'un groupe de places { nombre (1 à 30), couleur } : { cle, nom, primitives, boite… }, centré.
 */
export function parkingDynamique(o = {}) {
  const n = Math.max(1, Math.min(30, Math.round(Number(o.nombre) || 1)));
  const couleur = /^#[0-9a-f]{6}$/i.test(o.couleur ?? '') ? o.couleur : COULEUR_PARKING;
  const cle = `${n}|${couleur}`;
  if (memoire.has(cle)) return memoire.get(cle);
  if (memoire.size > 80) memoire.clear();
  const L = 2.5;
  const H = 5;
  const prims = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * L;
    prims.push(plein(couleur, 'peinture', rectArrondi(x0, 0, x0 + L, H, 0.03), rectArrondi(x0 + 0.1, 0.1, x0 + L - 0.1, H - 0.1, 0.02)));
    prims.push(lettreP(x0 + L / 2, H / 2, 1.5, couleur));
  }
  const sym = versSymbole(`Parking ${n} places ${couleur.slice(1)}`, 'Base-vie', prims, { prefixe: 'dyn:' });
  memoire.set(cle, { ...sym, cle: CLE_PARKING, nom: n > 1 ? `Parking (${n} places)` : 'Place de parking réservée' });
  return memoire.get(cle);
}
