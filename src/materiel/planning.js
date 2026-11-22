// Planning du matériel (0.275.0, étape 2) : règles des affectations, reprises de l'appli d'origine
// (api.py, partie « Affectations »). Une affectation = un article sur un chantier du jour « debut » au
// jour « fin », les deux compris : { id, articleId, chantierId, debut, fin ('AAAA-MM-JJ'),
// responsable ('' = celui du chantier), remarque }. Pas d'affectation un jour donné = l'article est
// au dépôt (disponible). Deux affectations d'un même article ne se chevauchent jamais.
// Rien ici ne touche l'écran : tout est testé.
import { nouvelId, lireDate, dateSuisse, articlesTries, categoriesTriees } from './donnees.js';

export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const JOURS_COURTS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

// --- Dates (calculées en UTC pour éviter les décalages d'heure d'été) ---

const enDate = (iso) => new Date(`${iso}T00:00:00Z`);
const enIso = (date) => date.toISOString().slice(0, 10);

/** Jour ISO décalé de n jours (n négatif = avant). */
export function ajouterJours(iso, n) {
  const d = enDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return enIso(d);
}

/** Nombre de jours du premier au dernier jour compris (« 2026-11-02 » → « 2026-11-02 » = 1). */
export function nombreDeJours(debut, fin) {
  return Math.round((enDate(fin) - enDate(debut)) / 86400000) + 1;
}

/** Jour de la semaine : 0 = lundi … 6 = dimanche. */
export function jourSemaine(iso) {
  return (enDate(iso).getUTCDay() + 6) % 7;
}

/** Nombre de jours d'un mois (mois de 1 à 12). */
export function joursDuMois(annee, mois) {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/** 'AAAA-MM-JJ' du jour j (1…31) d'un mois. */
export function isoDuJour(annee, mois, j) {
  return enIso(new Date(Date.UTC(annee, mois - 1, j)));
}

/** Premier et dernier jour d'un mois : { debut, fin }. */
export function bornesDuMois(annee, mois) {
  return { debut: isoDuJour(annee, mois, 1), fin: isoDuJour(annee, mois, joursDuMois(annee, mois)) };
}

/** Mois voisin : { annee, mois } décalé de n mois. */
export function moisVoisin(annee, mois, n) {
  const d = new Date(Date.UTC(annee, mois - 1 + n, 1));
  return { annee: d.getUTCFullYear(), mois: d.getUTCMonth() + 1 };
}

/** Jour local de l'appareil (« aujourd'hui » = la date du PC). */
export function aujourdhui(maintenant = new Date()) {
  const deux = (n) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
}

// --- Lecture ---

const chantierDe = (parc, id) => parc.chantiers.find((c) => c.id === id) ?? null;

/** Responsable d'une affectation : le sien s'il est rempli, sinon celui du chantier. */
export function responsableDe(parc, af) {
  return af.responsable || chantierDe(parc, af.chantierId)?.responsable || '';
}

/** « 10 203 – OFROU PAB » (n° et nom du chantier). */
export function nomDuChantier(chantier) {
  return chantier ? [chantier.numero, chantier.nom].filter(Boolean).join(' – ') : '?';
}

/** Affectations d'un article qui touchent la période [debut, fin], dans l'ordre (sauf celle à exclure). */
export function chevauchements(parc, articleId, debut, fin, exclure = null) {
  return parc.affectations
    .filter((af) => af.articleId === articleId && af.id !== exclure && af.debut <= fin && af.fin >= debut)
    .sort((a, b) => a.debut.localeCompare(b.debut));
}

/** Affectation d'un article un jour donné (« où est-il ? »), ou null = au dépôt. */
export function affectationDuJour(parc, articleId, iso) {
  return parc.affectations.find((af) => af.articleId === articleId && af.debut <= iso && af.fin >= iso) ?? null;
}

/** Historique d'un article, du plus récent au plus ancien. */
export function historiqueArticle(parc, articleId) {
  return parc.affectations.filter((af) => af.articleId === articleId).sort((a, b) => b.debut.localeCompare(a.debut));
}

/** Affectations qui finissent un jour donné (pour « Prolonger »), dans l'ordre du planning. */
export function affectationsFinissantLe(parc, iso) {
  const rang = new Map(articlesTries(parc).map((a, i) => [a.id, i]));
  return parc.affectations.filter((af) => af.fin === iso).sort((a, b) => (rang.get(a.articleId) ?? 0) - (rang.get(b.articleId) ?? 0));
}

/** Affectations qui finissent dans les n prochains jours (aujourd'hui compris). */
export function finsProches(parc, jour, n = 7) {
  const limite = ajouterJours(jour, n - 1);
  return parc.affectations.filter((af) => af.fin >= jour && af.fin <= limite).sort((a, b) => a.fin.localeCompare(b.fin));
}

// --- Modifications (chaque fonction contrôle d'abord, puis modifie : une erreur ne change rien) ---

/** Erreur « l'article est déjà affecté » : conflits = affectations qui gênent. */
export class ErreurChevauchement extends Error {
  constructor(conflits) {
    super('Cet article est déjà affecté sur cette période');
    this.conflits = conflits;
  }
}

/** Lit et contrôle une affectation (champs tapés : dates JJ.MM.AAAA ou ISO). */
export function lireAffectation(parc, champs) {
  if (!parc.articles.some((a) => a.id === champs.articleId)) throw new Error('Choisissez un article');
  if (!chantierDe(parc, champs.chantierId)) throw new Error('Choisissez un chantier');
  const debut = lireDate(champs.debut, 'Du');
  const fin = lireDate(champs.fin, 'Au');
  if (!debut || !fin) throw new Error('Les dates « du » et « au » sont obligatoires');
  if (fin < debut) throw new Error('La date de fin doit être après la date de début');
  return {
    articleId: champs.articleId,
    chantierId: champs.chantierId,
    debut,
    fin,
    responsable: String(champs.responsable ?? '').trim().slice(0, 100),
    remarque: String(champs.remarque ?? '').trim().slice(0, 1000),
  };
}

/**
 * Retire les affectations en conflit avec [debut, fin] : « remplacer » les supprime, « couper » garde
 * leurs morceaux avant et après la nouvelle période.
 */
function resoudre(parc, conflits, debut, fin, mode) {
  const ids = new Set(conflits.map((x) => x.id));
  parc.affectations = parc.affectations.filter((af) => !ids.has(af.id));
  if (mode !== 'couper') return;
  for (const x of conflits) {
    if (x.debut < debut) parc.affectations.push({ ...x, id: nouvelId('af'), fin: ajouterJours(debut, -1) });
    if (x.fin > fin) parc.affectations.push({ ...x, id: nouvelId('af'), debut: ajouterJours(fin, 1) });
  }
}

/**
 * Crée (id null) ou modifie une affectation. Si elle chevauche une autre affectation du même article :
 * sans mode, ErreurChevauchement (l'écran demande « couper / remplacer / annuler ») ; mode 'couper'
 * ou 'remplacer' : les autres sont coupées ou supprimées. Renvoie l'affectation.
 */
export function poserAffectation(parc, champs, id = null, mode = null) {
  const valeurs = lireAffectation(parc, champs);
  if (id && !parc.affectations.some((af) => af.id === id)) throw new Error('Affectation introuvable');
  const conflits = chevauchements(parc, valeurs.articleId, valeurs.debut, valeurs.fin, id);
  if (conflits.length && mode !== 'couper' && mode !== 'remplacer') throw new ErreurChevauchement(conflits);
  resoudre(parc, conflits, valeurs.debut, valeurs.fin, mode);
  if (id) {
    const af = parc.affectations.find((x) => x.id === id);
    Object.assign(af, valeurs);
    return af;
  }
  const af = { id: nouvelId('af'), ...valeurs };
  parc.affectations.push(af);
  return af;
}

export function supprimerAffectation(parc, id) {
  parc.affectations = parc.affectations.filter((af) => af.id !== id);
}

const trouver = (parc, id) => {
  const af = parc.affectations.find((x) => x.id === id);
  if (!af) throw new Error('Affectation introuvable');
  return af;
};

/** « Rendre au dépôt » : le jour donné devient le dernier jour sur le chantier. */
export function rendreAuDepot(parc, id, dernierJour) {
  const af = trouver(parc, id);
  const jour = lireDate(dernierJour, 'Dernier jour');
  if (!jour) throw new Error('Dernier jour : obligatoire');
  if (jour < af.debut) throw new Error('Le dernier jour ne peut pas être avant le début de l\'affectation');
  if (jour >= af.fin) throw new Error('L\'affectation se termine déjà à cette date ou avant');
  af.fin = jour;
  return af;
}

/**
 * Coupe en deux : [debut, jour − 1] et [jour, fin]. Avec chantierId, la 2e partie part sur un autre
 * chantier (« Changer de chantier à partir du… », avec son responsable). Renvoie la 2e partie.
 */
export function couperAffectation(parc, id, aPartirDu, { chantierId = null, responsable = '' } = {}) {
  const af = trouver(parc, id);
  const jour = lireDate(aPartirDu, 'À partir du');
  if (!jour) throw new Error('À partir du : obligatoire');
  if (!(af.debut < jour && jour <= af.fin)) {
    throw new Error(af.debut === af.fin
      ? 'Une affectation d\'un seul jour ne peut pas être coupée'
      : 'La date doit être après le premier jour de l\'affectation, et au plus tard son dernier jour');
  }
  if (chantierId && !chantierDe(parc, chantierId)) throw new Error('Chantier introuvable');
  const suite = {
    ...af,
    id: nouvelId('af'),
    debut: jour,
    chantierId: chantierId || af.chantierId,
    responsable: chantierId ? String(responsable ?? '').trim() : af.responsable,
  };
  af.fin = ajouterJours(jour, -1);
  parc.affectations.push(suite);
  return suite;
}

/**
 * Prolonge des affectations jusqu'au jour donné ; si une autre affectation du même article suit, on
 * s'arrête la veille. Renvoie { prolongees, raccourcies: ['953 (jusqu'au 12.11)'], ignorees }.
 */
export function prolongerAffectations(parc, ids, jusquau) {
  const dateFin = lireDate(jusquau, 'Jusqu\'au');
  const resultat = { prolongees: 0, raccourcies: [], ignorees: 0 };
  for (const id of ids) {
    const af = parc.affectations.find((x) => x.id === id);
    if (!af || dateFin <= af.fin) {
      resultat.ignorees += 1;
      continue;
    }
    let fin = dateFin;
    const suivantes = chevauchements(parc, af.articleId, ajouterJours(af.fin, 1), dateFin, af.id);
    if (suivantes.length) {
      fin = ajouterJours(suivantes[0].debut, -1);
      const numero = parc.articles.find((a) => a.id === af.articleId)?.numero ?? '?';
      resultat.raccourcies.push(`${numero} (jusqu'au ${dateSuisse(fin).slice(0, 5)})`);
    }
    if (fin <= af.fin) {
      resultat.ignorees += 1;
      continue;
    }
    af.fin = fin;
    resultat.prolongees += 1;
  }
  return resultat;
}

/**
 * Annuler (Ctrl+Z) : remet une copie des affectations prise avant un changement. Refusé si un article
 * ou un chantier concerné a été supprimé entre-temps.
 */
export function remettreAffectations(parc, copie) {
  const manque = copie.find((af) => !parc.articles.some((a) => a.id === af.articleId) || !chantierDe(parc, af.chantierId));
  if (manque) throw new Error('Annulation impossible : un article ou un chantier concerné a été supprimé entre-temps');
  parc.affectations = copie.map((af) => ({ ...af }));
}

// --- Données d'un mois (écran, PDF, Excel) ---

/**
 * Le mois prêt à dessiner : { annee, mois, n, jours: [{ j, iso, semaine }], groupes: [{ categorie,
 * articles: [{ article, barres }] }] }. Articles : actifs (ou tous avec inactifs), plus ceux qui ont
 * une affectation dans le mois (à facturer). Barre : { af, chantier, j1, j2 (jours du mois, 1…n),
 * avant / apres (continue sur le mois voisin), principal (« n° – nom »), responsable, nbJours }.
 * avecVeille : la veille du 1er (dernier jour du mois d'avant) compte comme jour 0.
 */
export function donneesDuMois(parc, annee, mois, { inactifs = false, avecVeille = false } = {}) {
  const n = joursDuMois(annee, mois);
  const premier = avecVeille ? 0 : 1;
  const debut = isoDuJour(annee, mois, premier);
  const fin = isoDuJour(annee, mois, n);
  const jours = [];
  for (let j = premier; j <= n; j += 1) {
    const iso = isoDuJour(annee, mois, j);
    jours.push({ j, iso, semaine: jourSemaine(iso) });
  }
  const dansLeMois = parc.affectations.filter((af) => af.fin >= debut && af.debut <= fin);
  const avecAffectation = new Set(dansLeMois.filter((af) => af.fin >= isoDuJour(annee, mois, 1)).map((af) => af.articleId));
  const numeroDuJour = (iso) => nombreDeJours(isoDuJour(annee, mois, 1), iso);
  const groupes = [];
  for (const categorie of categoriesTriees(parc)) {
    const articles = articlesTries(parc)
      .filter((a) => a.categorieId === categorie.id && (inactifs || a.statut === 'actif' || avecAffectation.has(a.id)))
      .map((article) => ({
        article,
        barres: dansLeMois.filter((af) => af.articleId === article.id).sort((a, b) => a.debut.localeCompare(b.debut)).map((af) => {
          const chantier = chantierDe(parc, af.chantierId);
          const j1 = af.debut < debut ? premier : numeroDuJour(af.debut);
          const j2 = af.fin > fin ? n : numeroDuJour(af.fin);
          return {
            af, chantier, j1, j2, avant: af.debut < debut, apres: af.fin > fin,
            principal: nomDuChantier(chantier), responsable: responsableDe(parc, af), nbJours: j2 - Math.max(j1, 1) + 1,
          };
        }),
      }));
    if (articles.length) groupes.push({ categorie, articles });
  }
  return { annee, mois, n, jours, groupes };
}

/** Nom des fichiers du mois : « 2026_11.pdf » (modèle de l'appli d'origine, attendu par la compta). */
export function nomFichierMois(annee, mois, extension) {
  return `${annee}_${String(mois).padStart(2, '0')}.${extension}`;
}
