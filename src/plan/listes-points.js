// Listes du bouton « Afficher » du plan (demandes du 23 et du 24.10.2026) : une liste par chose
// levée ou importée, à cocher pour l'afficher. Depuis 0.94.0 (tableau « Affichage » du 29.10.2026),
// rangées par catégories (section), dans cet ordre (voir SECTIONS) :
// - 'controle' : les points de contrôle ;
// - 'leve' : les levés (stock, terrain, terrassement, chantier, surface d'un dessin, levés libres),
//   avec leurs points, contours, lignes, triangles et volumes ;
// - 'surface' : les surfaces importées (LandXML, DXF 3D) ;
// - 'dessin' : les dessins (Calculs › Dessin) ;
// - 'mesures' : « Mesures » (aires, longueurs et points comptés faits à la main, dans Calculs › Mesures) ;
// - 'points' : « Points Import » : fichiers de points importés et « Points ajoutés ».
// Les points, contours, lignes, triangles et mesures ne sont dessinés que pour les listes cochées.
// - une surface (stock, terrain naturel, terrassement) : les points de son contour, de ses lignes
//   et ses points (tous les points du levé si elle les prend tous) ;
// - un levé « Autres » : ses lignes et ses points ;
// - un fichier de points importé, et le levé « Points ajoutés » : tous leurs points.
// Les listes décochées sont rangées dans le projet (projet.listesCachees : leurs identifiants).
import { estImportee } from '../topo/surface.js';
import { estLeveDirect } from '../topo/leve-direct.js';

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
  ['leve', 'Levé'],
  ['points', 'Points Import'],
  ['cadastre', 'Cadastre'],
  ['controle', 'Contrôle'],
  ['surface', 'Surface Import'],
  ['dessin', 'Dessin'],
  ['mesures', 'Mesures'],
  ['annotation', 'Annotations'],
];

// 0.214.0 (maquette 4 A du 12.11) : petit encadré de nature à côté du nom d'une liste (Afficher, Liste de points) :
// [texte court, couleur]. Mêmes couleurs que les boutons de nature de la Liste de points.
export const ETIQUETTES_NATURE = {
  controle: ['Contrôle', '#b91c1c'],
  libre: ['Libre', '#a16207'],
  stock: ['Stock', '#92400e'],
  terrain: ['Terrain', '#16a34a'],
  terrassement: ['Terrass.', '#0ea5e9'],
  chantier: ['Chantier', '#0f766e'],
  annotation: ['Annot.', '#7c3aed'],
  import: ['Importé', '#2563eb'],
};
/** Catégorie (clé de ETIQUETTES_NATURE) d'une liste d'après sa nature ; null : pas d'étiquette (cadastre, dessin, mesures…). */
const CATEGORIE_DE_NATURE = { stock: 'stock', terrain: 'terrain', terrassement: 'terrassement', autres: 'libre', annotation: 'annotation', fichier: 'import', ajoutes: 'import', controle: 'controle' };
/** HTML du petit encadré de nature (vide si la catégorie n'en a pas). */
export function htmlEtiquetteNature(categorie) {
  const e = ETIQUETTES_NATURE[categorie];
  return e ? `<span class="etiquette-nature" style="--couleur-etiquette: ${e[1]}">${e[0]}</span>` : '';
}

const nomsDeLaSurface = (s) => [...(s.contour ?? []), ...(s.lignesRupture ?? []).flatMap((l) => l.noms), ...(s.points ?? [])];

/**
 * Listes du projet : [{ id, nom, nature ('stock', 'terrain', 'terrassement', 'mesures',
 * 'autres', 'fichier', 'ajoutes', 'controle', 'dessin'), section ('points', 'surfaces', 'mesures'),
 * leveId (ou null : pas de points à dessiner), noms (Set des noms de points, ou null = tous ceux du
 * levé), visible, couleur (choisie pour la liste, ou pour son levé dans Projet ; ou null),
 * couleurModifiable (vrai pour les listes de la partie « Points », sauf les points de contrôle) }].
 */
export function listesDePoints(projet) {
  const cachees = new Set(projet.listesCachees ?? []);
  const listes = [];
  const SECTION_DE = { cadastre: 'cadastre', fichier: 'points', ajoutes: 'points', autres: 'leve', annotation: 'annotation', controle: 'controle', dessin: 'dessin', mesures: 'mesures', importee: 'surface' };
  const couleurs = projet.couleursListes ?? {};
  const ajouter = (id, nom, nature, leveId, noms, categorie = null) => {
    const section = SECTION_DE[nature] ?? 'leve';
    const couleur = nature === 'controle' ? COULEUR_CONTROLE : couleurs[id] ?? (leveId ? couleurs[leveId] : null) ?? null;
    // Couleur au choix : Points Import, et Surface Import (changer couleur, tableau « Affichage »).
    listes.push({ id, nom, nature, categorie: categorie ?? CATEGORIE_DE_NATURE[nature] ?? null, section, leveId, noms, visible: !cachees.has(id), couleur, couleurModifiable: section === 'points' || section === 'surface' || section === 'leve' });
  };
  for (const leve of projet.leves) {
    // Cadastre (0.116.4) : points et lignes rangés ensemble, une seule couleur (celle du plan DXF).
    if (leve.cadastre) {
      const planDxf = planDuCadastre(projet, leve);
      ajouter(leve.id, leve.nom, 'cadastre', leve.id, null);
      Object.assign(listes.at(-1), { couleur: couleurDuCadastre(planDxf), planId: planDxf?.id ?? null, lignesVisibles: planDxf ? planDxf.visible !== false : null });
    } else if (leve.ajoutes) ajouter(leve.id, leve.nom, 'ajoutes', leve.id, null);
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
  // Mesures faites à la main (Calculs › Mesures) : une seule case, pour leurs traits et leurs valeurs.
  if ((projet.mesures ?? []).length > 0) ajouter(LISTE_MESURES, 'Mesures', 'mesures', null, new Set());
  for (const autres of projet.autres ?? []) ajouter(autres.id, autres.nom, autres.nature === 'annotation' ? 'annotation' : 'autres', autres.leveId, new Set(nomsDeLaSurface(autres)), autres.nature === 'chantier' ? 'chantier' : null);
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

/** Points des listes « Points Import » (fichiers importés, points ajoutés ; plus le cadastre depuis 0.116.4) : Set de points (0.113). */
export function pointsDesImports(projet, listes) {
  const points = new Set();
  for (const liste of listes) {
    if (liste.section !== 'points' || !liste.leveId) continue;
    for (const point of projet.leves.find((l) => l.id === liste.leveId)?.points ?? []) points.add(point);
  }
  return points;
}

// Couleur d'un cadastre au départ (0.116.3) : lignes, points et noms des points.
export const COULEUR_CADASTRE = '#7c3aed';

/** Plan DXF des lignes d'un cadastre (lien `cadastre` = id du levé ; anciens projets : même nom), ou null. */
export function planDuCadastre(projet, leve) {
  const plans = projet.plansDxf ?? [];
  return plans.find((p) => p.cadastre === leve.id) ?? plans.find((p) => !p.cadastre && p.nom === leve.nom) ?? null;
}

/** Couleur d'un cadastre (lignes, points, noms) : celle de son plan DXF, violet au départ. */
export function couleurDuCadastre(planDxf) {
  return planDxf?.couleur || COULEUR_CADASTRE;
}

/** Anciens projets : relie chaque plan DXF de cadastre à son levé (même nom) et lui donne la couleur des points. Renvoie vrai si un lien a été ajouté. */
export function lierCadastres(projet) {
  let change = false;
  for (const leve of projet.leves.filter((l) => l.cadastre)) {
    const planDxf = planDuCadastre(projet, leve);
    if (planDxf && (planDxf.cadastre !== leve.id || !planDxf.couleur)) {
      planDxf.cadastre = leve.id;
      planDxf.couleur ||= COULEUR_CADASTRE; // même couleur que les points (violet au départ)
      change = true;
    }
  }
  return change;
}

/** Listes « Cadastre » (cadastre autour d'un point) : cachées au départ, seules leurs lignes DXF se voient (0.113). */
export function listesCadastre(projet) {
  return projet.leves.filter((l) => l.cadastre).map((l) => l.id);
}

/** Coche (visible) ou décoche une liste. */
export function montrerListe(projet, id, visible) {
  const cachees = new Set(projet.listesCachees ?? []);
  if (visible) cachees.delete(id);
  else cachees.add(id);
  projet.listesCachees = [...cachees];
}

/**
 * Mesures à dessiner sur le plan (hors de l'onglet des mesures) : celles-ci, si « Mesures » est cochée.
 */
export function mesuresVisibles(projet, listes) {
  const visibles = new Set(listes.filter((l) => l.visible).map((l) => l.id));
  return (projet.mesures ?? []).filter(() => visibles.has(LISTE_MESURES));
}

/** Liste de chaque point dessiné (la première liste cochée qui le contient) : Map point → id de la liste (0.192.0, réglages par liste). */
export function listeDesPoints(projet, listes) {
  const carte = new Map();
  for (const liste of listes) {
    if (!liste.visible || !liste.leveId) continue;
    const leve = projet.leves.find((l) => l.id === liste.leveId);
    for (const point of leve?.points ?? []) {
      if (liste.noms && !liste.noms.has(point.nom)) continue;
      if (!carte.has(point)) carte.set(point, liste.id);
    }
  }
  return carte;
}
