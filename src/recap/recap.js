// Recap Excel de la semaine (0.119.0) : fabriqué à partir des journaux de tous les appareils
// (voir recap/journal.js), envoyé sur Drive (« App Topo › Recap › Recap App Topo.xlsx »).
// Le but premier : savoir qui fait les contrôles, qui ne les fait pas, avec leurs écarts.
// L'appli ne donne pas d'avis (pas de « OK ») : c'est le géomètre qui arbitre, dans la colonne
// « Avis » laissée vide. Depuis 0.127.0, les écarts hors tolérance sont seulement colorés
// (orange : au-dessus de la 1re limite, rouge : hors tolérance), comme dans Contrôle.
//
// Onglets : « Synthèse » (une ligne par semaine et par appareil), puis un onglet par semaine
// (la plus récente d'abord, 8 au plus) avec : Contrôles, Travail sans contrôle, Activité.

import { jourLocal } from './journal.js';
import { classeTolerance, TOLERANCES_PAR_DEFAUT } from '../topo/controle.js';

const SEMAINES_MONTREES = 8;

/** Semaine ISO d'un jour « 2026-11-03 » : { annee, numero, lundi, dimanche } (jours « AAAA-MM-JJ »). */
export function semaineDe(jour) {
  const [a, m, j] = jour.split('-').map(Number);
  const date = new Date(Date.UTC(a, m - 1, j));
  const jourSemaine = (date.getUTCDay() + 6) % 7; // lundi = 0
  const lundi = new Date(date.getTime() - jourSemaine * 86400000);
  const jeudi = new Date(lundi.getTime() + 3 * 86400000);
  const debutAnnee = new Date(Date.UTC(jeudi.getUTCFullYear(), 0, 1));
  const numero = 1 + Math.floor((jeudi - debutAnnee) / (7 * 86400000));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { annee: jeudi.getUTCFullYear(), numero, lundi: iso(lundi), dimanche: iso(new Date(lundi.getTime() + 6 * 86400000)) };
}

/** Clé d'une semaine (« 2026-S45 »), triable. */
const cleSemaine = (s) => `${s.annee}-S${String(s.numero).padStart(2, '0')}`;

/** « 2026-11-03 » → « 03.11.2026 ». */
const dateSuisse = (jour) => (jour ? jour.split('-').reverse().join('.') : '');

/** Heure locale « 07:45 » d'une date ISO. */
function heure(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Durée « 2 h 05 » entre deux dates ISO. */
function duree(debut, fin) {
  const minutes = Math.max(0, Math.round((new Date(fin) - new Date(debut)) / 60000));
  if (!Number.isFinite(minutes)) return '';
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** Nombre arrondi au mm (3 décimales), ou vide. */
const m3 = (valeur) => (Number.isFinite(valeur) ? Math.round(valeur * 1000) / 1000 : null);

const gras = (v) => ({ v, style: 'gras' });

/**
 * Cellule d'un écart (plan ou hauteur) : colorée en orange ou en rouge si l'écart dépasse la tolérance.
 * classe : couleur notée au moment du contrôle (tolérances du projet), sinon calculée avec 2 cm / 4 cm.
 */
export function celluleEcart(valeur, classe, tolerance) {
  const nombre = m3(valeur);
  if (nombre == null) return nombre;
  const couleur = classe ?? classeTolerance(valeur, tolerance);
  return couleur === 'orange' || couleur === 'rouge' ? { v: nombre, style: couleur } : nombre;
}

/** Nom affiché d'un appareil (son nom, sinon son identifiant). */
const nomAppareil = (journal) => journal.appareil || journal.appareilId || 'appareil sans nom';

/**
 * Onglets du recap (voir recap/xlsx.js) à partir des journaux [{ appareilId, appareil, jours,
 * controles }]. maintenant : Date (titre « mis à jour le »).
 */
export function ongletsDuRecap(journaux, maintenant = new Date()) {
  // Tout ce qui s'est passé, rangé par semaine.
  const semaines = new Map();
  const semaine = (jour) => {
    const s = semaineDe(jour);
    const cle = cleSemaine(s);
    if (!semaines.has(cle)) semaines.set(cle, { ...s, cle, jours: [], controles: [] });
    return semaines.get(cle);
  };
  for (const journal of journaux) {
    const appareil = nomAppareil(journal);
    for (const ligne of journal.jours ?? []) semaine(ligne.jour).jours.push({ ...ligne, appareil });
    for (const c of journal.controles ?? []) {
      const d = new Date(c.le);
      if (!Number.isNaN(d.getTime())) semaine(jourLocal(d)).controles.push({ ...c, appareil, jour: jourLocal(d) });
    }
  }
  const triees = [...semaines.values()].sort((a, b) => b.cle.localeCompare(a.cle)).slice(0, SEMAINES_MONTREES);
  const misAJour = `${dateSuisse(jourLocal(maintenant))} ${heure(maintenant.toISOString())}`;
  return [ongletSynthese(triees, misAJour), ...triees.map((s) => ongletSemaine(s, misAJour))];
}

/** Onglet « Synthèse » : une ligne par semaine et par appareil. */
function ongletSynthese(semaines, misAJour) {
  const lignes = [
    [{ v: 'Recap App Topo : contrôles', style: 'titre' }],
    [`Mis à jour le ${misAJour}. Écarts et avis dans l'onglet de chaque semaine.`],
    [],
    ['Semaine', 'Du', 'Au', 'Appareil', 'Jours de travail', 'Projets', 'Contrôles faits', 'Refus du rappel', 'Jours avec travail sans contrôle', 'Points sans contrôle', 'Implantations sans contrôle'].map(gras),
  ];
  for (const s of semaines) {
    const appareils = [...new Set([...s.jours.map((j) => j.appareil), ...s.controles.map((c) => c.appareil)])].sort();
    for (const appareil of appareils) {
      const jours = s.jours.filter((j) => j.appareil === appareil);
      const controles = s.controles.filter((c) => c.appareil === appareil);
      const travail = jours.filter((j) => j.points + j.implantations > 0);
      const sans = jours.filter((j) => j.sansControle.points + j.sansControle.implantations > 0);
      lignes.push([
        `S${s.numero} ${s.annee}`, dateSuisse(s.lundi), dateSuisse(s.dimanche), appareil,
        new Set(travail.map((j) => j.jour)).size,
        [...new Set(jours.map((j) => j.projet))].join(', '),
        controles.filter((c) => c.type === 'mesure').length,
        controles.filter((c) => c.type === 'refus').length,
        new Set(sans.map((j) => j.jour)).size,
        sans.reduce((t, j) => t + j.sansControle.points, 0),
        sans.reduce((t, j) => t + j.sansControle.implantations, 0),
      ]);
    }
  }
  if (semaines.length === 0) lignes.push(['Rien d\'enregistré pour l\'instant.']);
  return { nom: 'Synthèse', lignes, largeurs: [12, 11, 11, 20, 10, 40, 10, 10, 14, 12, 14] };
}

/** Onglet d'une semaine : contrôles (écarts, avis vide), travail sans contrôle, activité. */
function ongletSemaine(s, misAJour) {
  const parDate = (a, b) => String(a.le ?? a.debut).localeCompare(String(b.le ?? b.debut));
  const lignes = [
    [{ v: `Semaine ${s.numero} ${s.annee} : du ${dateSuisse(s.lundi)} au ${dateSuisse(s.dimanche)}`, style: 'titre' }],
    [`Mis à jour le ${misAJour}.`],
    ['Écarts colorés : orange = au-dessus de la 1re limite, rouge = hors tolérance (limites du projet, 2 cm / 4 cm au départ). La colonne « Avis » reste à toi.'],
    [],
    [{ v: 'Contrôles', style: 'titre' }],
    ['Date', 'Heure', 'Projet', 'Appareil', 'Point', 'Écart Est (m)', 'Écart Nord (m)', 'Écart plan (m)', 'Écart hauteur (m)', 'Remarque', 'Avis'].map(gras),
  ];
  const controles = [...s.controles].sort(parDate);
  for (const c of controles) {
    if (c.type === 'refus') lignes.push([dateSuisse(c.jour), heure(c.le), c.projet, c.appareil, 'Rappel refusé', null, null, null, null, c.remarque || '', '']);
    else lignes.push([dateSuisse(c.jour), heure(c.le), c.projet, c.appareil, c.point ?? '', m3(c.ecarts?.est), m3(c.ecarts?.nord), celluleEcart(c.ecarts?.plan, c.resultat?.plan, TOLERANCES_PAR_DEFAUT.plan), celluleEcart(c.ecarts?.hauteur, c.resultat?.hauteur, TOLERANCES_PAR_DEFAUT.hauteur), c.remarque || '', '']);
  }
  if (controles.length === 0) lignes.push(['Aucun contrôle cette semaine.']);
  lignes.push([], [{ v: 'Travail sans contrôle', style: 'titre' }]);
  lignes.push(['Date', 'Depuis', 'Projet', 'Appareil', 'Points levés', 'Implantations'].map(gras));
  const sans = s.jours.filter((j) => j.sansControle.points + j.sansControle.implantations > 0).sort(parDate);
  for (const j of sans) lignes.push([dateSuisse(j.jour), heure(j.sansControle.depuis), j.projet, j.appareil, j.sansControle.points, j.sansControle.implantations]);
  if (sans.length === 0) lignes.push(['Aucun travail sans contrôle cette semaine.']);
  lignes.push([], [{ v: 'Activité', style: 'titre' }]);
  lignes.push(['Date', 'Projet', 'Appareil', 'Ouvertures', 'Début', 'Fin', 'Durée', 'Points levés', 'Implantations', 'Contrôles'].map(gras));
  for (const j of [...s.jours].sort(parDate)) {
    lignes.push([dateSuisse(j.jour), j.projet, j.appareil, j.ouvertures, heure(j.debut), heure(j.fin), duree(j.debut, j.fin), j.points, j.implantations, j.controles]);
  }
  return { nom: `S${s.numero} ${s.annee}`, lignes, largeurs: [11, 8, 30, 20, 14, 12, 12, 12, 14, 20, 20] };
}
