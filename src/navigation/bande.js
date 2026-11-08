// Bande du bas (0.156.0, demande du 08.11 ; maquette « A » sombre et Menu 1 en tuiles validés) :
// - à gauche, un bouton en 2 parties : l'application en cours (sa couleur, son icône, son nom) et
//   la sous-application (Point, Ligne… d'Implanter ; Contour, Ligne… de Lever ; Volumes… de Calculs) ;
// - toucher l'application ouvre la page « Applications » (bandeau du projet, puis les tuiles) ;
// - toucher la sous-application déroule la bande : on choisit une autre sous-application ;
// - appui long sur l'application : la roue des favoris (5 au plus, cochés sur les tuiles, par tablette) ;
// - au milieu, une zone d'infos propre à chaque application (à définir sous-application par sous-application).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { appliDeCle, lireFavoris, ecrireFavoris, basculerFavori, MAX_FAVORIS } from './applis.js';

const DUREE_APPUI_LONG = 500; // ms avant que la roue des favoris s'ouvre
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
 * - pageProjet(), changerProjet(), nouveauProjet() (ou null si le mode ne le permet pas) ;
 * - message(texte) : message court à l'écran ; vibrer() (facultatif).
 * Renvoie { mettreAJour(), fermer() }.
 */
export function creerNavigation(nav, actions) {
  let pageOuverte = false;
  let deroulee = false;
  let derniereSignature = '';
  let minuterie = null;
  let appuiLongFait = false;

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
    minuterie = setTimeout(() => {
      appuiLongFait = true;
      actions.vibrer?.();
      ouvrirRoue();
    }, DUREE_APPUI_LONG);
  });
  for (const fin of ['pointerup', 'pointercancel', 'pointerleave']) nav.addEventListener(fin, () => clearTimeout(minuterie));
  page.addEventListener('click', quandClicPage);
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
    }
  }

  function quandClicPage(evenement) {
    const favori = evenement.target.closest('[data-favori]');
    if (favori) {
      evenement.stopPropagation();
      const { liste, refuse } = basculerFavori(lireFavoris(), favori.dataset.favori);
      if (refuse) actions.message(`${MAX_FAVORIS} favoris au plus : décoche d'abord une autre application.`);
      else ecrireFavoris(liste);
      dessinerPage();
      return;
    }
    const projet = evenement.target.closest('[data-projet]');
    if (projet) {
      fermerPage();
      const quoi = projet.dataset.projet;
      if (quoi === 'page') actions.pageProjet();
      else if (quoi === 'changer') actions.changerProjet();
      else if (quoi === 'nouveau') actions.nouveauProjet?.();
      return;
    }
    const tuile = evenement.target.closest('[data-appli]');
    if (tuile) {
      fermerPage();
      actions.ouvrirAppli(tuile.dataset.appli);
    }
  }

  function ouvrirPage() {
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

  function dessinerPage() {
    const favoris = lireFavoris();
    const { titre, detail } = actions.projet();
    const courante = actions.courante();
    const nouveau = actions.nouveauProjet
      ? '<button type="button" class="bouton-bandeau-projet nouveau" data-projet="nouveau">+ Nouveau</button>'
      : '';
    page.innerHTML = `
      <div class="bandeau-projet-applis">
        <button type="button" class="texte-bandeau-projet" data-projet="page">
          <small>Projet en cours</small>
          <b>${echapper(titre)}</b>
          <span>${echapper(detail)}</span>
        </button>
        <div class="boutons-bandeau-projet">
          <button type="button" class="bouton-bandeau-projet" data-projet="changer">Changer</button>
          ${nouveau}
        </div>
      </div>
      <h2 class="titre-applis">Applications ${bulle('applications')}</h2>
      <div class="tuiles-applis">
        ${actions.applis().map((a) => `
          <div class="tuile-appli ${a.cle === courante ? 'en-cours' : ''}" data-appli="${a.cle}" role="button" tabindex="0"
            style="--couleur-appli: ${a.couleur}; --texte-appli: ${a.texte}">
            ${svg(a.icone)}
            <span class="nom-tuile">${echapper(actions.titre?.(a) ?? a.titre)}</span>
            <button type="button" class="coche-favori ${favoris.includes(a.cle) ? 'coche' : ''}" data-favori="${a.cle}"
              aria-pressed="${favoris.includes(a.cle)}" aria-label="Favori de la roue">★</button>
          </div>`).join('')}
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
    const courante = pageOuverte ? null : actions.courante();
    const appli = courante ? appliDeCle(courante) : null;
    const sous = appli ? actions.sousApplis() : [];
    if (sous.length === 0) deroulee = false;
    const info = appli ? actions.info() : '';
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
      : `<div class="zone-info-appli">${info}</div>`;
    nav.style.setProperty('--couleur-appli', appli?.couleur ?? '#1b2b36');
    nav.style.setProperty('--texte-appli', appli?.texte ?? '#ffffff');
    nav.classList.toggle('deroulee', deroulee);
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
  };
}
