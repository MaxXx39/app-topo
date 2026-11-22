// Planning « Comparer » (0.276.0, étape 3a) : le planning (prévu) est comparé au journal des tablettes (vu,
// voir recap/journal.js : chaque ligne dit quelle tablette a travaillé dans quel projet quel jour, avec
// « article » = n° de l'article du parc, noté depuis la 0.274.0). Le nom du projet = n° du chantier : on
// relie par les chiffres du début du nom. Les écarts sont seulement signalés (rien n'est corrigé tout seul).
// Rien ici ne touche l'écran : tout est testé.
import { cleNumeroDuProjet } from './donnees.js';
import { ajouterJours, jourSemaine, nomDuChantier, poserAffectation, chevauchements, nombreDeJours, aujourdhui } from './planning.js';

export const STATUTS_COMPARAISON = {
  ok: 'Vu comme prévu',
  ecart: 'Vu sur un autre chantier',
  sans: 'Vu, rien de prévu',
  absent: 'Prévu, pas vu',
};

const estJourOuvre = (iso) => jourSemaine(iso) < 5;

/**
 * Journaux de tous les appareils : ceux de Drive, où le journal de cet appareil (plus récent) remplace le sien.
 * Un journal sans identifiant d'appareil est gardé tel quel.
 */
export function reunirJournaux(journauxDrive, journalLocal) {
  const liste = (journauxDrive ?? []).filter((j) => j && Array.isArray(j.jours));
  if (!journalLocal || !Array.isArray(journalLocal.jours)) return liste;
  return [...liste.filter((j) => !j.appareilId || j.appareilId !== journalLocal.appareilId), journalLocal];
}

/**
 * Ce que les journaux ont vu (jours où il y a eu du travail) : [{ articleId, jour, chantierId (ou null si le projet n'a pas de chantier dans
 * le parc), projet, appareil, utilisateur, points, implantations }]. Les lignes sans article du parc (ou avec
 * un n° inconnu) sont comptées dans « sansArticle » : elles ne peuvent pas être reliées à un appareil.
 */
export function lireVus(parc, journaux) {
  const vus = [];
  const sansArticle = new Set();
  for (const journal of journaux) {
    for (const ligne of journal.jours) {
      // « Vu » = a travaillé : au moins un point, une implantation ou un contrôle (une simple ouverture du projet ne compte pas).
      if (!(ligne.points > 0 || ligne.implantations > 0 || ligne.controles > 0)) continue;
      const numero = String(ligne.article ?? journal.article ?? '').trim().toLowerCase();
      const article = numero ? parc.articles.find((a) => a.numero.toLowerCase() === numero) : null;
      if (!article) {
        sansArticle.add(ligne.appareil ?? journal.appareil ?? '?');
        continue;
      }
      const cle = cleNumeroDuProjet(ligne.projet);
      const chantier = cle ? parc.chantiers.find((c) => c.cle === cle) : null;
      vus.push({
        articleId: article.id, jour: ligne.jour, chantierId: chantier?.id ?? null, projet: ligne.projet ?? '',
        appareil: ligne.appareil ?? journal.appareil ?? '', utilisateur: ligne.utilisateur ?? '',
        points: ligne.points ?? 0, implantations: ligne.implantations ?? 0, controles: ligne.controles ?? 0,
      });
    }
  }
  return { vus, sansArticle: [...sansArticle].sort() };
}

/**
 * Compare le planning au journal. Renvoie { jours: Map('articleId|AAAA-MM-JJ' → { statut, prevu, vus }), sansArticle,
 * premierJour }. Un jour sans entrée n'a rien à signaler. « Prévu, pas vu » : seulement les jours ouvrés passés
 * (depuis le premier jour vu de l'article), pour les articles que le journal connaît (relié à une tablette).
 */
export function comparer(parc, journaux, jour = aujourdhui()) {
  const { vus, sansArticle } = lireVus(parc, journaux);
  const resultat = new Map();
  const cle = (articleId, iso) => `${articleId}|${iso}`;
  const vusParJour = new Map();
  for (const v of vus) {
    const k = cle(v.articleId, v.jour);
    if (!vusParJour.has(k)) vusParJour.set(k, []);
    vusParJour.get(k).push(v);
  }
  const premierJour = vus.length ? vus.reduce((m, v) => (v.jour < m ? v.jour : m), vus[0].jour) : null;
  // Premier jour vu de chaque article : avant, on ne sait pas si sa tablette était déjà reliée à l'article.
  const premierParArticle = new Map();
  for (const v of vus) if (!premierParArticle.has(v.articleId) || v.jour < premierParArticle.get(v.articleId)) premierParArticle.set(v.articleId, v.jour);
  const prevuLe = (articleId, iso) => parc.affectations.find((af) => af.articleId === articleId && af.debut <= iso && af.fin >= iso) ?? null;

  for (const [k, liste] of vusParJour) {
    const [articleId, iso] = k.split('|');
    const prevu = prevuLe(articleId, iso);
    let statut = 'sans';
    if (prevu) statut = liste.some((v) => v.chantierId === prevu.chantierId) ? 'ok' : 'ecart';
    resultat.set(k, { statut, prevu, vus: liste });
  }
  if (premierJour) {
    for (const af of parc.affectations) {
      const premier = premierParArticle.get(af.articleId);
      if (!premier) continue;
      const fin = af.fin < ajouterJours(jour, -1) ? af.fin : ajouterJours(jour, -1);
      for (let iso = af.debut < premier ? premier : af.debut; iso <= fin; iso = ajouterJours(iso, 1)) {
        if (!estJourOuvre(iso) || resultat.has(cle(af.articleId, iso))) continue;
        resultat.set(cle(af.articleId, iso), { statut: 'absent', prevu: af, vus: [] });
      }
    }
  }
  return { jours: resultat, sansArticle, premierJour };
}

/** Résultat d'un article un jour donné, ou null (rien à signaler). */
export function resultatDuJour(comparaison, articleId, iso) {
  return comparaison?.jours.get(`${articleId}|${iso}`) ?? null;
}

/**
 * Liste « À vérifier » : les écarts (pas « vu comme prévu »), les jours qui se suivent regroupés par article,
 * état et chantier vu. [{ articleId, statut, debut, fin, chantierId (vu) ou null, projet, prevuChantierId }].
 */
export function ecartsAVerifier(comparaison) {
  const lignes = [];
  for (const [k, r] of comparaison.jours) {
    if (r.statut === 'ok') continue;
    const [articleId, iso] = k.split('|');
    lignes.push({ articleId, iso, statut: r.statut, vu: r.vus[0] ?? null, prevu: r.prevu });
  }
  lignes.sort((a, b) => a.articleId.localeCompare(b.articleId) || a.statut.localeCompare(b.statut) || a.iso.localeCompare(b.iso));
  const groupes = [];
  for (const l of lignes) {
    const chantierId = l.vu?.chantierId ?? null;
    const projet = l.vu?.projet ?? '';
    const g = groupes.at(-1);
    const suite = g && g.articleId === l.articleId && g.statut === l.statut && g.chantierId === chantierId && g.projet === projet
      && (ajouterJours(g.fin, 1) === l.iso || (jourSemaine(g.fin) === 4 && l.iso === ajouterJours(g.fin, 3)));
    if (suite) g.fin = l.iso;
    else groupes.push({ articleId: l.articleId, statut: l.statut, debut: l.iso, fin: l.iso, chantierId, projet, prevuChantierId: l.prevu?.chantierId ?? null });
  }
  return groupes.sort((a, b) => a.debut.localeCompare(b.debut) || a.articleId.localeCompare(b.articleId));
}

/** « 953 : vu 10 203 le 05.11, prévu 10 245 » : texte d'une ligne de la liste. */
export function texteEcart(parc, ecart, dateCourte) {
  const numero = parc.articles.find((a) => a.id === ecart.articleId)?.numero ?? '?';
  const quand = ecart.debut === ecart.fin ? `le ${dateCourte(ecart.debut)}` : `du ${dateCourte(ecart.debut)} au ${dateCourte(ecart.fin)}`;
  const nom = (id) => nomDuChantier(parc.chantiers.find((c) => c.id === id));
  const vu = ecart.chantierId ? nom(ecart.chantierId) : ecart.projet || 'projet sans nom';
  if (ecart.statut === 'absent') return `${numero} ${quand} : prévu ${nom(ecart.prevuChantierId)}, pas vu`;
  if (ecart.statut === 'sans') return `${numero} ${quand} : vu ${vu}, rien de prévu`;
  return `${numero} ${quand} : prévu ${nom(ecart.prevuChantierId)}, vu ${vu}`;
}

/**
 * « Préremplir » : propose les affectations des jours « vus, rien de prévu » dont le projet a un chantier dans
 * le parc. Les jours qui se suivent (week-end compris) sur le même chantier font une seule affectation.
 * [{ articleId, chantierId, debut, fin }]. Les jours dont le projet n'a pas de chantier sont comptés à part (sansChantier).
 */
export function propositionsDePrerempli(parc, comparaison) {
  const jours = [];
  let sansChantier = 0;
  for (const [k, r] of comparaison.jours) {
    if (r.statut !== 'sans') continue;
    const [articleId, iso] = k.split('|');
    const chantierId = r.vus.find((v) => v.chantierId)?.chantierId ?? null;
    if (chantierId) jours.push({ articleId, chantierId, iso });
    else sansChantier += 1;
  }
  jours.sort((a, b) => a.articleId.localeCompare(b.articleId) || a.chantierId.localeCompare(b.chantierId) || a.iso.localeCompare(b.iso));
  const propositions = [];
  for (const j of jours) {
    const p = propositions.at(-1);
    const suite = p && p.articleId === j.articleId && p.chantierId === j.chantierId
      && (ajouterJours(p.fin, 1) === j.iso || (jourSemaine(p.fin) === 4 && j.iso === ajouterJours(p.fin, 3)))
      && !chevauchements(parc, j.articleId, p.fin, j.iso).length;
    if (suite) p.fin = j.iso;
    else propositions.push({ articleId: j.articleId, chantierId: j.chantierId, debut: j.iso, fin: j.iso });
  }
  propositions.sort((a, b) => a.debut.localeCompare(b.debut) || a.articleId.localeCompare(b.articleId));
  return { propositions, sansChantier };
}

/** Applique les propositions au parc (une affectation chacune) ; renvoie { posees, jours }. Rien d'existant n'est coupé. */
export function appliquerPropositions(parc, propositions) {
  let jours = 0;
  for (const p of propositions) {
    poserAffectation(parc, { ...p, remarque: 'Prérempli d\'après le recap' });
    jours += nombreDeJours(p.debut, p.fin);
  }
  return { posees: propositions.length, jours };
}
