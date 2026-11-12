// Mise en page du dessin d'une coupe, en millimètres : la même pour l'écran (SVG) et le PDF.
//
// Le dessin a, de haut en bas : le titre, le profil des surfaces, les cotes de longueur.
// À gauche : la petite échelle des hauteurs (point bas, point haut et 3 altitudes entre les deux).
// Les longueurs sont à une échelle normalisée (1:200, 1:500...) ; les hauteurs à la même échelle
// (×1) ou deux fois plus grandes (×2).
import { ECHELLES } from '../export/echelle.js';
import { cotesLongueur, cotesAltitude, longueurCoupe } from '../topo/coupe.js';
import { formaterNombre } from '../topo/format.js';

// Couleur de chaque nature de surface dans les coupes (rouge, vert, bleu : [R, V, B]).
const COULEURS_NATURE = {
  stock: [180, 83, 9], // brun
  terrain: [21, 128, 61], // vert
  terrassement: [37, 99, 235], // bleu
  surface: [124, 58, 237], // violet (surface d'un dessin)
};
const COULEUR_AUTRE = [95, 109, 119]; // gris

/** Couleur d'une surface dans les coupes, d'après sa nature : [R, V, B]. */
export function couleurCoupe(nature) {
  return COULEURS_NATURE[nature] ?? COULEUR_AUTRE;
}

// Marges autour du profil (mm) : à gauche pour les altitudes, en haut pour le titre,
// en bas pour les cotes de longueur.
const MARGES = { gauche: 17, droite: 4, haut: 7, bas: 7 };

/**
 * Prépare le dessin d'une coupe dans un rectangle de largeur × hauteur (mm) au plus.
 * - coupe : { nom, debut, fin, exageration (1 ou 2) }
 * - profils : [{ nom, nature, lignes }] où lignes = résultat de profilSurface
 * Le cadre du profil est ajusté à la hauteur du relief : le dessin peut être moins haut que
 * "hauteur" (hauteurTotale, mm).
 * Renvoie null si aucune surface n'est traversée, sinon :
 * { titre, echelle, echelleHauteurs, hauteurTotale, cadre: { x, y, largeur, hauteur },
 *   courbes: [{ nom, couleur, lignes: [[{ x, y }]] }],
 *   cotesX: [{ x, texte }], cotesY: [{ y, texte }], extremites: [{ x, texte }] }
 */
export function preparerDessinCoupe(coupe, profils, largeur, hauteur) {
  const traverses = profils.filter((p) => p.lignes.length > 0);
  if (traverses.length === 0) return null;
  const longueur = longueurCoupe(coupe.debut, coupe.fin);
  const exageration = coupe.exageration === 2 ? 2 : 1;
  const altitudes = traverses.flatMap((p) => p.lignes.flat().map((point) => point.altitude));
  const altitudeMin = Math.min(...altitudes);
  // Coupe toute plate : on garde 1 m de hauteur pour l'échelle des hauteurs.
  const altitudeMax = Math.max(...altitudes) - altitudeMin < 0.01 ? altitudeMin + 1 : Math.max(...altitudes);
  const hauteurTerrain = altitudeMax - altitudeMin;

  // Échelle des longueurs : la plus détaillée où la coupe (et ses hauteurs) tient dans le cadre.
  const cadre = {
    x: MARGES.gauche,
    y: MARGES.haut,
    largeur: largeur - MARGES.gauche - MARGES.droite,
    hauteur: hauteur - MARGES.haut - MARGES.bas,
  };
  const echelle =
    ECHELLES.find((e) => (longueur * 1000) / e <= cadre.largeur && (hauteurTerrain * exageration * 1000) / e <= cadre.hauteur) ??
    ECHELLES.at(-1);
  const mmParMetre = 1000 / echelle;
  const mmParMetreHauteur = mmParMetre * exageration;
  // Cadre ajusté au relief (avec un peu de marge, et au moins 26 mm pour la petite échelle
  // des hauteurs), profil centré en hauteur dedans.
  const hauteurRelief = (altitudeMax - altitudeMin) * mmParMetreHauteur;
  cadre.hauteur = Math.min(cadre.hauteur, Math.max(hauteurRelief + 8, 26));
  const yBas = cadre.y + cadre.hauteur - (cadre.hauteur - hauteurRelief) / 2;
  const versX = (distance) => cadre.x + distance * mmParMetre;
  const versY = (altitude) => yBas - (altitude - altitudeMin) * mmParMetreHauteur;

  // Petite échelle des hauteurs : 5 altitudes, ou seulement le point bas et le point haut
  // si elles seraient trop serrées pour être lues (moins de 3 mm entre deux).
  const altitudesCotees = cotesAltitude(altitudeMin, altitudeMax);
  const cotesY = (hauteurRelief / 4 >= 3 ? altitudesCotees : [altitudesCotees[0], altitudesCotees[4]]).map((altitude) => ({
    y: versY(altitude),
    texte: formaterNombre(altitude),
  }));
  // Point bas et point haut très proches : on écarte un peu leurs textes.
  if (cotesY.length === 2 && hauteurRelief < 3) {
    cotesY[0].y += (3 - hauteurRelief) / 2;
    cotesY[1].y -= (3 - hauteurRelief) / 2;
  }

  return {
    titre: `Coupe ${coupe.nom} – ${coupe.nom}'`,
    echelle,
    echelleHauteurs: echelle / exageration,
    hauteurTotale: cadre.y + cadre.hauteur + MARGES.bas,
    cadre,
    courbes: traverses.map(({ nom, nature, lignes }) => ({
      nom,
      couleur: couleurCoupe(nature),
      lignes: lignes.map((ligne) => ligne.map((p) => ({ x: versX(p.distance), y: versY(p.altitude) }))),
    })),
    cotesX: cotesLongueur(longueur).map((distance) => ({ x: versX(distance), texte: formaterNombre(distance) })),
    cotesY,
    extremites: [
      { x: versX(0), texte: coupe.nom },
      { x: versX(longueur), texte: `${coupe.nom}'` },
    ],
  };
}

/** Texte des échelles d'une coupe : « Longueurs 1:500 · hauteurs 1:250 (×2) ». */
export function texteEchellesCoupe(dessin) {
  const exageration = dessin.echelle / dessin.echelleHauteurs;
  return `Longueurs 1:${dessin.echelle} · hauteurs 1:${dessin.echelleHauteurs}${exageration > 1 ? ` (×${exageration})` : ''}`;
}

/** Dessin d'une coupe en SVG (pour l'écran), mesures en mm dans la viewBox. */
export function coupeEnSvg(dessin, largeur) {
  const hauteur = dessin.hauteurTotale;
  const rvb = ([r, v, b]) => `rgb(${r},${v},${b})`;
  const { cadre } = dessin;
  const xFin = dessin.cotesX.at(-1).x; // fin de la coupe (A')
  const morceaux = [];
  // Quadrillage léger aux cotes
  for (const { x } of dessin.cotesX) morceaux.push(`<line x1="${x}" y1="${cadre.y}" x2="${x}" y2="${cadre.y + cadre.hauteur}" class="grille" />`);
  for (const { y } of dessin.cotesY) morceaux.push(`<line x1="${cadre.x}" y1="${y}" x2="${xFin}" y2="${y}" class="grille" />`);
  // Axes, cotes et extrémités
  morceaux.push(`<path d="M${cadre.x} ${cadre.y} V${cadre.y + cadre.hauteur} H${xFin}" class="axe" />`);
  for (const { x, texte } of dessin.cotesX) {
    morceaux.push(`<text x="${x}" y="${cadre.y + cadre.hauteur + 3.6}" text-anchor="middle">${texte}</text>`);
  }
  for (const { y, texte } of dessin.cotesY) morceaux.push(`<text x="${cadre.x - 1}" y="${y + 0.9}" text-anchor="end">${texte}</text>`);
  for (const { x, texte } of dessin.extremites) {
    morceaux.push(`<text x="${x}" y="${cadre.y - 1.5}" text-anchor="middle" class="extremite">${texte}</text>`);
  }
  // Profils des surfaces
  for (const { couleur, lignes } of dessin.courbes) {
    for (const ligne of lignes) {
      morceaux.push(`<polyline points="${ligne.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" stroke="${rvb(couleur)}" class="profil" />`);
    }
  }
  return `<svg class="dessin-coupe" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="${dessin.titre}">${morceaux.join('')}</svg>`;
}
