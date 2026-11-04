// Cap automatique (0.119.0, tous les modes) : dès que le GNSS est connecté et que son inclinaison
// est PRÊTE, le plan suit la position, devant du GNSS en haut (« cap »). Quand l'inclinaison n'est
// plus prête ou que le GNSS est déconnecté, le plan revient à l'orientation d'avant.
// Seuls les changements (prêt → pas prêt, pas prêt → prêt) déclenchent quelque chose : si
// l'utilisateur change lui-même l'orientation entre-temps, on ne revient pas sur son choix.

/** Mémoire de départ : GNSS pas prêt, rien à rendre. */
export function creerCapAuto() {
  return { pret: false, avant: null };
}

/**
 * Décide quoi faire à chaque nouvelle position. memoire : voir creerCapAuto (modifiée ici) ;
 * pret : GNSS connecté et inclinaison prête ; suivi : orientation actuelle du plan ('libre',
 * 'suivre' ou 'cap') ; occupe : vrai si le plan est tenu par autre chose (« Voir toute la ligne »).
 * Renvoie null (rien à faire), 'cap' (passer en cap) ou { revenir: suivi } (revenir à ce suivi).
 */
export function decisionCapAuto(memoire, { pret, suivi, occupe = false }) {
  // L'utilisateur a quitté le cap lui-même : on oublie l'orientation d'avant.
  if (memoire.avant !== null && suivi !== 'cap') memoire.avant = null;
  let action = null;
  if (pret && !memoire.pret) {
    if (suivi !== 'cap' && !occupe) {
      memoire.avant = suivi;
      action = 'cap';
    }
  } else if (!pret && memoire.pret && memoire.avant !== null) {
    action = { revenir: memoire.avant };
    memoire.avant = null;
  }
  memoire.pret = pret;
  return action;
}
