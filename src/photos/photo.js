// Photos d'une surface (pour le compte rendu PDF).
//
// Une photo est rangée dans sa surface : surface.photos = [{ id, legende, date, image, miniature, largeur, hauteur }]
// - image : la photo réduite (JPEG, 1600 pixels de côté au plus), pour le PDF
// - miniature : petite version (240 pixels), pour l'écran
// - date : date de la prise de vue (ou du fichier), au format ISO
// Les photos restent sur l'appareil, dans le projet (et dans le fichier projet .topo.json).
import { nouvelIdentifiant } from '../topo/surface.js';

const COTE_PHOTO = 1600; // pixels
const COTE_MINIATURE = 240; // pixels

/**
 * Taille réduite (pixels) d'une image largeur × hauteur pour que son plus grand côté
 * ne dépasse pas "coteMax". Une image déjà assez petite garde sa taille.
 */
export function tailleReduite(largeur, hauteur, coteMax) {
  const facteur = Math.min(1, coteMax / Math.max(largeur, hauteur));
  return { largeur: Math.round(largeur * facteur), hauteur: Math.round(hauteur * facteur) };
}

/**
 * Lit un fichier image choisi par l'utilisateur (appareil photo ou galerie) et prépare la photo
 * à ranger dans une surface. Fonctionne dans le navigateur (utilise un canevas de dessin).
 */
export async function preparerPhoto(fichier) {
  // createImageBitmap tient compte de l'orientation enregistrée par le téléphone.
  const image = await createImageBitmap(fichier);
  const grande = tailleReduite(image.width, image.height, COTE_PHOTO);
  const petite = tailleReduite(image.width, image.height, COTE_MINIATURE);
  const photo = {
    id: nouvelIdentifiant(),
    legende: '',
    date: new Date(fichier.lastModified || Date.now()).toISOString(),
    image: enJpeg(image, grande, 0.8),
    miniature: enJpeg(image, petite, 0.7),
    largeur: grande.largeur,
    hauteur: grande.hauteur,
  };
  image.close?.();
  return photo;
}

/** Dessine l'image à la taille voulue et la renvoie en JPEG (texte « data:image/jpeg;base64,... »). */
function enJpeg(image, { largeur, hauteur }, qualite) {
  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  toile.getContext('2d').drawImage(image, 0, 0, largeur, hauteur);
  return toile.toDataURL('image/jpeg', qualite);
}
