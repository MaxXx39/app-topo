// Écran « Planning » de l'application Matériel (0.275.0, étape 2) : un mois (articles en lignes, un jour
// par colonne, la veille du 1er en colonne hachurée) ou une année (lecture seule). Gestes à la souris ou
// au doigt : glisser sur des jours vides = nouvelle affectation ; tirer un bord = allonger / raccourcir ;
// glisser une barre = la déplacer ; toucher une barre = la modifier. Règles : planning.js.
import { echapper } from '../outils/echapper.js';
import { demanderChoix, demanderChamps, demanderCases } from '../outils/choix.js';
import { texteSurCouleur, dateSuisse, chantiersTries, ajouterChantier, normaliserNumeroChantier, articlesTries } from './donnees.js';
import {
  MOIS, JOURS_COURTS, donneesDuMois, ajouterJours, nombreDeJours, aujourdhui, moisVoisin, bornesDuMois, joursDuMois,
  isoDuJour, poserAffectation, lireAffectation, chevauchements, supprimerAffectation, rendreAuDepot, couperAffectation,
  prolongerAffectations, affectationsFinissantLe, remettreAffectations, responsableDe, nomDuChantier, nomFichierMois,
} from './planning.js';
import { pdfDuMois } from './pdf-mois.js';
import { excelDuMois } from './excel-mois.js';

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const TAILLE_PILE = 30; // niveaux d'annulation (Ctrl+Z), gardés tant que la page est ouverte
const DEPLACEMENT_MINI = 4; // px : en dessous, c'est un toucher (ouvrir la barre), pas un glisser

/**
 * Crée l'écran. obtenirParc() : le parc en cours ; changer(action) : applique et enregistre (voir appli.js) ;
 * message(texte, durée, options) ; enregistrer(blob, nom) : fichier exporté (PDF, Excel) ; redessiner().
 */
export function creerEcranPlanning({ obtenirParc, changer, message, enregistrer, redessiner }) {
  const jour = aujourdhui();
  const etat = { annee: Number(jour.slice(0, 4)), mois: Number(jour.slice(5, 7)), vue: 'mois', inactifs: false, reperer: '' };
  const pile = []; // copies des affectations avant chaque changement du planning
  let geste = null; // glisser en cours

  /** Change le planning (avec une copie pour « Annuler »). */
  async function modifier(action) {
    const copie = obtenirParc().affectations.map((af) => ({ ...af }));
    const resultat = await changer(action);
    if (resultat.ok) {
      pile.push(copie);
      if (pile.length > TAILLE_PILE) pile.shift();
    }
    return resultat;
  }

  async function annuler() {
    if (!pile.length) return message('Rien à annuler.', 3000);
    const copie = pile.at(-1);
    const { ok } = await changer((p) => remettreAffectations(p, copie));
    if (ok) {
      pile.pop();
      message('Dernier changement du planning annulé', 2500, { ok: true });
    }
    redessiner();
    return undefined;
  }

  /**
   * Pose une affectation (nouvelle si id est null) ; si elle chevauche une autre affectation du même article,
   * demande « couper / remplacer / annuler ». Renvoie vrai si elle est posée.
   */
  async function poser(champs, id = null) {
    const parc = obtenirParc();
    let valeurs;
    try {
      valeurs = lireAffectation(parc, champs);
    } catch (erreur) {
      message(erreur.message, 6000);
      return false;
    }
    let mode = null;
    const conflits = chevauchements(parc, valeurs.articleId, valeurs.debut, valeurs.fin, id);
    if (conflits.length) {
      const liste = conflits.map((af) => `${nomDuChantier(parc.chantiers.find((c) => c.id === af.chantierId))} (${dateSuisse(af.debut).slice(0, 5)} → ${dateSuisse(af.fin).slice(0, 5)})`).join(' · ');
      mode = await demanderChoix({
        titre: 'Cet article est déjà affecté sur cette période',
        texte: liste,
        boutons: [
          { cle: 'couper', texte: 'Couper l\'existante', detail: 'elle garde ses jours avant et après', principal: true },
          { cle: 'remplacer', texte: 'Remplacer', detail: 'l\'affectation existante est supprimée' },
          { cle: 'annuler', texte: 'Annuler', detail: 'rien ne change' },
        ],
      });
      if (mode !== 'couper' && mode !== 'remplacer') {
        redessiner();
        return false;
      }
    }
    const { ok } = await modifier((p) => poserAffectation(p, champs, id, mode));
    redessiner();
    return ok;
  }

  // --- Choix du chantier (après un glisser) : recherche + liste, ou nouveau chantier tapé ---

  function choisirChantier(titre) {
    const parc = obtenirParc();
    const chantiers = chantiersTries(parc).filter((c) => !c.archive);
    return new Promise((resoudre) => {
      const fenetre = document.createElement('dialog');
      fenetre.className = 'fenetre-choix fenetre-champs fenetre-chantier';
      fenetre.innerHTML = `
        <div class="entete-fenetre-champs"><h2>${echapper(titre)}</h2>
          <button type="button" class="bouton-retour" data-cle="fermer" aria-label="Fermer">✕</button></div>
        <input type="search" data-champ="cherche" placeholder="Chercher (n° ou nom), ou taper un nouveau chantier" aria-label="Chercher un chantier" />
        <div class="liste-choix-chantiers" data-zone="liste"></div>`;
      const champ = fenetre.querySelector('[data-champ="cherche"]');
      const dessinerListe = () => {
        const mots = champ.value.toLowerCase().split(/\s+/).filter(Boolean);
        const trouves = chantiers.filter((c) => mots.every((m) => `${c.numero} ${c.nom} ${c.responsable}`.toLowerCase().includes(m))).slice(0, 40);
        const tape = champ.value.trim();
        fenetre.querySelector('[data-zone="liste"]').innerHTML = `${trouves.map((c) => `<button type="button" class="bouton-secondaire" data-chantier="${echapper(c.id)}"><strong>${echapper(nomDuChantier(c))}</strong>${c.responsable ? `<span>${echapper(c.responsable)}</span>` : ''}</button>`).join('')}
          ${tape ? `<button type="button" class="bouton" data-nouveau="1"><strong>＋ Nouveau chantier « ${echapper(tape)} »</strong></button>` : ''}
          ${!trouves.length && !tape ? '<p class="vide">Aucun chantier : tapez son n° et son nom.</p>' : ''}`;
      };
      const finir = (valeur) => {
        fenetre.close();
        resoudre(valeur);
      };
      fenetre.addEventListener('input', dessinerListe);
      fenetre.addEventListener('click', async (evenement) => {
        if (evenement.target.closest('[data-cle="fermer"]')) return finir(null);
        const choisi = evenement.target.closest('[data-chantier]');
        if (choisi) return finir(choisi.dataset.chantier);
        if (evenement.target.closest('[data-nouveau]')) {
          // « 10245 Gare Nyon » : n° = chiffres du début, nom = la suite (ou tout le texte).
          const tape = champ.value.trim();
          const debut = tape.match(/^\d[\d\s.'’]*/)?.[0] ?? '';
          const nom = tape.slice(debut.length).replace(/^[\s\-–·:]+/, '').trim() || tape;
          const { ok, resultat } = await changer((p) => ajouterChantier(p, { numero: normaliserNumeroChantier(debut.replace(/\D/g, '')), nom }));
          if (ok) finir(resultat.id);
        }
        return undefined;
      });
      fenetre.addEventListener('keydown', (evenement) => {
        if (evenement.key !== 'Enter') return;
        evenement.preventDefault();
        fenetre.querySelector('[data-chantier], [data-nouveau]')?.click();
      });
      fenetre.addEventListener('cancel', (evenement) => {
        evenement.preventDefault();
        finir(null);
      });
      fenetre.addEventListener('close', () => fenetre.remove());
      document.body.append(fenetre);
      dessinerListe();
      fenetre.showModal();
      champ.focus();
    });
  }

  const choixChantiers = () => chantiersTries(obtenirParc()).filter((c) => !c.archive).map((c) => [c.id, nomDuChantier(c)]);

  // --- Fenêtre d'une affectation (toucher une barre) ---

  async function ouvrirAffectation(id) {
    const parc = obtenirParc();
    const af = parc.affectations.find((x) => x.id === id);
    if (!af) return;
    const article = parc.articles.find((a) => a.id === af.articleId);
    const chantier = parc.chantiers.find((c) => c.id === af.chantierId);
    const action = await demanderChoix({
      titre: `${article?.numero ?? '?'} · ${nomDuChantier(chantier)}`,
      texte: `Du ${dateSuisse(af.debut)} au ${dateSuisse(af.fin)} (${nombreDeJours(af.debut, af.fin)} j) · ${responsableDe(parc, af) || 'sans responsable'}${af.remarque ? ` · ${af.remarque}` : ''}`,
      boutons: [
        { cle: 'modifier', texte: 'Modifier', detail: 'dates, chantier, responsable, remarque', principal: true },
        { cle: 'rendre', texte: 'Rendre au dépôt', detail: 'choisir le dernier jour sur le chantier' },
        { cle: 'changer', texte: 'Changer de chantier à partir du…' },
        { cle: 'couper', texte: 'Couper en deux' },
        { cle: 'supprimer', texte: 'Supprimer', classe: 'bouton-danger' },
        { cle: 'fermer', texte: 'Fermer' },
      ],
    });
    const demain = (iso) => (iso > af.debut && iso <= af.fin ? iso : ajouterJours(af.debut, 1));
    if (action === 'modifier') {
      const champs = await demanderChamps({
        titre: `Affectation de l'article ${article?.numero ?? ''}`,
        champs: [
          { cle: 'debut', titre: 'Du', valeur: dateSuisse(af.debut), exemple: 'JJ.MM.AAAA' },
          { cle: 'fin', titre: 'Au', valeur: dateSuisse(af.fin), exemple: 'JJ.MM.AAAA' },
          { cle: 'chantierId', titre: 'Chantier', valeur: af.chantierId, choix: choixChantiers() },
          { cle: 'responsable', titre: 'Responsable (vide = celui du chantier)', valeur: af.responsable, exemple: chantier?.responsable ?? '' },
          { cle: 'remarque', titre: 'Remarque', valeur: af.remarque },
        ],
      });
      if (champs) await poser({ ...champs, articleId: af.articleId }, af.id);
    } else if (action === 'rendre') {
      const champs = await demanderChamps({ titre: 'Rendre au dépôt', champs: [{ cle: 'jour', titre: 'Dernier jour sur le chantier', valeur: dateSuisse(af.fin > jour && af.debut <= jour ? jour : ajouterJours(af.fin, -1)), exemple: 'JJ.MM.AAAA' }] });
      if (champs) await modifier((p) => rendreAuDepot(p, af.id, champs.jour));
    } else if (action === 'changer') {
      const champs = await demanderChamps({
        titre: 'Changer de chantier',
        champs: [
          { cle: 'jour', titre: 'À partir du', valeur: dateSuisse(demain(jour)), exemple: 'JJ.MM.AAAA' },
          { cle: 'chantierId', titre: 'Nouveau chantier', valeur: '', choix: [['', '— choisir —'], ...choixChantiers().filter(([c]) => c !== af.chantierId)] },
          { cle: 'responsable', titre: 'Responsable (vide = celui du chantier)', valeur: '' },
        ],
      });
      if (champs && !champs.chantierId) message('Choisissez le nouveau chantier.', 4000);
      else if (champs) await modifier((p) => couperAffectation(p, af.id, champs.jour, { chantierId: champs.chantierId, responsable: champs.responsable }));
    } else if (action === 'couper') {
      const champs = await demanderChamps({ titre: 'Couper en deux', champs: [{ cle: 'jour', titre: 'La 2e partie commence le', valeur: dateSuisse(demain(jour)), exemple: 'JJ.MM.AAAA' }] });
      if (champs) await modifier((p) => couperAffectation(p, af.id, champs.jour));
    } else if (action === 'supprimer') {
      await modifier((p) => supprimerAffectation(p, af.id));
    }
    redessiner();
  }

  // --- Boutons de la barre ---

  async function saisir() {
    const parc = obtenirParc();
    const articles = articlesTries(parc).filter((a) => etat.inactifs || a.statut === 'actif');
    if (!articles.length || !parc.chantiers.length) return message('Il faut au moins un article (Parc) et un chantier (Chantiers).', 5000);
    const champs = await demanderChamps({
      titre: 'Nouvelle affectation',
      champs: [
        { cle: 'articleId', titre: 'Article', valeur: articles[0].id, choix: articles.map((a) => [a.id, `${a.numero} ${a.designation}`.trim()]) },
        { cle: 'chantierId', titre: 'Chantier', valeur: '', choix: [['', '— choisir —'], ...choixChantiers()] },
        { cle: 'debut', titre: 'Du', valeur: dateSuisse(jour), exemple: 'JJ.MM.AAAA' },
        { cle: 'fin', titre: 'Au', valeur: dateSuisse(jour), exemple: 'JJ.MM.AAAA' },
        { cle: 'responsable', titre: 'Responsable (vide = celui du chantier)', valeur: '' },
        { cle: 'remarque', titre: 'Remarque', valeur: '' },
      ],
    });
    if (champs) await poser(champs);
    return undefined;
  }

  async function prolonger() {
    const parc = obtenirParc();
    const { debut, fin } = bornesDuMois(etat.annee, etat.mois);
    const veille = ajouterJours(debut, -1);
    const liste = affectationsFinissantLe(parc, veille);
    if (!liste.length) return message(`Aucune affectation ne finit le ${dateSuisse(veille)}.`, 4000);
    const choisies = await demanderCases({
      titre: `Prolonger jusqu'au ${dateSuisse(fin)}`,
      options: liste.map((af) => ({ cle: af.id, coche: true, texte: `${parc.articles.find((a) => a.id === af.articleId)?.numero ?? '?'} · ${nomDuChantier(parc.chantiers.find((c) => c.id === af.chantierId))}` })),
    });
    if (!choisies?.length) return undefined;
    const { ok, resultat } = await modifier((p) => prolongerAffectations(p, choisies, fin));
    if (ok) {
      const texte = [`${resultat.prolongees} affectation(s) prolongée(s)`];
      if (resultat.raccourcies.length) texte.push(`arrêtées avant la suivante : ${resultat.raccourcies.join(', ')}`);
      message(texte.join(' · '), 7000, { ok: true });
    }
    redessiner();
    return undefined;
  }

  function exporter(format) {
    const donnees = donneesDuMois(obtenirParc(), etat.annee, etat.mois);
    if (!donnees.groupes.length) return message('Rien à exporter : aucun article actif.', 4000);
    if (format === 'pdf') enregistrer(pdfDuMois(donnees, jour), nomFichierMois(etat.annee, etat.mois, 'pdf'));
    else enregistrer(new Blob([excelDuMois(donnees)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nomFichierMois(etat.annee, etat.mois, 'xlsx'));
    return undefined;
  }

  /** Actions des boutons (data-action) ; renvoie vrai si l'action est celle du planning. */
  function agir(action, bouton) {
    const actions = {
      'mois-precedent': () => Object.assign(etat, etat.vue === 'annee' ? { annee: etat.annee - 1 } : moisVoisin(etat.annee, etat.mois, -1)),
      'mois-suivant': () => Object.assign(etat, etat.vue === 'annee' ? { annee: etat.annee + 1 } : moisVoisin(etat.annee, etat.mois, 1)),
      'mois-courant': () => Object.assign(etat, { annee: Number(jour.slice(0, 4)), mois: Number(jour.slice(5, 7)) }),
      'vue-mois': () => { etat.vue = 'mois'; },
      'vue-annee': () => { etat.vue = 'annee'; },
      'ouvrir-mois': () => Object.assign(etat, { vue: 'mois', mois: Number(bouton.dataset.mois) }),
    };
    if (actions[action]) {
      actions[action]();
      redessiner();
      return true;
    }
    const lentes = { annuler, saisir, prolonger, 'exporter-pdf': () => exporter('pdf'), 'exporter-excel': () => exporter('xlsx'), 'ouvrir-affectation': () => ouvrirAffectation(bouton.dataset.id) };
    if (!lentes[action]) return false;
    Promise.resolve(lentes[action]()).catch((erreur) => message(`Erreur : ${erreur.message}`, 8000));
    return true;
  }

  // --- Dessin ---

  function html() {
    const parc = obtenirParc();
    const moisPrecedent = moisVoisin(etat.annee, etat.mois, -1);
    const titre = etat.vue === 'annee' ? String(etat.annee) : `${MOIS[etat.mois - 1]} ${etat.annee}`;
    return `
      <div class="barre-materiel barre-planning">
        <span class="navigation-mois">
          <button type="button" class="bouton-secondaire" data-action="mois-precedent" aria-label="Avant">◀</button>
          <strong class="titre-mois">${titre}</strong>
          <button type="button" class="bouton-secondaire" data-action="mois-suivant" aria-label="Après">▶</button>
          <button type="button" class="bouton-lien" data-action="mois-courant">aujourd'hui</button>
        </span>
        <span class="choix-vue" role="group" aria-label="Vue">
          <button type="button" class="${etat.vue === 'mois' ? 'actif' : ''}" data-action="vue-mois" aria-pressed="${etat.vue === 'mois'}">Mois</button>
          <button type="button" class="${etat.vue === 'annee' ? 'actif' : ''}" data-action="vue-annee" aria-pressed="${etat.vue === 'annee'}">Année</button>
        </span>
        <input type="search" data-planning="reperer" value="${echapper(etat.reperer)}" placeholder="Repérer (chantier, article…)" aria-label="Repérer un chantier ou un article" />
        <label class="case-materiel"><input type="checkbox" data-planning="inactifs" ${etat.inactifs ? 'checked' : ''} /> Inactifs</label>
        ${etat.vue === 'mois' ? `
        <button type="button" class="bouton-secondaire" data-action="annuler" ${pile.length ? '' : 'aria-disabled="true"'} title="Ctrl+Z">↶ Annuler${pile.length ? ` (${pile.length})` : ''}</button>
        <button type="button" class="bouton-secondaire" data-action="prolonger">↦ Prolonger ${MOIS[moisPrecedent.mois - 1]}</button>
        <button type="button" class="bouton-secondaire" data-action="saisir">＋ Saisie</button>
        <button type="button" class="bouton" data-action="exporter-pdf">PDF du mois</button>
        <button type="button" class="bouton-secondaire" data-action="exporter-excel">Excel du mois</button>` : ''}
      </div>
      ${!parc.articles.length ? '<p class="aide">Ajoutez d\'abord des articles (onglet Parc) et des chantiers.</p>' : ''}
      <div class="cadre-planning">${etat.vue === 'annee' ? htmlAnnee() : htmlMois()}</div>
      <div class="bulle-planning" data-zone="bulle" hidden></div>`;
  }

  /** Vrai si le texte « Repérer » se trouve dans ce qui est donné. */
  const repere = (...textes) => !etat.reperer.trim() || etat.reperer.toLowerCase().split(/\s+/).filter(Boolean).every((m) => textes.join(' ').toLowerCase().includes(m));

  function htmlMois() {
    const d = donneesDuMois(obtenirParc(), etat.annee, etat.mois, { inactifs: etat.inactifs, avecVeille: true });
    const colonne = (j) => j + 2; // colonne 1 = article ; la veille (j = 0) = colonne 2
    const classesJour = (x) => `jour-pl${x.semaine >= 5 ? ' we' : ''}${x.iso === jour ? ' auj' : ''}${x.j === 0 ? ' veille' : ''}${x.semaine === 0 && x.j > 1 ? ' lundi' : ''}`;
    const entete = `<div class="ligne-pl entete-pl"><div class="nom-pl">Article</div>${d.jours.map((x) => `<div class="${classesJour(x)}" style="grid-column:${colonne(x.j)}"><b>${x.j === 0 ? Number(x.iso.slice(8)) : x.j}</b>${JOURS_COURTS[x.semaine]}</div>`).join('')}</div>`;
    const lignes = d.groupes.map((g) => `
      <div class="categorie-pl">${echapper(g.categorie.nom)}</div>
      ${g.articles.map(({ article, barres }) => {
        const pale = etat.reperer.trim() && !repere(article.numero, article.designation) && !barres.some((b) => repere(b.principal, b.responsable));
        return `<div class="ligne-pl${pale ? ' pale' : ''}${article.statut !== 'actif' ? ' inactif' : ''}" data-article="${echapper(article.id)}">
          <div class="nom-pl"><span class="pastille-article" style="background:${article.couleur};color:${texteSurCouleur(article.couleur)}">${echapper(article.numero)}</span><span class="designation-pl">${echapper(article.designation)}</span></div>
          ${d.jours.map((x) => `<div class="${classesJour(x)}" data-j="${x.j}" style="grid-column:${colonne(x.j)}"></div>`).join('')}
          ${barres.map((b) => `<div class="barre-pl${b.avant ? ' avant' : ''}${b.apres ? ' apres' : ''}${etat.reperer.trim() && !repere(b.principal, b.responsable, article.numero) ? ' pale' : ''}" data-af="${echapper(b.af.id)}"
              style="grid-column:${colonne(b.j1)} / ${colonne(b.j2) + 1};background:${article.couleur};color:${texteSurCouleur(article.couleur)}"
              title="${echapper(`${b.principal}${b.responsable ? ` – ${b.responsable}` : ''} · du ${dateSuisse(b.af.debut)} au ${dateSuisse(b.af.fin)}${b.af.remarque ? ` · ${b.af.remarque}` : ''}`)}">
              <span class="poignee-pl g" data-bord="g"></span>
              <span class="texte-pl">${echapper(b.principal)}${b.responsable ? ` <i>– ${echapper(b.responsable)}</i>` : ''}</span>
              <span class="poignee-pl d" data-bord="d"></span></div>`).join('')}
        </div>`;
      }).join('')}`).join('');
    return `<div class="grille-planning" style="--jours:${d.jours.length}">${entete}${lignes || '<p class="vide">Aucun article à montrer.</p>'}</div>`;
  }

  function htmlAnnee() {
    const parc = obtenirParc();
    const annee = etat.annee;
    const mois = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, ...bornesDuMois(annee, i + 1), n: joursDuMois(annee, i + 1) }));
    const articles = articlesTries(parc).filter((a) => etat.inactifs || a.statut === 'actif'
      || parc.affectations.some((af) => af.articleId === a.id && af.debut <= `${annee}-12-31` && af.fin >= `${annee}-01-01`));
    const nomCategorie = new Map(parc.categories.map((c) => [c.id, c.nom]));
    let categorie = null;
    return `<table class="annee-pl"><thead><tr><th>Article</th>${mois.map((x) => `<th><button type="button" class="bouton-lien" data-action="ouvrir-mois" data-mois="${x.m}">${MOIS_COURTS[x.m - 1]}</button></th>`).join('')}</tr></thead><tbody>
      ${articles.map((a) => {
        const titreCategorie = a.categorieId !== categorie ? `<tr class="categorie-annee"><td colspan="13">${echapper(nomCategorie.get(a.categorieId) ?? '')}</td></tr>` : '';
        categorie = a.categorieId;
        const cases = mois.map((x) => {
          const morceaux = parc.affectations.filter((af) => af.articleId === a.id && af.debut <= x.fin && af.fin >= x.debut).map((af) => {
            const j1 = af.debut < x.debut ? 1 : Number(af.debut.slice(8));
            const j2 = af.fin > x.fin ? x.n : Number(af.fin.slice(8));
            const pale = etat.reperer.trim() && !repere(nomDuChantier(parc.chantiers.find((c) => c.id === af.chantierId)), responsableDe(parc, af), a.numero);
            return `<span class="morceau-annee${pale ? ' pale' : ''}" style="left:${((j1 - 1) / x.n) * 100}%;width:${((j2 - j1 + 1) / x.n) * 100}%;background:${a.couleur}" title="${echapper(`${nomDuChantier(parc.chantiers.find((c) => c.id === af.chantierId))} · ${dateSuisse(af.debut)} → ${dateSuisse(af.fin)}`)}"></span>`;
          }).join('');
          return `<td><div class="mois-annee">${morceaux}</div></td>`;
        }).join('');
        return `${titreCategorie}<tr><td class="nom-annee"><span class="pastille-article" style="background:${a.couleur};color:${texteSurCouleur(a.couleur)}">${echapper(a.numero)}</span></td>${cases}</tr>`;
      }).join('')}</tbody></table>`;
  }

  // --- Gestes sur la grille (souris, doigt, stylet) ---

  /** Jour (j) sous le pointeur dans une ligne, borné à la veille et au dernier jour du mois. */
  function jourSous(ligne, x) {
    const cases = ligne.querySelectorAll('.jour-pl');
    const premiere = cases[0].getBoundingClientRect();
    const largeur = premiere.width;
    const n = cases.length - 1;
    return Math.max(0, Math.min(n, Math.floor((x - premiere.left) / largeur)));
  }

  function montrerBulle(page, x, y, texte) {
    const bulle = page.querySelector('[data-zone="bulle"]');
    if (!bulle) return;
    bulle.hidden = !texte;
    bulle.textContent = texte;
    bulle.style.left = `${x + 14}px`;
    bulle.style.top = `${y - 34}px`;
  }

  const isoDe = (j) => isoDuJour(etat.annee, etat.mois, j);
  const texteDates = (debut, fin) => `${dateSuisse(debut).slice(0, 5)} → ${dateSuisse(fin).slice(0, 5)} (${nombreDeJours(debut, fin)} j)`;

  /** Période en cours de geste : { debut, fin } (vraies dates, aussi hors du mois). */
  function periodeDuGeste(g) {
    if (g.sorte === 'creer') {
      const [a, b] = [g.j0, g.j].sort((x, y) => x - y);
      return { debut: isoDe(a), fin: isoDe(b) };
    }
    const delta = g.j - g.j0;
    if (g.sorte === 'deplacer') return { debut: ajouterJours(g.af.debut, delta), fin: ajouterJours(g.af.fin, delta) };
    if (g.bord === 'g') {
      const debut = ajouterJours(g.af.debut < isoDe(0) ? isoDe(g.j0) : g.af.debut, delta);
      return { debut: debut > g.af.fin ? g.af.fin : debut, fin: g.af.fin };
    }
    const fin = ajouterJours(g.af.fin > isoDe(joursDuMois(etat.annee, etat.mois)) ? isoDe(g.j0) : g.af.fin, delta);
    return { debut: g.af.debut, fin: fin < g.af.debut ? g.af.debut : fin };
  }

  /** Montre la période du geste dans la ligne (aperçu ou barre déplacée). */
  function apercu(g) {
    const { debut, fin } = periodeDuGeste(g);
    const premier = isoDe(0);
    const dernier = isoDe(joursDuMois(etat.annee, etat.mois));
    const j1 = debut < premier ? 0 : nombreDeJours(premier, debut) - 1;
    const j2 = fin > dernier ? joursDuMois(etat.annee, etat.mois) : nombreDeJours(premier, fin) - 1;
    const element = g.element;
    element.hidden = fin < premier || debut > dernier;
    element.style.gridColumn = `${j1 + 2} / ${j2 + 3}`;
    return { debut, fin };
  }

  function installer(page) {
    page.addEventListener('pointerdown', (evenement) => {
      const ligne = evenement.target.closest('.grille-planning .ligne-pl[data-article]');
      if (!ligne || evenement.button > 0) return;
      const barre = evenement.target.closest('.barre-pl');
      const parc = obtenirParc();
      const j = jourSous(ligne, evenement.clientX);
      if (barre) {
        const af = parc.affectations.find((x) => x.id === barre.dataset.af);
        if (!af) return;
        const bord = evenement.target.closest('[data-bord]')?.dataset.bord;
        geste = { sorte: bord ? 'etirer' : 'deplacer', bord, af: { ...af }, ligne, element: barre, j0: j, j, x0: evenement.clientX, y0: evenement.clientY, bouge: false };
      } else if (evenement.target.closest('.jour-pl')) {
        const element = document.createElement('div');
        element.className = 'apercu-pl';
        ligne.append(element);
        geste = { sorte: 'creer', ligne, element, j0: j, j, x0: evenement.clientX, y0: evenement.clientY, bouge: true };
        apercu(geste);
      } else return;
      evenement.preventDefault();
      ligne.setPointerCapture(evenement.pointerId);
    });
    page.addEventListener('pointermove', (evenement) => {
      if (!geste) return;
      if (!geste.bouge && Math.hypot(evenement.clientX - geste.x0, evenement.clientY - geste.y0) < DEPLACEMENT_MINI) return;
      geste.bouge = true;
      geste.j = jourSous(geste.ligne, evenement.clientX);
      const { debut, fin } = apercu(geste);
      montrerBulle(page, evenement.clientX, evenement.clientY, texteDates(debut, fin));
    });
    const finir = async (evenement, abandon = false) => {
      if (!geste) return;
      const g = geste;
      geste = null;
      montrerBulle(page, 0, 0, '');
      if (abandon) return redessiner();
      if (g.sorte !== 'creer' && !g.bouge) return ouvrirAffectation(g.af.id); // simple toucher
      const { debut, fin } = periodeDuGeste(g);
      if (g.sorte === 'creer') {
        const chantierId = await choisirChantier(`${obtenirParc().articles.find((a) => a.id === g.ligne.dataset.article)?.numero ?? ''} : ${texteDates(debut, fin)}`);
        if (!chantierId) return redessiner();
        return poser({ articleId: g.ligne.dataset.article, chantierId, debut, fin });
      }
      if (debut === g.af.debut && fin === g.af.fin) return redessiner();
      return poser({ ...g.af, debut, fin }, g.af.id);
    };
    page.addEventListener('pointerup', (evenement) => { finir(evenement).catch((erreur) => message(`Erreur : ${erreur.message}`, 8000)); });
    page.addEventListener('pointercancel', (evenement) => { finir(evenement, true); });
    page.addEventListener('input', (evenement) => {
      if (evenement.target.dataset.planning !== 'reperer') return;
      etat.reperer = evenement.target.value;
      const cadre = page.querySelector('.cadre-planning');
      if (cadre) cadre.innerHTML = etat.vue === 'annee' ? htmlAnnee() : htmlMois();
    });
    page.addEventListener('change', (evenement) => {
      if (evenement.target.dataset.planning !== 'inactifs') return;
      etat.inactifs = evenement.target.checked;
      redessiner();
    });
    // Ctrl+Z : écouté sur tout le document (le focus n'est pas toujours dans la page), tant que la page est ouverte.
    const touche = (evenement) => {
      if (!page.isConnected) {
        document.removeEventListener('keydown', touche);
        return;
      }
      if (document.querySelector('dialog[open]:not(.page-materiel)')) return; // une fenêtre est ouverte par-dessus
      if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === 'z' && !evenement.target.matches('input, textarea')
        && page.querySelector('.grille-planning')) {
        evenement.preventDefault();
        annuler();
      }
    };
    document.addEventListener('keydown', touche);
  }

  /** Raison d'un bouton grisé du planning. */
  const raison = (action) => ({ annuler: 'Rien à annuler (seuls les changements du planning faits depuis l\'ouverture de la page).' })[action];

  return { html, agir, installer, raison };
}
