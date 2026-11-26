// Gestion du matériel (0.274.0, Expert, site seulement) : le parc de l'entreprise (un seul pour tous
// les projets). Repris de l'appli « Planning du matériel » (dépôt Gestion-materiel-topo, Python),
// réécrit ici sans serveur. Rien ici ne touche l'écran ni la mémoire : tout est testé.
//
// Forme du parc :
// { version: 1, modifieLe (ISO),
//   categories: [{ id, nom, ordre }],
//   articles: [{ id, categorieId, ordre, numero (n° interne, unique : le même que la tablette),
//                designation (calculée : « Marque - Modèle - Autre - N° interne », 0.324.0), autre (3e champ de la désignation),
//                codeCompta (N° MS, se répète), couleur '#RRGGBB', statut, marque, modele,
//                numeroSerie, dateAchat, prixChf, fournisseur, finGarantie, notes, photo (id de fichier joint ou null),
//                documents: [{ id, nom, ajouteLe }], parentId (accessoire de), telephone, swiposNumero,
//                swiposMotDePasse, creeLe, modifieLe }],
//   chantiers: [{ id, numero, cle, nom, responsable, facturable, archive, notes }],
//   affectations: [] (planning : étape 2) }
// Dates : 'AAAA-MM-JJ' (affichées JJ.MM.AAAA). Montants : CHF.

export const VERSION_PARC = 1;

export const STATUTS = [
  ['actif', 'Actif'],
  ['reparation', 'En réparation / SAV'],
  ['perdu', 'Perdu / volé'],
  ['reforme', 'Réformé / vendu'],
];

// Palette de 20 couleurs claires (celle de l'appli d'origine) : le n° noir reste lisible dessus.
export const PALETTE_MATERIEL = [
  '#F4A6B8', '#9FD3F0', '#FFE08A', '#B9A7F0', '#9EE0B8', '#FFB98A', '#8ED8D2', '#E3A6E0', '#CDE59A', '#F7A399',
  '#A8BDF5', '#F2D49B', '#D2B8F2', '#A6E3A1', '#FFC9DE', '#9FDCEB', '#E8C9A8', '#C9D3DC', '#FFD1A6', '#BFE8D8',
];

/** Parc vide (premier lancement). */
export function parcVide() {
  return { version: VERSION_PARC, modifieLe: null, categories: [], articles: [], chantiers: [], affectations: [] };
}

/** Remet un parc lu (mémoire, Drive) dans la bonne forme ; un parc illisible donne un parc vide. */
export function normaliserParc(lu) {
  const parc = parcVide();
  if (!lu || typeof lu !== 'object') return parc;
  for (const cle of ['categories', 'articles', 'chantiers', 'affectations']) {
    if (Array.isArray(lu[cle])) parc[cle] = lu[cle].filter((x) => x && typeof x === 'object' && x.id);
  }
  parc.modifieLe = typeof lu.modifieLe === 'string' ? lu.modifieLe : null;
  for (const a of parc.articles) {
    a.documents = Array.isArray(a.documents) ? a.documents : [];
    // 0.324.0 : la désignation est faite de Marque, Modèle et Autre ; l'ancienne désignation libre devient « Autre ».
    if (typeof a.autre !== 'string') {
      const ancienne = String(a.designation ?? '').trim();
      a.autre = ancienne && ancienne !== designationArticle({ ...a, autre: '' }) ? ancienne : '';
    }
    a.designation = designationArticle(a);
  }
  return parc;
}

/** Désignation d'un article (0.324.0) : « Marque - Modèle - Autre - N° interne » (parties vides sautées). */
export function designationArticle(a) {
  return [a?.marque, a?.modele, a?.autre, a?.numero].map((x) => String(x ?? '').trim()).filter(Boolean).join(' - ');
}

/** Marques déjà utilisées dans le parc (liste proposée à la saisie, triée, sans doublon). */
export function marquesDuParc(parc) {
  return listeUnique(parc.articles.map((a) => a.marque));
}

/** Modèles déjà utilisés (ceux de la marque donnée en premier, puis les autres). */
export function modelesDuParc(parc, marque = '') {
  const m = String(marque ?? '').trim().toLowerCase();
  const deLaMarque = listeUnique(parc.articles.filter((a) => m && String(a.marque ?? '').trim().toLowerCase() === m).map((a) => a.modele));
  return [...deLaMarque, ...listeUnique(parc.articles.map((a) => a.modele)).filter((x) => !deLaMarque.includes(x))];
}

function listeUnique(valeurs) {
  const vus = new Map();
  for (const v of valeurs) {
    const t = String(v ?? '').trim();
    if (t && !vus.has(t.toLowerCase())) vus.set(t.toLowerCase(), t);
  }
  return [...vus.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Nouvel identifiant (court, tiré au hasard). */
export function nouvelId(prefixe) {
  const hasard = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefixe}-${hasard.replace(/-/g, '').slice(0, 10)}`;
}

// --- Numéros de chantier ---

/**
 * « 855325 » → « 855 325 », « 10203 » → « 10 203 » (5 ou 6 chiffres) ; les autres écritures sont
 * gardées (espaces en trop retirés).
 */
export function normaliserNumeroChantier(numero) {
  const n = String(numero ?? '').trim().replace(/\s+/g, ' ');
  const chiffres = n.replace(/ /g, '');
  if (/^\d{5,6}$/.test(chiffres)) return `${chiffres.slice(0, -3)} ${chiffres.slice(-3)}`;
  return n;
}

/** Clé de comparaison d'un n° de chantier : seulement chiffres et lettres, en majuscules (« 10 203 » = « 10203 »). */
export function cleNumero(numero) {
  return String(numero ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/**
 * N° de chantier lu dans le nom d'un projet de Topo (décidé le 22.11 : le nom du projet est le n° du
 * chantier). On prend le début du nom fait de chiffres (espaces, points ou apostrophes permis entre
 * eux) : « 10 203 », « 10203 Ofrou » et « 10'203 - PAB » donnent « 10203 ». Sans chiffres au début : ''.
 */
export function cleNumeroDuProjet(nomProjet) {
  const debut = String(nomProjet ?? '').trim().match(/^\d[\d\s.'’]*/);
  return debut ? debut[0].replace(/\D/g, '') : '';
}

/** Chantier du parc qui correspond à un projet (même n°), ou null. */
export function chantierDuProjet(parc, nomProjet) {
  const cle = cleNumeroDuProjet(nomProjet);
  return cle ? parc.chantiers.find((c) => c.cle === cle) ?? null : null;
}

/** Projets (noms) qui n'ont pas encore de chantier dans le parc ; sans n° au début du nom : sautés. */
export function projetsSansChantier(parc, nomsProjets) {
  const vus = new Set();
  return nomsProjets.filter((nom) => {
    const cle = cleNumeroDuProjet(nom);
    if (!cle || vus.has(cle) || parc.chantiers.some((c) => c.cle === cle)) return false;
    vus.add(cle);
    return true;
  });
}

// --- Contrôle de ce qui est tapé ---

/** Texte nettoyé ; erreur si obligatoire et vide. */
function texte(valeur, nom, { obligatoire = false, maxi = 500 } = {}) {
  const t = String(valeur ?? '').trim().slice(0, maxi);
  if (obligatoire && !t) throw new Error(`${nom} : obligatoire`);
  return t;
}

/** Date 'AAAA-MM-JJ' depuis 'JJ.MM.AAAA', 'J.M.AA' ou 'AAAA-MM-JJ' ; '' si vide ; erreur si illisible. */
export function lireDate(valeur, nom = 'Date') {
  const t = String(valeur ?? '').trim();
  if (!t) return '';
  let j, m, a;
  let r = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) [, a, m, j] = r;
  else if ((r = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/))) {
    [, j, m, a] = r;
    if (a.length === 2) a = `20${a}`;
  } else throw new Error(`${nom} : date illisible (écrire JJ.MM.AAAA)`);
  const d = new Date(Date.UTC(Number(a), Number(m) - 1, Number(j)));
  if (d.getUTCFullYear() !== Number(a) || d.getUTCMonth() !== Number(m) - 1 || d.getUTCDate() !== Number(j)) {
    throw new Error(`${nom} : cette date n'existe pas`);
  }
  return d.toISOString().slice(0, 10);
}

/** 'AAAA-MM-JJ' → 'JJ.MM.AAAA' ('' si vide). */
export function dateSuisse(iso) {
  const r = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return r ? `${r[3]}.${r[2]}.${r[1]}` : '';
}

/** Montant en CHF (virgule ou apostrophes acceptées) ; null si vide ; erreur si illisible ou négatif. */
export function lireMontant(valeur, nom = 'Prix') {
  const t = String(valeur ?? '').trim().replace(/['’\s]/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${nom} : montant illisible`);
  return Math.round(n * 100) / 100;
}

/** « 12'500.00 » (CHF, apostrophe des milliers) ; '' si vide. */
export function montantSuisse(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '';
  const [entier, decimales] = Number(n).toFixed(2).split('.');
  return `${entier.replace(/\B(?=(\d{3})+(?!\d))/g, '\'')}.${decimales}`;
}

/** Couleur '#RRGGBB' en majuscules ; sinon la couleur de remplacement. */
export function lireCouleur(valeur, remplacement = PALETTE_MATERIEL[0]) {
  const t = String(valeur ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toUpperCase() : remplacement;
}

/** Texte noir ou blanc selon la couleur de fond, pour rester lisible. */
export function texteSurCouleur(fond) {
  const h = lireCouleur(fond, '#FFFFFF').slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1d2733' : '#ffffff';
}

// --- Catégories ---

/** Catégories dans l'ordre du planning. */
export function categoriesTriees(parc) {
  return [...parc.categories].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr'));
}

/** Ajoute une catégorie (nom unique, sans tenir compte des majuscules). Renvoie la catégorie. */
export function ajouterCategorie(parc, nom) {
  const n = texte(nom, 'Nom de la catégorie', { obligatoire: true, maxi: 100 });
  if (parc.categories.some((c) => c.nom.toLowerCase() === n.toLowerCase())) throw new Error(`La catégorie « ${n} » existe déjà`);
  const categorie = { id: nouvelId('cat'), nom: n, ordre: Math.max(0, ...parc.categories.map((c) => c.ordre)) + 1 };
  parc.categories.push(categorie);
  return categorie;
}

export function renommerCategorie(parc, id, nom) {
  const n = texte(nom, 'Nom de la catégorie', { obligatoire: true, maxi: 100 });
  if (parc.categories.some((c) => c.id !== id && c.nom.toLowerCase() === n.toLowerCase())) throw new Error(`La catégorie « ${n} » existe déjà`);
  const categorie = parc.categories.find((c) => c.id === id);
  if (!categorie) throw new Error('Catégorie introuvable');
  categorie.nom = n;
}

/** Supprime une catégorie vide (sinon erreur : déplacer d'abord ses articles). */
export function supprimerCategorie(parc, id) {
  if (parc.articles.some((a) => a.categorieId === id)) throw new Error('Cette catégorie contient des articles : déplacez-les d\'abord dans une autre catégorie');
  parc.categories = parc.categories.filter((c) => c.id !== id);
}

/**
 * Monte (sens -1) ou descend (+1) un élément dans sa liste ; la liste est renumérotée 1, 2, 3…
 * liste : éléments { id, ordre } déjà dans l'ordre affiché.
 */
export function deplacerDansListe(liste, id, sens) {
  const i = liste.findIndex((x) => x.id === id);
  const j = i + (sens > 0 ? 1 : -1);
  if (i >= 0 && j >= 0 && j < liste.length) [liste[i], liste[j]] = [liste[j], liste[i]];
  liste.forEach((x, k) => { x.ordre = k + 1; });
}

export function deplacerCategorie(parc, id, sens) {
  deplacerDansListe(categoriesTriees(parc), id, sens);
}

// --- Articles ---

/** Articles dans l'ordre du planning (catégorie, puis ordre dans la catégorie). */
export function articlesTries(parc) {
  const rang = new Map(categoriesTriees(parc).map((c, i) => [c.id, i]));
  return [...parc.articles].sort((a, b) => (rang.get(a.categorieId) ?? 999) - (rang.get(b.categorieId) ?? 999)
    || a.ordre - b.ordre || a.numero.localeCompare(b.numero, 'fr', { numeric: true }));
}

export function deplacerArticle(parc, id, sens) {
  const article = parc.articles.find((a) => a.id === id);
  if (article) deplacerDansListe(articlesTries(parc).filter((a) => a.categorieId === article.categorieId), id, sens);
}

/** Couleur proposée pour un nouvel article (la suivante de la palette dans sa catégorie). */
export function couleurProposee(parc, categorieId) {
  return PALETTE_MATERIEL[parc.articles.filter((a) => a.categorieId === categorieId).length % PALETTE_MATERIEL.length];
}

/**
 * Lit les champs d'un article (tels que tapés dans la fiche) et les contrôle. Renvoie les valeurs
 * propres ; lance une erreur claire (n° vide ou déjà pris, date illisible…).
 */
export function lireArticle(parc, champs, id = null) {
  const numero = texte(champs.numero, 'N° interne', { obligatoire: true, maxi: 100 });
  const doublon = parc.articles.find((a) => a.id !== id && a.numero.toLowerCase() === numero.toLowerCase());
  if (doublon) throw new Error(`Le n° interne « ${numero} » est déjà pris (${doublon.designation || 'autre article'})`);
  if (!parc.categories.some((c) => c.id === champs.categorieId)) throw new Error('Choisissez une catégorie');
  const statut = STATUTS.some(([s]) => s === champs.statut) ? champs.statut : 'actif';
  const parentId = champs.parentId || null;
  if (parentId) {
    if (parentId === id) throw new Error('Un article ne peut pas être son propre accessoire');
    const parent = parc.articles.find((a) => a.id === parentId);
    if (!parent) throw new Error('Article principal introuvable');
    if (parent.parentId) throw new Error('Un accessoire ne peut pas avoir d\'accessoire (un seul niveau)');
  }
  const marque = texte(champs.marque, 'Marque', { maxi: 100 });
  const modele = texte(champs.modele, 'Modèle', { maxi: 100 });
  // Sans champ « autre » (ancien appel, import) : l'ancienne désignation libre en tient lieu.
  const autre = texte(champs.autre ?? champs.designation, 'Autre (désignation)', { maxi: 200 });
  return {
    numero,
    categorieId: champs.categorieId,
    marque,
    modele,
    autre,
    designation: designationArticle({ marque, modele, autre, numero }),
    codeCompta: texte(champs.codeCompta, 'Code compta', { maxi: 50 }),
    couleur: lireCouleur(champs.couleur, couleurProposee(parc, champs.categorieId)),
    statut,
    numeroSerie: texte(champs.numeroSerie, 'N° de série', { maxi: 100 }),
    dateAchat: lireDate(champs.dateAchat, 'Date d\'achat'),
    prixChf: lireMontant(champs.prixChf, 'Prix'),
    fournisseur: texte(champs.fournisseur, 'Fournisseur', { maxi: 200 }),
    finGarantie: lireDate(champs.finGarantie, 'Fin de garantie'),
    notes: texte(champs.notes, 'Notes', { maxi: 5000 }),
    telephone: texte(champs.telephone, 'N° de téléphone', { maxi: 50 }),
    swiposNumero: texte(champs.swiposNumero, 'N° Swipos', { maxi: 100 }),
    swiposMotDePasse: texte(champs.swiposMotDePasse, 'Mot de passe Swipos', { maxi: 200 }),
    parentId,
  };
}

/** Crée un article (champs : voir lireArticle). Renvoie l'article. */
export function ajouterArticle(parc, champs, maintenant = new Date()) {
  const valeurs = lireArticle(parc, champs);
  const ordre = Math.max(0, ...parc.articles.filter((a) => a.categorieId === valeurs.categorieId).map((a) => a.ordre)) + 1;
  const article = { id: nouvelId('art'), ...valeurs, ordre, photo: null, documents: [], creeLe: maintenant.toISOString(), modifieLe: maintenant.toISOString() };
  parc.articles.push(article);
  return article;
}

/** Modifie un article ; il va à la fin de sa nouvelle catégorie s'il en change. */
export function modifierArticle(parc, id, champs, maintenant = new Date()) {
  const article = parc.articles.find((a) => a.id === id);
  if (!article) throw new Error('Article introuvable');
  // Le mot de passe Swipos n'est montré qu'avec le code : champ absent = on garde l'ancien.
  const valeurs = lireArticle(parc, { ...champs, swiposMotDePasse: champs.swiposMotDePasse ?? article.swiposMotDePasse }, id);
  if (valeurs.categorieId !== article.categorieId) {
    valeurs.ordre = Math.max(0, ...parc.articles.filter((a) => a.categorieId === valeurs.categorieId).map((a) => a.ordre)) + 1;
  }
  // Un article qui devient accessoire n'a plus d'accessoires à lui (un seul niveau).
  if (valeurs.parentId && parc.articles.some((a) => a.parentId === id)) throw new Error('Cet article a des accessoires : il ne peut pas devenir lui-même un accessoire');
  Object.assign(article, valeurs, { modifieLe: maintenant.toISOString() });
  return article;
}

/**
 * Supprime un article. Refusé s'il a des affectations (garder l'historique : le passer en
 * « Réformé / vendu »). Ses accessoires restent, sans article principal. Renvoie les ids des
 * fichiers joints à effacer (photo et documents).
 */
export function supprimerArticle(parc, id) {
  if (parc.affectations.some((af) => af.articleId === id)) {
    throw new Error('Cet article a un historique d\'affectations : passez-le plutôt en statut « Réformé / vendu »');
  }
  const article = parc.articles.find((a) => a.id === id);
  if (!article) return [];
  parc.articles = parc.articles.filter((a) => a.id !== id);
  for (const a of parc.articles) if (a.parentId === id) a.parentId = null;
  return [article.photo, ...article.documents.map((d) => d.id)].filter(Boolean);
}

/** Copie d'un article (« Dupliquer ») : mêmes champs, n° à changer, sans photo ni documents. */
export function champsDupliques(article) {
  const { id, numero, photo, documents, creeLe, modifieLe, ordre, ...reste } = article;
  const copie = { ...reste, numero: '', swiposMotDePasse: '' };
  return { ...copie, designation: designationArticle(copie) };
}

/** Recolore tout le parc dans l'ordre du planning (deux lignes voisines n'ont jamais la même couleur). */
export function recolorerParc(parc) {
  articlesTries(parc).forEach((a, i) => { a.couleur = PALETTE_MATERIEL[i % PALETTE_MATERIEL.length]; });
}

/** Valeur du parc (somme des prix des articles actifs et en réparation), en CHF. */
export function valeurDuParc(parc) {
  return parc.articles.filter((a) => a.statut === 'actif' || a.statut === 'reparation').reduce((s, a) => s + (Number(a.prixChf) || 0), 0);
}

/**
 * Filtre et trie les articles de la page Parc. filtre : { texte, categorieId, statut ('' = tous) }.
 * Le texte cherche dans n°, désignation, code compta, marque, modèle, n° de série et catégorie.
 */
export function filtrerArticles(parc, { texte: cherche = '', categorieId = '', statut = '' } = {}) {
  const mots = String(cherche).toLowerCase().split(/\s+/).filter(Boolean);
  const nomCategorie = new Map(parc.categories.map((c) => [c.id, c.nom]));
  return articlesTries(parc).filter((a) => {
    if (categorieId && a.categorieId !== categorieId) return false;
    if (statut && a.statut !== statut) return false;
    const tout = [a.numero, a.designation, a.codeCompta, a.marque, a.modele, a.numeroSerie, nomCategorie.get(a.categorieId)].join(' ').toLowerCase();
    return mots.every((m) => tout.includes(m));
  });
}

// --- Chantiers ---

/** Lit les champs d'un chantier et les contrôle (n° unique par ses chiffres ; sans n° : nom unique). */
export function lireChantier(parc, champs, id = null) {
  const numero = normaliserNumeroChantier(texte(champs.numero, 'N° de chantier', { maxi: 50 }));
  const cle = cleNumero(numero);
  const nom = texte(champs.nom, 'Nom du chantier', { obligatoire: true, maxi: 200 });
  if (cle) {
    const autre = parc.chantiers.find((c) => c.id !== id && c.cle === cle);
    if (autre) throw new Error(`Le chantier n° ${autre.numero} existe déjà (${autre.nom})`);
  } else if (parc.chantiers.some((c) => c.id !== id && !c.cle && c.nom.toLowerCase() === nom.toLowerCase())) {
    throw new Error(`Un chantier sans numéro nommé « ${nom} » existe déjà`);
  }
  return {
    numero,
    cle,
    nom,
    responsable: texte(champs.responsable, 'Responsable', { maxi: 100 }),
    facturable: champs.facturable !== false,
    archive: champs.archive === true,
    notes: texte(champs.notes, 'Notes', { maxi: 5000 }),
  };
}

export function ajouterChantier(parc, champs) {
  const chantier = { id: nouvelId('ch'), ...lireChantier(parc, champs) };
  parc.chantiers.push(chantier);
  return chantier;
}

export function modifierChantier(parc, id, champs) {
  const chantier = parc.chantiers.find((c) => c.id === id);
  if (!chantier) throw new Error('Chantier introuvable');
  Object.assign(chantier, lireChantier(parc, champs, id));
  return chantier;
}

/** Supprime un chantier sans affectation (sinon : l'archiver, il reste dans l'historique). */
export function supprimerChantier(parc, id) {
  if (parc.affectations.some((af) => af.chantierId === id)) {
    throw new Error('Ce chantier a des affectations : archivez-le plutôt (il reste dans l\'historique)');
  }
  parc.chantiers = parc.chantiers.filter((c) => c.id !== id);
}

/** Chantiers : actifs d'abord, ceux avec n° avant ceux sans, puis par n° et par nom. */
export function chantiersTries(parc) {
  return [...parc.chantiers].sort((a, b) => Number(a.archive) - Number(b.archive) || Number(!a.cle) - Number(!b.cle)
    || a.numero.localeCompare(b.numero, 'fr', { numeric: true }) || a.nom.localeCompare(b.nom, 'fr'));
}

/** Responsables déjà tapés dans les chantiers (sans doublon, par ordre alphabétique). */
export function responsables(parc) {
  const vus = new Map();
  for (const c of parc.chantiers) {
    const r = String(c.responsable ?? '').trim();
    if (r && !vus.has(r.toLowerCase())) vus.set(r.toLowerCase(), r);
  }
  return [...vus.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

// --- Listes pour les tablettes (Réglages › Drive : article et utilisateur de cette tablette) ---

/**
 * Ce que les tablettes ont besoin de connaître du parc (sans prix ni mot de passe) : les articles
 * actifs ou en réparation { numero, designation, categorie } et les responsables.
 */
export function nomsPourTablettes(parc) {
  const nomCategorie = new Map(parc.categories.map((c) => [c.id, c.nom]));
  return {
    articles: articlesTries(parc).filter((a) => a.statut === 'actif' || a.statut === 'reparation')
      .map((a) => ({ numero: a.numero, designation: a.designation, categorie: nomCategorie.get(a.categorieId) ?? '' })),
    responsables: responsables(parc),
  };
}
