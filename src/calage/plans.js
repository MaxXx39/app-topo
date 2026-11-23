// Calage de plans (0.278.0) : choix du plan de référence, étiquettes des éléments, plan calé rangé dans le projet.
// Sans écran : testé dans tests/calage-ecran.test.js.
import { planRecale } from '../topo/recalage.js';
import { estEnMn95 } from '../topo/dxf-plan.js';
import { versHelmert } from '../topo/calage-plan.js';

/**
 * Plans du projet qui peuvent servir de référence MN95 : plans DXF / PDF à traits (pas les maquettes IFC ni les
 * PDF scannés) qui sont en MN95 une fois recalés (plan importé déjà calé, recalé, ou calé ici).
 */
export function plansDeReference(plansDxf = []) {
  // 0.284.0 : la référence peut être locale (pas en MN95) : le plan calé sera dans le même repère.
  return plansDxf.filter((p) => !p.ifc && !p.calage?.archive && p.contenu && (p.contenu.traits?.length || p.contenu.cercles?.length || p.contenu.points?.length));
}

/** Vrai si le plan (une fois recalé) est en MN95 ; sinon c'est un plan local. */
export const planEnMn95 = (plan) => Boolean(plan.bornes) && estEnMn95(planRecale(plan).bornes);

/** Identifiant de la « référence » faite des points du projet (levés, à implanter, contrôle). */
export const REF_POINTS = '__points';

/**
 * Plan « Points du projet » pour servir de référence (0.284.0) : un plan au format de lirePlanDxf (même dessin, mêmes
 * accroches) fait des points levés : un point accrochable + un rond + son nom. points : [{ nom, est, nord }].
 */
export function planDesPoints(points) {
  const valides = points.filter((p) => Number.isFinite(p.est) && Number.isFinite(p.nord));
  const est = valides.map((p) => p.est);
  const nord = valides.map((p) => p.nord);
  const vide = valides.length === 0;
  const bornes = vide ? null : { estMin: Math.min(...est), nordMin: Math.min(...nord), estMax: Math.max(...est), nordMax: Math.max(...nord) };
  const origine = vide ? { est: 0, nord: 0 } : { est: Math.floor(bornes.estMin), nord: Math.floor(bornes.nordMin) };
  const etendue = vide ? 1 : Math.max(bornes.estMax - bornes.estMin, bornes.nordMax - bornes.nordMin, 1);
  const rayon = Math.max(0.05, etendue / 250);
  const mm = (v) => Math.round(v * 1000) / 1000;
  const x = (p) => mm(p.est - origine.est);
  const y = (p) => mm(p.nord - origine.nord);
  const contenu = {
    traits: [],
    pleins: [],
    cercles: valides.map((p) => ({ c: 0, k: null, x: x(p), y: y(p), r: mm(rayon) })),
    textes: valides.map((p) => ({ c: 0, k: null, x: mm(x(p) + rayon * 1.5), y: mm(y(p) + rayon * 1.5), h: mm(rayon * 2.5), a: 0, t: String(p.nom ?? ''), ah: 0, av: 0 })),
    points: valides.map((p) => ({ c: 0, k: null, x: x(p), y: y(p), z: p.altitude ?? 0 })),
  };
  return {
    id: REF_POINTS,
    nom: 'Points du projet',
    origine,
    bornes,
    calques: [{ nom: 'Points', couleur: '#0f172a', visible: true }],
    contenu,
    compte: { objets: valides.length * 3, ignores: {} },
  };
}

/** Plans du projet calés par cette application (ils ont leur « recette »), du plus récent au plus ancien. */
export function plansCales(plansDxf = []) {
  const tries = plansDxf.filter((p) => p.calage && !p.calage.archive).sort((a, b) => String(b.calage.le).localeCompare(String(a.calage.le)));
  // Un seul plan par lignée d'indices : le plus récent (un ancien indice restauré des Archives ne double pas la ligne).
  const vus = new Set();
  return tries.filter((p) => {
    const groupe = p.calage.groupe ?? p.id;
    if (vus.has(groupe)) return false;
    vus.add(groupe);
    return true;
  });
}

/**
 * Tous les indices gardés d'un plan calé (0.283.0 : chaque indice reste dans le projet), du plus récent au plus ancien.
 * Ils partagent `calage.groupe` (l'id du premier indice) ; un plan d'avant la 0.283.0 est son propre groupe.
 */
export function indicesDuGroupe(plansDxf = [], plan) {
  const groupe = plan.calage?.groupe ?? plan.id;
  return plansDxf.filter((p) => p.calage && (p.calage.groupe ?? p.id) === groupe)
    .sort((a, b) => String(b.calage.le).localeCompare(String(a.calage.le)));
}

/**
 * Étiquette de chaque élément, dans l'ordre : P1, P2… (points de calage), A1, A2… (axes de calage),
 * V1, V2… (vérifications, points ou axes).
 */
export function etiquettes(elements) {
  const compte = { P: 0, A: 0, V: 0 };
  return elements.map((e) => {
    const lettre = e.role === 'verification' ? 'V' : (e.type === 'axe' ? 'A' : 'P');
    compte[lettre] += 1;
    return `${lettre}${compte[lettre]}`;
  });
}

/**
 * Plan calé, prêt à ranger dans projet.plansDxf : le plan reçu TEL QUEL (lu par lirePlanDxf) + un recalage appliqué
 * (comme un plan recalé : affichage, accroches, implantation, export DXF, Drive) + la recette du calage
 * (référence, éléments cliqués, résultat) pour la revoir ou la rejouer.
 * lu : plan lu (déjà nettoyé, voir topo/nettoyage-plan.js) ; nettoyage : sa recette ; resultat : retour de caler() ; reference : plan de référence ; elements : éléments cliqués.
 */
export function planCale({ lu, nom, fichier, resultat, reference, elements, id, le, nettoyage = null, indice = 'A', reperes = [], calquesVus = [], historique = [], mode = 'a-la-main', part = null, changements = null, groupe = null }) {
  const parametres = versHelmert(resultat.similitude);
  return {
    ...lu,
    id,
    nom: nom || lu.nom,
    importeLe: le,
    dejaCale: true,
    recalage: { paires: [], parametres, applique: true, le, parCalage: true },
    calage: {
      le,
      fichier,
      referenceId: reference.id,
      referenceNom: reference.nom,
      elements: elements.map(({ type, role, plan, ref, pointsAxe, ecartAxeM }) => ({ type, role, plan: [...plan], ref: [...ref], ...(pointsAxe ? { pointsAxe, ecartAxeM } : {}) })),
      similitude: { ...resultat.similitude },
      echelleBrute: resultat.echelleBrute,
      echelleArrondie: resultat.echelleArrondie,
      verdict: resultat.verdict,
      ecartVerificationM: Math.max(0, ...resultat.elements.filter((e) => e.role === 'verification').map((e) => e.ecartM)),
      message: resultat.message,
      // Recette du nettoyage (calques écartés, couleurs, types, hachures, zone en coordonnées du plan reçu, préfixe).
      ...(nettoyage ? { nettoyage: JSON.parse(JSON.stringify(nettoyage)) } : {}),
      // Nouvel indice (0.280.0) : indice de ce plan, repères pour contrôler le suivant (coordonnées du plan reçu),
      // calques du fichier reçu (les nouveaux seront signalés), et la suite des indices calés.
      indice,
      ...(groupe ? { groupe } : {}),
      reperes,
      calquesVus,
      indices: [...historique, { indice, le, fichier, mode, ...(part !== null ? { part } : {}), ...(changements ? { changements } : {}) }],
      // Calage automatique (0.281.0) : méthode et confiance (pour le rejouer sur un nouvel indice).
      methode: resultat.methode,
      ...(resultat.auto ? { auto: { niveau: resultat.auto.niveau, votes: resultat.auto.votes, dominance: resultat.auto.dominance, points: resultat.auto.points, ecartMoyenM: resultat.auto.ecartMoyenM, sources: resultat.auto.sources ?? [] } } : {}),
    },
  };
}

/**
 * Plan de référence ajouté depuis le module de calage (0.283.0) : un plan DXF / DWG déjà en MN95, nettoyé, rangé comme
 * un plan importé « déjà calé » (sans calage : il sert de référence, il n'est pas dans la liste des plans calés).
 */
export function planReference({ lu, nom, fichier, le, nettoyage = null, local = false }) {
  // Référence locale (pas en MN95) : pas « déjà calé », elle reste à recaler si on veut un jour la passer en MN95.
  return { ...lu, nom: nom || lu.nom, importeLe: le, ...(local ? { local: true } : { dejaCale: true }), reference: { fichier, le, ...(nettoyage ? { nettoyage: JSON.parse(JSON.stringify(nettoyage)) } : {}) } };
}
