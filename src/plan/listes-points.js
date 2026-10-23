// « Listes de points » du bouton « Points » du plan (demande du 23.10.2026) : une liste par chose
// levée ou importée, à cocher pour l'afficher. Les points, contours, lignes et triangles ne sont
// dessinés que pour les listes cochées.
// - une surface (stock, terrain naturel, terrassement) : les points de son contour, de ses lignes
//   et ses points (tous les points du levé si elle les prend tous) ;
// - un métré : les points de ses aires, longueurs et points comptés ;
// - un levé « Autres » : ses lignes et ses points ;
// - un fichier de points importé, et le levé « Points ajoutés » : tous leurs points.
// Les listes décochées sont rangées dans le projet (projet.listesCachees : leurs identifiants).
import { estImportee } from '../topo/surface.js';
import { estLeveDirect } from '../topo/leve-direct.js';
import { nomsDeLaMesure } from '../topo/mesure.js';

const nomsDeLaSurface = (s) => [...(s.contour ?? []), ...(s.lignesRupture ?? []).flatMap((l) => l.noms), ...(s.points ?? [])];

/**
 * Listes du projet : [{ id, nom, nature ('stock', 'terrain', 'terrassement', 'metre', 'autres',
 * 'fichier', 'ajoutes'), leveId, noms (Set des noms de points, ou null = tous ceux du levé), visible }].
 */
export function listesDePoints(projet) {
  const cachees = new Set(projet.listesCachees ?? []);
  const listes = [];
  const ajouter = (id, nom, nature, leveId, noms) => listes.push({ id, nom, nature, leveId, noms, visible: !cachees.has(id) });
  for (const leve of projet.leves) {
    if (leve.ajoutes) ajouter(leve.id, leve.nom, 'ajoutes', leve.id, null);
    else if (!estLeveDirect(leve)) ajouter(leve.id, leve.nom, 'fichier', leve.id, null);
  }
  for (const s of projet.surfaces) {
    if (estImportee(s)) continue; // surface LandXML / DXF : pas de points d'un levé
    ajouter(s.id, s.nom, s.nature ?? 'stock', s.leveId, s.tousLesPoints ? null : new Set(nomsDeLaSurface(s)));
  }
  for (const metre of projet.metres ?? []) {
    const noms = projet.mesures.filter((m) => m.metreId === metre.id).flatMap(nomsDeLaMesure);
    ajouter(metre.id, metre.nom, 'metre', metre.leveId, new Set(noms));
  }
  for (const autres of projet.autres ?? []) ajouter(autres.id, autres.nom, 'autres', autres.leveId, new Set(nomsDeLaSurface(autres)));
  return listes;
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
