// Lignes d'un plan DXF posées sur une surface (0.143.0, vue 3D, liste du 05.11, point 4) : chaque
// ligne est découpée tous les "pas" mètres et chaque point prend l'altitude de la surface à cet
// endroit ; hors de la surface, la ligne est coupée (morceaux séparés). Coordonnées MN95 (m).

/**
 * Lignes 2D des plans DXF montrés : [{ points: [{ est, nord }], couleur }]. plans : plans recalés
 * (origine + contenu.traits, p = [x, y, x, y…] depuis l'origine) ; seuls les plans et calques visibles.
 */
export function lignesDesPlans(plans) {
  const lignes = [];
  for (const plan of plans ?? []) {
    if (plan.visible === false || !plan.contenu?.traits) continue;
    const origine = plan.origine ?? { est: 0, nord: 0 };
    for (const trait of plan.contenu.traits) {
      if (plan.calques?.[trait.c] && plan.calques[trait.c].visible === false) continue;
      const points = [];
      for (let i = 0; i + 1 < trait.p.length; i += 2) points.push({ est: origine.est + trait.p[i], nord: origine.nord + trait.p[i + 1] });
      if (trait.f && points.length > 2) points.push({ ...points[0] });
      if (points.length >= 2) lignes.push({ points, couleur: plan.couleur || '#1f2937' });
    }
  }
  return lignes;
}

/**
 * Pose les lignes sur la surface. altitudeA(est, nord) : altitude de la surface (m) ou null hors
 * surface ; pas : distance entre deux points (m) ; maxPoints : limite pour garder la vue rapide.
 * Renvoie [{ points: [{ est, nord, altitude }], couleur }] (morceaux d'au moins 2 points).
 */
export function draperLignes(lignes, altitudeA, { pas = 1, maxPoints = 30000 } = {}) {
  const morceaux = [];
  let total = 0;
  for (const ligne of lignes) {
    let courant = [];
    const finir = () => {
      if (courant.length >= 2) morceaux.push({ points: courant, couleur: ligne.couleur });
      courant = [];
    };
    for (let i = 0; i + 1 < ligne.points.length; i++) {
      const a = ligne.points[i];
      const b = ligne.points[i + 1];
      const longueur = Math.hypot(b.est - a.est, b.nord - a.nord);
      const n = Math.max(1, Math.ceil(longueur / pas));
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const t = k / n;
        const est = a.est + (b.est - a.est) * t;
        const nord = a.nord + (b.nord - a.nord) * t;
        const altitude = altitudeA(est, nord);
        if (altitude == null) finir();
        else courant.push({ est, nord, altitude });
        if (++total >= maxPoints) {
          finir();
          return morceaux;
        }
      }
    }
    finir();
  }
  return morceaux;
}
