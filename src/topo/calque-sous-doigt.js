// Calque d'un plan DXF touché au doigt (0.222.0, demande du 12.11) : quel élément (trait, cercle, texte, point) est le plus près du
// toucher, et sur quel calque il se trouve. Sert à masquer un calque en le touchant sur le plan. Coordonnées MN95, m.
// Les plans sont ceux de plan.contenu (voir topo/dxf-plan.js) : coordonnées rangées par rapport à plan.origine.

/** Distance (m) d'un point (px, py) à un segment (ax, ay)-(bx, by). */
function distanceSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const carre = dx * dx + dy * dy;
  const t = carre === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / carre));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Élément de plan le plus proche de position { est, nord } (à moins de rayon m), parmi les calques visibles des plans visibles.
 * Renvoie { planId, planNom, calque (n° dans plan.calques), calqueNom, distance } ou null.
 */
export function calqueSousLeDoigt(plans, position, rayon) {
  let meilleur = null;
  const essayer = (plan, objet, distance) => {
    if (distance > rayon || (meilleur && distance >= meilleur.distance)) return;
    meilleur = { planId: plan.id, planNom: plan.nom, calque: objet.c, calqueNom: plan.calques?.[objet.c]?.nom ?? '', distance };
  };
  for (const plan of plans) {
    if (!plan.contenu || !plan.origine || plan.visible === false) continue;
    const x = position.est - plan.origine.est;
    const y = position.nord - plan.origine.nord;
    const visible = (objet) => plan.calques?.[objet.c]?.visible !== false;
    for (const trait of plan.contenu.traits ?? []) {
      if (!visible(trait)) continue;
      const p = trait.p;
      let plusProche = Infinity;
      for (let i = 0; i + 3 < p.length; i += 2) plusProche = Math.min(plusProche, distanceSegment(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]));
      if (trait.f && p.length >= 6) plusProche = Math.min(plusProche, distanceSegment(x, y, p[p.length - 2], p[p.length - 1], p[0], p[1]));
      if (p.length === 2) plusProche = Math.hypot(x - p[0], y - p[1]);
      essayer(plan, trait, plusProche);
    }
    for (const cercle of plan.contenu.cercles ?? []) if (visible(cercle)) essayer(plan, cercle, Math.abs(Math.hypot(x - cercle.x, y - cercle.y) - cercle.r));
    for (const texte of plan.contenu.textes ?? []) if (visible(texte)) essayer(plan, texte, Math.hypot(x - texte.x, y - texte.y));
    for (const point of plan.contenu.points ?? []) if (visible(point)) essayer(plan, point, Math.hypot(x - point.x, y - point.y));
  }
  return meilleur;
}
