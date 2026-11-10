// Types de plans DXF (0.194.0, demande du 10.11, Expert) : on classe un plan à l'import (GEOOFF, GEOPERRIN, TER, CANA, Autres…) ;
// le type s'affiche en petite pastille avec son nom. La liste est partagée par Drive avec les autres listes (partie « typesDxf »)
// et modifiable (Contenu du projet › Plans DXF › « Modifier les types »).
import { lireListesPartagees, ecrireListesPartagees } from '../reglages/listes-partagees.js';

export const TYPES_DXF_DEPART = ['GEOOFF', 'GEOPERRIN', 'TER', 'CANA', 'Autres'];
// Couleurs des pastilles, dans l'ordre de la liste (la 1re pour le 1er type, etc.).
const COULEURS_TYPES = ['#2563eb', '#7c3aed', '#16a34a', '#ea580c', '#6b7280', '#db2777', '#0891b2', '#a16207'];

/** Types texte → liste propre : noms séparés par des virgules ou des retours à la ligne, sans doublon, 20 signes au plus. */
export function nettoyerTypes(texteOuListe) {
  const morceaux = Array.isArray(texteOuListe) ? texteOuListe : String(texteOuListe ?? '').split(/[,;\n]/);
  const vus = new Set();
  const noms = [];
  for (const m of morceaux) {
    const nom = String(m).trim().slice(0, 20);
    if (nom && !vus.has(nom.toLowerCase())) {
      vus.add(nom.toLowerCase());
      noms.push(nom);
    }
  }
  return noms;
}

/** Types proposés : ceux de la liste partagée, sinon ceux de départ. Renvoie [{ nom, couleur }]. */
export function lireTypesDxf(listes = lireListesPartagees()) {
  const propres = nettoyerTypes(listes?.typesDxf ?? []);
  return (propres.length > 0 ? propres : TYPES_DXF_DEPART).map((nom, i) => ({ nom, couleur: COULEURS_TYPES[i % COULEURS_TYPES.length] }));
}

/** Couleur de la pastille d'un type (gris si le type n'est plus dans la liste). */
export function couleurDuType(nom, types = lireTypesDxf()) {
  return types.find((t) => t.nom === nom)?.couleur ?? '#6b7280';
}

/** Enregistre la liste des types dans les listes partagées (envoyée sur Drive à tous les appareils). */
export function enregistrerTypesDxf(texteOuListe) {
  ecrireListesPartagees({ ...lireListesPartagees(), typesDxf: nettoyerTypes(texteOuListe) });
}
