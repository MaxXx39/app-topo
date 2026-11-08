// Journal de l'appareil (0.119.0) : ce que cet appareil fait chaque jour dans chaque projet, pour le
// recap Excel de la semaine (voir recap/recap.js). Gardé sur l'appareil (localStorage
// « topo-journal ») et envoyé sur Drive (« App Topo › Recap ») avec la synchronisation.
//
// Forme :
// { appareilId, appareil (nom), modifieLe,
//   jours: [{ jour ('2026-11-03'), projetId, projet (nom), ouvertures, debut, fin (dates ISO),
//             points, implantations, controles, sansControle: { points, implantations, depuis } }],
//   controles: [{ id, le, projetId, projet, type ('mesure' ou 'refus'), point, ecarts, remarque }] }
// sansControle : travail (points levés, implantations) fait par cet appareil alors qu'il n'avait
// fait aucun contrôle de ce projet le même jour dans la durée du projet (4 h par défaut) ;
// depuis : heure du premier de ces travaux.

const CLE = 'topo-journal';
// On garde 12 semaines sur l'appareil (le recap n'en montre que 8).
const JOURS_GARDES = 84;

/** Jour local d'une date (« 2026-11-03 »). */
export function jourLocal(date) {
  const deux = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

/** Journal vide pour cet appareil. */
export function journalVide(appareil = { id: '', nom: '' }) {
  return { appareilId: appareil.id, appareil: appareil.nom, utilisateur: appareil.utilisateur ?? '', modifieLe: null, jours: [], controles: [] };
}

/**
 * Vrai si cet appareil a fait un contrôle (mesuré, quel que soit son résultat : c'est le géomètre
 * qui juge) de ce projet le même jour, dans la durée "delaiMs" avant "maintenant".
 * controles : ceux du projet ({ type, appareil, le }).
 */
export function aUnControleRecent(controles, nomAppareil, maintenant, delaiMs) {
  return (controles ?? []).some((c) => {
    if (c.type !== 'mesure' || (c.appareil ?? '') !== (nomAppareil ?? '')) return false;
    const le = new Date(c.le);
    if (Number.isNaN(le.getTime()) || jourLocal(le) !== jourLocal(maintenant)) return false;
    const ecart = maintenant - le;
    return ecart >= 0 && ecart < delaiMs;
  });
}

/** Ligne du jour pour ce projet (créée si besoin). */
function ligneDuJour(journal, projet, maintenant) {
  const jour = jourLocal(maintenant);
  // 0.162.0 : le nom de la tablette et l'utilisateur du moment sont notés dans chaque ligne (changer
  // d'utilisateur ne change pas ce qui a déjà été noté) ; une ligne par jour, projet et utilisateur.
  const utilisateur = journal.utilisateur ?? '';
  let ligne = journal.jours.find((j) => j.jour === jour && j.projetId === projet.id && (j.utilisateur ?? '') === utilisateur && (j.appareil ?? journal.appareil) === journal.appareil);
  if (!ligne) {
    ligne = { jour, projetId: projet.id, projet: projet.nom, appareil: journal.appareil, utilisateur, ouvertures: 0, debut: maintenant.toISOString(), fin: maintenant.toISOString(), points: 0, implantations: 0, controles: 0, sansControle: { points: 0, implantations: 0, depuis: null } };
    journal.jours.push(ligne);
  }
  ligne.projet = projet.nom || ligne.projet;
  const iso = maintenant.toISOString();
  if (iso < ligne.debut) ligne.debut = iso;
  if (iso > ligne.fin) ligne.fin = iso;
  return ligne;
}

/**
 * Note un événement dans le journal (modifié ici, renvoyé). evenement :
 * - { type: 'ouverture' } : projet ouvert ;
 * - { type: 'point' | 'implantation', controleRecent } : travail ; controleRecent : voir aUnControleRecent ;
 * - { type: 'controle', controle } : contrôle du projet ({ id, type: 'mesure' | 'refus', nom, ecarts, remarque, le }).
 * projet : { id, nom } (nom lisible du projet). maintenant : Date.
 */
export function noter(journal, projet, evenement, maintenant = new Date()) {
  const ligne = ligneDuJour(journal, projet, maintenant);
  if (evenement.type === 'ouverture') ligne.ouvertures += 1;
  else if (evenement.type === 'point' || evenement.type === 'implantation') {
    const cle = evenement.type === 'point' ? 'points' : 'implantations';
    ligne[cle] += 1;
    if (!evenement.controleRecent) {
      ligne.sansControle[cle] += 1;
      ligne.sansControle.depuis ??= maintenant.toISOString();
    }
  } else if (evenement.type === 'controle') {
    const c = evenement.controle;
    if (c.type === 'mesure') ligne.controles += 1;
    journal.controles.push({
      id: c.id,
      appareil: journal.appareil,
      utilisateur: journal.utilisateur ?? '',
      le: c.le ?? maintenant.toISOString(),
      projetId: projet.id,
      projet: projet.nom,
      type: c.type,
      point: c.nom ?? null,
      ecarts: c.ecarts ?? null,
      // Couleurs du contrôle (vert / orange / rouge, d'après les tolérances du projet à ce moment-là), pour le recap (0.127.0).
      resultat: c.resultat ? { plan: c.resultat.plan ?? null, hauteur: c.resultat.hauteur ?? null } : null,
      remarque: c.remarque ?? '',
    });
  }
  journal.modifieLe = maintenant.toISOString();
  return oublierAnciens(journal, maintenant);
}

/** Enlève ce qui a plus de 12 semaines. */
function oublierAnciens(journal, maintenant) {
  const limite = jourLocal(new Date(maintenant.getTime() - JOURS_GARDES * 24 * 3600 * 1000));
  journal.jours = journal.jours.filter((j) => j.jour >= limite);
  journal.controles = journal.controles.filter((c) => jourLocal(new Date(c.le)) >= limite);
  return journal;
}

/** Journal de cet appareil, lu sur l'appareil (journal vide si rien ou illisible). */
export function lireJournal(appareil) {
  try {
    const lu = JSON.parse(localStorage.getItem(CLE) ?? 'null');
    if (lu && Array.isArray(lu.jours) && Array.isArray(lu.controles)) return { ...lu, appareilId: appareil.id, appareil: appareil.nom, utilisateur: appareil.utilisateur ?? '' };
  } catch {
    // illisible : on repart d'un journal vide
  }
  return journalVide(appareil);
}

/** Enregistre le journal sur l'appareil. */
export function ecrireJournal(journal) {
  try {
    localStorage.setItem(CLE, JSON.stringify(journal));
  } catch {
    // Mémoire pleine ou indisponible : le recap sera incomplet, l'appli continue.
  }
}
