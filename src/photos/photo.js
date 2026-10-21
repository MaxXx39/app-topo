// Photos d'une surface (pour le compte rendu PDF).
//
// Une photo est rangée dans sa surface : surface.photos = [{ id, legende, date, image, miniature, largeur, hauteur }]
// Toutes les photos vont dans le PDF quand la case « Photos » de l'export est cochée.
// - image : la photo réduite (JPEG, 1600 pixels de côté au plus), pour le PDF
// - miniature : petite version (240 pixels), pour l'écran
// - date : date de la prise de vue (ou du fichier), au format ISO
// Les photos restent sur l'appareil, dans le projet (et dans le fichier projet .topo.json).
//
// Photos HEIC : beaucoup de téléphones (Samsung, iPhone) enregistrent leurs photos dans ce format,
// que Chrome ne sait pas lire. Elles sont alors décodées par la bibliothèque heic-to, sur l'appareil.
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
  const image = await ouvrirImage(fichier);
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

/**
 * Ouvre l'image d'un fichier. Renvoie une image prête à dessiner, ou lance une erreur
 * avec un message compréhensible.
 */
async function ouvrirImage(fichier) {
  try {
    // createImageBitmap tient compte de l'orientation enregistrée par le téléphone.
    return await createImageBitmap(fichier);
  } catch {
    // Le navigateur ne sait pas lire ce fichier : est-ce une photo HEIC ?
    const marque = await new Response(fichier.slice(8, 12)).text();
    if (!estPhotoHeic(fichier.name, fichier.type, marque)) {
      throw new Error('format d\'image non reconnu (photo JPEG, PNG ou HEIC attendue)');
    }
    try {
      // La bibliothèque est chargée seulement quand il le faut (elle pèse environ 3 Mo).
      const { heicTo } = await import('heic-to');
      return await heicTo({ blob: fichier, type: 'bitmap' });
    } catch {
      throw new Error('photo HEIC illisible');
    }
  }
}

/**
 * Vrai si le fichier est une photo HEIC (ou HEIF) : d'après son type, son extension,
 * ou sa « marque » (4 lettres écrites au début du fichier, octets 8 à 11).
 */
export function estPhotoHeic(nomFichier, typeFichier, marque) {
  if (/^image\/hei[cf]/i.test(typeFichier ?? '')) return true;
  if (/\.hei[cf]$/i.test(nomFichier ?? '')) return true;
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes((marque ?? '').trim());
}

/** Dessine l'image à la taille voulue et la renvoie en JPEG (texte « data:image/jpeg;base64,... »). */
function enJpeg(image, { largeur, hauteur }, qualite) {
  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  toile.getContext('2d').drawImage(image, 0, 0, largeur, hauteur);
  return toile.toDataURL('image/jpeg', qualite);
}
