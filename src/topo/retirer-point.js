// Retirer un point d'une liste, n'importe lequel (0.209.0, demande du 11.11) : le point disparaît de sa liste et de tout ce
// qui l'utilise (contour, lignes, points choisis d'un levé, métré, mesures, recollement, photos du point).
// Les points de contrôle ont leur propre liste (projet.pointsControle) : voir main.js.

import { retirerPointDesMesures } from './metre.js';
import { nomsDuRecollement, retirerPointReseau } from './reseau.js';

/** Objets du projet qui gardent des noms de points (contour, lignes, points choisis, cadres de chantier). */
const AVEC_NOMS = ['surfaces', 'metres', 'autres'];

const nomDe = (p) => (typeof p === 'string' ? p : p?.nom);

/**
 * Où sert le point « nom » : { contours, lignes, isoles, cadres, mesures, recollements, photos } (nombres).
 * leve : la liste qui contient le point (ses photos sont celles de l'objet qui la possède).
 */
export function usagesDuPoint(projet, leve, nom) {
  const usages = { contours: 0, lignes: 0, isoles: 0, cadres: 0, mesures: 0, recollements: 0, photos: 0 };
  for (const cle of AVEC_NOMS) {
    for (const objet of projet[cle] ?? []) {
      if ((objet.contour ?? []).includes(nom)) usages.contours += 1;
      usages.lignes += (objet.lignesRupture ?? []).filter((l) => l.noms.includes(nom)).length;
      if ((objet.points ?? []).some((p) => nomDe(p) === nom)) usages.isoles += 1;
      usages.cadres += (objet.cadres ?? []).filter((c) => c.noms.includes(nom)).length;
    }
  }
  for (const mesure of projet.mesures ?? []) {
    if ((mesure.contour ?? []).includes(nom) || (mesure.points ?? []).includes(nom) || (mesure.lignesRupture ?? []).some((l) => l.noms.includes(nom))) usages.mesures += 1;
  }
  usages.recollements = (projet.reseaux ?? []).filter((r) => nomsDuRecollement(r).includes(nom)).length;
  for (const cle of [...AVEC_NOMS, 'reseaux']) {
    for (const objet of projet[cle] ?? []) {
      if (objet.leveId === leve?.id) usages.photos += (objet.photos ?? []).filter((ph) => ph.point === nom).length;
    }
  }
  return usages;
}

/** Texte court des usages pour la confirmation : « 1 contour, 2 lignes, 1 photo » ; '' si le point ne sert nulle part. */
export function texteUsages(usages) {
  const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
  return [
    usages.contours > 0 && pluriel(usages.contours, 'contour', 'contours'),
    usages.lignes > 0 && pluriel(usages.lignes, 'ligne de rupture', 'lignes de rupture'),
    usages.isoles > 0 && pluriel(usages.isoles, 'liste de points choisis', 'listes de points choisis'),
    usages.cadres > 0 && pluriel(usages.cadres, 'cadre de chantier', 'cadres de chantier'),
    usages.mesures > 0 && pluriel(usages.mesures, 'mesure', 'mesures'),
    usages.recollements > 0 && pluriel(usages.recollements, 'recollement', 'recollements'),
    usages.photos > 0 && pluriel(usages.photos, 'photo', 'photos'),
  ].filter(Boolean).join(', ');
}

/** Enlève le point « nom » de la liste « leve » et de tout ce qui l'utilise. Renvoie false si le point n'existe pas. */
export function retirerPointDuProjet(projet, leve, nom) {
  if (!leve.points.some((p) => p.nom === nom)) return false;
  leve.points = leve.points.filter((p) => p.nom !== nom);
  for (const cle of AVEC_NOMS) {
    for (const objet of projet[cle] ?? []) {
      if (objet.contour) objet.contour = objet.contour.filter((n) => n !== nom);
      if (objet.points) objet.points = objet.points.filter((p) => nomDe(p) !== nom);
      for (const ligne of objet.lignesRupture ?? []) ligne.noms = ligne.noms.filter((n) => n !== nom);
      if (objet.cadres) objet.cadres = objet.cadres.map((c) => ({ ...c, noms: c.noms.filter((n) => n !== nom) })).filter((c) => c.noms.length > 0);
    }
  }
  retirerPointDesMesures(projet, nom); // aussi les mesures de métré restées vides
  for (const recollement of projet.reseaux ?? []) retirerPointReseau(recollement, nom);
  for (const cle of [...AVEC_NOMS, 'reseaux']) {
    for (const objet of projet[cle] ?? []) {
      if (objet.leveId === leve.id && objet.photos) objet.photos = objet.photos.filter((ph) => ph.point !== nom);
    }
  }
  return true;
}
