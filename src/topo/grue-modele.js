// Plans de chantier (0.311.0) : modèles de grues « d'après la fiche technique ». Un modèle = toutes les caractéristiques d'une
// grue (flèches, tableaux de charge, tours et pieds, hauteurs sous crochet, dimensions) : ceux livrés (Liebherr 172 EC-B 8,
// Condecta EURO 4513) et ceux de l'utilisateur (rangés dans projet.modelesGrues, donc partagés par Drive avec le projet).
//
// Forme d'un modèle :
//  { id, nom, fabricant, type: 'tour' | 'automontante' | 'autre', notes, estimes: [clés de dim pas données par la fiche],
//    dim: { flecheLargeur, flecheDebut, flecheProfondeur, flecheAuDessusHsc, teteAuDessusFleche, contreFlecheArriere,
//           contreFlecheLargeur, arriereTotal, plateforme {l, b} | null, cabine {l, b} | null, treuil | null },
//    infos: [[titre, texte]],
//    fleches: [{ nom m, rMax m, rPlein m?, charges [[portée m, charge t]], charges2 [[…]]?, rPlein2?, sections [n°]?,
//                contrepoids { t, blocs }? }],
//    elements?: { n°: { nom, reel, kg } }, blocs?: { A: { t, haut, long, ep, couleur } },
//    tours: [{ id, nom, famille, mat, pied { type: 'FA' | 'UC' | 'CB' | 'ST', c }, element, hauteurs [[étiquette, HSC m, options]] }] }
// Charge au rayon r = charge de la première paire dont la portée est ≥ r (la fiche ne donne que des valeurs à certaines
// portées : on prend la suivante, côté prudent, sans calculer entre deux).
import { FLECHES, TOURS, ELEMENTS_FLECHE, BLOCS, DIMENSIONS } from './grue-liebherr-172-donnees.js';
import { MODELE_CONDECTA } from './grue-condecta-4513-donnees.js';

export const MODELE_LIEBHERR = {
  id: 'liebherr-172-ecb',
  integre: true,
  nom: 'Liebherr 172 EC-B 8 Litronic',
  fabricant: 'Liebherr',
  type: 'tour',
  court: '172 EC-B',
  notes: 'Fiche technique Liebherr 172 EC-B 8 Litronic (EN 14439, C25, 2025-02). Charges valables jusqu\'à 50 m de hauteur sous crochet. Cotes verticales (flèche au-dessus du crochet, tête) lues sur les dessins : à vérifier.',
  estimes: ['teteAuDessusFleche', 'flecheAuDessusHsc'],
  chargesValablesJusqua: 50,
  dim: {
    flecheLargeur: DIMENSIONS.flecheLargeur, flecheDebut: DIMENSIONS.debutFleche, flecheProfondeur: 1.69, flecheAuDessusHsc: 2.9, teteAuDessusFleche: 2.5,
    contreFlecheArriere: DIMENSIONS.contreFlecheArriere, contreFlecheLargeur: DIMENSIONS.contreFleche.b, arriereTotal: DIMENSIONS.arriereTotal,
    plateforme: DIMENSIONS.plateforme, cabine: DIMENSIONS.cabine, treuil: { x0: -11.9, x1: -8.2 },
  },
  infos: [['Norme', 'EN 14439:2009 – C25'], ['Treuil 24 kW FU', 'câble 113 m ; 8 t à 0–16 m/min, 0,5 t à 0–86 m/min']],
  elements: ELEMENTS_FLECHE,
  blocs: BLOCS,
  fleches: FLECHES.map((f) => ({
    nom: f.nom, rMax: f.rMax, rPlein: f.rPlein, sections: f.sections, portee: f.nom, charges: f.lm1,
    ...(f.lm2 ? { charges2: f.lm2, rPlein2: f.rPlein2 } : {}), contrepoids: f.contrepoids,
  })),
  tours: TOURS,
};

export { MODELE_CONDECTA };
export const MODELES_DE_BASE = [MODELE_LIEBHERR, MODELE_CONDECTA];

// ---------------------------------------------------------------- Registre (modèles livrés + ceux du projet)

let personnalises = [];
let version = 0;
/** Modèles du projet ouvert (appelé par la page Plans de chantier à l'ouverture et à chaque changement). */
export function definirModelesPerso(liste) {
  personnalises = Array.isArray(liste) ? liste : [];
  version += 1;
}
export const versionModeles = () => version;
// 0.355.0 : un modèle livré peut être modifié ; la version modifiée est rangée dans le projet avec le même id et `base: true`,
// elle remplace le modèle livré (on peut revenir à l'original en la supprimant).
export const tousLesModeles = () => [
  ...MODELES_DE_BASE.map((m) => personnalises.find((p) => p.id === m.id) ?? m),
  ...personnalises.filter((p) => !MODELES_DE_BASE.some((m) => m.id === p.id)),
];
/** Vrai pour un modèle créé par l'utilisateur (ni livré, ni livré modifié) : dessin générique selon son type. */
export const estModeleGenerique = (m) => !m?.integre && !m?.base;
/** Modèle livré d'origine pour un id (null si ce n'est pas un modèle livré). */
export const modeleLivre = (id) => MODELES_DE_BASE.find((m) => m.id === id) ?? null;
/** Modèle d'un id ; à défaut (modèle supprimé, ancien objet) le premier livré. */
export const modeleDe = (id) => tousLesModeles().find((m) => m.id === id) ?? MODELE_LIEBHERR;

// ---------------------------------------------------------------- Lecture / écriture des champs de l'éditeur

const nombre = (v) => Number(String(v).trim().replace(',', '.'));

/**
 * Charges tapées « 12.35:6, 12.69:5.8 » (portée en m : charge en t, séparées par virgule, point-virgule ou retour à la
 * ligne) → [[portée, charge]] triées par portée. Renvoie { liste, erreurs }.
 */
export function lireCharges(texte) {
  const liste = [];
  const erreurs = [];
  for (const brut of String(texte ?? '').split(/[;\n,]+/)) {
    const x = brut.trim();
    if (!x) continue;
    const m = /^([\d.,]+)\s*[:=]\s*([\d.,]+)$/.exec(x);
    const r = m ? nombre(m[1]) : NaN;
    const t = m ? nombre(m[2]) : NaN;
    if (!m || !(r > 0) || !(t > 0)) erreurs.push(`« ${x} » : écrire portée:charge, par exemple 20:5.2`);
    else liste.push([r, t]);
  }
  liste.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < liste.length; i++) if (liste[i][1] > liste[i - 1][1] + 1e-9) erreurs.push(`La charge augmente à ${liste[i][0]} m (${liste[i][1]} t) : à vérifier.`);
  return { liste, erreurs };
}
export const texteCharges = (liste) => (liste ?? []).map(([r, t]) => `${r}:${t}`).join(', ');

/** Hauteurs tapées « 18, 21, 24 » ou « 3 éléments:14.8, 4:17.3 » (étiquette:HSC) → [[étiquette, h]]. */
export function lireHauteurs(texte) {
  const liste = [];
  const erreurs = [];
  for (const brut of String(texte ?? '').split(/[;\n,]+/)) {
    const x = brut.trim();
    if (!x) continue;
    const m = /^(?:(.+?)\s*[:=]\s*)?([\d.,]+)$/.exec(x);
    const h = m ? nombre(m[2]) : NaN;
    if (!m || !(h > 0)) erreurs.push(`« ${x} » : écrire une hauteur (18) ou étiquette:hauteur (rang 3:14.8)`);
    else liste.push([(m[1] ?? String(h)).trim(), h]);
  }
  return { liste, erreurs };
}
export const texteHauteurs = (liste) => (liste ?? []).map(([e, h]) => (e === String(h) ? String(h) : `${e}:${h}`)).join(', ');

/** Contrôle d'un modèle : liste de phrases compréhensibles (vide = bon). */
export function validerModele(m) {
  const e = [];
  if (!String(m.nom ?? '').trim()) e.push('Le modèle doit avoir un nom.');
  if (!m.fleches?.length) e.push('Il faut au moins une longueur de flèche.');
  for (const f of m.fleches ?? []) {
    if (!(f.nom > 0)) e.push('Une flèche n\'a pas de longueur.');
    if (!f.charges?.length) e.push(`Flèche ${f.nom} m : aucune charge (portée:charge).`);
  }
  const noms = (m.fleches ?? []).map((f) => f.nom);
  if (new Set(noms).size !== noms.length) e.push('Deux flèches ont la même longueur.');
  if (!m.tours?.length) e.push('Il faut au moins une tour (avec ses hauteurs sous crochet).');
  for (const t of m.tours ?? []) {
    if (!t.hauteurs?.length) e.push(`Tour « ${t.nom} » : aucune hauteur sous crochet.`);
    if (!(t.mat > 0)) e.push(`Tour « ${t.nom} » : largeur du mât manquante.`);
  }
  return e;
}

/** Modèle neuf (éditeur) : une flèche et une tour à remplir. */
export function modeleVide(nom = 'Nouveau modèle') {
  return {
    id: `grue-${Date.now().toString(36)}`, nom, fabricant: '', type: 'tour', notes: '', estimes: [],
    dim: { flecheLargeur: 1.2, flecheDebut: 0, flecheProfondeur: 1.5, flecheAuDessusHsc: 2.5, teteAuDessusFleche: 3, contreFlecheArriere: 10, contreFlecheLargeur: 1.8, arriereTotal: 10, plateforme: null, cabine: null, treuil: null },
    infos: [],
    fleches: [{ nom: 40, rMax: 40, charges: [[20, 4]] }],
    tours: [{ id: 'tour1', nom: 'Tour 1', famille: 'Tour', mat: 1.6, pied: { type: 'FA' }, element: 3, hauteurs: [['20', 20]] }],
  };
}

/** Copie profonde d'un modèle (pour dupliquer ou éditer) sans l'indicateur « livré ». */
export function copierModele(m, nom) {
  const c = JSON.parse(JSON.stringify(m));
  delete c.integre;
  delete c.base;
  c.id = `grue-${Date.now().toString(36)}`;
  c.nom = nom ?? `${m.nom} (copie)`;
  return c;
}
