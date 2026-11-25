// Cadrage d'un plan qui mélange des objets très éloignés (ex. quelques traits dessinés près de 0,0 et le plan en MN95) :
// l'étendue totale ferait un point minuscule et la vue resterait blanche. On cadre sur le groupe principal.

/**
 * Bornes du groupe principal d'un plan { estMin, nordMin, estMax, nordMax } (m, repère absolu) et nombre d'objets
 * écartés (trop loin du reste), ou null s'il n'y a rien d'écarté (on garde alors les bornes normales du plan).
 * Méthode : on prend le centre (médiane) des objets ; un objet plus loin que 6 fois la distance médiane au centre
 * est écarté (marche tant que les objets éloignés sont moins de la moitié).
 */
export function groupePrincipal(plan) {
  const c = plan?.contenu;
  if (!c || !plan.origine) return null;
  const { est: oe, nord: on } = plan.origine;
  const pts = [];
  const ajouter = (x, y, w, h) => pts.push({ x: oe + x, y: on + y, w, h });
  for (const t of c.traits ?? []) {
    const p = t.p;
    if (p?.length >= 2) {
      let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
      for (let i = 0; i < p.length; i += 2) {
        if (p[i] < xMin) xMin = p[i];
        if (p[i] > xMax) xMax = p[i];
        if (p[i + 1] < yMin) yMin = p[i + 1];
        if (p[i + 1] > yMax) yMax = p[i + 1];
      }
      ajouter((xMin + xMax) / 2, (yMin + yMax) / 2, (xMax - xMin) / 2, (yMax - yMin) / 2);
    }
  }
  for (const k of c.cercles ?? []) ajouter(k.x, k.y, k.r, k.r);
  for (const t of c.textes ?? []) ajouter(t.x, t.y, 0, 0);
  if (pts.length < 4) return null;
  const med = (l) => { const s = [...l].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const mx = med(pts.map((p) => p.x));
  const my = med(pts.map((p) => p.y));
  const dist = pts.map((p) => Math.hypot(p.x - mx, p.y - my)).sort((a, b) => a - b);
  const limite = 6 * dist[Math.floor(dist.length / 2)] + 1;
  const gardes = pts.filter((p) => Math.hypot(p.x - mx, p.y - my) <= limite);
  if (gardes.length === pts.length || gardes.length === 0) return null;
  return {
    bornes: {
      estMin: Math.min(...gardes.map((p) => p.x - p.w)), estMax: Math.max(...gardes.map((p) => p.x + p.w)),
      nordMin: Math.min(...gardes.map((p) => p.y - p.h)), nordMax: Math.max(...gardes.map((p) => p.y + p.h)),
    },
    ecartes: pts.length - gardes.length,
  };
}
