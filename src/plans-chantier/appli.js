// Application « Plans de chantier » (0.288.0, Expert, site PC et Topo Bureau ; maquette validée le 23.11) :
// dessiner un plan d'installation de chantier, de phasage ou de circulation sur les plans du projet (MN95).
// Page plein écran à part (comme Calage de plans) : « Plans » (liste du projet) · « Dessiner » (bandeau d'outils en
// haut comme AutoCAD, plan au centre, phases et élément choisi à droite).
// Étape 1 : zones, lignes (clôtures…), pistes, flèches, textes, phases, accroches, fonds. 0.289.0 (étapes 2 à 4) :
// symboles (bibliothèque de blocs modernisés à gauche, grues réglables, base-vie à étage, import d'un DXF de blocs),
// fond swisstopo / cadastre / surfaces, onglet « Feuille » (A4 / A3 / A1, cartouche avec logo, légende, nord, échelle,
// une page par phase), PDF et DXF.
// Calculs : topo/plan-chantier.js, topo/symboles.js, topo/feuille-chantier.js, topo/plan-chantier-dxf.js ; vue : vue.js ;
// dessin : dessin.js ; feuille : feuille.js. Rangé dans le projet : projet.plansChantier, projet.symboles (Drive).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { demanderChoix, demanderTexte, demanderCases } from '../outils/choix.js';
import { accrocher, sourcesDesPlans, piedPerpendiculaire } from '../topo/accroche.js';
import {
  GENRES, nouveauPlanChantier, ajouterPhase, retirerPhase, ajouterObjet, retirerObjet, objetsVisibles, objetSousLePoint,
  deplacerObjet, lignesPourAccroche, resumeObjet, copiePlan, aire, longueur, sommetSousLePoint, couleurObjet, styleLigne,
  LARGEUR_FLECHE, OPACITE_ZONE, ECHELLE_PAPIER, epaisseurLigneMm, contourZoneMm, dimensionsFleche, coteDuPoint,
  decalerPolyligne, ligneLaPlusProche,
} from '../topo/plan-chantier.js';
import { creerVueChantier } from './vue.js';
import { listeGenres } from './apercu.js';
import { chargerBibliothequeBase, entreesBibliotheque, filtrerEntrees, CATEGORIES_SYMBOLES, symbolesDuDxf, ajouterSymbolesProjet } from './bibliotheque.js';
import { dessinerVignette, symboleDeLObjet } from './dessin.js';
import { geometrieCotation } from '../topo/plan-chantier.js';
import { SENS_DEVIATION, CLE_DEVIATION } from '../topo/panneau-deviation.js';
import { ouvrirGestionPhases } from './gestion-phases.js';
import { autogrueDe, TONNES_MOBILES, FLECHE_MOBILE_MIN } from '../topo/grue-mobile.js';
import { surLeSymbole, poigneeRotation, rotationVers, coinsSymbole, POSES_ETAGE, flechesDisponibles, chassisDisponibles, CLE_CONTENEUR, coteChassis, FLECHE_MIN, FLECHE_MAX, CHASSIS_MIN, CHASSIS_MAX, echelleDeLObjet } from '../topo/symboles.js';
import { estPose, changerOrdre, angleDeLaLigne, MATERIAUX_TAS, TAS_HAUTEUR, TAS_TALUS, TAILLE_TEXTE_MM, segmentLePlusProche, pointALaDistance, angleVers } from '../topo/plan-chantier.js';
import { reglagesFeuille, pagesDeLaFeuille, centreDeDepart, FORMATS_FEUILLE, miseEnPageFeuille, COINS_SITUATION } from '../topo/feuille-chantier.js';
import { preparerPage, dessinerPage, creerPdfChantier, chargerImage, adresseLogo } from './feuille.js';
import { dxfPlanChantier } from '../topo/plan-chantier-dxf.js';
import { nomFichierExport } from '../outils/nom-fichier.js';
import { PALEUR_ORTHO } from './tuiles.js';

const OUTILS = [
  ['zone', '<path d="M4 8L12 4L20 9L17 19H6Z"/>', 'Zone'],
  ['ligne', '<path d="M3 18L9 8L15 14L21 5"/>', 'Ligne'],
  ['piste', '<path d="M3 15L12 9L21 15M3 20L12 14L21 20"/>', 'Piste'],
  ['fleche', '<path d="M3 14H15V9L21 15L15 21V16H3Z"/>', 'Flèche'],
  ['texte', '<path d="M5 6H19M12 6V20M9 20H15"/>', 'Texte'],
  ['decaler', '<path d="M3 16L10 6L21 13"/><path d="M3 21L11 10L21 18" opacity=".55"/>', 'Décaler'],
  ['cotation', '<path d="M4 18H20M4 14V21M20 14V21"/><path d="M4 18L7 16V20ZM20 18L17 16V20Z"/>', 'Cotation'],
  ['construction', '<path d="M3 20L21 4" stroke-dasharray="3 2.5"/><path d="M12 8V16M8 12H16"/>', 'Construction'],
];
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const ACCROCHES = [['point', 'Point'], ['sommet', 'Sommet'], ['milieu', 'Milieu'], ['ligne', 'Sur ligne'], ['croisement', 'Croisement'], ['perpendiculaire', 'Perpendiculaire']];
const ICONE_CHOISIR = '<path d="M6 3L18 13L12 14L15 21L12.5 22L9.5 15L6 19Z"/>';
const MAX_ANNULER = 50;
const ico = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const n1 = (x) => (Math.abs(x) < 0.05 ? 0 : x).toFixed(1);
const dateCourte = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-CH') : '');

/**
 * Ouvre la page. projet (projet.plansChantier) ; modifie() : enregistrer (et Drive) ; plans() : plans du projet prêts
 * à dessiner (recalés) ; points() : points levés ; lectureSeule() : vrai si le projet ne peut pas être modifié ici ;
 * quandRetour() ; message(texte, durée, options).
 */
export function ouvrirPlansChantier({
  projet: projetDonne, modifie, plans = () => [], points = () => [], surfaces = () => [], enregistrer: enregistrerFichier = null,
  auteur = () => '', lectureSeule = () => false, quandRetour = null, message = () => {},
}) {
  // Le projet est relu à chaque fois (projet() ou objet) : l'appli peut le remplacer (Drive, Annuler général).
  const leProjet = typeof projetDonne === 'function' ? projetDonne : () => projetDonne;
  const liste = () => {
    const pr = leProjet();
    pr.plansChantier ??= [];
    return pr.plansChantier;
  };
  const page = document.createElement('dialog');
  page.className = 'page-chantier';
  document.body.append(page);
  page.showModal();

  const etat = {
    ecran: 'liste', planId: null, outil: 'choisir', saisie: null, choisi: null, accroches: new Set(['point', 'sommet']),
    categorie: 'installation', style: 'cloture', largeur: 4, tailleTexte: 1.2, curseur: null,
    // Réglages de l'outil (valeurs données aux éléments dessinés ensuite) : null = celle du genre.
    opacite: OPACITE_ZONE, contourMm: null, afficherSurface: false, epaisseurMm: null, echelleMotif: 1,
    largeurFleche: LARGEUR_FLECHE, echelleFleche: 1, texteRepere: false, repereBout: 'fleche', distanceDecalage: 0.5, cotationGenre: 'longueur',
    attenteRepere: null, // id du texte qui attend le point visé par sa ligne de repère
    reglageEnCours: false, // un curseur (transparence…) est en train d'être glissé
    glisse: null, // glisse : { type: 'sommet', i } ou { type: 'objet' } ou { type: 'rotation' }
    // 0.289.0 : symboles
    pose: null, // élément à poser (outil « symbole ») : { type: 'symbole', cle… } ou { type: 'grue', … }
    rotationPose: 0, biblio: { ouvert: false, categorie: '', recherche: '' }, fondEtat: null,
    orienter: null, // 0.290.0 : { id, mode: 'point' | 'ligne' } : le prochain clic oriente le symbole choisi
    constructionMode: 'droite', // 0.293.0 : 'droite' (2 points) | 'angle' (1 point + angle tapé) | 'segment' (2 points ou longueur tapée)
    decalerConstruction: false, // Décaler : créer une ligne de construction (parallèle) au lieu d'une ligne
  };
  let vue = null;
  let pileAnnuler = [];
  // Bibliothèque des symboles : livrée (chargée à l'ouverture) + importée dans le projet.
  let bibBase = [];
  const bib = () => [...bibBase, ...(leProjet().symboles ?? [])];
  chargerBibliothequeBase().then((liste) => {
    bibBase = liste;
    if (fermee) return;
    if (etat.ecran === 'dessin') {
      majBiblio();
      majTout();
    } else if (etat.ecran === 'feuille') majFeuille();
  });

  const plan = () => liste().find((x) => x.id === etat.planId) ?? null;
  const plansFond = () => {
    const caches = new Set(plan()?.fond?.plansCaches ?? []);
    return plans().filter((p) => !caches.has(p.id));
  };

  let fermee = false;
  function fermer() {
    fermee = true;
    vue?.detruire();
    feuille?.observateur?.disconnect();
    page.close();
    page.remove();
    quandRetour?.();
  }
  // Le navigateur peut fermer la page à un 2e Échap malgré tout (Chrome) : on la rouvre, seul « ← » la ferme.
  page.addEventListener('close', () => {
    if (!fermee && page.isConnected) page.showModal();
  });

  /** Avant chaque changement : refusé en lecture seule, sinon on garde l'état d'avant (↶ Annuler). */
  function avantChangement() {
    if (lectureSeule()) {
      message('Projet ouvert en lecture seule ici : rien n\'est modifié.', 5000);
      return false;
    }
    pileAnnuler.push(copiePlan(plan()));
    if (pileAnnuler.length > MAX_ANNULER) pileAnnuler.shift();
    return true;
  }
  function enregistrer() {
    plan().modifieLe = new Date().toISOString();
    modifie();
  }
  function annuler() {
    const avant = pileAnnuler.pop();
    if (!avant) {
      message('Rien à annuler.', 2500);
      return;
    }
    const p = plan();
    for (const cle of Object.keys(p)) delete p[cle];
    Object.assign(p, avant);
    if (!p.objets.some((o) => o.id === etat.choisi)) etat.choisi = null;
    enregistrer();
    majTout();
  }

  function echap() {
    if (etat.orienter) {
      etat.orienter = null;
      majTout();
    } else if (etat.attenteRepere) {
      etat.attenteRepere = null;
      majTout();
    } else if (etat.saisie) {
      etat.saisie = null;
      majTout();
    } else if (etat.choisi) {
      etat.choisi = null;
      majTout();
    } else if (etat.outil !== 'choisir') {
      etat.outil = 'choisir';
      majTout();
    }
  }
  page.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    echap();
  });
  page.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ['z', 'y'].includes(ev.key.toLowerCase())) ev.stopPropagation();
    // Échap (0.287.0) : arrête le dessin ou le choix, mais ne ramène jamais au menu de l'appli.
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      if (!ev.target.matches('input, select, textarea')) {
        ev.preventDefault();
        echap();
      }
      return;
    }
    if (etat.ecran !== 'dessin') return;
    const dansChamp = ev.target.matches('input, select, textarea');
    if (ev.key === 'Enter' && ev.target.matches('[data-saisie]')) {
      ev.preventDefault();
      placerParSaisie();
      return;
    }
    // Un chiffre tapé pendant le dessin va tout de suite dans « Longueur » (comme la saisie directe d'AutoCAD).
    if (!dansChamp && etat.saisie?.points?.length && etat.saisie.outil !== 'decaler' && /^[0-9.,]$/.test(ev.key) && !ev.ctrlKey && !ev.metaKey) {
      const champ = page.querySelector('[data-saisie="longueur"]:not([hidden])') && !page.querySelector('[data-zone="saisie"]').hidden ? page.querySelector('[data-saisie="longueur"]') : null;
      champ?.focus();
      return;
    }
    if (ev.key === 'Enter' && !dansChamp && etat.saisie) {
      ev.preventDefault();
      finirSaisie();
    } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && !dansChamp && etat.choisi) {
      ev.preventDefault();
      supprimerChoisi();
    } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !dansChamp) {
      ev.preventDefault();
      annuler();
    }
  });

  // ================================================================ Page

  function dessiner() {
    vue?.detruire();
    vue = null;
    feuille?.observateur?.disconnect();
    feuille = null;
    page.innerHTML = `
      <header class="entete-calage entete-chantier">
        <button type="button" class="retour-reglages" data-action="retour" aria-label="Retour aux applications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        <h2>Plans de chantier ${bulle('plansChantier')}</h2>
        <nav class="etapes-calage" aria-label="Parties">
          <button type="button" data-ecran="liste" class="${etat.ecran === 'liste' ? 'actif' : ''}">Plans</button>
          <button type="button" data-ecran="dessin" class="${etat.ecran === 'dessin' ? 'actif' : ''}" ${plan() ? '' : 'disabled'}>Dessiner</button>
          <button type="button" data-ecran="feuille" class="${etat.ecran === 'feuille' ? 'actif' : ''}" ${plan() ? '' : 'disabled'}>Feuille</button>
        </nav>
        ${plan() && etat.ecran !== 'liste' ? `<span class="nom-plan-chantier">${echapper(plan().nom)}</span>` : ''}
      </header>
      <main class="contenu-calage ${etat.ecran !== 'liste' ? 'en-calage' : ''}">${etat.ecran === 'dessin' ? htmlDessin() : etat.ecran === 'feuille' ? htmlFeuille() : htmlListe()}</main>`;
    if (etat.ecran === 'dessin') monterVue();
    if (etat.ecran === 'feuille') monterFeuille();
  }

  // ---------------------------------------------------------------- Liste des plans

  function htmlListe() {
    const tries = [...liste()].sort((a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe)));
    const genre = (g) => GENRES.find(([c]) => c === g)?.[1] ?? '';
    return `
      <div class="barre-calage"><button type="button" class="bouton" data-action="nouveau">＋ Nouveau plan</button></div>
      ${tries.length ? `<div class="cadre-tableau-calage"><table class="tableau-calage">
        <thead><tr><th>Plan</th><th>Genre</th><th>Phases</th><th>Objets</th><th>Modifié</th><th></th></tr></thead>
        <tbody>${tries.map((p) => `<tr>
          <td><strong>${echapper(p.nom)}</strong></td><td>${echapper(genre(p.genre))}</td>
          <td class="chiffre">${p.phases.length}</td><td class="chiffre">${p.objets.length}</td><td>${dateCourte(p.modifieLe)}</td>
          <td class="actions-chantier"><button type="button" class="bouton" data-ouvrir="${echapper(p.id)}">Ouvrir</button>
            <button type="button" class="bouton-secondaire" data-renommer="${echapper(p.id)}">Renommer</button>
            <button type="button" class="bouton-secondaire" data-dupliquer="${echapper(p.id)}">Dupliquer</button>
            <button type="button" class="bouton-secondaire" data-supprimer="${echapper(p.id)}">Supprimer</button></td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="aide-calage">Aucun plan de chantier dans ce projet.</p>'}`;
  }

  async function nouveau() {
    if (lectureSeule()) {
      message('Projet ouvert en lecture seule ici : rien n\'est modifié.', 5000);
      return;
    }
    const genre = await demanderChoix({ titre: 'Nouveau plan de chantier', boutons: [...GENRES.map(([cle, texte], i) => ({ cle, texte, principal: i === 0 })), { cle: '', texte: 'Annuler' }] });
    if (!genre) return;
    const titre = GENRES.find(([c]) => c === genre)[1];
    const nom = await demanderTexte({ titre: 'Nom du plan', valeur: `${titre} ${liste().filter((p) => p.genre === genre).length + 1}` });
    if (!nom) return;
    const p = nouveauPlanChantier(nom, genre);
    liste().push(p);
    modifie();
    ouvrirPlan(p);
  }

  function ouvrirPlan(p) {
    etat.planId = p.id;
    etat.ecran = 'dessin';
    etat.outil = 'choisir';
    etat.saisie = null;
    etat.choisi = null;
    pileAnnuler = [];
    dessiner();
  }

  // ---------------------------------------------------------------- Dessiner

  function htmlDessin() {
    const groupe = (titre, html) => `<div class="groupe-ruban"><span class="titre-groupe">${titre}</span><div class="boutons-groupe">${html}</div></div>`;
    const outil = (cle, icone, texte) => `<button type="button" class="outil-ruban" data-outil="${cle}">${ico(icone)}<span>${texte}</span></button>`;
    return `
      <div class="ruban-calage ruban-chantier" role="toolbar" aria-label="Outils de dessin">
        ${groupe('Sélection', `${outil('choisir', ICONE_CHOISIR, 'Sélectionner')}
          <button type="button" class="outil-ruban" data-action="effacer">${ico('<path d="M5 5L19 19M19 5L5 19"/>')}<span>Effacer</span></button>
          <button type="button" class="outil-ruban" data-action="annuler">${ico('<path d="M9 14L4 9L9 4"/><path d="M4 9H14A6 6 0 0 1 14 21H11"/>')}<span>Annuler</span></button>`)}
        ${groupe('Dessin', OUTILS.map(([c, i, t]) => outil(c, i, t)).join(''))}
        ${groupe('Symboles', `<button type="button" class="outil-ruban" data-action="biblio" aria-pressed="${etat.biblio.ouvert}">${ico('<rect x="3" y="7" width="12" height="9" rx="1"/><path d="M15 10H19L21 13V16H15"/><circle cx="7" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>')}<span>Bibliothèque</span></button>`)}
        ${groupe('Accroche', ACCROCHES.map(([c, t]) => `<button type="button" class="outil-ruban petit" data-accroche="${c}"><span>${t}</span></button>`).join(''))}
        ${groupe('Fond', `<button type="button" class="outil-ruban" data-action="fond-plans">${ico('<path d="M3 6L9 4L15 6L21 4V18L15 20L9 18L3 20Z"/><path d="M9 4V18M15 6V20"/>')}<span>Plans…</span></button>
          <button type="button" class="outil-ruban petit" data-action="fond-points"><span>Points levés</span></button>
          <button type="button" class="outil-ruban petit" data-action="fond-carte"><span>Carte</span></button>
          <button type="button" class="outil-ruban petit" data-action="fond-ortho"><span>Photo</span></button>
          <button type="button" class="outil-ruban petit" data-action="fond-cadastre"><span>Cadastre</span></button>
          <button type="button" class="outil-ruban petit" data-action="fond-surfaces"><span>Surfaces</span></button>`)}
        ${groupe('Construction', `<button type="button" class="outil-ruban petit" data-action="construction-visible" title="Montrer ou cacher les lignes de construction (jamais imprimées)"><span>Afficher</span></button>`)}
        ${groupe('Zoom', '<button type="button" class="outil-ruban" data-zoom="1.5">＋</button><button type="button" class="outil-ruban" data-zoom="0.667">−</button><button type="button" class="outil-ruban" data-zoom="tout">⤢<span>Tout</span></button>')}
      </div>
      <div class="ruban-element" data-zone="bandeau-element" hidden></div>
      <p class="consigne-calage" data-zone="consigne"></p>
      <div class="saisie-longueur" data-zone="saisie" hidden>
        <label>Longueur <input type="text" inputmode="decimal" size="7" data-saisie="longueur" placeholder="m" autocomplete="off"></label>
        <label>Angle <input type="text" inputmode="decimal" size="6" data-saisie="angle" placeholder="° (sens inverse, depuis l'Est)" autocomplete="off"></label>
        <button type="button" class="bouton-secondaire" data-action="saisie-ok">↵ Placer le point</button>
      </div>
      <div class="travail-chantier ${etat.biblio.ouvert ? 'avec-biblio' : ''}">
        <aside class="carte-calage biblio-chantier" data-zone="biblio" ${etat.biblio.ouvert ? '' : 'hidden'}></aside>
        <div class="vue-calage vue-chantier">
          <div class="toile-chantier" data-toile></div>
          <div class="pied-vue etat-chantier" data-zone="etat"></div>
        </div>
        <aside class="carte-calage panneau-chantier" data-zone="panneau"></aside>
      </div>`;
  }

  function monterVue() {
    vue = creerVueChantier(page.querySelector('[data-toile]'), {
      plans: plansFond,
      points: () => (plan()?.fond?.points === false ? [] : points()),
      planChantier: plan,
      choisi: () => etat.choisi,
      saisie: saisieVue,
      bibliotheque: bib,
      surfaces,
      apercu: () => (etat.outil === 'symbole' && etat.pose ? { ...etat.pose, rotation: etat.rotationPose } : null),
      etatFond: (r) => {
        etat.fondEtat = r;
      },
      accrocher: accrochage,
      clic: toucher,
      double: () => {
        if (etat.saisie?.outil === 'decaler') return;
        if (etat.saisie && etat.saisie.outil !== 'zone') finirSaisie();
        else if (etat.saisie?.outil === 'zone' && etat.saisie.points.length >= 3) finirSaisie();
      },
      bouge: (p) => {
        etat.curseur = p;
        majEtat();
      },
      glisserObjet: {
        // 0.287.0 : sur une poignée (sommet) de l'élément choisi = déplacer ce sommet (avec l'accroche) ; ailleurs sur
        // l'élément = le déplacer en entier.
        debut: (p, tol) => {
          if (etat.outil !== 'choisir' || !etat.choisi || etat.orienter) return false;
          const o = plan().objets.find((x) => x.id === etat.choisi);
          if (!o) return false;
          if (estPose(o)) {
            // Symbole : la poignée ronde = tourner ; ailleurs sur lui = le déplacer (son centre s'accroche).
            const sy = symboleDeLObjet(bib(), o);
            const r = sy ? poigneeRotation(o, sy) : null;
            if (r && Math.hypot(p[0] - r[0], p[1] - r[1]) <= tol * 1.4) {
              if (!avantChangement()) return false;
              etat.glisse = { type: 'rotation' };
              return true;
            }
            if (!toucheSymbole(o, p, tol)) return false;
            if (!avantChangement()) return false;
            etat.glisse = { type: 'objet', decal: [p[0] - o.point[0], p[1] - o.point[1]] };
            return true;
          }
          let i = sommetSousLePoint(o, p, tol);
          if (o.type === 'texte' && i === 0) i = -1; // le texte se déplace en entier ; seule la poignée du repère est un sommet
          if (i < 0 && objetSousLePoint(objetsVisibles(plan()), p, tol)?.id !== etat.choisi) return false;
          if (!avantChangement()) return false;
          etat.glisse = i >= 0 ? { type: 'sommet', i } : { type: 'objet' };
          return true;
        },
        deplacer: (de, dn, point) => {
          const o = plan().objets.find((x) => x.id === etat.choisi);
          if (!o) return;
          if (etat.glisse?.type === 'rotation') {
            o.rotation = rotationVers(o, point);
            return majEtat();
          }
          if (estPose(o)) {
            // Le point saisi suit la souris (et s'accroche) : comme « Déplacer » d'AutoCAD avec un point de base.
            const [dx, dy] = etat.glisse?.decal ?? [0, 0];
            o.point = [point[0] - dx, point[1] - dy];
            return;
          }
          if (etat.glisse?.type === 'sommet') {
            if (o.type === 'texte') o.repere = point;
            else o.points[etat.glisse.i] = point;
          } else deplacerObjet(o, de, dn);
        },
        fin: () => {
          etat.glisse = null;
          enregistrer();
          majPanneau();
        },
      },
    });
    majTout();
    majBiblio();
  }

  /** Dessin en cours pour la vue ; pendant un décalage, avec l'aperçu de la copie du côté où est la souris. */
  function saisieVue() {
    const s = etat.saisie;
    if (!s?.source || !etat.curseur) return s;
    return { ...s, apercu: decalerPolyligne(s.source, coteDuPoint(s.source, etat.curseur) * etat.distanceDecalage) };
  }

  /** Le point p touche-t-il le symbole posé o (boîte tournée) ? */
  function toucheSymbole(o, p, tol) {
    const sy = symboleDeLObjet(bib(), o);
    return sy ? surLeSymbole(o, sy, p, tol) : Math.hypot(p[0] - o.point[0], p[1] - o.point[1]) <= tol + 1;
  }
  /** Élément sous le point (symboles compris). */
  const objetSous = (p, tol) => objetSousLePoint(objetsVisibles(plan()), p, tol, toucheSymbole);

  /** Boîtes des symboles posés, pour l'accroche (sommets, milieux des côtés). */
  const lignesSymboles = (objets) => objets.filter(estPose).flatMap((o) => {
    const sy = symboleDeLObjet(bib(), o);
    return sy && o.type !== 'grue' ? [{ points: coinsSymbole(o, sy).map(([est, nord]) => ({ est, nord, altitude: null })), ferme: true }] : [];
  });

  /** Accroche pendant un dessin : points levés, puis sommets / milieux / bords des plans et de ce qui est dessiné. */
  function accrochage(position, tolerance) {
    if (etat.orienter?.mode === 'ligne') return null; // on touche la ligne elle-même
    if (etat.outil === 'choisir' && !etat.orienter && etat.glisse?.type !== 'sommet' && !(etat.glisse?.type === 'objet' && etat.glisse.decal)) return null;
    if (etat.outil === 'decaler') return null; // on touche la ligne elle-même, puis le côté : pas d'accroche
    const a = etat.accroches;
    if (a.has('point')) {
      const t = accrocher('point', position, tolerance, { points: plan()?.fond?.points === false ? [] : points() });
      if (t) return t;
    }
    const sources = sourcesDesPlans(plansFond(), position, tolerance);
    // Pendant qu'on glisse un sommet, l'élément lui-même n'est pas une accroche (il bouge).
    const autres = etat.glisse ? plan().objets.filter((o) => o.id !== etat.choisi) : plan().objets;
    sources.lignes = [...sources.lignes, ...lignesPourAccroche(autres), ...lignesSymboles(autres)];
    for (const mode of ['sommet', 'milieu', 'croisement', 'perpendiculaire', 'ligne']) {
      if (!a.has(mode)) continue;
      if (mode === 'perpendiculaire') {
        // Pied de la perpendiculaire menée du dernier point posé sur la ligne touchée (comme Mesure rapide).
        const dernier = etat.saisie?.points?.at(-1);
        if (!dernier) continue;
        const pied = piedPerpendiculaire({ est: dernier[0], nord: dernier[1] }, position, tolerance, sources.lignes);
        if (pied) return { est: pied.est, nord: pied.nord, altitude: null, mode };
        continue;
      }
      const t = accrocher(mode, position, tolerance, sources);
      if (t) return t;
    }
    return null;
  }

  /** Orienter le symbole choisi (0.290.0) : vers le point cliqué (accroché), ou parallèle à la ligne cliquée. */
  function toucherOrientation(p, tolerance) {
    const { id, mode } = etat.orienter;
    const o = plan().objets.find((x) => x.id === id);
    if (!o) {
      etat.orienter = null;
      return majTout();
    }
    let rotation;
    if (mode === 'point') {
      if (Math.hypot(p[0] - o.point[0], p[1] - o.point[1]) < 0.01) return message('Cliquez un point plus loin que le centre du symbole.', 3000);
      rotation = rotationVers(o, p);
    } else {
      const autres = plan().objets.filter((x) => x.id !== id);
      const lignes = [...lignesPourAccroche(objetsVisibles({ ...plan(), objets: autres })), ...lignesSymboles(autres), ...sourcesDesPlans(plansFond(), { est: p[0], nord: p[1] }, tolerance).lignes];
      rotation = angleDeLaLigne(lignes, p, tolerance * 1.5, o.rotation ?? 0);
      if (rotation === null) return message('Aucune ligne ici : cliquez une ligne du plan ou un élément dessiné.', 3000);
    }
    if (!avantChangement()) return;
    o.rotation = rotation;
    etat.orienter = null;
    enregistrer();
    majTout();
  }

  /** Décalage : 1er clic = la ligne à décaler (dessin ou plan DXF), 2e clic = le côté de la copie. */
  function toucherDecalage(p, tolerance) {
    const s = etat.saisie;
    if (!s?.source) {
      const lignes = [...lignesPourAccroche(objetsVisibles(plan()).filter((o) => o.type !== 'texte')), ...sourcesDesPlans(plansFond(), { est: p[0], nord: p[1] }, tolerance).lignes];
      // En ligne de construction : on décale seulement le segment touché (une droite parallèle), pas toute la polyligne.
      const source = etat.decalerConstruction ? segmentLePlusProche(lignes, p, tolerance * 1.5) : ligneLaPlusProche(lignes, p, tolerance * 1.5);
      if (!source) return message('Aucune ligne ici : touchez une ligne du plan ou un élément dessiné.', 3000);
      etat.saisie = { outil: 'decaler', source, style: etat.style, points: [] };
      majConsigne();
      return vue?.redessinerDessus();
    }
    creerDecalage(s.source, coteDuPoint(s.source, p) * etat.distanceDecalage, s.style);
  }

  /** Crée la ligne décalée de distance m (+ à gauche, − à droite en suivant la ligne de départ). */
  function creerDecalage(source, distance, style) {
    if (!avantChangement()) return;
    const decalee = decalerPolyligne(source, distance);
    const o = etat.decalerConstruction && decalee.length === 2
      ? ajouterObjet(plan(), { type: 'construction', points: decalee, infinie: true })
      : ajouterObjet(plan(), compact({ type: 'ligne', points: decalee, style, epaisseurMm: etat.epaisseurMm ?? undefined, echelleMotif: etat.echelleMotif !== 1 ? etat.echelleMotif : undefined }));
    etat.saisie = null;
    etat.choisi = o.id;
    etat.outil = 'choisir';
    vue?.oublierCurseur();
    enregistrer();
    majTout();
  }

  /** « Décaler… » depuis l'élément choisi : la ligne de départ est déjà connue, on touche seulement le côté. */
  function decalerChoisi() {
    const o = plan().objets.find((x) => x.id === etat.choisi);
    if (!o || o.type === 'texte') return;
    const source = o.type === 'zone' ? [...o.points, o.points[0]] : o.points;
    etat.outil = 'decaler';
    etat.style = o.type === 'ligne' ? styleLigne(o.style).cle : etat.style;
    etat.saisie = { outil: 'decaler', source, style: etat.style, points: [] };
    etat.choisi = null;
    majTout();
  }

  async function toucher(p, tolerance) {
    if (etat.attenteRepere) {
      const o = plan().objets.find((x) => x.id === etat.attenteRepere);
      etat.attenteRepere = null;
      if (o && avantChangement()) {
        o.repere = p;
        o.repereBout = etat.repereBout;
        enregistrer();
      }
      return majTout();
    }
    if (etat.orienter) return toucherOrientation(p, tolerance);
    if (etat.outil === 'decaler') return toucherDecalage(p, tolerance);
    if (etat.outil === 'choisir') {
      etat.choisi = objetSous(p, tolerance)?.id ?? null;
      etat.orienter = null;
      majTout();
      return;
    }
    if (etat.outil === 'symbole') {
      if (!etat.pose) return message('Choisissez d\'abord un symbole dans la bibliothèque (à gauche).', 3000);
      if (!avantChangement()) return;
      const o = ajouterObjet(plan(), JSON.parse(JSON.stringify({ ...etat.pose, point: p, rotation: etat.rotationPose })));
      etat.choisi = o.id;
      etat.outil = 'choisir';
      vue?.oublierCurseur();
      enregistrer();
      majBiblio();
      majTout();
      return;
    }
    if (etat.outil === 'texte') {
      const texte = await demanderTexte({ titre: 'Texte à écrire sur le plan' });
      if (!texte || !avantChangement()) return;
      const o = ajouterObjet(plan(), { type: 'texte', point: p, texte, taille: etat.tailleTexte });
      etat.choisi = o.id;
      etat.outil = 'choisir';
      if (etat.texteRepere) etat.attenteRepere = o.id; // le prochain clic donne le point visé
      enregistrer();
      majTout();
      return;
    }
    const s = etat.saisie ?? (etat.saisie = { outil: etat.outil, points: [], categorie: etat.categorie, style: etat.style, largeur: etat.largeur });
    // Zone : toucher le 1er sommet la ferme.
    if (s.outil === 'zone' && s.points.length >= 3 && Math.hypot(p[0] - s.points[0][0], p[1] - s.points[0][1]) <= tolerance) {
      finirSaisie();
      return;
    }
    const dernier = s.points[s.points.length - 1];
    if (!dernier || Math.hypot(p[0] - dernier[0], p[1] - dernier[1]) > 1e-6) s.points.push(p);
    if (s.outil === 'construction' && s.points.length >= 2) return finirSaisie(); // 2 points : la ligne est faite
    if (s.outil === 'cotation' && s.points.length >= 3) return creerCotation(s.points);
    majConsigne();
    vue?.redessinerDessus();
  }

  /** Cotation : longueur = A, B puis un 3e point qui donne le côté et la distance de la ligne de cote ; angle = sommet, P1, P2. */
  function creerCotation(pts) {
    if (!avantChangement()) return;
    let champs;
    if (etat.cotationGenre === 'angle') {
      champs = { type: 'cotation', genre: 'angle', points: pts.slice(0, 3) };
    } else {
      const [A, B, C] = pts;
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
      const decalage = (((C[0] - A[0]) * -(B[1] - A[1])) + ((C[1] - A[1]) * (B[0] - A[0]))) / L; // distance signée de C à la droite A → B
      champs = { type: 'cotation', genre: 'longueur', points: [A, B], decalage: Math.round(decalage * 1000) / 1000 };
    }
    const o = ajouterObjet(plan(), champs);
    etat.saisie = null;
    etat.choisi = o.id;
    etat.outil = 'choisir';
    vue?.oublierCurseur();
    enregistrer();
    majTout();
  }

  function finirSaisie() {
    const s = etat.saisie;
    if (!s || s.outil === 'decaler') return;
    if (s.outil === 'construction') return creerConstruction(s.points.slice(0, 2), etat.constructionMode !== 'segment');
    const min = s.outil === 'zone' ? 3 : 2;
    if (s.points.length < min) {
      message(s.outil === 'zone' ? 'Une zone a au moins 3 sommets.' : 'Il faut au moins 2 points.', 3000);
      return;
    }
    if (!avantChangement()) return;
    const props = {
      zone: compact({ categorie: s.categorie, opacite: etat.opacite, contourMm: etat.contourMm ?? undefined, afficherSurface: etat.afficherSurface || undefined }),
      ligne: compact({ style: s.style, epaisseurMm: etat.epaisseurMm ?? undefined, echelleMotif: etat.echelleMotif !== 1 ? etat.echelleMotif : undefined }),
      piste: { largeur: s.largeur },
      fleche: compact({ largeur: etat.largeurFleche, echelle: etat.echelleFleche !== 1 ? etat.echelleFleche : undefined }),
    }[s.outil];
    const o = ajouterObjet(plan(), { type: s.outil, points: s.points, ...props });
    etat.saisie = null;
    etat.choisi = o.id;
    etat.outil = 'choisir'; // 0.287.0 : l'élément dessiné est choisi (poignées, réglages à droite)
    vue?.oublierCurseur();
    enregistrer();
    majTout();
  }

  /** Crée une ligne de construction (2 points ; droite infinie ou segment) et la choisit. */
  function creerConstruction(pts, infinie) {
    if (pts.length < 2 || Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) < 1e-6) {
      message('Il faut 2 points différents.', 3000);
      return;
    }
    if (!avantChangement()) return;
    if (plan().construction?.visible === false) plan().construction = { ...(plan().construction ?? {}), visible: true }; // on la voit en la créant
    const o = ajouterObjet(plan(), { type: 'construction', points: pts, infinie });
    etat.saisie = null;
    etat.choisi = o.id;
    etat.outil = 'choisir';
    vue?.oublierCurseur();
    enregistrer();
    majTout();
  }

  // ---------------------------------------------------------------- Longueur et angle tapés (0.293.0)

  const nombreSaisi = (c) => {
    const v = Number(String(c?.value ?? '').replace(',', '.'));
    return String(c?.value ?? '').trim() !== '' && Number.isFinite(v) ? v : null;
  };

  /**
   * Place le prochain point d'après la longueur (m) et l'angle (°) tapés : le dernier point posé + longueur dans la direction
   * de l'angle (sens inverse des aiguilles depuis l'Est, comme la rotation des symboles) ou, sans angle, dans la direction
   * de la souris (comme AutoCAD). Droite par un point et un angle : l'angle seul suffit.
   */
  function placerParSaisie() {
    const s = etat.saisie;
    const dernier = s?.points?.at(-1);
    if (!s || !dernier || s.outil === 'decaler') return;
    const longueurTapee = nombreSaisi(page.querySelector('[data-saisie="longueur"]'));
    const angleTape = nombreSaisi(page.querySelector('[data-saisie="angle"]'));
    if (s.outil === 'construction' && etat.constructionMode === 'angle') {
      if (angleTape === null) return message('Tapez l\'angle de la droite.', 3000);
      return creerConstruction([dernier, pointALaDistance(dernier, 10, angleTape)], true);
    }
    if (longueurTapee === null || !(longueurTapee > 0)) return message('Tapez une longueur en mètres (plus grande que 0).', 3000);
    const angle = angleTape ?? (etat.curseur ? angleVers(dernier, etat.curseur) : null);
    if (angle === null) return message('Bougez la souris pour donner la direction, ou tapez un angle.', 3500);
    const p = pointALaDistance(dernier, longueurTapee, angle);
    for (const c of page.querySelectorAll('[data-saisie]')) c.value = '';
    if (s.outil === 'construction') {
      s.points.push(p);
      return creerConstruction(s.points.slice(0, 2), etat.constructionMode !== 'segment');
    }
    s.points.push(p);
    majConsigne();
    vue?.redessinerDessus();
    page.querySelector('[data-saisie="longueur"]')?.focus();
  }

  function supprimerChoisi() {
    if (!etat.choisi || !avantChangement()) return;
    retirerObjet(plan(), etat.choisi);
    etat.choisi = null;
    enregistrer();
    majTout();
  }


  // ---------------------------------------------------------------- Feuille (mise en page, PDF, DXF)

  let feuille = null; // { canvas, page (rang), observateur }

  function htmlFeuille() {
    return `
      <p class="consigne-calage">Glisser sur la feuille = déplacer le plan dans le cadre. L'échelle est celle du plan (1:${plan().echelle ?? ECHELLE_PAPIER}).</p>
      <div class="travail-chantier">
        <div class="vue-calage vue-feuille">
          <div class="toile-feuille" data-feuille><canvas></canvas></div>
          <div class="pied-vue etat-chantier" data-zone="etat-feuille"></div>
        </div>
        <aside class="carte-calage panneau-chantier" data-zone="panneau-feuille"></aside>
      </div>`;
  }

  /** Données communes à l'aperçu et au PDF. */
  const donneesFeuille = () => ({
    plan: plan(), plans: plansFond(), points: plan()?.fond?.points === false ? [] : points(), surfaces: plan()?.fond?.surfaces === false ? [] : surfaces(),
    bib: bib(), projet: leProjet(), auteur: auteur(), centre: centreDeDepart(plan(), plansFond()),
  });

  function monterFeuille() {
    const toile = page.querySelector('[data-feuille]');
    const canvas = toile.querySelector('canvas');
    feuille = { canvas, page: 0, geste: null };
    feuille.observateur = new ResizeObserver(() => dessinerApercu());
    feuille.observateur.observe(toile);
    canvas.addEventListener('pointerdown', (ev) => {
      if (!plan()) return;
      canvas.setPointerCapture(ev.pointerId);
      const r = reglagesFeuille(plan());
      feuille.geste = { x: ev.clientX, y: ev.clientY, centre: r.centre ?? donneesFeuille().centre ?? [0, 0], change: false };
    });
    canvas.addEventListener('pointermove', (ev) => {
      const g = feuille?.geste;
      if (!g) return;
      const dx = ev.clientX - g.x;
      const dy = ev.clientY - g.y;
      if (!g.change && Math.hypot(dx, dy) < 4) return;
      if (!g.change) {
        if (!avantChangement()) {
          feuille.geste = null;
          return;
        }
        g.change = true;
      }
      // px d'aperçu → mm de papier → m sur le terrain.
      const m = (plan().echelle ?? ECHELLE_PAPIER) / 1000 / (feuille.pxParMm || 1);
      plan().feuille = { ...(plan().feuille ?? {}), centre: [g.centre[0] - dx * m, g.centre[1] + dy * m] };
      dessinerApercu();
    });
    const fin = () => {
      if (feuille?.geste?.change) enregistrer();
      if (feuille) feuille.geste = null;
    };
    canvas.addEventListener('pointerup', fin);
    canvas.addEventListener('pointercancel', fin);
    majFeuille();
  }

  function majFeuille() {
    if (etat.ecran !== 'feuille' || !feuille) return;
    majPanneauFeuille();
    dessinerApercu();
  }

  let imageApercu = 0;
  async function dessinerApercu() {
    if (!feuille || !plan()) return;
    const toile = page.querySelector('[data-feuille]');
    if (!toile?.clientWidth) return;
    const pages = pagesDeLaFeuille(plan());
    feuille.page = Math.min(feuille.page, pages.length - 1);
    const r = reglagesFeuille(plan());
    const mise = miseEnPageFeuille(r.format, r.orientation, 0);
    const densite = window.devicePixelRatio || 1;
    const pxParMm = Math.min((toile.clientWidth - 16) / mise.page.largeur, (toile.clientHeight - 16) / mise.page.hauteur);
    feuille.pxParMm = pxParMm;
    const c = feuille.canvas;
    c.style.width = `${Math.round(mise.page.largeur * pxParMm)}px`;
    c.style.height = `${Math.round(mise.page.hauteur * pxParMm)}px`;
    c.width = Math.round(mise.page.largeur * pxParMm * densite);
    c.height = Math.round(mise.page.hauteur * pxParMm * densite);
    const ctx = c.getContext('2d');
    ctx.setTransform(densite, 0, 0, densite, 0, 0);
    const donnees = donneesFeuille();
    const prep = preparerPage(donnees, pages[feuille.page], pxParMm);
    const logo = await chargerImage(adresseLogo(r.logo));
    if (!feuille || feuille.canvas !== c) return;
    dessinerPage(ctx, donnees, prep, pxParMm, {
      logo,
      quandTuile: () => {
        cancelAnimationFrame(imageApercu);
        imageApercu = requestAnimationFrame(() => dessinerApercu());
      },
    });
    const etatZone = page.querySelector('[data-zone="etat-feuille"]');
    if (etatZone) {
      etatZone.innerHTML = `${pages.length > 1 ? `<button type="button" class="bouton-secondaire" data-page-feuille="-1" ${feuille.page ? '' : 'disabled'}>◀</button>
        <span>Page ${feuille.page + 1} / ${pages.length}${pages[feuille.page].titre ? ` · ${echapper(pages[feuille.page].titre)}` : ''}</span>
        <button type="button" class="bouton-secondaire" data-page-feuille="1" ${feuille.page < pages.length - 1 ? '' : 'disabled'}>▶</button>` : '<span>1 page</span>'}
        <span>${prep.objets.length} élément(s) · légende : ${prep.legende.length}</span>`;
    }
  }

  function majPanneauFeuille() {
    const zone = page.querySelector('[data-zone="panneau-feuille"]');
    if (!zone) return;
    const p = plan();
    const r = reglagesFeuille(p);
    const options = (liste, valeur) => liste.map(([v, t]) => `<option value="${v}" ${v === valeur ? 'selected' : ''}>${t}</option>`).join('');
    const nomPdf = `${nomFichier()}.pdf`;
    zone.innerHTML = `
      <h3>Feuille ${bulle('feuilleChantier')}</h3>
      <label class="champ-calage"><span>Format</span><select data-feuille="format">${options(FORMATS_FEUILLE, r.format)}</select></label>
      <label class="champ-calage"><span>Orientation</span><select data-feuille="orientation">${options([['paysage', 'Paysage'], ['portrait', 'Portrait']], r.orientation)}</select></label>
      <label class="champ-calage"><span>Échelle 1 :</span><input type="number" min="1" max="10000" step="50" value="${p.echelle ?? ECHELLE_PAPIER}" data-feuille="echelle"></label>
      <button type="button" class="lien-calage" data-action="feuille-centrer">Recentrer sur les éléments</button>
      <label class="champ-calage"><span>Pages</span><select data-feuille="pages">${options([['une', 'Toutes les phases sur une page'], ['phases', 'Une page par phase']], r.pages)}</select></label>
      ${r.pages === 'phases' ? `<p class="aide-calage">Phases montrées sur toutes les pages :</p>
        ${p.phases.map((ph) => `<label class="case-chantier"><input type="checkbox" data-phase-commune="${ph.id}" ${ph.commune ? 'checked' : ''}> ${echapper(ph.nom)}</label>`).join('')}` : ''}
      <h3>Fond</h3>
      <label class="case-chantier"><input type="checkbox" data-fond="carte" ${p.fond.carte ? 'checked' : ''}> Carte nationale swisstopo</label>
      <label class="case-chantier"><input type="checkbox" data-fond="ortho" ${p.fond.ortho ? 'checked' : ''}> Photo aérienne swisstopo</label>
      ${p.fond.ortho ? `<label class="champ-calage"><span>Photo pâlie : <b data-valeur-de="paleur">${p.fond.paleur ?? PALEUR_ORTHO} %</b></span><input type="range" min="0" max="90" step="5" value="${p.fond.paleur ?? PALEUR_ORTHO}" data-feuille-curseur="paleur"></label>` : ''}
      <label class="case-chantier"><input type="checkbox" data-fond="cadastre" ${p.fond.cadastre ? 'checked' : ''}> Cadastre</label>
      <label class="case-chantier"><input type="checkbox" data-fond="surfaces" ${p.fond.surfaces !== false ? 'checked' : ''}> Surfaces du projet</label>
      <label class="case-chantier"><input type="checkbox" data-fond="points" ${p.fond.points !== false ? 'checked' : ''}> Points levés</label>
      <h3>Cartouche</h3>
      <label class="champ-calage"><span>Titre du plan</span><input type="text" maxlength="80" value="${echapper(r.titre || p.nom)}" data-feuille="titre"></label>
      <label class="champ-calage"><span>Indice</span><input type="text" maxlength="6" value="${echapper(r.indice)}" data-feuille="indice"></label>
      <label class="champ-calage"><span>Date (vide = du jour)</span><input type="text" maxlength="20" value="${echapper(r.date)}" placeholder="${new Date().toLocaleDateString('fr-CH')}" data-feuille="date"></label>
      <label class="champ-calage"><span>Dessiné par</span><input type="text" maxlength="40" value="${echapper(r.auteur)}" placeholder="${echapper(auteur())}" data-feuille="auteur"></label>
      <label class="champ-calage"><span>Logo</span><select data-feuille="logo">${options([['perrin', 'Perrin'], ['aucun', 'Sans logo'], ['image', r.logo?.startsWith?.('data:') ? 'Image choisie' : 'Autre image…']], r.logo?.startsWith?.('data:') ? 'image' : r.logo)}</select></label>
      ${r.logo?.startsWith?.('data:') ? '<button type="button" class="lien-calage" data-action="feuille-logo">Changer d\'image…</button>' : ''}
      <label class="case-chantier"><input type="checkbox" data-feuille-case="legende" ${r.legende ? 'checked' : ''}> Légende automatique</label>
      <label class="case-chantier"><input type="checkbox" data-feuille-case="nord" ${r.nord ? 'checked' : ''}> Nord</label>
      <label class="case-chantier"><input type="checkbox" data-feuille-case="barre" ${r.barre ? 'checked' : ''}> Barre d'échelle</label>
      <label class="case-chantier"><input type="checkbox" data-situation="actif" ${r.situation.actif ? 'checked' : ''}> Vue de situation (carte nationale)</label>
      ${r.situation.actif ? `<label class="champ-calage"><span>Coin</span><select data-situation="coin">${options(COINS_SITUATION, r.situation.coin)}</select></label>
      <label class="champ-calage"><span>Échelle de la situation 1 :</span><input type="number" min="500" max="100000" step="500" value="${r.situation.echelle}" data-situation="echelle"></label>
      <label class="champ-calage"><span>Taille (mm, A3)</span><input type="number" min="30" max="120" step="5" value="${r.situation.taille}" data-situation="taille"></label>` : ''}
      <h3>Enregistrer</h3>
      <div class="actions-chantier"><button type="button" class="bouton" data-action="feuille-pdf">PDF</button><button type="button" class="bouton-secondaire" data-action="feuille-dxf">DXF</button></div>
      <p class="aide-calage">Nom : <span class="chiffre">${echapper(nomPdf)}</span></p>`;
  }

  const nomFichier = () => nomFichierExport(leProjet().cartouche?.affaire || leProjet().nom || '', `plan-chantier_${plan().nom}`);

  function telecharger(blob, nom) {
    if (enregistrerFichier) return enregistrerFichier(blob, nom);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /** Un clic dans l'onglet Feuille ; renvoie false s'il n'est pas pour lui. */
  async function clicFeuille(b, p) {
    if (b.dataset.pageFeuille) {
      feuille.page += Number(b.dataset.pageFeuille);
      return dessinerApercu();
    }
    if (b.dataset.action === 'feuille-centrer') {
      if (!avantChangement()) return;
      const f = { ...(p.feuille ?? {}) };
      delete f.centre;
      p.feuille = f;
      enregistrer();
      return dessinerApercu();
    }
    if (b.dataset.action === 'feuille-logo') return choisirLogo(p);
    if (b.dataset.action === 'feuille-pdf') {
      b.disabled = true;
      try {
        const { blob, remarques } = await creerPdfChantier(donneesFeuille(), (t) => message(t, null));
        telecharger(blob, `${nomFichier()}.pdf`);
        message(`PDF prêt${remarques.length ? ` (${remarques.join(' ; ')})` : ''}.`, 5000, { ok: !remarques.length });
      } catch (erreur) {
        message(`PDF impossible : ${erreur?.message ?? erreur}`, 8000);
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (b.dataset.action === 'feuille-dxf') {
      const pages = pagesDeLaFeuille(p);
      const objets = pages.length > 1 ? p.objets : null; // une page par phase : toutes les phases, chacune sur ses calques
      const texte = dxfPlanChantier(p, bib(), objets);
      telecharger(new Blob([texte], { type: 'application/dxf' }), `${nomFichier()}.dxf`);
      message('DXF prêt (un calque par phase et par genre, symboles en blocs).', 4000, { ok: true });
      return;
    }
    return false;
  }

  /** Image du logo choisie (réduite à 600 px, gardée dans le plan, part sur Drive avec le projet). */
  async function choisirLogo(p) {
    const entree = document.createElement('input');
    entree.type = 'file';
    entree.accept = 'image/png,image/jpeg';
    const fichier = await new Promise((ok) => {
      entree.addEventListener('change', () => ok(entree.files?.[0] ?? null));
      entree.click();
    });
    if (!fichier) return majPanneauFeuille();
    const url = URL.createObjectURL(fichier);
    const image = await chargerImage(url);
    if (!image) {
      message(`« ${fichier.name} » n'est pas une image lisible.`, 5000);
      return majPanneauFeuille();
    }
    const k = Math.min(1, 600 / Math.max(image.width, image.height));
    const c = document.createElement('canvas');
    c.width = Math.round(image.width * k);
    c.height = Math.round(image.height * k);
    c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
    if (!avantChangement()) return;
    p.feuille = { ...(p.feuille ?? {}), logo: c.toDataURL(fichier.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9) };
    enregistrer();
    majFeuille();
  }

  function entreeFeuille(c) {
    const p = plan();
    if (c.dataset.feuilleCurseur === 'paleur') {
      const etiquette = page.querySelector('[data-valeur-de="paleur"]');
      if (etiquette) etiquette.textContent = `${c.value} %`;
      if (!etat.reglageEnCours) {
        if (!avantChangement()) return;
        etat.reglageEnCours = true;
      }
      p.fond.paleur = Number(c.value);
      dessinerApercu();
    }
  }

  function changeFeuille(c, p) {
    if (c.dataset.feuilleCurseur) {
      if (etat.reglageEnCours) enregistrer();
      etat.reglageEnCours = false;
      return;
    }
    if (c.dataset.situation) {
      if (!avantChangement()) return majPanneauFeuille();
      const v = c.type === 'checkbox' ? c.checked : c.type === 'number' ? nombreDe(c) : c.value;
      if (v === null) return majPanneauFeuille();
      p.feuille = { ...(p.feuille ?? {}), situation: { ...reglagesFeuille(p).situation, [c.dataset.situation]: v } };
      enregistrer();
      majFeuille();
      return majPanneauFeuille();
    }
    const cle = c.dataset.feuille ?? c.dataset.feuilleCase ?? c.dataset.fond ?? c.dataset.phaseCommune;
    if (!cle) return;
    if (cle === 'logo' && c.value === 'image') return choisirLogo(p);
    if (!avantChangement()) return majPanneauFeuille();
    if (c.dataset.phaseCommune) p.phases.find((x) => x.id === c.dataset.phaseCommune).commune = c.checked || undefined;
    else if (c.dataset.fond) p.fond[cle] = c.checked;
    else if (c.dataset.feuilleCase) p.feuille = { ...(p.feuille ?? {}), [cle]: c.checked };
    else if (cle === 'echelle') {
      const v = nombreDe(c);
      if (v === null) return majPanneauFeuille();
      p.echelle = v;
    } else p.feuille = { ...(p.feuille ?? {}), [cle]: c.value.trim() };
    enregistrer();
    majFeuille();
  }

  // ---------------------------------------------------------------- Mises à jour

  function majTout() {
    if (etat.ecran !== 'dessin') return;
    majOutils();
    majPanneau();
    vue?.redessiner();
  }

  function majOutils() {
    page.querySelectorAll('[data-outil]').forEach((b) => b.classList.toggle('actif', b.dataset.outil === etat.outil));
    page.querySelectorAll('[data-accroche]').forEach((b) => b.classList.toggle('actif', etat.accroches.has(b.dataset.accroche)));
    page.querySelector('[data-action="fond-points"]')?.classList.toggle('actif', plan()?.fond?.points !== false);
    page.querySelector('[data-action="fond-carte"]')?.classList.toggle('actif', Boolean(plan()?.fond?.carte));
    page.querySelector('[data-action="fond-ortho"]')?.classList.toggle('actif', Boolean(plan()?.fond?.ortho));
    page.querySelector('[data-action="fond-cadastre"]')?.classList.toggle('actif', Boolean(plan()?.fond?.cadastre));
    page.querySelector('[data-action="fond-surfaces"]')?.classList.toggle('actif', plan()?.fond?.surfaces !== false);
    page.querySelector('[data-action="construction-visible"]')?.classList.toggle('actif', plan()?.construction?.visible !== false);
    page.querySelector('[data-action="biblio"]')?.setAttribute('aria-pressed', String(etat.biblio.ouvert));
    page.querySelector('[data-action="effacer"]')?.toggleAttribute('disabled', !etat.choisi);
    const toile = page.querySelector('[data-toile]');
    if (toile) toile.dataset.outil = etat.outil;
    majConsigne();
  }

  function majConsigne() {
    const s = etat.saisie;
    const n = s?.points.length ?? 0;
    const textes = {
      choisir: etat.choisi ? (estPose(plan().objets.find((x) => x.id === etat.choisi) ?? {}) ? 'Glisser le symbole = le déplacer (le point saisi s\'accroche) ; poignée ronde = le tourner ; Suppr = l\'effacer ; Échap = ne plus le choisir.' : 'Glisser une poignée (carré) = déplacer ce sommet ; glisser l\'élément = le déplacer ; Suppr = l\'effacer ; Échap = ne plus le choisir.') : 'Cliquez un élément pour le choisir (ou dans la liste à droite). Molette = zoom, glisser dans le vide = déplacer le plan.',
      symbole: etat.pose ? 'Cliquez où poser le symbole (son centre). La rotation de pose se règle à droite.' : 'Choisissez un symbole dans la bibliothèque (à gauche).',
      zone: n >= 3 ? 'Cliquez le sommet suivant ; cliquez le 1er sommet (ou Entrée, double-clic) pour fermer la zone.' : 'Cliquez les sommets de la zone.',
      ligne: n >= 2 ? 'Point suivant ; Entrée ou double-clic = finir.' : 'Cliquez le départ de la ligne.',
      piste: n >= 2 ? 'Point suivant de l\'axe ; Entrée ou double-clic = finir.' : 'Cliquez le départ de l\'axe de la piste.',
      fleche: n >= 2 ? 'Point suivant ; Entrée ou double-clic = finir (la pointe est au dernier point).' : 'Cliquez le départ de la flèche, puis les points jusqu\'à la pointe.',
      texte: etat.attenteRepere ? 'Cliquez le point visé par la ligne de repère.' : `Cliquez où écrire le texte${etat.texteRepere ? ' (puis le point visé par la ligne de repère)' : ''}.`,
      decaler: etat.saisie?.source ? `Cliquez du côté où mettre la copie, à ${etat.distanceDecalage} m.` : (etat.decalerConstruction ? 'Cliquez le segment dont on veut une parallèle en ligne de construction (plan DXF, dessin ou autre construction).' : 'Cliquez la ligne à décaler (une ligne du plan DXF ou un élément dessiné).'),
      cotation: etat.cotationGenre === 'angle'
        ? (n === 0 ? 'Cliquez le sommet de l\'angle.' : n === 1 ? 'Cliquez un point du 1er côté.' : 'Cliquez un point du 2e côté : l\'angle est coté.')
        : (n === 0 ? 'Cliquez le 1er point à coter (accroches actives).' : n === 1 ? 'Cliquez le 2e point.' : 'Cliquez où placer la ligne de cote (de quel côté et à quelle distance).'),
      construction: etat.constructionMode === 'angle'
        ? (n ? 'Tapez l\'angle de la droite puis Entrée (ou cliquez un 2e point).' : 'Cliquez un point de la droite, puis tapez son angle.')
        : (n ? 'Cliquez le 2e point, ou tapez la longueur (et l\'angle) puis Entrée.' : `Cliquez le 1er point de la ${etat.constructionMode === 'segment' ? 'ligne (segment)' : 'droite'}.`),
    };
    const zone = page.querySelector('[data-zone="consigne"]');
    if (zone && etat.orienter) {
      zone.textContent = etat.orienter.mode === 'point' ? 'Cliquez le point vers lequel tourner le symbole (accroches actives). (Échap = abandonner)' : 'Cliquez la ligne sur laquelle aligner le symbole (plan DXF ou élément dessiné). (Échap = abandonner)';
      return;
    }
    if (zone) zone.textContent = etat.attenteRepere ? `${textes.texte} (Échap = sans repère)` : `${textes[etat.outil]}${etat.outil !== 'choisir' ? ' (Échap = arrêter)' : ''}`;
    // Longueur et angle tapés : visibles dès qu'un 1er point est posé (lignes, pistes, flèches, zones, constructions).
    const saisie = page.querySelector('[data-zone="saisie"]');
    if (saisie) {
      const actif = Boolean(etat.saisie?.points?.length) && etat.saisie.outil !== 'decaler';
      saisie.hidden = !actif;
      const lon = saisie.querySelector('[data-saisie="longueur"]');
      if (lon) lon.closest('label').hidden = actif && etat.saisie.outil === 'construction' && etat.constructionMode === 'angle';
    }
  }

  function majEtat() {
    const zone = page.querySelector('[data-zone="etat"]');
    if (!zone) return;
    const c = etat.curseur;
    const s = etat.saisie;
    let mesure = '';
    if (s?.points.length && c) {
      const pts = [...s.points, c];
      mesure = s.outil === 'zone' && pts.length >= 3 ? `Surface ${n1(aire(pts))} m² · ` : '';
      mesure += `Longueur ${n1(longueur(pts, s.outil === 'zone'))} m`;
    }
    zone.innerHTML = c ? `<span class="chiffre">E ${c[0].toFixed(2)}</span><span class="chiffre">N ${c[1].toFixed(2)}</span>${mesure ? `<span>${mesure}</span>` : ''}` : '';
  }

  /** Champ nombre : data-reglage (outil) ou data-prop (élément choisi). */
  const champNombre = (titre, attr, cle, valeur, min, max, pas, unite = '') =>
    `<label class="champ-calage"><span>${titre}${unite ? ` (${unite})` : ''}</span><input type="number" min="${min}" max="${max}" step="${pas}" value="${valeur}" data-${attr}="${cle}"></label>`;
  const champCase = (titre, attr, cle, coche) => `<label class="case-chantier"><input type="checkbox" data-${attr}="${cle}" ${coche ? 'checked' : ''}> ${titre}</label>`;
  const champCurseur = (titre, attr, cle, valeur) =>
    `<label class="champ-calage"><span>${titre} : <b data-valeur-de="${cle}">${Math.round(valeur)} %</b></span><input type="range" min="0" max="100" step="5" value="${valeur}" data-${attr}="${cle}"></label>`;

  function majPanneau() {
    const zone = page.querySelector('[data-zone="panneau"]');
    if (!zone) return;
    const p = plan();
    const o = p.objets.find((x) => x.id === etat.choisi);
    const mmLigne = (cle) => (etat.epaisseurMm ?? styleLigne(cle).epaisseurMm);
    // Réglages de l'outil : donnés aux éléments dessinés ensuite.
    const reglages = {
      zone: `${listeGenres('zone', etat.categorie, 'outil', echapper)}
        ${champCurseur('Transparence du fond (opacité)', 'reglage', 'opacite', etat.opacite)}
        ${champNombre('Épaisseur du contour', 'reglage', 'contourMm', etat.contourMm ?? (etat.categorie === 'emprise' ? 0.7 : 0.35), 0.05, 5, 0.05, 'mm')}
        ${champCase('Afficher la surface (m²)', 'reglage-case', 'afficherSurface', etat.afficherSurface)}`,
      ligne: `${listeGenres('ligne', etat.style, 'outil', echapper)}
        ${champNombre('Épaisseur', 'reglage', 'epaisseurMm', mmLigne(etat.style), 0.05, 5, 0.05, 'mm')}
        ${champNombre('Échelle du motif', 'reglage', 'echelleMotif', etat.echelleMotif, 0.3, 5, 0.1, '×')}`,
      piste: champNombre('Largeur de la piste', 'reglage', 'largeur', etat.largeur, 1, 30, 0.5, 'm'),
      fleche: `${champNombre('Largeur de la ligne', 'reglage', 'largeurFleche', etat.largeurFleche, 0.05, 5, 0.05, 'm')}
        ${champNombre('Échelle de la pointe', 'reglage', 'echelleFleche', etat.echelleFleche, 0.3, 10, 0.1, '×')}`,
      texte: `${champNombre('Hauteur des lettres', 'reglage', 'tailleTexte', etat.tailleTexte, 0.2, 10, 0.1, 'm')}
        ${champCase('Avec ligne de repère', 'reglage-case', 'texteRepere', etat.texteRepere)}
        <label class="champ-calage"><span>Bout du repère</span><select data-reglage="repereBout">
          ${[['fleche', 'Flèche'], ['point', 'Point'], ['aucun', 'Rien']].map(([v, t]) => `<option value="${v}" ${etat.repereBout === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
      symbole: etat.pose ? `<p class="resume-chantier">${echapper(nomDeLaPose(etat.pose))}</p>
        ${champNombre('Rotation de pose', 'reglage', 'rotationPose', etat.rotationPose, -360, 360, 5, '°')}` : '<p class="aide-calage">Choisissez un symbole dans la bibliothèque.</p>',
      construction: `<label class="champ-calage"><span>Type</span><select data-reglage="constructionMode">
          ${[['droite', 'Droite (2 points)'], ['angle', 'Droite par un point et un angle'], ['segment', 'Segment (2 points ou longueur tapée)']].map(([v, t]) => `<option value="${v}" ${etat.constructionMode === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <p class="aide-calage">Cyan en tirets, jamais imprimées ni exportées ; elles servent d'accroche (Sur ligne, Croisement, Perpendiculaire) et pour aligner. « Décaler » avec la case « En ligne de construction » donne une parallèle.</p>`,
      cotation: `<label class="champ-calage"><span>Genre de cotation</span><select data-reglage="cotationGenre"><option value="longueur" ${etat.cotationGenre !== 'angle' ? 'selected' : ''}>Longueur alignée</option><option value="angle" ${etat.cotationGenre === 'angle' ? 'selected' : ''}>Angle</option></select></label>`,
      decaler: `${champNombre('Distance du décalage', 'reglage', 'distanceDecalage', etat.distanceDecalage, 0.01, 100, 0.05, 'm')}
        ${champCase('En ligne de construction (parallèle)', 'reglage-case', 'decalerConstruction', etat.decalerConstruction)}
        <p class="aide-calage">Genre de la ligne créée :</p>${listeGenres('ligne', etat.style, 'outil', echapper)}`,
    }[etat.outil] ?? '';
    let choisi = '';
    if (o) {
      const propre = {
        zone: `${listeGenres('zone', o.categorie, 'objet', echapper)}
          ${champCurseur('Transparence du fond (opacité)', 'prop', 'opacite', o.opacite ?? OPACITE_ZONE)}
          ${champNombre('Épaisseur du contour', 'prop', 'contourMm', contourZoneMm(o), 0.05, 5, 0.05, 'mm')}
          ${champCase('Afficher la surface (m²)', 'prop-case', 'afficherSurface', o.afficherSurface)}
          <label class="champ-calage"><span>Matériau du stock</span><select data-prop="materiau"><option value="">— (couleur du genre)</option>
            ${MATERIAUX_TAS.map((m) => `<option value="${m.cle}" ${o.materiau === m.cle ? 'selected' : ''}>${m.nom}</option>`).join('')}</select></label>
          ${champCase('Effet de tas (hauteur, talus)', 'prop-case', 'tasOui', o.tasH > 0)}
          ${o.tasH > 0 ? `${champNombre('Hauteur du tas', 'prop', 'tasH', o.tasH, 0.2, 30, 0.1, 'm')}
            ${champNombre('Talus (m horizontaux pour 1 m de hauteur)', 'prop', 'tasTalus', o.tasTalus ?? TAS_TALUS, 0.3, 5, 0.1, '')}
            ${champCase('Écrire la hauteur', 'prop-case', 'afficherHauteur', o.afficherHauteur)}` : ''}`,
        ligne: `${listeGenres('ligne', styleLigne(o.style).cle, 'objet', echapper)}
          ${champNombre('Épaisseur', 'prop', 'epaisseurMm', epaisseurLigneMm(o), 0.05, 5, 0.05, 'mm')}
          ${champNombre('Échelle du motif', 'prop', 'echelleMotif', o.echelleMotif ?? 1, 0.3, 5, 0.1, '×')}
          ${styleLigne(o.style).motif?.type === 'chevron' ? '<button type="button" class="bouton-secondaire" data-action="inverser-sens">⇄ Inverser le sens de la flèche</button>' : ''}`,
        piste: champNombre('Largeur', 'prop', 'largeur', o.largeur ?? 4, 1, 30, 0.5, 'm'),
        cotation: o.genre === 'angle' ? champNombre('Rayon de l\'arc', 'prop', 'rayon', o.rayon ?? Math.round((geometrieCotation(o)?.arc?.[0] ? Math.hypot(geometrieCotation(o).arc[0][0] - o.points[0][0], geometrieCotation(o).arc[0][1] - o.points[0][1]) : 1) * 100) / 100, 0.1, 500, 0.1, 'm') : champNombre('Distance de la ligne de cote (+ gauche, − droite)', 'prop', 'decalage', o.decalage ?? 1, -500, 500, 0.1, 'm'),
        texte: `<label class="champ-calage"><span>Texte</span><input type="text" value="${echapper(o.texte)}" data-prop="texte" maxlength="80"></label>
          ${champNombre('Hauteur des lettres', 'prop', 'taille', o.taille ?? 1, 0.2, 10, 0.1, 'm')}
          ${champCase('Ligne de repère', 'prop-case', 'repere', Boolean(o.repere) || etat.attenteRepere === o.id)}
          ${o.repere ? `<label class="champ-calage"><span>Bout du repère</span><select data-prop="repereBout">
            ${[['fleche', 'Flèche'], ['point', 'Point'], ['aucun', 'Rien']].map(([v, t]) => `<option value="${v}" ${(o.repereBout ?? 'fleche') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
          ${etat.attenteRepere === o.id ? '<p class="aide-calage">Cliquez le point visé sur le plan (Échap = sans repère).</p>' : ''}`,
        fleche: `${champNombre('Largeur de la ligne', 'prop', 'largeur', dimensionsFleche(o).largeur, 0.05, 5, 0.05, 'm')}
          ${champNombre('Échelle de la pointe', 'prop', 'echelle', Math.round(dimensionsFleche(o).echelle * 100) / 100, 0.3, 10, 0.1, '×')}`,
        symbole: panneauSymbole(o),
        grue: panneauSymbole(o),
      }[o.type];
      choisi = `<h3>Élément choisi</h3><p class="resume-chantier">${echapper(resumeObjet(o))}</p>${propre ?? ''}
        <p class="aide-calage">Rotation, échelle, couleur, phase, ordre de dessin : dans le bandeau au-dessus du plan.</p>`;
    }
    zone.innerHTML = `
      <h3>Plan</h3>
      <label class="champ-calage"><span>Échelle d'impression 1 :</span><input type="number" min="1" max="10000" step="50" value="${p.echelle ?? ECHELLE_PAPIER}" data-champ="echelle"></label>
      <label class="champ-calage"><span>Texte des symboles (mm sur le papier)</span><input type="number" min="0.5" max="12" step="0.5" value="${p.tailleTexteMm ?? TAILLE_TEXTE_MM}" data-champ="tailleTexteMm"></label>
      <h3>Phases</h3>
      <ul class="phases-chantier">${p.phases.map((ph) => `<li class="${ph.id === p.phaseActive ? 'active' : ''}">
        <input type="checkbox" data-phase-visible="${ph.id}" ${ph.visible !== false ? 'checked' : ''} aria-label="Montrer ${echapper(ph.nom)}">
        <input type="color" value="${ph.couleur}" data-phase-couleur="${ph.id}" aria-label="Couleur de ${echapper(ph.nom)}">
        <button type="button" class="nom-phase" data-phase-active="${ph.id}" title="Dessiner dans cette phase">${echapper(ph.nom)}</button>
        <button type="button" class="suppr-calage" data-phase-renommer="${ph.id}" aria-label="Renommer ${echapper(ph.nom)}">✎</button>
        ${p.phases.length > 1 ? `<button type="button" class="suppr-calage" data-phase-suppr="${ph.id}" aria-label="Supprimer ${echapper(ph.nom)}">✕</button>` : ''}</li>`).join('')}</ul>
      <button type="button" class="lien-calage" data-action="phase-ajouter">＋ Nouvelle phase</button>
      <button type="button" class="bouton-secondaire" data-action="gestion-phases">Gestion des phases…</button>
      <label class="champ-calage"><span>Couleurs</span><select data-champ="couleurs">
        <option value="objets" ${p.couleurs !== 'phases' ? 'selected' : ''}>Celles des objets</option>
        <option value="phases" ${p.couleurs === 'phases' ? 'selected' : ''}>Une couleur par phase</option></select></label>
      ${reglages ? `<h3>Outil</h3>${reglages}` : ''}
      ${choisi}
      <h3>Éléments (${p.objets.length})</h3>
      <ul class="elements-chantier">${[...p.objets].reverse().map((x) => `<li><button type="button" data-choisir="${x.id}" class="${x.id === etat.choisi ? 'actif' : ''}">
        <i style="background:${couleurObjet(p, x)}"></i>${echapper(resumeObjet(x))}</button></li>`).join('') || '<li class="aide-calage">Rien de dessiné.</li>'}</ul>`;
    page.querySelector('.ruban-chantier [data-action="effacer"]')?.toggleAttribute('disabled', !etat.choisi);
    zone.querySelectorAll('canvas[data-vignette-pose]').forEach((c) => dessinerPose(c, Number(c.dataset.vignettePose)));
    majBandeau(o, p);
  }

  /**
   * Bandeau de l'élément choisi (0.293.0, au-dessus du plan) : ce qu'on règle le plus souvent, sans défiler dans le panneau de
   * droite : rotation, échelle, orientation, phase, couleur, ordre de dessin, décaler, effacer.
   */
  function majBandeau(o, p) {
    const zone = page.querySelector('[data-zone="bandeau-element"]');
    if (!zone) return;
    zone.hidden = !o;
    if (!o) {
      zone.innerHTML = '';
      return;
    }
    const k = echelleDeLObjet(o);
    const pose = estPose(o);
    const petit = (titre, attr, cle, valeur, min, max, pas, unite = '') => `<label class="champ-bandeau"><span>${titre}${unite ? ` (${unite})` : ''}</span><input type="number" min="${min}" max="${max}" step="${pas}" value="${valeur}" data-${attr}="${cle}"></label>`;
    const bouton = (attr, texte, titre) => `<button type="button" class="bouton-secondaire petit" ${attr} title="${titre}">${texte}</button>`;
    const phases = `<label class="champ-bandeau"><span>Phase</span><select data-prop="phase">${p.phases.map((ph) => `<option value="${ph.id}" ${ph.id === o.phase ? 'selected' : ''}>${echapper(ph.nom)}</option>`).join('')}</select></label>
      <label class="champ-bandeau" title="Dernière phase où l'élément est en place ; après, il est « fini » (voir Gestion des phases)"><span>Fin</span><select data-prop="fin"><option value="">— (reste)</option>${p.phases.map((ph) => `<option value="${ph.id}" ${ph.id === o.fin ? 'selected' : ''}>${echapper(ph.nom)}</option>`).join('')}</select></label>`;
    const couleur = pose || o.type === 'construction' ? '' : p.couleurs === 'phases' ? '<span class="aide-calage">Couleur : celle de la phase</span>'
      : `<label class="champ-bandeau"><span>Couleur</span><input type="color" value="${couleurObjet({ ...p, couleurs: 'objets' }, o)}" data-prop="couleur"></label>${o.couleur ? bouton('data-action="couleur-origine"', '↺', 'Couleur d\'origine') : ''}`;
    const poseHtml = pose ? `${petit('Rotation', 'prop', 'rotation', o.rotation ?? 0, -360, 360, 1, '°')}
      ${bouton('data-tourner="90"', '⟲ 90°', 'Tourner de 90° à gauche')}${bouton('data-tourner="-90"', '⟳ 90°', 'Tourner de 90° à droite')}
      ${o.type === 'grue' ? '' : petit('Échelle', 'prop', 'echelle', k, 0.1, 10, 0.05, '×')}${k !== 1 && o.type !== 'grue' ? bouton('data-echelle-reelle', '1×', 'Taille réelle') : ''}
      ${bouton(`data-orienter="point" class="${etat.orienter?.mode === 'point' ? 'actif' : ''}"`, 'Vers un point', 'Orienter vers un point (cliquer ensuite le point visé)')}
      ${bouton(`data-orienter="ligne" class="${etat.orienter?.mode === 'ligne' ? 'actif' : ''}"`, 'Aligner', 'Aligner sur une ligne (cliquer ensuite une ligne)')}` : '';
    const decaler = !['texte', 'symbole', 'grue', 'construction', 'cotation'].includes(o.type) && !pose ? bouton('data-action="decaler-choisi"', '⇉ Décaler', 'Décaler une copie') : '';
    zone.innerHTML = `<span class="puce-element">${echapper(resumeObjet(o))}</span>
      ${poseHtml}${phases}${couleur}
      <span class="groupe-ordre" role="group" aria-label="Ordre de dessin">${bouton('data-ordre="devant"', '⤒', 'Premier plan')}${bouton('data-ordre="monter"', '▲', 'Un cran au-dessus')}${bouton('data-ordre="descendre"', '▼', 'Un cran en dessous')}${bouton('data-ordre="arriere"', '⤓', 'Arrière-plan')}</span>
      ${decaler}${bouton('data-action="effacer"', '✕ Effacer', 'Effacer cet élément')}`;
  }

  /** Nom de ce qui va être posé (panneau de l'outil). */
  function nomDeLaPose(pose) {
    if (pose.type === 'grue') return pose.modele === 'auto' ? 'Grue automontante' : pose.modele === 'mobile' ? 'Grue mobile' : 'Grue à tour';
    if (pose.etage) return 'Base-vie à étage';
    return bib().find((x) => x.cle === pose.cle)?.nom ?? pose.cle;
  }

  /** Réglages d'un symbole posé : rotation ; grue : modèle, flèche, châssis, rayon ; base-vie à étage : pose, textes. */
  function panneauSymbole(o) {
    const sy = symboleDeLObjet(bib(), o);
    const k = echelleDeLObjet(o);
    const dims = sy && o.type !== 'grue' ? `<p class="aide-calage">${n1(sy.largeur * k)} × ${n1(sy.hauteur * k)} m${k === 1 ? ' (échelle réelle)' : ` (échelle ×${k})`}</p>` : '';
    const echelle = o.type === 'grue' ? '' : `<div class="ligne-rotation">${champNombre('Échelle du bloc', 'prop', 'echelle', k, 0.1, 10, 0.05, '×')}
      ${k !== 1 ? '<button type="button" class="bouton-secondaire" data-echelle-reelle title="Revenir à la taille réelle">Taille réelle</button>' : ''}</div>`;
    const rotation = ''; // 0.293.0 : rotation, échelle et orientation sont dans le bandeau du haut
    const orienter = '';
    if (o.type === 'grue' && o.modele === 'mobile') {
      // 0.293.0 : grue mobile dynamique (porteur = rotation de l'objet, tourelle et flèche indépendantes).
      const a = autogrueDe(o.tonnes ?? 100);
      return `<label class="champ-calage"><span>Taille de la grue</span><select data-prop="tonnes">${TONNES_MOBILES.map((t) => `<option value="${t}" ${t === a.t ? 'selected' : ''}>${t} t</option>`).join('')}</select></label>
        ${champNombre('Rotation de la tourelle (par rapport au porteur)', 'prop', 'tourelle', o.tourelle ?? 0, -360, 360, 1, '°')}
        ${champNombre('Longueur de la flèche', 'prop', 'fleche', sy?.fleche ?? o.fleche ?? 20, FLECHE_MOBILE_MIN, a.fleche, 0.5, 'm')}
        ${champCase('Stabilisateurs sortis', 'prop-case', 'stabilisateurs', o.stabilisateurs !== false)}`;
    }
    if (o.type === 'grue') {
      // 0.290.0 : longueur de flèche et côté du châssis tapés librement (les longueurs du DXF sont proposées).
      const fleches = flechesDisponibles(bib(), o.modele ?? 'tour');
      const chassis = chassisDisponibles(bib());
      const cote = coteChassis(o.chassis);
      return `${rotation}${orienter}
        <label class="champ-calage"><span>Modèle</span><select data-prop="modele">
          <option value="tour" ${o.modele !== 'auto' ? 'selected' : ''}>Grue à tour</option><option value="auto" ${o.modele === 'auto' ? 'selected' : ''}>Grue automontante</option></select></label>
        <label class="champ-calage"><span>Longueur de la flèche (m)</span><input type="number" min="${FLECHE_MIN}" max="${FLECHE_MAX}" step="0.5" value="${sy?.fleche ?? o.fleche ?? 40}" data-prop="fleche" list="fleches-grue"></label>
        <datalist id="fleches-grue">${fleches.map((f) => `<option value="${f}"></option>`).join('')}</datalist>
        ${champCase('Châssis (coté sur le plan)', 'prop-case', 'chassisOui', Boolean(cote))}
        ${cote ? `<label class="champ-calage"><span>Côté du châssis (m)</span><input type="number" min="${CHASSIS_MIN}" max="${CHASSIS_MAX}" step="0.05" value="${cote.toFixed(2)}" data-prop="chassis" list="chassis-grue"></label>
        <datalist id="chassis-grue">${chassis.map((c) => `<option value="${c}"></option>`).join('')}</datalist>` : ''}
        ${champNombre('Orientation de la flèche (indépendante du châssis)', 'prop', 'rotationFleche', o.rotationFleche ?? 0, -360, 360, 1, '°')}
        ${champCase('Rayon d\'action', 'prop-case', 'rayon', o.rayon !== false)}`;
    }
    if (o.etage) {
      const textes = o.etage.textes ?? ['1er', 'Rez'];
      return `${dims}${rotation}${orienter}
        <p class="aide-calage">Pose de l'escalier (4 coins × 2 sens de montée) :</p>
        <div class="poses-etage">${POSES_ETAGE.map((t, i) => `<button type="button" data-pose-etage="${i}" class="${(o.etage.pose ?? 0) === i ? 'actif' : ''}" title="${echapper(t)}"><canvas data-vignette-pose="${i}"></canvas></button>`).join('')}</div>
        <label class="champ-calage"><span>Texte de l'étage</span><input type="text" maxlength="30" value="${echapper(textes[0])}" data-etage-texte="0"></label>
        <label class="champ-calage"><span>Texte du rez</span><input type="text" maxlength="30" value="${echapper(textes[1])}" data-etage-texte="1"></label>`;
    }
    if (o.cle === CLE_DEVIATION) {
      return `<label class="champ-calage"><span>Texte du panneau</span><input type="text" maxlength="30" value="${echapper(o.texte ?? 'Lugano')}" data-prop="texte"></label>
        <label class="champ-calage"><span>Sens</span><select data-prop="sens">${SENS_DEVIATION.map(([v, t]) => `<option value="${v}" ${(o.sens ?? 'droite') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
    }
    const tourelle = sy?.pivote ? champNombre('Rotation de la tourelle (par rapport au châssis)', 'prop', 'tourelle', o.tourelle ?? 0, -360, 360, 1, '°') : '';
    return `<p class="resume-chantier">${echapper(sy?.nom ?? 'Symbole introuvable')}</p>${dims}${tourelle}${rotation}${orienter}`;
  }

  /** Vignette d'une pose de la base-vie à étage. */
  function dessinerPose(canvas, pose) {
    const conteneur = bib().find((x) => x.cle === CLE_CONTENEUR);
    if (!conteneur) return;
    dessinerVignette(canvas, { ...conteneur, etageDemo: true, poseDemo: pose }, bib());
  }

  // ---------------------------------------------------------------- Bibliothèque (panneau de gauche)

  function majBiblio() {
    const zone = page.querySelector('[data-zone="biblio"]');
    if (!zone) return;
    zone.hidden = !etat.biblio.ouvert;
    page.querySelector('.travail-chantier')?.classList.toggle('avec-biblio', etat.biblio.ouvert);
    if (!etat.biblio.ouvert) return;
    if (!zone.querySelector('[data-zone="biblio-liste"]')) {
      zone.innerHTML = `
        <h3>Symboles ${bulle('symbolesChantier')}</h3>
        <input type="search" placeholder="Rechercher…" data-biblio="recherche" value="${echapper(etat.biblio.recherche)}" aria-label="Rechercher un symbole">
        <div class="categories-biblio">${['', ...CATEGORIES_SYMBOLES].map((c) => `<button type="button" data-biblio-cat="${c}">${c || 'Tous'}</button>`).join('')}</div>
        <div class="liste-biblio" data-zone="biblio-liste"></div>
        <button type="button" class="lien-calage" data-action="importer-blocs">＋ Importer un DXF de blocs…</button>`;
    }
    zone.querySelectorAll('[data-biblio-cat]').forEach((b) => b.classList.toggle('actif', b.dataset.biblioCat === etat.biblio.categorie));
    const liste = zone.querySelector('[data-zone="biblio-liste"]');
    if (!bibBase.length && !(leProjet().symboles ?? []).length) {
      liste.innerHTML = '<p class="aide-calage">Chargement de la bibliothèque…</p>';
      return;
    }
    const entrees = filtrerEntrees(entreesBibliotheque(bib()), etat.biblio.categorie, etat.biblio.recherche);
    const choisie = etat.outil === 'symbole' ? cleDeLaPose(etat.pose) : null;
    liste.innerHTML = entrees.map((x) => `<button type="button" class="entree-biblio ${x.cle === choisie ? 'actif' : ''}" data-entree="${echapper(x.cle)}" title="${echapper(x.nom)}">
      <canvas data-vignette="${echapper(x.cle)}"></canvas><span class="nom">${echapper(x.nom)}</span>
      <span class="dims">${x.detail ? echapper(x.detail) : `${n1(x.largeur)} × ${n1(x.hauteur)} m`}${x.importe ? ' · projet' : ''}</span></button>`).join('') || '<p class="aide-calage">Aucun symbole.</p>';
    const parCle = new Map(entrees.map((x) => [x.cle, x]));
    liste.querySelectorAll('canvas[data-vignette]').forEach((c) => {
      const x = parCle.get(c.dataset.vignette);
      if (x) dessinerVignette(c, x.symbole, bib());
    });
  }

  const cleDeLaPose = (pose) => (!pose ? null : pose.type === 'grue' ? `grue:${pose.modele}` : pose.etage ? 'etage' : pose.cle);

  async function importerBlocs() {
    if (lectureSeule()) return message('Projet ouvert en lecture seule ici : rien n\'est modifié.', 5000);
    const entree = document.createElement('input');
    entree.type = 'file';
    entree.accept = '.dxf';
    const fichier = await new Promise((ok) => {
      entree.addEventListener('change', () => ok(entree.files?.[0] ?? null));
      entree.click();
    });
    if (!fichier) return;
    const { symboles, erreur } = symbolesDuDxf(new Uint8Array(await fichier.arrayBuffer()));
    if (erreur) return message(`« ${fichier.name} » : ${erreur}.`, 6000);
    const { ajoutes, remplaces } = ajouterSymbolesProjet(leProjet(), symboles);
    modifie();
    message(`${ajoutes} symbole(s) ajouté(s) au projet${remplaces ? `, ${remplaces} remplacé(s)` : ''} (style moderne ajouté).`, 5000, { ok: true });
    majBiblio();
  }

  // ---------------------------------------------------------------- Événements

  page.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    const p = plan();
    if (b.dataset.action === 'retour') return fermer();
    if (b.dataset.ecran) {
      if (b.dataset.ecran === 'liste') etat.ecran = 'liste';
      else if (p) etat.ecran = b.dataset.ecran;
      return dessiner();
    }
    if (etat.ecran === 'feuille' && p && (await clicFeuille(b, p)) !== false) return;
    if (b.dataset.action === 'nouveau') return nouveau();
    const trouve = (id) => liste().find((x) => x.id === id);
    if (b.dataset.ouvrir) return ouvrirPlan(trouve(b.dataset.ouvrir));
    if (b.dataset.renommer || b.dataset.dupliquer || b.dataset.supprimer) {
      if (lectureSeule()) return message('Projet ouvert en lecture seule ici : rien n\'est modifié.', 5000);
      const x = trouve(b.dataset.renommer || b.dataset.dupliquer || b.dataset.supprimer);
      if (b.dataset.renommer) {
        const nom = await demanderTexte({ titre: 'Nouveau nom du plan', valeur: x.nom });
        if (!nom) return;
        x.nom = nom;
      } else if (b.dataset.dupliquer) {
        const copie = { ...copiePlan(x), id: nouveauPlanChantier('').id, nom: `${x.nom} (copie)`, modifieLe: new Date().toISOString() };
        liste().push(copie);
      } else {
        const ok = await demanderChoix({ titre: `Supprimer « ${x.nom} » ?`, texte: `${x.objets.length} élément(s) seront supprimés du projet.`, boutons: [{ cle: 'non', texte: 'Garder', principal: true }, { cle: 'oui', texte: 'Supprimer', classe: 'danger' }] });
        if (ok !== 'oui') return;
        leProjet().plansChantier = liste().filter((y) => y !== x);
        if (etat.planId === x.id) etat.planId = null;
      }
      modifie();
      return dessiner();
    }
    if (!p || etat.ecran !== 'dessin') return;
    if (b.dataset.action === 'biblio') {
      etat.biblio.ouvert = !etat.biblio.ouvert;
      majBiblio();
      majOutils();
      return;
    }
    if (b.dataset.action === 'importer-blocs') return importerBlocs();
    if (b.dataset.biblioCat !== undefined) {
      etat.biblio.categorie = b.dataset.biblioCat;
      return majBiblio();
    }
    if (b.dataset.entree) {
      const x = entreesBibliotheque(bib()).find((y) => y.cle === b.dataset.entree);
      if (!x) return;
      etat.pose = JSON.parse(JSON.stringify(x.pose));
      etat.outil = 'symbole';
      etat.saisie = null;
      etat.choisi = null;
      majBiblio();
      return majTout();
    }
    if (b.dataset.ordre) {
      if (!etat.choisi || !avantChangement()) return;
      if (!changerOrdre(p, etat.choisi, b.dataset.ordre)) {
        pileAnnuler.pop();
        return message(b.dataset.ordre === 'devant' || b.dataset.ordre === 'monter' ? 'Cet élément est déjà tout au-dessus.' : 'Cet élément est déjà tout en dessous.', 2500);
      }
      enregistrer();
      return majTout();
    }
    if (b.dataset.orienter) {
      etat.orienter = etat.orienter?.mode === b.dataset.orienter ? null : { id: etat.choisi, mode: b.dataset.orienter };
      return majTout();
    }
    if (b.dataset.echelleReelle !== undefined) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      delete o.echelle;
      enregistrer();
      return majTout();
    }
    if (b.dataset.tourner || b.dataset.poseEtage !== undefined) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      if (b.dataset.tourner) o.rotation = ((((o.rotation ?? 0) + Number(b.dataset.tourner)) % 360) + 360) % 360;
      else o.etage = { ...o.etage, pose: Number(b.dataset.poseEtage) };
      enregistrer();
      return majTout();
    }
    if (['fond-carte', 'fond-ortho', 'fond-cadastre', 'fond-surfaces'].includes(b.dataset.action)) {
      if (!avantChangement()) return;
      const cle = { 'fond-carte': 'carte', 'fond-ortho': 'ortho', 'fond-cadastre': 'cadastre', 'fond-surfaces': 'surfaces' }[b.dataset.action];
      p.fond[cle] = cle === 'surfaces' ? p.fond.surfaces === false : !p.fond[cle];
      if (cle === 'surfaces' && !surfaces().length && p.fond.surfaces) message('Le projet n\'a aucune surface (ou elles sont cachées par le dossier choisi).', 4000);
      enregistrer();
      majTout();
      if (cle !== 'surfaces' && p.fond[cle]) setTimeout(() => {
        if (etat.fondEtat?.manquantes && !etat.fondEtat.enCours) message('Fond swisstopo indisponible (pas de connexion ?).', 4000);
      }, 6000);
      return;
    }
    if (b.dataset.outil) {
      etat.outil = b.dataset.outil;
      etat.saisie = null;
      etat.attenteRepere = null;
      if (etat.outil !== 'choisir') etat.choisi = null;
      return majTout();
    }
    if (b.dataset.accroche) {
      const a = b.dataset.accroche;
      if (etat.accroches.has(a)) etat.accroches.delete(a);
      else etat.accroches.add(a);
      return majOutils();
    }
    if (b.dataset.zoom) return b.dataset.zoom === 'tout' ? vue?.cadrer() : vue?.zoom(Number(b.dataset.zoom));
    if (b.dataset.choisir) {
      etat.outil = 'choisir';
      etat.saisie = null;
      etat.choisi = b.dataset.choisir;
      return majTout();
    }
    if (b.dataset.action === 'couleur-origine') {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      delete o.couleur;
      enregistrer();
      return majTout();
    }
    if (b.dataset.genre) {
      const { genre, cible, valeur } = b.dataset;
      if (cible === 'outil') {
        if (genre === 'zone') etat.categorie = valeur;
        else {
          etat.style = valeur;
          etat.epaisseurMm = null; // l'épaisseur redevient celle du genre
          if (etat.saisie?.source) etat.saisie.style = valeur;
        }
        if (etat.saisie && !etat.saisie.source) Object.assign(etat.saisie, { categorie: etat.categorie, style: etat.style });
        return majTout();
      }
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      if (genre === 'zone') o.categorie = valeur;
      else {
        o.style = valeur;
        delete o.epaisseurMm; // épaisseur du nouveau genre
      }
      enregistrer();
      return majTout();
    }
    if (b.dataset.action === 'inverser-sens') {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      if (o.sens === 'inverse') delete o.sens;
      else o.sens = 'inverse';
      enregistrer();
      return majTout();
    }
    if (b.dataset.action === 'construction-visible') {
      if (!avantChangement()) return;
      p.construction = { ...(p.construction ?? {}), visible: p.construction?.visible === false };
      if (etat.choisi && p.objets.find((x) => x.id === etat.choisi)?.type === 'construction' && p.construction.visible === false) etat.choisi = null;
      enregistrer();
      return majTout();
    }
    if (b.dataset.action === 'saisie-ok') return placerParSaisie();
    if (b.dataset.action === 'decaler-choisi') return decalerChoisi();
    if (b.dataset.action === 'effacer') return supprimerChoisi();
    if (b.dataset.action === 'annuler') return annuler();
    if (b.dataset.action === 'fond-points') {
      if (!avantChangement()) return;
      p.fond.points = p.fond.points === false;
      enregistrer();
      return majTout();
    }
    if (b.dataset.action === 'fond-plans') {
      const tous = plans();
      if (!tous.length) return message('Le projet n\'a aucun plan (DXF, PDF, IFC) à mettre dessous.', 4000);
      const caches = new Set(p.fond.plansCaches ?? []);
      const coches = await demanderCases({ titre: 'Plans du projet montrés dessous', options: tous.map((x) => ({ cle: x.id, texte: x.nom ?? x.id, coche: !caches.has(x.id) })) });
      if (!coches || !avantChangement()) return;
      p.fond.plansCaches = tous.map((x) => x.id).filter((id) => !coches.includes(id));
      enregistrer();
      return majTout();
    }
    if (b.dataset.action === 'gestion-phases') {
      return ouvrirGestionPhases({ plan, avantChangement, enregistrer, redessiner: () => { majTout(); vue?.redessinerDessus(); } });
    }
    if (b.dataset.action === 'phase-ajouter') {
      if (!avantChangement()) return;
      ajouterPhase(p);
      enregistrer();
      return majTout();
    }
    if (b.dataset.phaseActive) {
      p.phaseActive = b.dataset.phaseActive;
      enregistrer();
      return majPanneau();
    }
    if (b.dataset.phaseRenommer) {
      const ph = p.phases.find((x) => x.id === b.dataset.phaseRenommer);
      const nom = await demanderTexte({ titre: 'Nom de la phase', valeur: ph.nom });
      if (!nom || !avantChangement()) return;
      ph.nom = nom;
      enregistrer();
      return majPanneau();
    }
    if (b.dataset.phaseSuppr) {
      const ph = p.phases.find((x) => x.id === b.dataset.phaseSuppr);
      const nb = p.objets.filter((o) => o.phase === ph.id).length;
      const ok = await demanderChoix({ titre: `Supprimer « ${ph.nom} » ?`, texte: nb ? `Ses ${nb} élément(s) seront supprimés aussi (↶ Annuler possible).` : '', boutons: [{ cle: 'non', texte: 'Garder', principal: true }, { cle: 'oui', texte: 'Supprimer', classe: 'danger' }] });
      if (ok !== 'oui' || !avantChangement()) return;
      retirerPhase(p, ph.id);
      if (!p.objets.some((o) => o.id === etat.choisi)) etat.choisi = null;
      enregistrer();
      return majTout();
    }
  });

  /** Valeur d'un champ nombre, bornée par son min / max (virgule acceptée) ; null si illisible. */
  const nombreDe = (c) => {
    const v = Number(String(c.value).replace(',', '.'));
    if (!Number.isFinite(v) || String(c.value).trim() === '') return null;
    return Math.min(c.max !== '' ? Number(c.max) : Infinity, Math.max(c.min !== '' ? Number(c.min) : -Infinity, v));
  };

  // Curseur de transparence : l'aperçu suit le doigt ; un seul « Annuler » pour tout le glissement.
  page.addEventListener('input', (ev) => {
    const c = ev.target;
    if (c.dataset.biblio === 'recherche') {
      etat.biblio.recherche = c.value;
      return majBiblio();
    }
    if (etat.ecran === 'feuille' && c.dataset.feuilleCurseur) return entreeFeuille(c);
    const p = plan();
    if (!p || c.type !== 'range') return;
    const valeur = Number(c.value);
    const etiquette = page.querySelector(`[data-valeur-de="${c.dataset.reglage ?? c.dataset.prop}"]`);
    if (etiquette) etiquette.textContent = `${Math.round(valeur)} %`;
    if (c.dataset.reglage) {
      etat[c.dataset.reglage] = valeur;
      return;
    }
    const o = p.objets.find((x) => x.id === etat.choisi);
    if (!o) return;
    if (!etat.reglageEnCours) {
      if (!avantChangement()) return;
      etat.reglageEnCours = true;
    }
    o[c.dataset.prop] = valeur;
    vue?.redessinerDessus();
  });

  page.addEventListener('change', (ev) => {
    const c = ev.target;
    const p = plan();
    if (!p) return;
    if (etat.ecran === 'feuille') return changeFeuille(c, p);
    if (c.dataset.etageTexte !== undefined) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o?.etage || !avantChangement()) return;
      const textes = [...(o.etage.textes ?? ['1er', 'Rez'])];
      textes[Number(c.dataset.etageTexte)] = c.value.trim();
      o.etage = { ...o.etage, textes };
      enregistrer();
      return vue?.redessinerDessus();
    }
    if (c.type === 'range') {
      if (etat.reglageEnCours) enregistrer();
      etat.reglageEnCours = false;
      return;
    }
    if (c.dataset.reglage) {
      const cle = c.dataset.reglage;
      if (c.type === 'number') {
        const v = nombreDe(c);
        if (v === null) return majPanneau();
        etat[cle] = v;
      } else etat[cle] = c.value;
      if (etat.saisie && !etat.saisie.source) Object.assign(etat.saisie, { categorie: etat.categorie, style: etat.style, largeur: etat.largeur });
      majConsigne();
      vue?.redessinerDessus();
      return;
    }
    if (c.dataset.reglageCase) {
      etat[c.dataset.reglageCase] = c.checked;
      return majConsigne();
    }
    if (c.dataset.champ === 'echelle') {
      const v = nombreDe(c);
      if (v === null || !avantChangement()) return majPanneau();
      p.echelle = v;
      enregistrer();
      return vue?.redessinerDessus();
    }
    if (c.dataset.champ === 'tailleTexteMm') {
      const v = nombreDe(c);
      if (v === null || !avantChangement()) return majPanneau();
      p.tailleTexteMm = v;
      enregistrer();
      return vue?.redessinerDessus();
    }
    if (c.dataset.phaseVisible) {
      if (!avantChangement()) return;
      p.phases.find((x) => x.id === c.dataset.phaseVisible).visible = c.checked;
      enregistrer();
      return majTout();
    }
    if (c.dataset.phaseCouleur) {
      if (!avantChangement()) return;
      p.phases.find((x) => x.id === c.dataset.phaseCouleur).couleur = c.value;
      enregistrer();
      return vue?.redessinerDessus();
    }
    if (c.dataset.champ === 'couleurs') {
      if (!avantChangement()) return;
      p.couleurs = c.value;
      enregistrer();
      return vue?.redessinerDessus();
    }
    if (c.dataset.propCase) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o) return;
      const cle = c.dataset.propCase;
      if (cle === 'tasOui') {
        if (!avantChangement()) return;
        if (c.checked) {
          o.tasH = o.tasH > 0 ? o.tasH : TAS_HAUTEUR;
          o.tasTalus ??= TAS_TALUS;
          o.afficherHauteur = true;
        } else {
          delete o.tasH;
          delete o.tasTalus;
          delete o.afficherHauteur;
        }
        enregistrer();
        majPanneau();
        return vue?.redessinerDessus();
      }
      if (cle === 'chassisOui') {
        if (!avantChangement()) return;
        o.chassis = c.checked ? (coteChassis(o.chassisAvant) ?? 4.5).toFixed(2) : 'aucun';
        if (!c.checked) o.chassisAvant = coteChassis(o.chassis) ?? o.chassisAvant;
        enregistrer();
        majPanneau();
        return vue?.redessinerDessus();
      }
      if (cle === 'stabilisateurs') {
        if (!avantChangement()) return;
        o.stabilisateurs = c.checked;
        enregistrer();
        return vue?.redessinerDessus();
      }
      if (cle === 'rayon') {
        if (!avantChangement()) return;
        o.rayon = c.checked; // rayon d'action d'une grue : affiché ou caché
        enregistrer();
        return vue?.redessinerDessus();
      }
      if (cle === 'repere') {
        if (c.checked) {
          etat.attenteRepere = o.id; // le prochain clic sur le plan donne le point visé
          etat.repereBout = o.repereBout ?? etat.repereBout;
        } else {
          etat.attenteRepere = null;
          if (o.repere && avantChangement()) {
            delete o.repere;
            delete o.repereBout;
            enregistrer();
          }
        }
        return majTout();
      }
      if (!avantChangement()) return;
      if (c.checked) o[cle] = true;
      else delete o[cle];
      enregistrer();
      majPanneau();
      return vue?.redessinerDessus();
    }
    if (c.dataset.prop) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o) return;
      const cle = c.dataset.prop;
      if (cle === 'texte' && !c.value.trim()) return majPanneau();
      let valeur = c.value.trim();
      if (c.type === 'number') {
        valeur = nombreDe(c);
        if (valeur === null) return majPanneau();
      }
      if (!avantChangement()) return;
      o[cle] = valeur;
      if (cle === 'fin' && !valeur) delete o.fin;
      if (cle === 'materiau' && !valeur) delete o.materiau;
      if (cle === 'tonnes') o.tonnes = Number(valeur);
      if (cle === 'chassis') o.chassis = Number(valeur).toFixed(2); // côté libre (m), gardé en texte comme « 4.50 »
      enregistrer();
      majPanneau();
      vue?.redessinerDessus();
    }
  });

  dessiner();
  return { fermer };
}
