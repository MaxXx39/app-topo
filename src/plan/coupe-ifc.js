// Coupe en plan des maquettes IFC du projet (0.262.0) : à quelle altitude on coupe (choix de CHAQUE
// tablette, gardé hors du projet, par projet) et le plan coupé à dessiner.
//
// Le plan IFC rangé dans le projet garde seulement la maquette (contenu.maquette) ; le plan coupé est
// un plan « dérivé » (il lit nom, calques, visible… sur le plan du projet) dont le contenu est la coupe.
// Changer d'altitude ne modifie donc pas le projet (rien n'est renvoyé sur Drive).
import { altitudeDeCoupe, coupeHorizontale, coupeVerticale, coupeVerticaleLeLong } from '../topo/ifc.js';

const CLE = 'topo-coupe-ifc';

/** Vrai si le plan du projet est une maquette IFC. */
export const estPlanIfc = (plan) => Boolean(plan?.ifc);

/** Choix de la tablette pour ce projet : { sorte: 'niveau' | 'altitude' | 'recepteur', niveau, altitude } ou null. */
export function lireChoixCoupeIfc(projetId) {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? '{}')?.[projetId] ?? null;
  } catch {
    return null;
  }
}

/** Retient le choix de la tablette pour ce projet. */
export function enregistrerChoixCoupeIfc(projetId, choix) {
  try {
    const tous = JSON.parse(localStorage.getItem(CLE) ?? '{}') ?? {};
    tous[projetId] = choix;
    localStorage.setItem(CLE, JSON.stringify(tous));
  } catch {
    // Stockage refusé (navigation privée) : le choix vaut jusqu'à la fermeture.
  }
}

/** Niveaux de toutes les maquettes IFC (sans doublon nom + altitude), du plus bas au plus haut. */
export function niveauxDesIfc(plans) {
  const vus = new Map();
  for (const plan of plans) {
    for (const n of plan.ifc?.niveaux ?? []) vus.set(`${n.nom}@${n.altitude}`, n);
  }
  return [...vus.values()].sort((a, b) => a.altitude - b.altitude);
}

/**
 * Altitude de coupe de la tablette : { altitude (m, ou null), texte } (voir altitudeDeCoupe).
 * altitudeCanne : altitude du bout de canne du récepteur (m), ou null.
 */
export function altitudeCoupeIfc(plans, choix, altitudeCanne) {
  const niveaux = niveauxDesIfc(plans);
  // Un niveau choisi par son nom ET son altitude (deux maquettes peuvent avoir un « N0 » différent).
  const niveau = choix?.sorte === 'niveau' ? niveaux.find((n) => n.nom === choix.niveau && (choix.altitude == null || n.altitude === choix.altitude)) : null;
  return altitudeDeCoupe({ niveaux: niveau ? [niveau] : niveaux, objets: [] }, niveau ? { sorte: 'niveau', niveau: niveau.nom } : choix, altitudeCanne);
}

// Plans coupés déjà calculés : plan du projet → { altitude, plan }.
const coupes = new WeakMap();
const VIDE = { traits: [], pleins: [], cercles: [], textes: [], points: [] };

/**
 * Plan coupé à l'altitude donnée (m), à dessiner et à utiliser pour les accroches. Recalculé
 * seulement si l'altitude change. Sans altitude (récepteur sans position) : plan vide.
 */
export function planIfcCoupe(plan, altitude) {
  if (!plan.contenu?.maquette) return plan;
  const enCache = coupes.get(plan);
  if (enCache && enCache.altitude === altitude && enCache.maquette === plan.contenu.maquette) return enCache.plan;
  const contenu = altitude == null ? VIDE : coupeHorizontale(plan.contenu.maquette, altitude);
  const coupe = Object.assign(Object.create(plan), {
    contenu: { ...contenu, maquette: plan.contenu.maquette },
    revision: `ifc${altitude}`,
    altitudeCoupe: altitude,
  });
  coupes.set(plan, { altitude, maquette: plan.contenu.maquette, plan: coupe });
  return coupe;
}

/** Arrondi de l'altitude du récepteur pour la coupe (m) : au centimètre (on ne recoupe pas pour un millimètre). */
export function arrondiRecepteur(altitude) {
  return Number.isFinite(altitude) ? Math.round(altitude * 100) / 100 : null;
}

/** Maquettes affichées (case du plan cochée) et calques cochés de chacune. */
function maquettesAffichees(plans) {
  return (plans ?? [])
    .filter((plan) => estPlanIfc(plan) && plan.visible !== false && plan.contenu?.maquette)
    .map((plan) => ({ maquette: plan.contenu.maquette, cache: new Set((plan.calques ?? []).filter((c) => c.visible === false).map((c) => c.nom)) }));
}

/**
 * Objets des maquettes IFC affichées coupés par la coupe debut → fin ({ est, nord }, m), pour les
 * dessins de coupes (Implanter, Réseaux, Guidage) : [{ type, couleur, points: [{ x, z }], ferme }]
 * (x : distance depuis le début, m ; z : altitude, m). Les calques décochés ne sont pas dessinés.
 */
export function objetsIfcSurCoupe(plans, debut, fin) {
  return maquettesAffichees(plans).flatMap(({ maquette, cache }) => coupeVerticale(maquette, debut, fin).filter((o) => !cache.has(o.type)));
}

/** Même chose le long d'une suite de points (profil en long d'une ligne) : x = distance cumulée (m). */
export function objetsIfcLeLong(plans, sommets) {
  return maquettesAffichees(plans).flatMap(({ maquette, cache }) => coupeVerticaleLeLong(maquette, sommets).filter((o) => !cache.has(o.type)));
}

/** Signature des maquettes affichées (cases du plan et calques) : pour savoir quand refaire une coupe gardée en mémoire. */
export function signatureIfc(plans) {
  return (plans ?? []).filter(estPlanIfc).map((p) => `${p.id}:${p.visible !== false}:${(p.calques ?? []).map((c) => (c.visible === false ? 0 : 1)).join('')}`).join('|');
}

/**
 * SVG (texte) des objets IFC coupés : contour à la couleur du type, rempli clair. versX(x), versZ(z) : position
 * dans le dessin. objets : résultat de objetsIfcSurCoupe / objetsIfcLeLong.
 */
export function svgObjetsIfc(objets, versX, versZ) {
  return (objets ?? []).map((o) => {
    const points = o.points.map((p) => `${versX(p.x).toFixed(1)},${versZ(p.z).toFixed(1)}`).join(' ');
    return o.ferme
      ? `<polygon points="${points}" class="ifc-coupe" style="stroke:${o.couleur};fill:${o.couleur}33" />`
      : `<polyline points="${points}" class="ifc-coupe" style="stroke:${o.couleur}" />`;
  }).join('');
}
