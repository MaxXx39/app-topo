// Suppression du Métré et du Recollement (0.212.0, demande du 12.11) : à l'ouverture d'un projet, leurs
// données sont retirées. Ce sont les listes « metres » et « reseaux » du projet, leurs mesures (celles
// qui ont un metreId) et les levés qui ne servent qu'à eux. Les archives qui en contiennent perdent
// ces morceaux aussi. Un levé encore utilisé par une surface, un levé libre ou une mesure reste.

/**
 * Retire le Métré et le Recollement du projet (il est modifié ; les surfaces « Recollement (ancien) » deviennent des Terrains). Renvoie le nombre retiré par sorte :
 * { metres, reseaux, mesures, leves } (0 partout si rien à faire).
 */
export function retirerMetreEtRecollement(projet) {
  // Anciens levés « Recollement (ancien) » (surfaces avec volumes) : gardés, rangés en Terrain.
  for (const surface of projet.surfaces ?? []) if (surface.nature === 'recollement') surface.nature = 'terrain';
  const metres = projet.metres ?? [];
  const reseaux = projet.reseaux ?? [];
  const mesures = projet.mesures ?? [];
  const levesUtilises = new Set(); // levés encore utilisés
  for (const objet of [...(projet.surfaces ?? []), ...(projet.autres ?? [])]) if (objet.leveId) levesUtilises.add(objet.leveId);
  const mesuresRetirees = mesures.filter((m) => m.metreId != null);
  const mesuresGardees = mesures.filter((m) => m.metreId == null);
  for (const mesure of mesuresGardees) if (mesure.leveId) levesUtilises.add(mesure.leveId);
  // Levés qui ne servaient qu'au Métré ou au Recollement.
  const levesCandidats = new Set([...metres, ...reseaux].map((o) => o.leveId).filter(Boolean));
  const levesRetires = new Set([...levesCandidats].filter((id) => !levesUtilises.has(id)));
  const nombreLeves = (projet.leves ?? []).filter((l) => levesRetires.has(l.id)).length;
  if (projet.leves) projet.leves = projet.leves.filter((l) => !levesRetires.has(l.id));
  projet.mesures = mesuresGardees;
  delete projet.metres;
  delete projet.reseaux;
  for (const archive of projet.archives ?? []) {
    const contenu = archive.contenu ?? {};
    delete contenu.metres;
    delete contenu.reseaux;
    if (Array.isArray(contenu.mesures)) contenu.mesures = contenu.mesures.filter((m) => m.metreId == null);
  }
  projet.archives = (projet.archives ?? []).filter((a) => a.type !== 'metre' && a.type !== 'reseau');
  return { metres: metres.length, reseaux: reseaux.length, mesures: mesuresRetirees.length, leves: nombreLeves };
}
