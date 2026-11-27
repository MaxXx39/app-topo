// Affaires d'un projet (0.344.0, refait en 0.346.0 d'après la demande du 27.11) : UN projet, plusieurs affaires (même
// désignation, numéro d'affaire différent) ; chaque affaire a UNE catégorie (ACQ, BÂT, GC, NAT, T/R, Autres… liste partagée par
// Drive, modifiable par l'Expert) et il y a au plus une affaire par catégorie dans un projet.
// - la 1re affaire est celle du cartouche (projet.cartouche.affaire, id « principale », catégorie projet.categoriePrincipale) ;
//   les autres sont dans projet.affaires [{ id, numero, categorie }] ;
// - un élément (levé, surface, plan DXF / PDF, dessin, réseau, plan de chantier, plateforme) porte des PASTILLES = des catégories :
//   `pastilles: ['GC', 'BÂT']`. Sans pastille, il se voit dans toutes les affaires. Avec pastilles, il ne se voit que dans les
//   affaires de ces catégories. Une surface ou une liste « autres » issue d'un levé suit son levé ;
// - Expert : voit tout (« Toutes ») ou une affaire, change les pastilles ; Base et Intermédiaire : une seule affaire, fixée par la
//   ligne choisie dans « Ouvrir », sans pouvoir en changer ;
// - un nouvel élément reçoit la pastille de l'affaire choisie ; le numéro d'affaire du cartouche et des exports suit l'affaire choisie.
import { nouvelIdentifiant } from './surface.js';
import { lireListesPartagees, ecrireListesPartagees } from '../reglages/listes-partagees.js';

export const PRINCIPALE = 'principale';
export const TOUTES = '';

/** Catégories de départ (liste modifiable par l'Expert, partagée par Drive). « BÂT » avec accent : le sous-dossier BAT existe déjà. */
export const CATEGORIES_DEPART = ['ACQ', 'BÂT', 'GC', 'NAT', 'T/R', 'Autres'];

/** Texte ou liste → noms de catégories propres (sans doublon, 12 signes au plus). */
export function nettoyerCategories(texteOuListe) {
  const morceaux = Array.isArray(texteOuListe) ? texteOuListe : String(texteOuListe ?? '').split(/[,;\n]/);
  const vus = new Set();
  const noms = [];
  for (const m of morceaux) {
    const nom = String(m).trim().slice(0, 12);
    if (nom && !vus.has(nom.toLowerCase())) {
      vus.add(nom.toLowerCase());
      noms.push(nom);
    }
  }
  return noms;
}

/** Catégories proposées : la liste partagée, sinon celles de départ. */
export function categoriesAffaires(listes = lireListesPartagees()) {
  const propres = nettoyerCategories(listes?.categoriesAffaires ?? []);
  return propres.length > 0 ? propres : [...CATEGORIES_DEPART];
}

/** Enregistre la liste des catégories (envoyée par Drive à tous les appareils). */
export function enregistrerCategoriesAffaires(texteOuListe) {
  ecrireListesPartagees({ ...lireListesPartagees(), categoriesAffaires: nettoyerCategories(texteOuListe) });
}

/** Listes du projet dont les éléments se rangent par affaire : [clé du projet, genre]. */
const GENRES = [['leves', 'leve'], ['surfaces', 'surface'], ['autres', 'autre'], ['plansDxf', 'plan'], ['dessins', 'dessin'], ['canalisations', 'reseau'], ['plansChantier', 'planChantier'], ['plateformes', 'plateforme']];

/** Tous les éléments qui se rangent par affaire : [{ genre, element }]. */
export function elementsDesAffaires(projet) {
  return GENRES.flatMap(([cle, genre]) => (projet?.[cle] ?? []).map((element) => ({ genre, element })));
}

/** Affaires du projet : la principale (numéro du cartouche) puis les autres. */
export function affairesDe(projet) {
  const numero = String(projet?.cartouche?.affaire ?? '').trim();
  return [{ id: PRINCIPALE, numero: numero || 'Affaire 1', categorie: projet?.categoriePrincipale ?? '', principale: true }, ...(projet?.affaires ?? [])];
}

/** Le projet a-t-il plusieurs affaires ? */
export const aPlusieursAffaires = (projet) => (projet?.affaires ?? []).length > 0;

/** Numéro d'une affaire (par son identifiant), ou null si elle n'existe plus. */
export function numeroDeLAffaire(projet, id) {
  return affairesDe(projet).find((a) => a.id === id)?.numero ?? null;
}

/** Affaire par son identifiant, ou null. */
export const affaireParId = (projet, id) => affairesDe(projet).find((a) => a.id === id) ?? null;

function verifier(projet, id, numero, categorie) {
  const n = String(numero ?? '').trim().slice(0, 30);
  const c = String(categorie ?? '').trim();
  if (!n) throw new Error('Tapez le numéro de l\'affaire.');
  if (!c) throw new Error('Choisissez la catégorie de l\'affaire (GC, BÂT…).');
  if (affairesDe(projet).some((a) => a.id !== id && a.numero.toLowerCase() === n.toLowerCase())) throw new Error(`L'affaire « ${n} » existe déjà dans ce projet.`);
  if (affairesDe(projet).some((a) => a.id !== id && a.categorie.toLowerCase() === c.toLowerCase())) throw new Error(`Ce projet a déjà une affaire « ${c} » (une seule par catégorie).`);
  return { n, c };
}

/** Ajoute une affaire (numéro + catégorie, sans doublon). Renvoie l'affaire ; lève une erreur lisible sinon. */
export function ajouterAffaire(projet, numero, categorie) {
  const { n, c } = verifier(projet, null, numero, categorie);
  const affaire = { id: nouvelIdentifiant(), numero: n, categorie: c };
  projet.affaires = [...(projet.affaires ?? []), affaire];
  return affaire;
}

/**
 * Change le numéro et / ou la catégorie d'une affaire (la principale : numéro du cartouche). Les pastilles des éléments
 * qui portaient l'ancienne catégorie prennent la nouvelle. Lève une erreur lisible si c'est refusé.
 */
export function modifierAffaire(projet, id, numero, categorie) {
  const { n, c } = verifier(projet, id, numero, categorie);
  const trouvee = affaireParId(projet, id);
  if (!trouvee) return false;
  const avant = { ...trouvee }; // copie : l'affaire est modifiée juste après
  if (id === PRINCIPALE) {
    projet.cartouche = { ...(projet.cartouche ?? {}), affaire: n };
    projet.categoriePrincipale = c;
  } else {
    const a = projet.affaires.find((x) => x.id === id);
    a.numero = n;
    a.categorie = c;
  }
  if (avant.categorie && avant.categorie !== c) {
    for (const { element } of elementsDesAffaires(projet)) {
      if (Array.isArray(element.pastilles) && element.pastilles.includes(avant.categorie)) element.pastilles = [...new Set(element.pastilles.map((x) => (x === avant.categorie ? c : x)))];
    }
  }
  return true;
}

/** Retire une affaire VIDE (aucun élément n'a sa pastille). Renvoie un texte d'erreur ou null. */
export function retirerAffaire(projet, id) {
  if (id === PRINCIPALE) return 'L\'affaire principale ne peut pas être retirée.';
  const a = affaireParId(projet, id);
  if (!a) return 'Affaire introuvable.';
  if (elementsDesAffaires(projet).some(({ element }) => (element.pastilles ?? []).includes(a.categorie))) return 'Des éléments ont encore la pastille de cette affaire : changez leurs pastilles d\'abord.';
  projet.affaires = (projet.affaires ?? []).filter((x) => x.id !== id);
  return null;
}

/** Pastilles d'un élément (catégories) : les siennes, sinon celles de son levé (surface / liste « autres » issue d'un levé). */
export function pastillesDe(projet, element, genre = '') {
  if ((genre === 'surface' || genre === 'autre') && element?.leveId) {
    const leve = (projet?.leves ?? []).find((l) => l.id === element.leveId);
    if (leve) return leve.pastilles ?? [];
  }
  return element?.pastilles ?? [];
}

// --- Affaire choisie sur CETTE tablette ---

let choisie = TOUTES;
export const affaireChoisie = () => choisie;
export function definirAffaire(id) {
  choisie = id || TOUTES;
}

/** L'élément est-il visible dans l'affaire choisie ? Toutes : oui ; sans pastille : oui ; sinon la catégorie de l'affaire doit y être. */
export function dansAffaire(projet, element, genre = '', choix = choisie) {
  if (!choix) return true;
  const pastilles = pastillesDe(projet, element, genre);
  if (pastilles.length === 0) return true;
  const categorie = affaireParId(projet, choix)?.categorie;
  return Boolean(categorie) && pastilles.includes(categorie);
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

/** Change les pastilles d'un élément (Expert). Vide = visible partout. Renvoie vrai si l'élément a été trouvé. */
export function definirPastilles(projet, idElement, pastilles) {
  const trouve = elementsDesAffaires(projet).find(({ element }) => element.id === idElement);
  if (!trouve) return false;
  const liste = nettoyerCategories(pastilles);
  if (liste.length) trouve.element.pastilles = liste;
  else delete trouve.element.pastilles;
  return true;
}

/** Les éléments encore sans pastille reçoivent celle de l'affaire choisie (nouveaux éléments) : `connus` = ids déjà là. Renvoie le nombre rangé. */
export function rangerNouveauxDansAffaire(projet, connus, choix = choisie) {
  const categorie = choix ? affaireParId(projet, choix)?.categorie : '';
  let nb = 0;
  for (const { element } of elementsDesAffaires(projet)) {
    if (connus.has(element.id)) continue;
    connus.add(element.id);
    if (element.pastilles !== undefined || !categorie) continue;
    element.pastilles = [categorie];
    nb += 1;
  }
  return nb;
}

/** Projets de la 0.344.0 : `affaireId` devient une pastille (la catégorie de cette affaire, sinon « Autres »). Renvoie le nombre changé. */
export function migrerAffaires(projet) {
  let nb = 0;
  for (const a of projet?.affaires ?? []) if (a.categorie === undefined) a.categorie = '';
  for (const { element } of elementsDesAffaires(projet)) {
    if (element.affaireId === undefined) continue;
    const categorie = affaireParId(projet, element.affaireId)?.categorie || 'Autres';
    delete element.affaireId;
    element.pastilles = [...new Set([...(element.pastilles ?? []), categorie])];
    nb += 1;
  }
  return nb;
}

/**
 * Fusionne le projet `source` dans `cible` : il devient une nouvelle affaire (numéro et catégorie donnés), tous ses levés,
 * surfaces, plans, dessins, réseaux, plans de chantier et plateformes passent dans `cible` avec la pastille de cette catégorie ;
 * points de contrôle, contrôles, implantations et points à implanter sont repris tels quels. Si des identifiants sont déjà pris
 * (même projet, ou copie) : erreur, rien n'est changé. Renvoie { affaire, nombre }.
 */
export function fusionnerProjet(cible, source, numero, categorie) {
  const aPrendre = [...GENRES.map(([cle]) => cle), 'pointsControle', 'controles', 'implantations', 'aImplanter'];
  const pris = new Set(elementsDesAffaires(cible).map(({ element }) => element.id));
  for (const cle of aPrendre) for (const e of cible?.[cle] ?? []) pris.add(e.id);
  for (const cle of aPrendre) for (const e of source?.[cle] ?? []) {
    if (pris.has(e.id)) throw new Error('Fusion impossible : ce projet a des éléments en commun avec celui-ci (est-ce une copie ?).');
  }
  const affaire = ajouterAffaire(cible, numero, categorie);
  let nombre = 0;
  for (const [cle] of GENRES) {
    const copies = JSON.parse(JSON.stringify(source?.[cle] ?? []));
    for (const e of copies) {
      delete e.affaireId;
      e.pastilles = [affaire.categorie];
    }
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
