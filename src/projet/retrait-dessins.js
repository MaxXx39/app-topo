// Suppression de Calculs › Dessin (0.300.0, décision du 24.11 : remplacé par l'application Plateformes ; « les
// supprimer »). À l'ouverture d'un projet, les dessins sont retirés, avec ce qui ne servait qu'à eux : leurs surfaces
// (surfaces « Surf-… » faites dans Dessin, champ dessinId), les levés « Surface » dédiés à ces surfaces, les calculs de
// volume qui les utilisaient, et les dessins archivés. La DAO (plan dessiné, dans projet.plansDxf) n'est pas touchée.

/** Retire les dessins du projet (il est modifié). Renvoie { dessins, surfaces, leves, calculs } : nombres retirés. */
export function retirerDessins(projet) {
  const dessins = (projet.dessins ?? []).length;
  const parties = (projet.surfaces ?? []).filter((s) => s.dessinId);
  const idsSurfaces = new Set(parties.map((s) => s.id));
  // Levés « Surface » dédiés (0.77.0) : créés pour la surface d'un dessin, sans autre usage.
  const autresUsages = new Set([...(projet.surfaces ?? []).filter((s) => !idsSurfaces.has(s.id)), ...(projet.autres ?? []), ...(projet.mesures ?? [])].map((o) => o.leveId).filter(Boolean));
  const levesParties = new Set(parties.filter((s) => s.leveId).map((s) => s.leveId).filter((id) => !autresUsages.has(id) && (projet.leves ?? []).find((l) => l.id === id)?.dediee));
  const calculsAvant = (projet.calculs ?? []).length;
  const levesAvant = (projet.leves ?? []).length;
  if (projet.surfaces) projet.surfaces = projet.surfaces.filter((s) => !idsSurfaces.has(s.id));
  if (projet.leves) projet.leves = projet.leves.filter((l) => !levesParties.has(l.id));
  if (levesParties.has(projet.leveActifId)) projet.leveActifId = projet.leves?.[0]?.id ?? null;
  if (projet.calculs) projet.calculs = projet.calculs.filter((c) => !idsSurfaces.has(c.surface1Id) && !idsSurfaces.has(c.surface2Id) && !idsSurfaces.has(c.talusDe));
  projet.dessins = [];
  projet.archives = (projet.archives ?? []).filter((a) => a.type !== 'dessin');
  for (const archive of projet.archives) if (archive.contenu?.dessins) delete archive.contenu.dessins;
  return { dessins, surfaces: parties.length, leves: levesAvant - (projet.leves ?? []).length, calculs: calculsAvant - (projet.calculs ?? []).length };
}
