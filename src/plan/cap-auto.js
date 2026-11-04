// Cap automatique (0.119.0, refait en 0.123.0, tous les modes) : dès que le GNSS est connecté et que son
// inclinaison est PRÊTE, le plan suit la position, devant du GNSS en haut (« cap »). Sinon (pas
// d'inclinaison, GNSS déconnecté, GPS tablette), le plan suit la position avec le nord en haut.
// Seuls les changements (et le tout premier état) déclenchent quelque chose : si l'utilisateur
// déplace le plan lui-même entre-temps, on ne reprend pas la main avant le prochain changement.

/** Mémoire de départ : état pas encore connu. */
export function creerCapAuto() {
  return { pret: null };
}

/**
 * Décide quoi faire à chaque nouvelle position. memoire : voir creerCapAuto (modifiée ici) ;
 * pret : GNSS connecté et inclinaison prête ; suivi : orientation actuelle du plan ('libre',
 * 'suivre' ou 'cap') ; occupe : vrai si le plan est tenu par autre chose (« Voir toute la ligne »).
 * Renvoie null (rien à faire), 'cap' (passer en cap) ou { revenir: 'suivre' } (nord en haut).
 */
export function decisionCapAuto(memoire, { pret, suivi, occupe = false }) {
  const change = memoire.pret !== pret;
  memoire.pret = pret;
  if (!change) return null;
  if (pret) return suivi !== 'cap' && !occupe ? 'cap' : null;
  return suivi === 'suivre' ? null : { revenir: 'suivre' };
}
