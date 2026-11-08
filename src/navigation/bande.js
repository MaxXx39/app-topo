// Bande du bas (0.156.0, demande du 08.11 ; maquette « A » sombre et Menu 1 en tuiles validés) :
// - à gauche, un bouton en 2 parties : l'application en cours (sa couleur, son icône, son nom) et
//   la sous-application (Point, Ligne… d'Implanter ; Contour, Ligne… de Lever ; Volumes… de Calculs) ;
// - toucher l'application ouvre la page « Applications » (bandeau du projet, puis les tuiles) ;
// - toucher la sous-application déroule la bande : on choisit une autre sous-application ;
// - appui long sur l'application : la roue des favoris (5 au plus, cochés sur les tuiles, par tablette) ;
// - au milieu, une zone d'infos propre à chaque application (à définir sous-application par sous-application) ;
//   0.157.0 : Lever y met le bouton Enreg. Pts ; rien à y mettre = la bande disparaît, seul le bouton
//   reste en bas à gauche et la zone de travail descend jusqu'en bas (classe body.bande-vide) ;
// - page Applications = menu de départ ; appui long sur une tuile = la déplacer (ordre gardé par tablette).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { appliDeCle, lireFavoris, ecrireFavoris, basculerFavori, MAX_FAVORIS, lireOrdre, ecrireOrdre, ordonner } from './applis.js';

const DUREE_APPUI_LONG = 500; // ms avant que la roue des favoris s'ouvre
const ICONE_REGLAGES = '<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />';
const ICONE_APPLIS = '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />';

const svg = (trace) => `<svg viewBox="0 0 24 24" aria-hidden="true">${trace}</svg>`;

/**
 * Crée la bande dans « nav » et la page « Applications » (ajoutée au document).
 * actions :
 * - applis() : applications proposées (voir applisDisponibles) ;
 * - courante() : clé de l'application affichée ;
 * - sousApplis() : [{ cle, titre, actif }] de l'application affichée ([] : pas de sous-application) ;
 * - choisirSousAppli(cle) ; ouvrirAppli(cle) ;
 * - info() : HTML de la zone du milieu (déjà échappé), ou '' ;
 * - projet() : { titre, detail } du projet ouvert ;
 * - changerProjet(), nouveauProjet() (ou null si le mode ne le permet pas) ;
 * - comptes() : ligne en petit sous Import / Exporter / Contenu (ex. « 3 levés · 2 DXF ») ; detailTuile(cle) :
 *   ligne en petit sous le nom d'une tuile (ex. date du dernier contrôle) ;
 * - sousApplisDe(cle) : [[cle, titre]] écrites en petit sur la tuile (toucher = ouvrir dessus) ;
 * - reglages(), fermerAppli (ou null : pas de bouton) : pied de la page Applications ; avantPage() : juste
 *   avant d'ouvrir la page (fermer la page des réglages) ;
 * - partieProjet('import' | 'export' | 'contenu') : page Projet ouverte sur cette partie ; importPermis() ;
 * - agir(cle) : bouton de la zone du milieu touché (data-nav="action", ex. « prendre » = Enreg. Pts) ;
 * - message(texte) : message court à l'écran ; vibrer() (facultatif).
 * Renvoie { mettreAJour(), fermer(), ouvrirPage(), pageOuverte() }.
 */
export function creerNavigation(nav, actions) {
  let pageOuverte = false;
  let deroulee = false;
  let derniereSignature = '';
  let minuterie = null;
  let appuiLongFait = false;
  let dernierProjet = ''; // nom du projet montré dans l'encadré de la page
  // Déplacement d'une tuile (appui long) : { tuile, minuterie, x, y, actif }.
  let deplacement = null;

  // --- Page « Applications » ---
  const page = document.createElement('section');
  page.className = 'page-applis';
  page.hidden = true;
  page.setAttribute('aria-label', 'Applications');
  document.body.append(page);

  // --- Roue des favoris ---
  const roue = document.createElement('div');
  roue.className = 'roue-favoris';
  roue.hidden = true;
  document.body.append(roue);

  nav.addEventListener('click', quandClicBande);
  nav.addEventListener('contextmenu', (evenement) => evenement.preventDefault());
  nav.addEventListener('pointerdown', (evenement) => {
    if (!evenement.target.closest('[data-nav="appli"]') || pageOuverte) return;
    appuiLongFait = false;
    clearTimeout(minuterie);
    document.body.classList.add('appui-en-cours');
    minuterie = setTimeout(() => {
      appuiLongFait = true;
      sansSelection();
      actions.vibrer?.();
      ouvrirRoue();
    }, DUREE_APPUI_LONG);
  });
  for (const fin of ['pointerup', 'pointercancel', 'pointerleave']) {
    nav.addEventListener(fin, () => {
      clearTimeout(minuterie);
      document.body.classList.remove('appui-en-cours');
    });
  }
  // L'appui long d'Android sélectionne le texte et ouvre un menu : jamais sur la bande, la page ou la roue.
  for (const zone of [nav, page, roue]) {
    zone.addEventListener('contextmenu', (evenement) => evenement.preventDefault());
    zone.addEventListener('selectstart', (evenement) => evenement.preventDefault());
  }
  page.addEventListener('click', quandClicPage);
  page.addEventListener('pointerdown', debutDeplacement);
  page.addEventListener('pointermove', suiteDeplacement);
  for (const fin of ['pointerup', 'pointercancel']) page.addEventListener(fin, finDeplacement);
  // Pendant un déplacement, le doigt ne fait pas défiler la page.
  page.addEventListener('touchmove', (evenement) => {
    if (deplacement?.actif) evenement.preventDefault();
  }, { passive: false });
  roue.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('[data-appli]');
    fermerRoue();
    if (bouton) actions.ouvrirAppli(bouton.dataset.appli);
  });
  // Toucher ailleurs que la bande : elle se replie.
  document.addEventListener('pointerdown', (evenement) => {
    if (deroulee && !nav.contains(evenement.target)) {
      deroulee = false;
      mettreAJour();
    }
  });

  function quandClicBande(evenement) {
    const bouton = evenement.target.closest('[data-nav]');
    if (!bouton) return;
    const quoi = bouton.dataset.nav;
    if (quoi === 'appli') {
      // Le toucher qui suit un appui long ne fait rien de plus (la roue est ouverte).
      if (appuiLongFait) {
        appuiLongFait = false;
        return;
      }
      deroulee = false;
      if (pageOuverte) fermerPage();
      else ouvrirPage();
      return;
    }
    if (quoi === 'sous') {
      deroulee = !deroulee;
      mettreAJour();
      return;
    }
    if (quoi === 'choix-sous') {
      deroulee = false;
      actions.choisirSousAppli(bouton.dataset.cle);
      mettreAJour();
      return;
    }
    if (quoi === 'action') actions.agir?.(bouton.dataset.cle);
  }

  /** Enlève une sélection de texte faite par l'appui long. */
  function sansSelection() {
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      // rien à enlever
    }
  }

  // --- Déplacer une tuile : appui long, puis glisser ; l'ordre est gardé sur la tablette ---
  function debutDeplacement(evenement) {
    const tuile = evenement.target.closest('.tuile-appli');
    if (!tuile || evenement.target.closest('[data-favori]')) return;
    clearTimeout(deplacement?.minuterie);
    deplacement = { tuile, x: evenement.clientX, y: evenement.clientY, actif: false, fait: false };
    deplacement.minuterie = setTimeout(() => {
      deplacement.actif = true;
      sansSelection();
      actions.vibrer?.();
      tuile.classList.add('en-deplacement');
      page.classList.add('deplacement');
      try {
        tuile.setPointerCapture?.(evenement.pointerId);
      } catch {
        // pas grave : le doigt reste suivi par la page
      }
    }, DUREE_APPUI_LONG);
  }

  function suiteDeplacement(evenement) {
    if (!deplacement) return;
    if (!deplacement.actif) {
      // Le doigt bouge avant l'appui long : c'est un défilement, pas un déplacement.
      if (Math.hypot(evenement.clientX - deplacement.x, evenement.clientY - deplacement.y) > 10) {
        clearTimeout(deplacement.minuterie);
        deplacement = null;
      }
      return;
    }
    const sous = document.elementFromPoint(evenement.clientX, evenement.clientY)?.closest('.tuile-appli');
    const { tuile } = deplacement;
    if (!sous || sous === tuile || sous.parentNode !== tuile.parentNode) return;
    const tuiles = [...tuile.parentNode.children];
    // Posée avant la tuile survolée si on recule, après si on avance.
    if (tuiles.indexOf(sous) < tuiles.indexOf(tuile)) sous.before(tuile);
    else sous.after(tuile);
    deplacement.fait = true;
  }

  function finDeplacement() {
    if (!deplacement) return;
    clearTimeout(deplacement.minuterie);
    if (deplacement.actif) {
      deplacement.tuile.classList.remove('en-deplacement');
      page.classList.remove('deplacement');
      ecrireOrdre([...page.querySelectorAll('.tuile-appli')].map((t) => t.dataset.appli));
      // Le toucher qui finit le déplacement n'ouvre pas l'application.
      appuiLongFait = true;
      setTimeout(() => { appuiLongFait = false; }, 400);
    }
    deplacement = null;
  }

  function quandClicPage(evenement) {
    if (appuiLongFait) return;
    const favori = evenement.target.closest('[data-favori]');
    if (favori) {
      evenement.stopPropagation();
      const { liste, refuse } = basculerFavori(lireFavoris(), favori.dataset.favori);
      if (refuse) actions.message(`${MAX_FAVORIS} favoris au plus : décoche d'abord une autre application.`);
      else ecrireFavoris(liste);
      dessinerPage();
      return;
    }
    // 0.159.0 : Réglages et « Fermer l'appli » (pied de la page, pas des applications).
    const pied = evenement.target.closest('[data-pied]');
    if (pied) {
      if (pied.dataset.pied === 'reglages') {
        fermerPage();
        actions.reglages?.();
      }
      else actions.fermerAppli?.();
      return;
    }
    const projet = evenement.target.closest('[data-projet]');
    if (projet) {
      fermerPage();
      const quoi = projet.dataset.projet;
      if (quoi === 'changer') actions.changerProjet();
      else if (quoi === 'nouveau') actions.nouveauProjet?.();
      else actions.partieProjet?.(quoi);
      return;
    }
    // Une sous-application écrite en petit sur la tuile : on ouvre l'application directement dessus.
    const sous = evenement.target.closest('[data-sous]');
    const tuile = evenement.target.closest('[data-appli]');
    if (tuile) {
      fermerPage();
      actions.ouvrirAppli(tuile.dataset.appli, sous?.dataset.sous ?? null, true);
    }
  }

  function ouvrirPage() {
    actions.avantPage?.();
    pageOuverte = true;
    dessinerPage();
    placerSousEntete(page);
    page.hidden = false;
    document.body.classList.add('page-applis-ouverte');
    mettreAJour();
  }

  function fermerPage() {
    pageOuverte = false;
    page.hidden = true;
    document.body.classList.remove('page-applis-ouverte');
    mettreAJour();
  }

  /** La page commence sous l'en-tête (sa hauteur change avec la barre du récepteur et le mode téléphone). */
  function placerSousEntete(element) {
    const entete = document.querySelector('.entete');
    element.style.top = `${Math.max(0, entete?.getBoundingClientRect().bottom ?? 0)}px`;
  }

  const comptes0 = () => actions.comptes?.() ?? '';

  function dessinerPage() {
    const favoris = lireFavoris();
    const { titre, detail } = actions.projet();
    dernierProjet = JSON.stringify([{ titre, detail }, comptes0()]);
    const courante = actions.courante();
    const comptes = actions.comptes?.() ?? '';
    const nouveau = actions.nouveauProjet
      ? '<button type="button" class="bouton-bandeau-projet nouveau" data-projet="nouveau">+ Nouveau</button>'
      : '';
    const partie = (cle, titre, icone) => `<button type="button" class="bouton-partie-projet" data-projet="${cle}">${svg(icone)}${titre}</button>`;
    const parties = [
      actions.importPermis?.() ? partie('import', 'Import', '<path d="M12 15V3M7 10l5 5 5-5M4 21h16" />') : '',
      partie('export', 'Exporter', '<path d="M12 3v12M7 8l5-5 5 5M4 21h16" />'),
      partie('contenu', 'Contenu du projet', '<circle cx="6" cy="6" r="1.6" /><circle cx="18" cy="6" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="6" cy="18" r="1.6" /><circle cx="18" cy="18" r="1.6" />'),
    ].join('');
    // 0.159.0 : tout ce qui touche au projet dans un seul encadré ; chaque bouton ouvre sa page.
    page.innerHTML = `
      <div class="cadre-projet-applis">
        <div class="bandeau-projet-applis">
          <div class="texte-bandeau-projet">
            <small>Projet en cours</small>
            <b>${echapper(titre)}</b>
            ${detail ? `<span>${echapper(detail)}</span>` : ''}
          </div>
          <div class="boutons-bandeau-projet">
            <button type="button" class="bouton-bandeau-projet" data-projet="changer">Changer</button>
            ${nouveau}
          </div>
        </div>
        <div class="parties-projet-applis">${parties}</div>
        ${comptes ? `<p class="comptes-projet-applis">${echapper(comptes)}</p>` : ''}
      </div>
      <div class="zone-tuiles-applis">
      <h2 class="titre-applis">Applications ${bulle('applications')}</h2>
      <div class="tuiles-applis">
        ${ordonner(actions.applis(), lireOrdre()).map((a) => `
          <div class="tuile-appli ${a.cle === courante ? 'en-cours' : ''}" data-appli="${a.cle}" role="button" tabindex="0"
            style="--couleur-appli: ${a.couleur}; --texte-appli: ${a.texte}">
            ${svg(a.icone)}
            <span class="nom-tuile">${echapper(actions.titre?.(a) ?? a.titre)}</span>
            ${(() => {
              const detail = actions.detailTuile?.(a.cle) ?? '';
              return detail ? `<small class="detail-tuile">${echapper(detail)}</small>` : '';
            })()}
            ${(() => {
              const sous = actions.sousApplisDe?.(a.cle) ?? [];
              return sous.length > 0 ? `<span class="sous-tuile">${sous.map(([c, t]) => `<button type="button" data-sous="${c}">${echapper(t)}</button>`).join('')}</span>` : '';
            })()}
            <button type="button" class="coche-favori ${favoris.includes(a.cle) ? 'coche' : ''}" data-favori="${a.cle}"
              aria-pressed="${favoris.includes(a.cle)}" aria-label="Favori de la roue">★</button>
          </div>`).join('')}
      </div>
      </div>
      <div class="pied-applis">
        ${actions.fermerAppli ? `<button type="button" class="bouton-pied-applis fermer" data-pied="fermer">${svg('<path d="M12 3v9" /><path d="M6.3 7.3a8 8 0 1 0 11.4 0" />')}Fermer l'appli</button>` : ''}
        <button type="button" class="bouton-pied-applis" data-pied="reglages">${svg(ICONE_REGLAGES)}Réglages</button>
      </div>`;
  }

  function ouvrirRoue() {
    const disponibles = actions.applis();
    const favoris = lireFavoris().map((cle) => disponibles.find((a) => a.cle === cle)).filter(Boolean);
    if (favoris.length === 0) {
      actions.message('Aucun favori : coche l\'étoile des applications dans la page Applications.');
      return;
    }
    // Les bulles sont posées en arc de cercle autour du bouton : de la verticale (au-dessus) vers la droite,
    // en s'arrêtant à 15° au-dessus de l'horizontale pour ne pas tomber sur la bande.
    const bouton = nav.querySelector('[data-nav="appli"]').getBoundingClientRect();
    const telephone = document.body.classList.contains('mode-telephone');
    const rayon = telephone ? 150 : 200;
    const x0 = bouton.left + bouton.width / 2;
    const y0 = bouton.top + bouton.height / 2;
    const n = favoris.length;
    roue.innerHTML = favoris.map((a, i) => {
      const angle = (n === 1 ? 50 : 92 - (i * 77) / (n - 1)) * (Math.PI / 180);
      const x = x0 + rayon * Math.cos(angle);
      const y = y0 - rayon * Math.sin(angle);
      return `<button type="button" class="bulle-favori" data-appli="${a.cle}" style="left: ${x}px; top: ${y}px; --couleur-appli: ${a.couleur}; --texte-appli: ${a.texte}">
        ${svg(a.icone)}<span>${echapper(actions.titre?.(a) ?? a.titre)}</span></button>`;
    }).join('');
    roue.hidden = false;
  }

  function fermerRoue() {
    roue.hidden = true;
    roue.innerHTML = '';
  }

  /** Redessine la bande si quelque chose a changé (appelé souvent : comparaison d'une signature). */
  function mettreAJour() {
    // Page ouverte avant que le projet soit chargé (démarrage) : son encadré suit le nom du projet.
    if (pageOuverte && !deplacement) {
      const projet = JSON.stringify([actions.projet(), actions.comptes?.() ?? '']);
      if (projet !== dernierProjet) dessinerPage();
    }
    const courante = pageOuverte ? null : actions.courante();
    const appli = courante ? appliDeCle(courante) : null;
    const sous = appli ? actions.sousApplis() : [];
    if (sous.length === 0) deroulee = false;
    const info = appli ? actions.info() : '';
    // Rien à montrer au milieu : la bande s'efface, seul le bouton reste (la zone de travail s'agrandit).
    const vide = !info && !deroulee;
    document.body.classList.toggle('bande-vide', vide);
    document.body.classList.toggle('bande-action', info.includes('data-nav="action"'));
    const signature = JSON.stringify([courante, sous, info, deroulee, actions.titre?.(appli ?? {}) ?? '']);
    if (signature === derniereSignature) return;
    derniereSignature = signature;
    const active = sous.find((s) => s.actif) ?? null;
    const partieAppli = appli
      ? `<button type="button" class="partie-appli" data-nav="appli" title="Applications (appui long : favoris)">${svg(appli.icone)}<span>${echapper(actions.titre?.(appli) ?? appli.titre)}</span></button>`
      : `<button type="button" class="partie-appli applis" data-nav="appli" title="Revenir">${svg(ICONE_APPLIS)}<span>Applications</span></button>`;
    const partieSous = sous.length > 0
      ? `<button type="button" class="partie-sous ${deroulee ? 'ouverte' : ''}" data-nav="sous" aria-expanded="${deroulee}">
          <span>${echapper(active?.titre ?? 'Choisir')}</span><span class="fleche-sous">${deroulee ? '▸' : '▾'}</span></button>`
      : '';
    const milieu = deroulee
      ? `<div class="choix-sous-appli" role="group">${sous.map((s) => `<button type="button" class="${s.actif ? 'actif' : ''}" data-nav="choix-sous" data-cle="${echapper(s.cle)}">${echapper(s.titre)}</button>`).join('')}</div>`
      : (vide ? '' : `<div class="zone-info-appli">${info}</div>`);
    nav.style.setProperty('--couleur-appli', appli?.couleur ?? '#1b2b36');
    nav.style.setProperty('--texte-appli', appli?.texte ?? '#ffffff');
    nav.classList.toggle('deroulee', deroulee);
    nav.classList.toggle('vide', vide);
    nav.innerHTML = `<div class="bouton-appli ${appli ? '' : 'neutre'}">${partieAppli}${partieSous}</div>${milieu}`;
  }

  return {
    mettreAJour,
    /** Ferme la page Applications et la roue (changement d'onglet venu d'ailleurs). */
    fermer() {
      fermerRoue();
      if (pageOuverte) fermerPage();
    },
    pageOuverte: () => pageOuverte,
    /** Ouvre la page Applications (menu de départ). */
    ouvrirPage() {
      if (!pageOuverte) ouvrirPage();
    },
  };
}
