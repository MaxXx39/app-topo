// Pont entre l'appli web et l'appli Android (APK « Topo », dossier android/).
// Dans l'APK, la page tourne dans une fenêtre de navigateur intégrée (WebView) qui ne sait pas
// tout faire seule : l'appli Android lui donne l'objet window.AppliAndroid, avec des fonctions
// écrites en Kotlin (android/app/src/main/java/ch/apptopo/PontAndroid.kt).
// Dans un navigateur normal, cet objet n'existe pas et rien ne change.
// Plus tard, c'est aussi par ici que passera la position du récepteur Emlid (Bluetooth).

/** Vrai si la page tourne dans l'APK Android. */
export function estDansAppliAndroid() {
  return typeof window !== 'undefined' && Boolean(window.AppliAndroid);
}

/** Octets -> texte base64 (pour passer un fichier à Kotlin, qui ne reçoit que du texte). */
export function enBase64(octets) {
  let binaire = '';
  // Par morceaux, pour ne pas dépasser le nombre d'arguments permis par String.fromCharCode.
  for (let debut = 0; debut < octets.length; debut += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(debut, debut + 0x8000));
  }
  return btoa(binaire);
}

/**
 * Enregistre un fichier par l'appli Android : elle demande où l'enregistrer
 * (Téléchargements, Google Drive…), comme Emlid Stock.
 */
export async function enregistrerDansAndroid(blob, nom) {
  try {
    const octets = new Uint8Array(await blob.arrayBuffer());
    window.AppliAndroid.enregistrerFichier(nom, blob.type || 'application/octet-stream', enBase64(octets));
  } catch (erreur) {
    alert(`Export de « ${nom} » impossible : ${erreur.message ?? erreur}.`);
  }
}

// --- Récepteur Emlid (Bluetooth), lu par l'appli Android ---

/** Vrai si l'appli Android sait lire le récepteur (APK assez récent). */
export function recepteurDisponible() {
  return estDansAppliAndroid() && typeof window.AppliAndroid.prendrePoint === 'function';
}

/**
 * Appelle "fonction(etat)" à chaque état reçu du récepteur (5 fois par seconde), voir
 * EtatRecepteur.enJson côté Kotlin : { connecte, bluetooth, dernierRecepteur, recu, qualite,
 * libelleQualite, nbSatellites, hdop, ageCorrections, etatInclinaison, inclinaisonPrete,
 * inclinaison, cap (°, orientation du RX2, à confirmer), position: { est, nord, altitude } ou null,
 * erreurConversion, autorise, raison }.
 */
export function ecouterRecepteur(fonction) {
  window.recevoirEtatRecepteur = fonction;
}

export const choisirRecepteur = () => window.AppliAndroid.choisirRecepteur();
export const reconnecterRecepteur = () => window.AppliAndroid.reconnecterRecepteur();
export const deconnecterRecepteur = () => window.AppliAndroid.deconnecterRecepteur();

/**
 * Point à prendre maintenant (MN95 / RAN95), vérifié par l'appli Android : RTK fixe et
 * inclinaison prête. Renvoie { ok: true, point } ou { ok: false, raison }.
 */
export function prendrePointRecepteur() {
  try {
    return JSON.parse(window.AppliAndroid.prendrePoint());
  } catch (erreur) {
    return { ok: false, raison: `réponse illisible du récepteur (${erreur.message})` };
  }
}

/**
 * Touche « volume − » de la tablette : si "actif", elle appelle "fonction()" au lieu de baisser
 * le volume (onglet Terrain, mode Lever). Sans effet avec un APK plus ancien.
 */
export function regleToucheVolume(actif, fonction) {
  window.toucheVolumeBas = fonction;
  if (typeof window.AppliAndroid?.activerToucheVolume === 'function') window.AppliAndroid.activerToucheVolume(Boolean(actif));
}
