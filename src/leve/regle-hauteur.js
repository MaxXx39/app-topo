// Règle de hauteur verticale (0.107.0) : à droite de l'écart (Implanter Altitude / Surface), à
// gauche et à droite des coins de la lame (Guidage). Le trait du milieu est l'altitude voulue ; la
// marque verte (▶ ◀) est la canne (ou le coin de lame) ; la partie colorée va de la marque vers
// l'altitude voulue : rouge = monter, bleu = descendre (mêmes couleurs que l'écart). Portée ±50 cm,
// graduée tous les 10 cm.
import { placeSurRegle, DISTANCE_BIP } from '../topo/bip.js';

/** HTML de la règle pour un écart (m, + = monter) ; ecart null = règle vide (en attente). */
export function htmlRegleHauteur(ecart, tolerance = 0.02) {
  const graduations = Array.from({ length: 9 }, (_, i) => `<span class="graduation${i === 4 ? ' milieu' : ''}" style="top:${(i + 1) * 10}%"></span>`).join('');
  if (ecart == null || !Number.isFinite(ecart)) return `<div class="regle-hauteur attente" aria-hidden="true">${graduations}</div>`;
  const place = placeSurRegle(ecart, DISTANCE_BIP) * 100;
  const dedans = Math.abs(ecart) <= tolerance + 1e-9;
  const monter = ecart > 0;
  // Monter : la canne est sous l'altitude voulue, la couleur part de la marque vers le haut.
  const remplissage = dedans ? '' : monter
    ? `<span class="regle-remplissage monter" style="top:0;height:${place.toFixed(1)}%"></span>`
    : `<span class="regle-remplissage descendre" style="top:${place.toFixed(1)}%;bottom:0"></span>`;
  return `<div class="regle-hauteur ${dedans ? 'dedans' : monter ? 'monter' : 'descendre'}" aria-hidden="true">
    ${remplissage}${graduations}
    <span class="regle-marque" style="top:${place.toFixed(1)}%"></span>
  </div>`;
}
