// Application « Plans de chantier » (0.286.0, Expert, site PC et Topo Bureau ; maquette validée le 23.11) :
// dessiner un plan d'installation de chantier, de phasage ou de circulation sur les plans du projet (MN95).
// Page plein écran à part (comme Calage de plans) : « Plans » (liste du projet) · « Dessiner » (bandeau d'outils en
// haut comme AutoCAD, plan au centre, phases et élément choisi à droite).
// Étape 1 : zones, lignes (clôtures…), pistes, flèches, textes, phases, accroches, fonds. Plus tard : symboles
// (bibliothèque de blocs modernisés, base-vie à étage), mise en page PDF, export DXF.
// Calculs : topo/plan-chantier.js ; vue : vue.js. Rangé dans le projet : projet.plansChantier (Drive avec le projet).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { demanderChoix, demanderTexte, demanderCases } from '../outils/choix.js';
import { accrocher, sourcesDesPlans } from '../topo/accroche.js';
import {
  GENRES, CATEGORIES_ZONE, STYLES_LIGNE, nouveauPlanChantier, ajouterPhase, retirerPhase, ajouterObjet, retirerObjet,
  objetsVisibles, objetSousLePoint, deplacerObjet, lignesPourAccroche, resumeObjet, copiePlan, aire, longueur,
  sommetSousLePoint, couleurObjet, LARGEUR_FLECHE, POINTE_FLECHE,
} from '../topo/plan-chantier.js';
import { creerVueChantier } from './vue.js';

const OUTILS = [
  ['zone', '<path d="M4 8L12 4L20 9L17 19H6Z"/>', 'Zone'],
  ['ligne', '<path d="M3 18L9 8L15 14L21 5"/>', 'Ligne'],
  ['piste', '<path d="M3 15L12 9L21 15M3 20L12 14L21 20"/>', 'Piste'],
  ['fleche', '<path d="M3 14H15V9L21 15L15 21V16H3Z"/>', 'Flèche'],
  ['texte', '<path d="M5 6H19M12 6V20M9 20H15"/>', 'Texte'],
];
const ACCROCHES = [['point', 'Point'], ['sommet', 'Sommet'], ['milieu', 'Milieu'], ['ligne', 'Sur ligne']];
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
export function ouvrirPlansChantier({ projet: projetDonne, modifie, plans = () => [], points = () => [], lectureSeule = () => false, quandRetour = null, message = () => {} }) {
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
    largeurFleche: LARGEUR_FLECHE, pointeFleche: POINTE_FLECHE, glisse: null, // glisse : { type: 'sommet', i } ou { type: 'objet' }
  };
  let vue = null;
  let pileAnnuler = [];

  const plan = () => liste().find((x) => x.id === etat.planId) ?? null;
  const plansFond = () => {
    const caches = new Set(plan()?.fond?.plansCaches ?? []);
    return plans().filter((p) => !caches.has(p.id));
  };

  let fermee = false;
  function fermer() {
    fermee = true;
    vue?.detruire();
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
    if (etat.saisie) {
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
    page.innerHTML = `
      <header class="entete-calage entete-chantier">
        <button type="button" class="retour-reglages" data-action="retour" aria-label="Retour aux applications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        <h2>Plans de chantier ${bulle('plansChantier')}</h2>
        <nav class="etapes-calage" aria-label="Parties">
          <button type="button" data-ecran="liste" class="${etat.ecran === 'liste' ? 'actif' : ''}">Plans</button>
          <button type="button" data-ecran="dessin" class="${etat.ecran === 'dessin' ? 'actif' : ''}" ${plan() ? '' : 'disabled'}>Dessiner</button>
        </nav>
        ${plan() && etat.ecran === 'dessin' ? `<span class="nom-plan-chantier">${echapper(plan().nom)}</span>` : ''}
      </header>
      <main class="contenu-calage ${etat.ecran === 'dessin' ? 'en-calage' : ''}">${etat.ecran === 'dessin' ? htmlDessin() : htmlListe()}</main>`;
    if (etat.ecran === 'dessin') monterVue();
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
        ${groupe('Accroche', ACCROCHES.map(([c, t]) => `<button type="button" class="outil-ruban petit" data-accroche="${c}"><span>${t}</span></button>`).join(''))}
        ${groupe('Fond', `<button type="button" class="outil-ruban" data-action="fond-plans">${ico('<path d="M3 6L9 4L15 6L21 4V18L15 20L9 18L3 20Z"/><path d="M9 4V18M15 6V20"/>')}<span>Plans…</span></button>
          <button type="button" class="outil-ruban" data-action="fond-points">${ico('<circle cx="7" cy="8" r="2"/><circle cx="16" cy="6" r="2"/><circle cx="12" cy="16" r="2"/>')}<span>Points levés</span></button>`)}
        ${groupe('Zoom', '<button type="button" class="outil-ruban" data-zoom="1.5">＋</button><button type="button" class="outil-ruban" data-zoom="0.667">−</button><button type="button" class="outil-ruban" data-zoom="tout">⤢<span>Tout</span></button>')}
      </div>
      <p class="consigne-calage" data-zone="consigne"></p>
      <div class="travail-chantier">
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
      saisie: () => etat.saisie,
      accrocher: accrochage,
      clic: toucher,
      double: () => {
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
          if (etat.outil !== 'choisir' || !etat.choisi) return false;
          const o = plan().objets.find((x) => x.id === etat.choisi);
          if (!o) return false;
          const i = o.type === 'texte' ? -1 : sommetSousLePoint(o, p, tol);
          if (i < 0 && objetSousLePoint(objetsVisibles(plan()), p, tol)?.id !== etat.choisi) return false;
          if (!avantChangement()) return false;
          etat.glisse = i >= 0 ? { type: 'sommet', i } : { type: 'objet' };
          return true;
        },
        deplacer: (de, dn, point) => {
          const o = plan().objets.find((x) => x.id === etat.choisi);
          if (!o) return;
          if (etat.glisse?.type === 'sommet') o.points[etat.glisse.i] = point;
          else deplacerObjet(o, de, dn);
        },
        fin: () => {
          etat.glisse = null;
          enregistrer();
          majPanneau();
        },
      },
    });
    majTout();
  }

  /** Accroche pendant un dessin : points levés, puis sommets / milieux / bords des plans et de ce qui est dessiné. */
  function accrochage(position, tolerance) {
    if (etat.outil === 'choisir' && etat.glisse?.type !== 'sommet') return null;
    const a = etat.accroches;
    if (a.has('point')) {
      const t = accrocher('point', position, tolerance, { points: plan()?.fond?.points === false ? [] : points() });
      if (t) return t;
    }
    const sources = sourcesDesPlans(plansFond(), position, tolerance);
    // Pendant qu'on glisse un sommet, l'élément lui-même n'est pas une accroche (il bouge).
    const autres = etat.glisse ? plan().objets.filter((o) => o.id !== etat.choisi) : plan().objets;
    sources.lignes = [...sources.lignes, ...lignesPourAccroche(autres)];
    for (const mode of ['sommet', 'milieu', 'ligne']) {
      if (!a.has(mode)) continue;
      const t = accrocher(mode, position, tolerance, sources);
      if (t) return t;
    }
    return null;
  }

  async function toucher(p, tolerance) {
    if (etat.outil === 'choisir') {
      etat.choisi = objetSousLePoint(objetsVisibles(plan()), p, tolerance)?.id ?? null;
      majTout();
      return;
    }
    if (etat.outil === 'texte') {
      const texte = await demanderTexte({ titre: 'Texte à écrire sur le plan' });
      if (!texte || !avantChangement()) return;
      const o = ajouterObjet(plan(), { type: 'texte', point: p, texte, taille: etat.tailleTexte });
      etat.choisi = o.id;
      etat.outil = 'choisir';
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
    majConsigne();
    vue?.redessinerDessus();
  }

  function finirSaisie() {
    const s = etat.saisie;
    if (!s) return;
    const min = s.outil === 'zone' ? 3 : 2;
    if (s.points.length < min) {
      message(s.outil === 'zone' ? 'Une zone a au moins 3 sommets.' : 'Il faut au moins 2 points.', 3000);
      return;
    }
    if (!avantChangement()) return;
    const props = { zone: { categorie: s.categorie }, ligne: { style: s.style }, piste: { largeur: s.largeur }, fleche: { largeur: etat.largeurFleche, pointe: etat.pointeFleche } }[s.outil];
    const o = ajouterObjet(plan(), { type: s.outil, points: s.points, ...props });
    etat.saisie = null;
    etat.choisi = o.id;
    etat.outil = 'choisir'; // 0.287.0 : l'élément dessiné est choisi (poignées, réglages à droite)
    vue?.oublierCurseur();
    enregistrer();
    majTout();
  }

  function supprimerChoisi() {
    if (!etat.choisi || !avantChangement()) return;
    retirerObjet(plan(), etat.choisi);
    etat.choisi = null;
    enregistrer();
    majTout();
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
    page.querySelector('[data-action="effacer"]')?.toggleAttribute('disabled', !etat.choisi);
    const toile = page.querySelector('[data-toile]');
    if (toile) toile.dataset.outil = etat.outil;
    majConsigne();
  }

  function majConsigne() {
    const s = etat.saisie;
    const n = s?.points.length ?? 0;
    const textes = {
      choisir: etat.choisi ? 'Glisser une poignée (carré) = déplacer ce sommet ; glisser l\'élément = le déplacer ; Suppr = l\'effacer ; Échap = ne plus le choisir.' : 'Cliquez un élément pour le choisir (ou dans la liste à droite). Molette = zoom, glisser dans le vide = déplacer le plan.',
      zone: n >= 3 ? 'Cliquez le sommet suivant ; cliquez le 1er sommet (ou Entrée, double-clic) pour fermer la zone.' : 'Cliquez les sommets de la zone.',
      ligne: n >= 2 ? 'Point suivant ; Entrée ou double-clic = finir.' : 'Cliquez le départ de la ligne.',
      piste: n >= 2 ? 'Point suivant de l\'axe ; Entrée ou double-clic = finir.' : 'Cliquez le départ de l\'axe de la piste.',
      fleche: n >= 2 ? 'Point suivant ; Entrée ou double-clic = finir (la pointe est au dernier point).' : 'Cliquez le départ de la flèche, puis les points jusqu\'à la pointe.',
      texte: 'Cliquez où écrire le texte.',
    };
    const zone = page.querySelector('[data-zone="consigne"]');
    if (zone) zone.textContent = `${textes[etat.outil]}${etat.outil !== 'choisir' ? ' (Échap = arrêter)' : ''}`;
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

  function majPanneau() {
    const zone = page.querySelector('[data-zone="panneau"]');
    if (!zone) return;
    const p = plan();
    const o = p.objets.find((x) => x.id === etat.choisi);
    const options = (liste, valeur) => liste.map((x) => `<option value="${x.cle}" ${x.cle === valeur ? 'selected' : ''}>${echapper(x.nom)}</option>`).join('');
    const reglages = {
      zone: `<label class="champ-calage"><span>Genre de zone</span><select data-reglage="categorie">${options(CATEGORIES_ZONE, etat.categorie)}</select></label>`,
      ligne: `<label class="champ-calage"><span>Genre de ligne</span><select data-reglage="style">${options(STYLES_LIGNE, etat.style)}</select></label>`,
      piste: `<label class="champ-calage"><span>Largeur de la piste (m)</span><input type="number" min="1" max="30" step="0.5" value="${etat.largeur}" data-reglage="largeur"></label>`,
      texte: `<label class="champ-calage"><span>Hauteur des lettres (m)</span><input type="number" min="0.2" max="10" step="0.1" value="${etat.tailleTexte}" data-reglage="tailleTexte"></label>`,
      fleche: `<label class="champ-calage"><span>Largeur de la flèche (m)</span><input type="number" min="0.1" max="10" step="0.1" value="${etat.largeurFleche}" data-reglage="largeurFleche"></label>
        <label class="champ-calage"><span>Longueur de la pointe (m)</span><input type="number" min="0.3" max="20" step="0.1" value="${etat.pointeFleche}" data-reglage="pointeFleche"></label>`,
    }[etat.outil] ?? '';
    let choisi = '';
    if (o) {
      const phaseChoix = p.phases.map((ph) => `<option value="${ph.id}" ${ph.id === o.phase ? 'selected' : ''}>${echapper(ph.nom)}</option>`).join('');
      const propre = {
        zone: `<label class="champ-calage"><span>Genre de zone</span><select data-prop="categorie">${options(CATEGORIES_ZONE, o.categorie)}</select></label>`,
        ligne: `<label class="champ-calage"><span>Genre de ligne</span><select data-prop="style">${options(STYLES_LIGNE, o.style)}</select></label>`,
        piste: `<label class="champ-calage"><span>Largeur (m)</span><input type="number" min="1" max="30" step="0.5" value="${o.largeur ?? 4}" data-prop="largeur"></label>`,
        texte: `<label class="champ-calage"><span>Texte</span><input type="text" value="${echapper(o.texte)}" data-prop="texte" maxlength="80"></label>
          <label class="champ-calage"><span>Hauteur des lettres (m)</span><input type="number" min="0.2" max="10" step="0.1" value="${o.taille ?? 1}" data-prop="taille"></label>`,
        fleche: `<label class="champ-calage"><span>Largeur (m)</span><input type="number" min="0.1" max="10" step="0.1" value="${o.largeur ?? LARGEUR_FLECHE}" data-prop="largeur"></label>
          <label class="champ-calage"><span>Longueur de la pointe (m)</span><input type="number" min="0.3" max="20" step="0.1" value="${o.pointe ?? POINTE_FLECHE}" data-prop="pointe"></label>`,
      }[o.type];
      choisi = `<h3>Élément choisi</h3><p class="resume-chantier">${echapper(resumeObjet(o))}</p>${propre}
        ${p.couleurs === 'phases' ? '<p class="aide-calage">Couleurs « une par phase » : la couleur vient de la phase.</p>' : `<div class="couleur-element"><label class="champ-calage"><span>Couleur</span><input type="color" value="${couleurObjet({ ...p, couleurs: 'objets' }, o)}" data-prop="couleur"></label>
          ${o.couleur ? '<button type="button" class="lien-calage" data-action="couleur-origine">Couleur d\'origine</button>' : ''}</div>`}
        <label class="champ-calage"><span>Phase</span><select data-prop="phase">${phaseChoix}</select></label>
        <button type="button" class="bouton-secondaire" data-action="effacer">Effacer cet élément</button>`;
    }
    zone.innerHTML = `
      <h3>Phases</h3>
      <ul class="phases-chantier">${p.phases.map((ph) => `<li class="${ph.id === p.phaseActive ? 'active' : ''}">
        <input type="checkbox" data-phase-visible="${ph.id}" ${ph.visible !== false ? 'checked' : ''} aria-label="Montrer ${echapper(ph.nom)}">
        <input type="color" value="${ph.couleur}" data-phase-couleur="${ph.id}" aria-label="Couleur de ${echapper(ph.nom)}">
        <button type="button" class="nom-phase" data-phase-active="${ph.id}" title="Dessiner dans cette phase">${echapper(ph.nom)}</button>
        <button type="button" class="suppr-calage" data-phase-renommer="${ph.id}" aria-label="Renommer ${echapper(ph.nom)}">✎</button>
        ${p.phases.length > 1 ? `<button type="button" class="suppr-calage" data-phase-suppr="${ph.id}" aria-label="Supprimer ${echapper(ph.nom)}">✕</button>` : ''}</li>`).join('')}</ul>
      <button type="button" class="lien-calage" data-action="phase-ajouter">＋ Nouvelle phase</button>
      <label class="champ-calage"><span>Couleurs</span><select data-champ="couleurs">
        <option value="objets" ${p.couleurs !== 'phases' ? 'selected' : ''}>Celles des objets</option>
        <option value="phases" ${p.couleurs === 'phases' ? 'selected' : ''}>Une couleur par phase</option></select></label>
      ${reglages ? `<h3>Outil</h3>${reglages}` : ''}
      ${choisi}
      <h3>Éléments (${p.objets.length})</h3>
      <ul class="elements-chantier">${[...p.objets].reverse().map((x) => `<li><button type="button" data-choisir="${x.id}" class="${x.id === etat.choisi ? 'actif' : ''}">
        <i style="background:${couleurObjet(p, x)}"></i>${echapper(resumeObjet(x))}</button></li>`).join('') || '<li class="aide-calage">Rien de dessiné.</li>'}</ul>`;
    page.querySelector('.ruban-chantier [data-action="effacer"]')?.toggleAttribute('disabled', !etat.choisi);
  }

  // ---------------------------------------------------------------- Événements

  page.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    const p = plan();
    if (b.dataset.action === 'retour') return fermer();
    if (b.dataset.ecran) {
      if (b.dataset.ecran === 'liste') etat.ecran = 'liste';
      else if (p) etat.ecran = 'dessin';
      return dessiner();
    }
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
    if (b.dataset.outil) {
      etat.outil = b.dataset.outil;
      etat.saisie = null;
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

  page.addEventListener('change', (ev) => {
    const c = ev.target;
    const p = plan();
    if (!p) return;
    if (c.dataset.reglage) {
      etat[c.dataset.reglage] = c.type === 'number' ? Math.max(Number(c.min) || 0.1, Number(c.value) || Number(c.min) || 1) : c.value;
      if (etat.saisie) Object.assign(etat.saisie, { categorie: etat.categorie, style: etat.style, largeur: etat.largeur });
      vue?.redessinerDessus();
      return;
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
    if (c.dataset.prop) {
      const o = p.objets.find((x) => x.id === etat.choisi);
      if (!o || !avantChangement()) return;
      const cle = c.dataset.prop;
      if (cle === 'texte' && !c.value.trim()) return majPanneau();
      o[cle] = c.type === 'number' ? Math.max(Number(c.min) || 0.1, Number(c.value) || 1) : c.value.trim();
      enregistrer();
      majPanneau();
      vue?.redessinerDessus();
    }
  });

  dessiner();
  return { fermer };
}
