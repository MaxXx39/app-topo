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
