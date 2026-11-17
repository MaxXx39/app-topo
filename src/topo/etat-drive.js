// Nuage de Drive dans l'en-tête : quand est-il ROUGE (pastille « Hors ligne » sur le logo du récepteur) ?
// - hors ligne : le téléphone / la tablette dit qu'il n'y a pas d'internet (nuage rouge barré) ;
// - Drive connecté mais dans un état d'erreur ou d'attente (nuage rouge avec « ! ») : sur la tablette, couper le Wi-Fi donne souvent ce cas,
//   car le navigateur de l'appli croit encore être en ligne.
// Gris (Google pas connecté), orange (envoi), vert (à jour) : pas de pastille.
const ETATS_SANS_ALERTE = ['a-jour', 'envoi', 'connexion', 'rendu', 'repris'];

/** Vrai si le nuage de Drive est rouge. horsLigne : navigator.onLine === false ; connecte : Google connecté ; etat : partage.etat.etat. */
export function nuageDriveRouge({ horsLigne, connecte, etat }) {
  if (horsLigne) return true;
  return Boolean(connecte) && !ETATS_SANS_ALERTE.includes(etat);
}
