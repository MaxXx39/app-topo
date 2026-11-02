// Bip-bip de hauteur (0.107.0) : Implanter (Altitude, Surface) et Guidage. Le son aide à monter ou
// descendre sans regarder l'écran.
// - plus de 50 cm d'écart : silence ;
// - de 50 cm jusqu'à la tolérance : bips de plus en plus rapides en approchant (900 ms entre deux
//   bips à 50 cm, 120 ms à la tolérance) ; son aigu = monter, grave = descendre ;
// - dans la tolérance : son continu.
// Écart en m : + = monter (la canne ou la lame est trop basse), − = descendre.

/** Distance (m) à partir de laquelle on commence à bipper. */
export const DISTANCE_BIP = 0.5;

/**
 * Rythme du bip pour un écart (m) et une tolérance (m) : null (silence), { continu: true }
 * (dans la tolérance) ou { continu: false, monter, intervalle (ms entre deux bips) }.
 */
export function rythmeBip(ecart, tolerance) {
  if (ecart == null || !Number.isFinite(ecart)) return null;
  const valeur = Math.abs(ecart);
  if (valeur <= tolerance + 1e-9) return { continu: true, monter: ecart >= 0 };
  if (valeur > DISTANCE_BIP) return null;
  const part = (valeur - tolerance) / (DISTANCE_BIP - tolerance); // 0 à la tolérance, 1 à 50 cm
  return { continu: false, monter: ecart > 0, intervalle: Math.round(120 + part * (900 - 120)) };
}

/**
 * Règle de hauteur : place de la marque (la canne ou le coin de lame) sur la règle, de 0 (en haut)
 * à 1 (en bas). Le milieu (0.5) est l'altitude voulue ; la règle va de +portee à −portee (m).
 * Écart + (monter) : la canne est sous l'altitude voulue, donc la marque est sous le milieu.
 * Au-delà de la portée, la marque reste au bord (0.03 ou 0.97).
 */
export function placeSurRegle(ecart, portee = DISTANCE_BIP) {
  const part = 0.5 + (ecart / portee) / 2;
  return Math.min(0.97, Math.max(0.03, part));
}
