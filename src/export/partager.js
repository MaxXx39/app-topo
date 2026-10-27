// Envoyer un fichier exporté (0.69.0 ; depuis 0.79.0 depuis la fenêtre « Exporter », voir
// fenetre-export.js) : le partage de l'appareil (mail, WhatsApp, Drive…), ou un mail à une adresse
// de la liste partagée. Dans l'APK : l'appli Android (AppliAndroid.partagerFichier,
// partagerFichierMail) ; sur le site : le partage du navigateur (navigator.share), ou le mail.
import { enBase64 } from '../android/pont.js';


/** Vrai si cet appareil sait partager ce fichier. */
export function partagePossible(fichier) {
  if (typeof window.AppliAndroid?.partagerFichier === 'function') return true;
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [fichier] });
}

/** Ouvre le partage de l'appareil avec ce fichier. Renvoie null, ou un message si c'est impossible. */
export async function partagerFichier(blob, nom) {
  const type = blob.type || 'application/octet-stream';
  if (typeof window.AppliAndroid?.partagerFichier === 'function') {
    window.AppliAndroid.partagerFichier(nom, type, enBase64(new Uint8Array(await blob.arrayBuffer())));
    return null;
  }
  const fichier = new File([blob], nom, { type });
  if (!partagePossible(fichier)) return 'Partage impossible ici : envoie le fichier depuis tes téléchargements.';
  try {
    await navigator.share({ files: [fichier], title: nom });
  } catch (erreur) {
    if (erreur.name !== 'AbortError') return `Partage impossible : ${erreur.message}`;
  }
  return null;
}

/**
 * Envoie le fichier par mail à "adresse" (0.79.0). Dans l'APK : le partage Android avec l'adresse
 * déjà remplie (l'appli de mail la reprend). Sur le site : le fichier est téléchargé et le mail
 * s'ouvre avec l'adresse et l'objet : il reste à y joindre le fichier.
 * enregistrer(blob, nom) : téléchargement (voir export/ecran.js). Renvoie null, ou un message.
 */
export async function envoyerParMail(blob, nom, adresse, enregistrer) {
  if (typeof window.AppliAndroid?.partagerFichierMail === 'function') {
    window.AppliAndroid.partagerFichierMail(nom, blob.type || 'application/octet-stream', enBase64(new Uint8Array(await blob.arrayBuffer())), adresse);
    return null;
  }
  if (typeof window.AppliAndroid?.partagerFichier === 'function') {
    // APK plus ancienne : partage sans adresse.
    return partagerFichier(blob, nom);
  }
  enregistrer(blob, nom);
  window.location.href = `mailto:${encodeURIComponent(adresse)}?subject=${encodeURIComponent(nom)}`;
  return `Joins « ${nom} » (dans les téléchargements) au mail qui s'ouvre.`;
}
