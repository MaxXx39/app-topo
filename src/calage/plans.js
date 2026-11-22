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
  return plansDxf.filter((p) => !p.ifc && p.contenu && (p.contenu.traits?.length || p.contenu.cercles?.length || p.contenu.points?.length) && estEnMn95(planRecale(p).bornes));
}

/** Plans du projet calés par cette application (ils ont leur « recette »), du plus récent au plus ancien. */
export function plansCales(plansDxf = []) {
  return plansDxf.filter((p) => p.calage).sort((a, b) => String(b.calage.le).localeCompare(String(a.calage.le)));
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
export function planCale({ lu, nom, fichier, resultat, reference, elements, id, le, nettoyage = null }) {
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
      elements: elements.map(({ type, role, plan, ref }) => ({ type, role, plan: [...plan], ref: [...ref] })),
      similitude: { ...resultat.similitude },
      echelleBrute: resultat.echelleBrute,
      echelleArrondie: resultat.echelleArrondie,
      verdict: resultat.verdict,
      ecartVerificationM: Math.max(0, ...resultat.elements.filter((e) => e.role === 'verification').map((e) => e.ecartM)),
      message: resultat.message,
      // Recette du nettoyage (calques écartés, couleurs, types, hachures, zone en coordonnées du plan reçu, préfixe).
      ...(nettoyage ? { nettoyage: JSON.parse(JSON.stringify(nettoyage)) } : {}),
    },
  };
}
