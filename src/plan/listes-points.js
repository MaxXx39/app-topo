// Listes du bouton « Afficher » du plan (demandes du 23 et du 24.10.2026) : une liste par chose
// levée ou importée, à cocher pour l'afficher, rangées en 3 parties (section) :
// - 'points' : fichiers importés, « Points ajoutés », levés « Autres » ;
// - 'surfaces' : surfaces (avec leur contour, leurs lignes, leurs triangles et leur volume),
//   aussi celles importées d'un LandXML ou d'un DXF ;
// - 'metres' : métrés (leurs points et leurs mesures : aires, longueurs, nombres), et « Mesures »
//   (celles faites à la main dans Calculs › Mesures / métrés).
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

const nomsDeLaSurface = (s) => [...(s.contour ?? []), ...(s.lignesRupture ?? []).flatMap((l) => l.noms), ...(s.points ?? [])];

/**
 * Listes du projet : [{ id, nom, nature ('stock', 'terrain', 'terrassement', 'metre', 'mesures',
 * 'autres', 'fichier', 'ajoutes'), section ('points', 'surfaces', 'metres'), leveId (ou null :
 * pas de points à dessiner), noms (Set des noms de points, ou null = tous ceux du levé), visible }].
 */
export function listesDePoints(projet) {
  const cachees = new Set(projet.listesCachees ?? []);
  const listes = [];
  const SECTIONS = { fichier: 'points', ajoutes: 'points', autres: 'points', metre: 'metres', mesures: 'metres' };
  const ajouter = (id, nom, nature, leveId, noms) => listes.push({ id, nom, nature, section: SECTIONS[nature] ?? 'surfaces', leveId, noms, visible: !cachees.has(id) });
  for (const leve of projet.leves) {
    if (leve.ajoutes) ajouter(leve.id, leve.nom, 'ajoutes', leve.id, null);
    else if (!estLeveDirect(leve)) ajouter(leve.id, leve.nom, 'fichier', leve.id, null);
  }
  for (const s of projet.surfaces) {
    // Surface LandXML / DXF : pas de points d'un levé, seulement la surface.
    if (estImportee(s)) {
      ajouter(s.id, s.nom, s.nature ?? 'terrain', null, new Set());
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
  const ordre = ['points', 'surfaces', 'metres'];
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
