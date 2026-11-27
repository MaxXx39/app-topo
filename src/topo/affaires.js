// Affaires d'un projet (0.344.0, demande du 27.11) : UN projet, plusieurs affaires (même désignation, numéro d'affaire différent :
// terrassement GC 8 114, bâtiment béton 10 203…). Fonctionne comme les sous-dossiers :
// - la 1re affaire est celle du cartouche (projet.cartouche.affaire, id « principale ») ; les autres sont dans projet.affaires
//   [{ id, numero }] ;
// - un élément (levé, surface, plan DXF / PDF, dessin, réseau, plan de chantier, plateforme) porte `affaireId` ; sans `affaireId`,
//   il est dans l'affaire principale ; une surface ou une liste « autres » issue d'un levé suit son levé ;
// - l'affaire choisie est un réglage de CHAQUE tablette (« Toutes » = rien n'est filtré) ;
// - un nouvel élément est rangé dans l'affaire choisie ; on peut le changer d'affaire (oubli, changement) ;
// - le numéro d'affaire du cartouche et des exports est celui de l'affaire choisie.
import { nouvelIdentifiant } from './surface.js';

export const PRINCIPALE = 'principale';
export const TOUTES = '';

/** Listes du projet dont les éléments se rangent par affaire : [clé du projet, genre]. */
const GENRES = [['leves', 'leve'], ['surfaces', 'surface'], ['autres', 'autre'], ['plansDxf', 'plan'], ['dessins', 'dessin'], ['canalisations', 'reseau'], ['plansChantier', 'planChantier'], ['plateformes', 'plateforme']];

/** Tous les éléments qui se rangent par affaire : [{ genre, element }]. */
export function elementsDesAffaires(projet) {
  return GENRES.flatMap(([cle, genre]) => (projet?.[cle] ?? []).map((element) => ({ genre, element })));
}

/** Affaires du projet : la principale (numéro du cartouche) puis les autres. */
export function affairesDe(projet) {
  const numero = String(projet?.cartouche?.affaire ?? '').trim();
  return [{ id: PRINCIPALE, numero: numero || 'Affaire 1', principale: true }, ...(projet?.affaires ?? [])];
}

/** Le projet a-t-il plusieurs affaires ? */
export const aPlusieursAffaires = (projet) => (projet?.affaires ?? []).length > 0;

/** Numéro d'une affaire (par son identifiant), ou null si elle n'existe plus. */
export function numeroDeLAffaire(projet, id) {
  return affairesDe(projet).find((a) => a.id === id)?.numero ?? null;
}

/** Ajoute une affaire (numéro tapé, sans doublon). Renvoie l'affaire ; lève une erreur lisible sinon. */
export function ajouterAffaire(projet, numero) {
  const n = String(numero ?? '').trim().slice(0, 30);
  if (!n) throw new Error('Tapez le numéro de l\'affaire.');
  if (affairesDe(projet).some((a) => a.numero.toLowerCase() === n.toLowerCase())) throw new Error(`L'affaire « ${n} » existe déjà dans ce projet.`);
  const affaire = { id: nouvelIdentifiant(), numero: n };
  projet.affaires = [...(projet.affaires ?? []), affaire];
  return affaire;
}

/** Change le numéro d'une affaire (la principale : le numéro du cartouche). Renvoie le même texte d'erreur que ajouterAffaire. */
export function renommerAffaire(projet, id, numero) {
  const n = String(numero ?? '').trim().slice(0, 30);
  if (!n) throw new Error('Tapez le numéro de l\'affaire.');
  if (affairesDe(projet).some((a) => a.id !== id && a.numero.toLowerCase() === n.toLowerCase())) throw new Error(`L'affaire « ${n} » existe déjà dans ce projet.`);
  if (id === PRINCIPALE) {
    projet.cartouche = { ...(projet.cartouche ?? {}), affaire: n };
    return true;
  }
  const a = (projet.affaires ?? []).find((x) => x.id === id);
  if (!a) return false;
  a.numero = n;
  return true;
}

/** Retire une affaire VIDE (sans élément). Renvoie un texte d'erreur ou null. */
export function retirerAffaire(projet, id) {
  if (id === PRINCIPALE) return 'L\'affaire principale ne peut pas être retirée.';
  if (elementsDesAffaires(projet).some(({ genre, element }) => affaireDe(projet, element, genre) === id)) return 'Cette affaire contient encore des éléments : changez-les d\'affaire d\'abord.';
  projet.affaires = (projet.affaires ?? []).filter((a) => a.id !== id);
  return null;
}

/** Affaire d'un élément : la sienne, sinon celle de son levé (surface / liste « autres » issue d'un levé), sinon la principale. */
export function affaireDe(projet, element, genre = '') {
  if ((genre === 'surface' || genre === 'autre') && element?.leveId) {
    const leve = (projet?.leves ?? []).find((l) => l.id === element.leveId);
    if (leve) return leve.affaireId ?? PRINCIPALE;
  }
  const id = element?.affaireId ?? PRINCIPALE;
  return id === PRINCIPALE || (projet?.affaires ?? []).some((a) => a.id === id) ? id : PRINCIPALE; // affaire disparue : retour à la principale
}

// --- Affaire choisie sur CETTE tablette ---

let choisie = TOUTES;
export const affaireChoisie = () => choisie;
export function definirAffaire(id) {
  choisie = id || TOUTES;
}

/** L'élément est-il dans l'affaire choisie (Toutes : oui) ? */
export function dansAffaire(projet, element, genre = '', choix = choisie) {
  return !choix || affaireDe(projet, element, genre) === choix;
}

/** Numéro d'affaire à écrire sur les exports et le cartouche : celui de l'affaire choisie, sinon celui de l'affaire principale. */
export function numeroAffaireActif(projet, choix = choisie) {
  const numero = choix ? numeroDeLAffaire(projet, choix) : null;
  return numero ?? affairesDe(projet)[0].numero;
}

/** Cartouche du projet avec le numéro d'affaire de l'affaire choisie (exports, PDF, noms de fichiers). */
export function cartoucheActif(projet, choix = choisie) {
  const c = projet?.cartouche ?? {};
  if (!choix || choix === PRINCIPALE) return c;
  return { ...c, affaire: numeroAffaireActif(projet, choix) };
}

/** Change un élément d'affaire (oubli, changement). Renvoie vrai si l'élément a été trouvé. */
export function deplacerVersAffaire(projet, idElement, affaireId) {
  const trouve = elementsDesAffaires(projet).find(({ element }) => element.id === idElement);
  if (!trouve || numeroDeLAffaire(projet, affaireId) === null) return false;
  if (affaireId === PRINCIPALE) delete trouve.element.affaireId;
  else trouve.element.affaireId = affaireId;
  return true;
}

/** Les éléments encore sans affaire reçoivent l'affaire choisie (nouveaux éléments) : `connus` = ids déjà là. Renvoie le nombre rangé. */
export function rangerNouveauxDansAffaire(projet, connus, choix = choisie) {
  let nb = 0;
  for (const { element } of elementsDesAffaires(projet)) {
    if (connus.has(element.id)) continue;
    connus.add(element.id);
    if (element.affaireId !== undefined || !choix || choix === PRINCIPALE) continue;
    element.affaireId = choix;
    nb += 1;
  }
  return nb;
}

/**
 * Fusionne le projet `source` dans `cible` : il devient une nouvelle affaire (son numéro d'affaire, ou son nom), tous ses levés,
 * surfaces, plans, dessins, réseaux, plans de chantier et plateformes passent dans `cible` avec cette affaire ; points de
 * contrôle, contrôles, implantations et points à implanter sont repris tels quels. Si des identifiants sont déjà pris
 * (même projet, ou copie) : erreur, rien n'est changé. Renvoie { affaire, nombre }.
 */
export function fusionnerProjet(cible, source) {
  const aPrendre = [...GENRES.map(([cle]) => cle), 'pointsControle', 'controles', 'implantations', 'aImplanter'];
  const pris = new Set(elementsDesAffaires(cible).map(({ element }) => element.id));
  for (const cle of aPrendre) for (const e of cible?.[cle] ?? []) pris.add(e.id);
  for (const cle of aPrendre) for (const e of source?.[cle] ?? []) {
    if (pris.has(e.id)) throw new Error('Fusion impossible : ce projet a des éléments en commun avec celui-ci (est-ce une copie ?).');
  }
  const base = String(source?.cartouche?.affaire ?? '').trim() || String(source?.nom ?? '').trim() || 'Affaire fusionnée';
  let numero = base;
  for (let k = 2; affairesDe(cible).some((a) => a.numero.toLowerCase() === numero.toLowerCase()); k += 1) numero = `${base} (${k})`;
  const affaire = ajouterAffaire(cible, numero);
  let nombre = 0;
  for (const [cle] of GENRES) {
    const copies = JSON.parse(JSON.stringify(source?.[cle] ?? []));
    // L'affaire de la source (ses propres sous-affaires comprises) devient l'affaire fusionnée.
    for (const e of copies) e.affaireId = affaire.id;
    cible[cle] = [...(cible[cle] ?? []), ...copies];
    nombre += copies.length;
  }
  for (const cle of ['pointsControle', 'controles', 'implantations', 'aImplanter']) {
    cible[cle] = [...(cible[cle] ?? []), ...JSON.parse(JSON.stringify(source?.[cle] ?? []))];
  }
  return { affaire, nombre };
}

// --- Choix gardé sur la tablette (comme le sous-dossier) ---
const CLE_AFFAIRE = 'topo-affaire';
function magasin() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
/** Range le choix de cette tablette pour ce projet (Toutes = rien de gardé). */
export function retenirAffaire(idProjet, id, stock = magasin()) {
  if (!idProjet || !stock) return;
  try {
    const tout = JSON.parse(stock.getItem(CLE_AFFAIRE) ?? '{}');
    if (id) tout[idProjet] = id; else delete tout[idProjet];
    stock.setItem(CLE_AFFAIRE, JSON.stringify(tout));
  } catch { /* le choix revient à « Toutes » */ }
}
/** Choix retenu sur cette tablette pour ce projet (Toutes s'il n'y en a pas ou si l'affaire n'existe plus). */
export function lireAffaireRetenue(projet, stock = magasin()) {
  try {
    const id = JSON.parse(stock?.getItem(CLE_AFFAIRE) ?? '{}')[projet?.id] ?? TOUTES;
    return id && numeroDeLAffaire(projet, id) !== null ? id : TOUTES;
  } catch { return TOUTES; }
}
