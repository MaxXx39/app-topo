// Calque d'un plan DXF touché au doigt (0.222.0, demande du 12.11) : quel élément (trait, cercle, texte, point) est le plus près du
// toucher, et sur quel calque il se trouve. Sert à masquer un calque en le touchant sur le plan. Coordonnées MN95, m.
// Les plans sont ceux de plan.contenu (voir topo/dxf-plan.js) : coordonnées rangées par rapport à plan.origine.
// 0.225.0 : l'élément touché est aussi rendu avec sa forme (en MN95) et une clé unique, pour le montrer en orange
// pendant le choix « Geler / Isoler » (plusieurs éléments).

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
 * Renvoie { planId, planNom, calque (n° dans plan.calques), calqueNom, distance, cle, forme } ou null.
 * forme (MN95) : { type: 'trait', pts: [{est, nord}…], ferme } | { type: 'cercle', est, nord, r } | { type: 'texte' | 'point', est, nord }.
 * cle : identifie l'élément (plan, sorte, rang) pour le retrouver au second toucher.
 */
export function calqueSousLeDoigt(plans, position, rayon) {
  let meilleur = null;
  const essayer = (plan, objet, distance, cle, forme) => {
    if (distance > rayon || (meilleur && distance >= meilleur.distance)) return;
    meilleur = { planId: plan.id, planNom: plan.nom, calque: objet.c, calqueNom: plan.calques?.[objet.c]?.nom ?? '', distance, cle: `${plan.id}|${cle}`, forme: forme(plan) };
  };
  for (const plan of plans) {
    if (!plan.contenu || !plan.origine || plan.visible === false) continue;
    const x = position.est - plan.origine.est;
    const y = position.nord - plan.origine.nord;
    const visible = (objet) => plan.calques?.[objet.c]?.visible !== false;
    const enMn95 = (px, py) => ({ est: px + plan.origine.est, nord: py + plan.origine.nord });
    (plan.contenu.traits ?? []).forEach((trait, rang) => {
      if (!visible(trait)) return;
      const p = trait.p;
      let plusProche = Infinity;
      for (let i = 0; i + 3 < p.length; i += 2) plusProche = Math.min(plusProche, distanceSegment(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]));
      if (trait.f && p.length >= 6) plusProche = Math.min(plusProche, distanceSegment(x, y, p[p.length - 2], p[p.length - 1], p[0], p[1]));
      if (p.length === 2) plusProche = Math.hypot(x - p[0], y - p[1]);
      essayer(plan, trait, plusProche, `t${rang}`, () => {
        const pts = [];
        for (let i = 0; i + 1 < p.length; i += 2) pts.push(enMn95(p[i], p[i + 1]));
        return { type: 'trait', pts, ferme: Boolean(trait.f) };
      });
    });
    (plan.contenu.cercles ?? []).forEach((cercle, rang) => {
      if (visible(cercle)) essayer(plan, cercle, Math.abs(Math.hypot(x - cercle.x, y - cercle.y) - cercle.r), `c${rang}`, () => ({ type: 'cercle', ...enMn95(cercle.x, cercle.y), r: cercle.r }));
    });
    (plan.contenu.textes ?? []).forEach((texte, rang) => {
      if (visible(texte)) essayer(plan, texte, Math.hypot(x - texte.x, y - texte.y), `x${rang}`, () => ({ type: 'texte', ...enMn95(texte.x, texte.y) }));
    });
    (plan.contenu.points ?? []).forEach((point, rang) => {
      if (visible(point)) essayer(plan, point, Math.hypot(x - point.x, y - point.y), `p${rang}`, () => ({ type: 'point', ...enMn95(point.x, point.y) }));
    });
  }
  return meilleur;
}

/**
 * Applique « Geler » (cacher les calques choisis) ou « Isoler » (ne garder que les calques choisis) sur les plans du projet.
 * choisis : éléments renvoyés par calqueSousLeDoigt. Renvoie le nombre de calques cachés.
 */
export function appliquerGelIsolement(plansDuProjet, choisis, mode) {
  const gardes = new Set(choisis.map((e) => `${e.planId}|${e.calque}`));
  let caches = 0;
  for (const plan of plansDuProjet) {
    (plan.calques ?? []).forEach((calque, numero) => {
      const choisi = gardes.has(`${plan.id}|${numero}`);
      const doitCacher = mode === 'geler' ? choisi : !choisi;
      if (doitCacher && calque.visible !== false) {
        calque.visible = false;
        caches += 1;
      }
    });
  }
  return caches;
}

/** « Tout réafficher » : tous les calques de tous les plans redeviennent visibles. Renvoie le nombre de calques remis. */
export function reafficherTousLesCalques(plansDuProjet) {
  let remis = 0;
  for (const plan of plansDuProjet) {
    for (const calque of plan.calques ?? []) {
      if (calque.visible === false) {
        calque.visible = true;
        remis += 1;
      }
    }
  }
  return remis;
}
