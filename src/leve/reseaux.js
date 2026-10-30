// Réseaux du recollement (0.101.0, demande du 30.10.2026) : un levé de recollement = un réseau
// (EU, EC…), dessiné de la couleur du réseau. Comme les libellés (voir leve/libelles.js) : ceux de
// départ ne changent pas de nom (leur couleur oui) ; ceux ajoutés se modifient dans les réglages
// (Expert) ou depuis Lever, et sont partagés par Drive (listes partagées : reseaux = { ajoutes:
// [[abréviation, description, couleur]], couleurs: { EU: '#…' } }).
// Couleurs de départ : proposition, à valider par l'utilisateur (modifiables).
import { lireListesPartagees, ecrireListesPartagees, surChangementListes } from '../reglages/listes-partagees.js';

export const RESEAUX_DEPART = [
  ['EU', 'eaux usées', '#dc2626'],
  ['EC', 'eaux claires', '#2563eb'],
  ['EM', 'eaux mixtes', '#7c3aed'],
  ['AEP', 'eau potable', '#0ea5e9'],
  ['GAZ', 'gaz', '#ca8a04'],
  ['ELE', 'électricité', '#ea580c'],
  ['TEL', 'télécom', '#16a34a'],
  ['CAD', 'chauffage à distance', '#db2777'],
  ['ECL', 'éclairage public', '#92400e'],
];

// Matériaux proposés (le dernier choisi est gardé d'un point à l'autre).
export const MATERIAUX = ['PVC', 'PE', 'PP', 'Béton', 'Grès', 'Fonte', 'Acier', 'Autre'];

let enCache = null;
surChangementListes(() => (enCache = null));

/** Abréviations des réseaux de départ : leur nom ne se modifie pas. */
export function abreviationsReseauxDepart() {
  return new Set(RESEAUX_DEPART.map(([a]) => a));
}

/** Liste complète [[abréviation, description, couleur]] à partir de la part partagée { ajoutes, couleurs }. */
export function assemblerReseaux(partage) {
  const couleurs = partage?.couleurs ?? {};
  const fixes = abreviationsReseauxDepart();
  const depart = RESEAUX_DEPART.map(([a, d, c]) => [a, d, couleurs[a] || c]);
  const ajoutes = (partage?.ajoutes ?? []).filter(([a]) => a && !fixes.has(a)).map(([a, d, c]) => [a, d ?? '', c ?? '']);
  return [...depart, ...ajoutes];
}

/** Part à partager d'une liste complète : { ajoutes, couleurs } (couleur des réseaux de départ si changée). */
export function partDesReseaux(liste) {
  const fixes = abreviationsReseauxDepart();
  const departs = new Map(RESEAUX_DEPART.map(([a, , c]) => [a, c]));
  return {
    ajoutes: liste.filter(([a]) => !fixes.has(a)).map(([a, d, c]) => [a, d ?? '', c ?? '']),
    couleurs: Object.fromEntries(liste.filter(([a, , c]) => fixes.has(a) && c && c !== departs.get(a)).map(([a, , c]) => [a, c])),
  };
}

/** Réseaux : ceux de départ puis ceux ajoutés ([[abréviation, description, couleur]]), une copie. */
export function lireReseaux() {
  if (!enCache) enCache = assemblerReseaux(lireListesPartagees().reseaux);
  return structuredClone(enCache);
}

/** Enregistre les réseaux dans les listes partagées (envoyées sur Drive à tous les appareils). */
export function enregistrerReseaux(liste) {
  ecrireListesPartagees({ ...lireListesPartagees(), reseaux: partDesReseaux(liste) });
  enCache = null;
}

/** Couleur d'un réseau (abréviation), ou gris s'il n'est plus dans la liste. */
export function couleurDuReseau(abreviation, reseaux = lireReseaux()) {
  return reseaux.find(([a]) => a === abreviation)?.[2] || '#6b7280';
}
