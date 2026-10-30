// Listes du bouton « Afficher » du plan (demandes du 23 et du 24.10.2026) : une liste par chose
// levée ou importée, à cocher pour l'afficher. Depuis 0.94.0 (tableau « Affichage » du 29.10.2026),
// rangées par catégories (section), dans cet ordre (voir SECTIONS) :
// - 'controle' : les points de contrôle ;
// - 'leve' : les levés (stock, terrain, recollement, terrassement, surface d'un dessin, levés libres),
//   avec leurs points, contours, lignes, triangles et volumes ;
// - 'surface' : les surfaces importées (LandXML, DXF 3D) ;
// - 'dessin' : les dessins (Calculs › Dessin) ;
// - 'metre' : les métrés (leurs points et leurs mesures), et « Mesures » (faites à la main) ;
// - 'points' : « Points Import » : fichiers de points importés et « Points ajoutés ».
// Les points, contours, lignes, triangles et mesures ne sont dessinés que pour les listes cochées.
// - une surface (stock, terrain naturel, terrassement) : les points de son contour, de ses lignes
//   et ses points (tous les points du levé si elle les prend tous) ;
// - un métré : les points de ses aires, longueurs et points comptés ;
// - un levé « Autres » : ses lignes et ses points ;
// - un fichier de points importé, et le levé « Points ajoutés » : tous leurs points.
// Les listes décochées sont rangées dans le projet (projet.listesCachees : leurs identifiants).
import { estImportee } from '../topo/surface.js';
import { estLeveDirect } from '../topo/leve-direct.js';
import { nomsDeLaMesure } from '../topo/mesure.js';

// Identifiant de la case « Mesures » (mesures faites à la main).
export const LISTE_MESURES = 'mesures-calculs';
// Identifiant de la case « Points de contrôle » (Terrain › Contrôle), dessinés en rouge.
export const LISTE_CONTROLE = 'points-controle';
// Couleur des points de contrôle : toujours rouge (jamais au choix).
export const COULEUR_CONTROLE = '#dc2626';
// Couleurs au choix d'une liste de points (demande du 26.10.2026 ; le rouge est gardé pour les
// points de contrôle). '' = la couleur normale (celle du rôle ou du libellé).
export const COULEURS_LISTES = [
  ['', 'Couleur normale'],
  ['#2563eb', 'Bleu'],
  ['#16a34a', 'Vert'],
  ['#ea580c', 'Orange'],
  ['#7c3aed', 'Violet'],
  ['#0891b2', 'Cyan'],
  ['#db2777', 'Rose'],
  ['#a16207', 'Brun'],
  ['#6b7280', 'Gris'],
  ['#000000', 'Noir'],
];

// Catégories du menu « Afficher », dans l'ordre, avec leur titre.
export const SECTIONS = [
  ['controle', 'Contrôle'],
  ['leve', 'Levé'],
  ['surface', 'Surface Import'],
  ['dessin', 'Dessin'],
  ['metre', 'Métré'],
  ['points', 'Points Import'],
];

const nomsDeLaSurface = (s) => [...(s.contour ?? []), ...(s.lignesRupture ?? []).flatMap((l) => l.noms), ...(s.points ?? [])];

/**
 * Listes du projet : [{ id, nom, nature ('stock', 'terrain', 'terrassement', 'metre', 'mesures',
 * 'autres', 'fichier', 'ajoutes', 'controle', 'dessin'), section ('points', 'surfaces', 'metres'),
 * leveId (ou null : pas de points à dessiner), noms (Set des noms de points, ou null = tous ceux du
 * levé), visible, couleur (choisie pour la liste, ou pour son levé dans Projet ; ou null),
 * couleurModifiable (vrai pour les listes de la partie « Points », sauf les points de contrôle) }].
 */
export function listesDePoints(projet) {
  const cachees = new Set(projet.listesCachees ?? []);
  const listes = [];
  const SECTION_DE = { fichier: 'points', ajoutes: 'points', autres: 'leve', controle: 'controle', dessin: 'dessin', metre: 'metre', mesures: 'metre', importee: 'surface' };
  const couleurs = projet.couleursListes ?? {};
  const ajouter = (id, nom, nature, leveId, noms) => {
    const section = SECTION_DE[nature] ?? 'leve';
    const couleur = nature === 'controle' ? COULEUR_CONTROLE : couleurs[id] ?? (leveId ? couleurs[leveId] : null) ?? null;
    // Couleur au choix : Points Import, et Surface Import (changer couleur, tableau « Affichage »).
    listes.push({ id, nom, nature, section, leveId, noms, visible: !cachees.has(id), couleur, couleurModifiable: section === 'points' || section === 'surface' });
  };
  for (const leve of projet.leves) {
    if (leve.ajoutes) ajouter(leve.id, leve.nom, 'ajoutes', leve.id, null);
    else if (!estLeveDirect(leve)) ajouter(leve.id, leve.nom, 'fichier', leve.id, null);
  }
  for (const s of projet.surfaces) {
    // Surface LandXML / DXF : pas de points d'un levé, seulement la surface.
    if (estImportee(s)) {
      ajouter(s.id, s.nom, 'importee', null, new Set());
      continue;
    }
    ajouter(s.id, s.nom, s.nature ?? 'stock', s.leveId, s.tousLesPoints ? null : new Set(nomsDeLaSurface(s)));
  }
  for (const metre of projet.metres ?? []) {
    const noms = projet.mesures.filter((m) => m.metreId === metre.id).flatMap(nomsDeLaMesure);
    ajouter(metre.id, metre.nom, 'metre', metre.leveId, new Set(noms));
  }
  // Mesures faites à la main (pas d'un métré) : une seule case, pour leurs traits et leurs valeurs.
  if ((projet.mesures ?? []).some((m) => !m.metreId)) ajouter(LISTE_MESURES, 'Mesures', 'mesures', null, new Set());
  for (const autres of projet.autres ?? []) ajouter(autres.id, autres.nom, 'autres', autres.leveId, new Set(nomsDeLaSurface(autres)));
  // Points de contrôle : pas dans un levé, dessinés à part (triangles rouges, voir plan.js).
  if ((projet.pointsControle ?? []).length > 0) ajouter(LISTE_CONTROLE, 'Points de contrôle', 'controle', null, new Set());
  // Dessins (Calculs › Dessin) : une case par dessin (ses traits et ses sommets, en violet, voir plan/dessins.js).
  for (const dessin of projet.dessins ?? []) ajouter(dessin.id, dessin.nom, 'dessin', null, new Set());
  const ordre = SECTIONS.map(([cle]) => cle);
  return listes.sort((a, b) => ordre.indexOf(a.section) - ordre.indexOf(b.section));
}

/**
 * Points à dessiner : ceux des listes cochées (chaque point une seule fois, même s'il est dans
 * plusieurs listes). Renvoie [point].
 */
export function pointsDesListes(projet, listes) {
  const vus = new Set();
  const resultat = [];
  for (const liste of listes) {
    if (!liste.visible) continue;
    if (!liste.leveId) continue;
    const leve = projet.leves.find((l) => l.id === liste.leveId);
    for (const point of leve?.points ?? []) {
      if (liste.noms && !liste.noms.has(point.nom)) continue;
      const cle = `${leve.id}\u0000${point.nom}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      resultat.push(point);
    }
  }
  return resultat;
}

/**
 * Couleur de chaque point dessiné, d'après la couleur de sa liste (la première liste cochée qui a
 * une couleur) : Map point → couleur (« #2563eb »). Les points sans couleur choisie n'y sont pas.
 */
export function couleursDesPoints(projet, listes) {
  const couleurs = new Map();
  for (const liste of listes) {
    if (!liste.visible || !liste.couleur || !liste.leveId) continue;
    const leve = projet.leves.find((l) => l.id === liste.leveId);
    for (const point of leve?.points ?? []) {
      if (liste.noms && !liste.noms.has(point.nom)) continue;
      if (!couleurs.has(point)) couleurs.set(point, liste.couleur);
    }
  }
  return couleurs;
}

/** Coche (visible) ou décoche une liste. */
export function montrerListe(projet, id, visible) {
  const cachees = new Set(projet.listesCachees ?? []);
  if (visible) cachees.delete(id);
  else cachees.add(id);
  projet.listesCachees = [...cachees];
}

/**
 * Mesures à dessiner sur le plan (hors de l'onglet des mesures) : celles des métrés cochés, et
 * celles faites à la main si « Mesures » est cochée.
 */
export function mesuresVisibles(projet, listes) {
  const visibles = new Set(listes.filter((l) => l.visible).map((l) => l.id));
  return (projet.mesures ?? []).filter((m) => visibles.has(m.metreId ?? LISTE_MESURES));
}
