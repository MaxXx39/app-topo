// « Envoyer » un fichier exporté (0.69.0) : après chaque export, une barre en bas de l'écran
// propose de l'envoyer avec le partage de l'appareil (mail, WhatsApp, Drive…). Dans l'APK :
// l'appli Android (AppliAndroid.partagerFichier) ; sur le site : le partage du navigateur
// (navigator.share), s'il sait partager des fichiers.
import { echapper } from '../outils/echapper.js';
import { enBase64 } from '../android/pont.js';

const DUREE_BARRE = 20_000; // ms : la barre disparaît toute seule

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

let minuterie = null;

/** Barre « « nom » exporté · Envoyer · ✕ » en bas de l'écran (remplace la précédente). */
export function proposerEnvoi(blob, nom) {
  let barre = document.querySelector('#barre-envoi');
  if (!barre) {
    barre = document.createElement('div');
    barre.id = 'barre-envoi';
    barre.setAttribute('role', 'status');
    document.body.append(barre);
  }
  barre.innerHTML = `<span>« ${echapper(nom)} » exporté</span>
    <button type="button" class="bouton" data-envoyer>Envoyer</button>
    <button type="button" class="bouton-lien bouton-lien-neutre" data-fermer aria-label="Fermer">✕</button>`;
  barre.hidden = false;
  const fermer = () => {
    barre.hidden = true;
    clearTimeout(minuterie);
  };
  barre.querySelector('[data-fermer]').addEventListener('click', fermer);
  barre.querySelector('[data-envoyer]').addEventListener('click', async () => {
    const probleme = await partagerFichier(blob, nom);
    if (probleme) barre.querySelector('span').textContent = probleme;
    else fermer();
  });
  clearTimeout(minuterie);
  minuterie = setTimeout(fermer, DUREE_BARRE);
}
