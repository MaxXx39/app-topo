// Bibliothèque du Levé chantier (0.175.0, demande du 09.11) : libellés (Chambre, Tuyau…) et natures
// (EU, EC… / Haute, Basse…), à part des libellés des autres levés, modifiables en Expert et partagées
// par Drive (listes partagées, partie « chantier » = { libelles, natures: { reseau, bordure } }).
// Sans rien de partagé : les listes de départ (topo/chantier.js).
import { LIBELLES_CHANTIER_DEPART, NATURES_RESEAU_DEPART, NATURES_BORDURE_DEPART, couleurDeNature } from '../topo/chantier.js';
import { FORMES } from '../plan/formes.js';
import { lireListesPartagees, ecrireListesPartagees } from '../reglages/listes-partagees.js';

/** Remet un libellé en ordre : abréviation sans tiret ni espace, champs et modes connus. Renvoie null si inutilisable. */
export function nettoyerLibelle(l) {
  const abreviation = String(l?.abreviation ?? '').replace(/[-\s]/g, '').trim();
  const nom = String(l?.nom ?? '').trim();
  if (!abreviation || !nom) return null;
  const champsPermis = ['diametre', 'gaine', 'nombre', 'profondeur', 'materiau', 'remarque'];
  const modesPermis = ['dessus', 'tampon', 'fe'];
  return {
    abreviation,
    nom,
    // Nom court (rangée de Lever) : par défaut, le nom lui-même.
    court: String(l?.court ?? '').trim() || nom,
    // Forme du point sur le plan (celle du libellé) ; les anciennes valeurs « rond » deviennent le rond plein.
    forme: FORMES.some(([cle]) => cle === l?.forme) ? l.forme : '',
    reseau: l?.reseau !== false,
    ouvrage: Boolean(l?.ouvrage),
    modes: (l?.modes ?? []).filter((m) => modesPermis.includes(m)),
    champs: (l?.champs ?? []).filter((c) => champsPermis.includes(c)),
  };
}

/** Libellés du Levé chantier : ceux de la liste partagée, sinon ceux de départ (une copie). */
export function lireLibellesChantier() {
  const partage = lireListesPartagees().chantier?.libelles;
  const propres = Array.isArray(partage) ? partage.map(nettoyerLibelle).filter(Boolean) : [];
  return structuredClone(propres.length > 0 ? propres : LIBELLES_CHANTIER_DEPART);
}

/** Natures du Levé chantier : { reseau: [...], bordure: [...], couleurs: { nature: '#rrggbb' } }. */
export function lireNaturesChantier() {
  const n = lireListesPartagees().chantier?.natures;
  const liste = (valeur, depart) => {
    const propre = [...new Set((Array.isArray(valeur) ? valeur : []).map((t) => String(t).trim()).filter(Boolean))];
    return propre.length > 0 ? propre : [...depart];
  };
  const couleurs = {};
  for (const [nom, c] of Object.entries(n?.couleurs ?? {})) if (/^#[0-9a-f]{6}$/i.test(c)) couleurs[nom] = c;
  return { reseau: liste(n?.reseau, NATURES_RESEAU_DEPART), bordure: liste(n?.bordure, NATURES_BORDURE_DEPART), couleurs };
}

/** Enregistre libellés et natures dans les listes partagées (envoyées sur Drive à tous les appareils). */
export function enregistrerBibliothequeChantier({ libelles, natures }) {
  ecrireListesPartagees({
    ...lireListesPartagees(),
    chantier: { libelles: libelles.map(nettoyerLibelle).filter(Boolean), natures },
  });
}

/** Libellé de cette abréviation (ou le premier de la liste s'il n'existe plus). */
export function libelleChantier(abreviation, libelles = lireLibellesChantier()) {
  return libelles.find((l) => l.abreviation === abreviation) ?? libelles[0];
}

/** Couleur des points d'une nature (voir COULEURS_NATURES_DEPART). */
export function couleurNatureChantier(nature, couleurs = lireNaturesChantier().couleurs) {
  return couleurDeNature(nature, couleurs);
}
