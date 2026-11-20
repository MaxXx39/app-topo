// Appareil photo sous Windows (0.273.0). Sur Android, un champ « fichier » avec capture ouvre l'appareil photo ;
// sous Windows (WebView2) il ouvre l'explorateur de fichiers. Ici : quand on touche un bouton photo, une fenêtre
// montre la caméra de la tablette ; « Prendre la photo » fabrique un fichier JPEG et le donne au champ, comme si
// l'appareil photo l'avait fourni (les écrans qui lisent la photo ne changent pas).

/** Le champ « photo » touché (le champ lui-même ou son bouton « label »), ou null. */
export function champPhotoTouche(cible) {
  if (!cible || !cible.closest) return null;
  const champ = cible.closest('input[type="file"][capture]');
  if (champ) return champ;
  const etiquette = cible.closest('label');
  return etiquette?.querySelector('input[type="file"][capture]') ?? null;
}

/** Donne la photo prise (un File) au champ et le prévient, comme après un choix de fichier. */
function donnerAuChamp(champ, fichier) {
  const liste = new DataTransfer();
  liste.items.add(fichier);
  champ.files = liste.files;
  champ.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Ouvre la fenêtre de la caméra pour ce champ. */
export async function ouvrirCamera(champ) {
  const fond = document.createElement('div');
  fond.className = 'fenetre-camera';
  fond.innerHTML = `<div class="boite-camera" role="dialog" aria-label="Appareil photo">
      <video class="video-camera" autoplay playsinline muted></video>
      <p class="erreur-camera" hidden></p>
      <div class="boutons-camera">
        <button type="button" class="bouton" data-camera="prendre" disabled>Prendre la photo</button>
        <button type="button" class="bouton" data-camera="fichier" hidden>Choisir un fichier</button>
        <button type="button" class="bouton" data-camera="fermer">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(fond);
  const video = fond.querySelector('video');
  const erreur = fond.querySelector('.erreur-camera');
  const prendre = fond.querySelector('[data-camera="prendre"]');
  const fichier = fond.querySelector('[data-camera="fichier"]');
  let flux = null;
  const fermer = () => {
    flux?.getTracks().forEach((t) => t.stop());
    fond.remove();
  };
  fond.querySelector('[data-camera="fermer"]').addEventListener('click', fermer);
  fichier.addEventListener('click', () => {
    // Secours : l'explorateur de fichiers (le champ sans capture).
    const secours = document.createElement('input');
    secours.type = 'file';
    secours.accept = champ.accept || 'image/*';
    secours.addEventListener('change', () => {
      if (secours.files[0]) donnerAuChamp(champ, secours.files[0]);
      fermer();
    });
    secours.click();
  });
  prendre.addEventListener('click', () => {
    const toile = document.createElement('canvas');
    toile.width = video.videoWidth;
    toile.height = video.videoHeight;
    toile.getContext('2d').drawImage(video, 0, 0);
    toile.toBlob((blob) => {
      if (!blob) {
        erreur.textContent = 'La photo n\'a pas pu être prise. Réessaie.';
        erreur.hidden = false;
        return;
      }
      donnerAuChamp(champ, new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
      fermer();
    }, 'image/jpeg', 0.9);
  });
  try {
    flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    if (!fond.isConnected) { flux.getTracks().forEach((t) => t.stop()); return; }
    video.srcObject = flux;
    await video.play().catch(() => {});
    prendre.disabled = false;
  } catch (e) {
    erreur.textContent = `Pas d'accès à la caméra (${e?.message || e?.name || 'refusée ou absente'}). Autorise la caméra pour Topo dans Windows (Paramètres › Confidentialité › Caméra), ou choisis un fichier.`;
    erreur.hidden = false;
    fichier.hidden = false;
  }
}

/** Branche tout : à appeler une fois, seulement sous Windows. */
export function brancherCameraWindows() {
  document.addEventListener('click', (e) => {
    const champ = champPhotoTouche(e.target);
    if (!champ) return;
    e.preventDefault();
    e.stopPropagation();
    ouvrirCamera(champ);
  }, true);
}
