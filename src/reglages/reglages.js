// Réglages de cet appareil (roue ⚙ de l'en-tête), gardés dans la mémoire du navigateur, jamais
// dans le projet :
// - « Mode téléphone » : textes, icônes et boutons plus petits, libellés plus courts
//   (classe mode-telephone sur la page, voir style.css) ;
// - mode « Base », « Intermédiaire » ou « Expert » (demande du 28.10.2026, tableau
//   docs/modes-base-intermediaire-expert.xlsx) : les fonctions avancées sont cachées selon le mode
//   (classe mode-base / mode-intermediaire / mode-expert sur la page ; éléments .seulement-intermediaire
//   et .seulement-expert, voir style.css ; et estModeBase() / aAcces() dans le code). Rien n'est
//   supprimé du projet. Intermédiaire par défaut ; l'ancien « Confirmé » devient « Expert » ;
// - bulles d'aide (même chose que le bouton « ? ») ;
// - partage par Google Drive (nom de l'appareil, connexion, état), déplacé de l'onglet Projet ;
// - Lame et 2e récepteur : toujours montrés en Expert (plus de case « Onglet Lame », 0.85.0) ;
// - « Listes partagées » (0.79.0, code de sécurité) : adresses mail et réglages swipos, pour tous
//   les appareils (voir listes-partagees.js) ;
// - « Fermer l'appli » (appli Android seulement), en rouge tout en haut.
import { echapper } from '../outils/echapper.js';
import { demanderCode } from '../outils/code.js';
import { lireListesPartagees } from './listes-partagees.js';
import { modifierLibellesDeSorte, modifierReseaux } from '../leve/fenetre-libelles.js';
import { ouvrirFenetreListes } from './fenetre-listes.js';

const CLE = 'topo-reglages';
const PAR_DEFAUT = { telephone: false, mode: 'intermediaire' };
// Les trois modes, du plus simple au plus complet (le rang sert à comparer : aAcces).
export const MODES = [['base', 'Base'], ['intermediaire', 'Intermédiaire'], ['expert', 'Expert']];
// Mode retenu (relu une fois, puis gardé ici) : estModeBase() est appelé très souvent par le plan.
let modeRetenu = null;

/** Mode connu : l'ancien « Confirmé » (réglages d'avant 0.85.0) devient « Expert ». */
function modeValide(mode) {
  if (mode === 'confirme') return 'expert';
  return MODES.some(([cle]) => cle === mode) ? mode : PAR_DEFAUT.mode;
}

/** Réglages enregistrés : { telephone: vrai / faux, mode: 'base', 'intermediaire' ou 'expert' }. */
export function lireReglages() {
  try {
    const reglages = { ...PAR_DEFAUT, ...JSON.parse(localStorage.getItem(CLE) ?? '{}') };
    reglages.mode = modeValide(reglages.mode);
    return reglages;
  } catch {
    return { ...PAR_DEFAUT };
  }
}

/** Mode de l'appareil : 'base', 'intermediaire' ou 'expert'. */
export function modeAppli() {
  if (modeRetenu == null) modeRetenu = lireReglages().mode;
  return modeRetenu;
}

/** Vrai si le mode de l'appareil est au moins `minimum` (ex. aAcces('intermediaire') : faux en Base). */
export function aAcces(minimum) {
  const rang = (cle) => MODES.findIndex(([c]) => c === cle);
  return rang(modeAppli()) >= rang(minimum);
}

/** Vrai en mode Base (fonctions avancées cachées). */
export function estModeBase() {
  return modeAppli() === 'base';
}

/** Vrai si le guidage de lame (et le 2e récepteur) est montré : mode Expert. */
export function lameActive() {
  return aAcces('expert');
}

// Logo du mode : une pyramide en 3 paliers (0.87.0). Palier du bas vert, du milieu jaune, pointe
// rouge. Base = le palier vert seul allumé, Intermédiaire = vert + jaune, Expert = les 3 ; les paliers
// pas atteints sont gris.
const PALIERS_MODE = [
  { couleur: '#16a34a', haut: 15.5, bas: 21 }, // vert (le bas)
  { couleur: '#eab308', haut: 9.5, bas: 14.5 }, // jaune
  { couleur: '#dc2626', haut: 3, bas: 8.5 }, // rouge (la pointe)
];
export function barresDuMode(mode) {
  const allumes = MODES.findIndex(([cle]) => cle === mode) + 1;
  const largeur = (y) => ((y - 3) * 10) / 18; // demi-largeur de la pyramide à la hauteur y
  const paliers = PALIERS_MODE.map(({ couleur, haut, bas }, i) => {
    const points = [[12 - largeur(haut), haut], [12 + largeur(haut), haut], [12 + largeur(bas), bas], [12 - largeur(bas), bas]]
      .map(([x, y]) => `${x.toFixed(2)},${y}`).join(' ');
    return `<polygon points="${points}" fill="${i < allumes ? couleur : '#9aa5ad'}" opacity="${i < allumes ? 1 : 0.5}" />`;
  });
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="barres-mode barres-${mode}">${paliers.join('')}</svg>`;
}

function ecrireReglages(reglages) {
  modeRetenu = reglages.mode;
  try {
    localStorage.setItem(CLE, JSON.stringify(reglages));
  } catch {
    // Mémoire indisponible : le réglage vaut jusqu'à la fermeture de l'appli.
  }
}

/**
 * Applique les réglages à la page : classes mode-telephone et mode-base / mode-intermediaire /
 * mode-expert, pyramide du mode dans l'en-tête.
 */
export function appliquerReglages(reglages = lireReglages()) {
  modeRetenu = modeValide(reglages.mode);
  document.body.classList.toggle('mode-telephone', Boolean(reglages.telephone));
  for (const [cle] of MODES) document.body.classList.toggle(`mode-${cle}`, cle === modeRetenu);
  const bouton = document.querySelector('#bouton-mode');
  if (bouton) {
    bouton.innerHTML = barresDuMode(modeRetenu);
    const texte = `Mode ${MODES.find(([cle]) => cle === modeRetenu)[1]} (toucher pour changer)`;
    bouton.title = texte;
    bouton.setAttribute('aria-label', texte);
  }
}

/** « 2 adresse(s) mail · 1 réglage(s) swipos » (listes partagées). */
function compteListes() {
  const { adresses, swipos } = lireListesPartagees();
  return `${adresses.length} adresse(s) mail · ${swipos.length} réglage(s) swipos`;
}

/**
 * Ouvre la fenêtre des réglages. options : { aideActive, basculerAide(), fermerAppli() (ou null
 * hors de l'appli Android), partage: { html() (bloc Partage, voir projet/ecran.js), actions } ou null,
 * changerMode() : appelé après un changement de mode (pour redessiner les écrans) }.
 * Renvoie { rafraichir() } : redessine le bloc Partage (son état a changé), tant que la fenêtre est ouverte.
 */
export function ouvrirReglages({ aideActive, basculerAide, fermerAppli, partage, changerMode }) {
  const reglages = lireReglages();
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-reglages';
  fenetre.innerHTML = `
    <form method="dialog">
      ${fermerAppli ? `<button type="button" class="bouton bouton-fermer-appli" data-action="fermer-appli">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8" /><path d="M6.3 6.8a8 8 0 1 0 11.4 0" /></svg>Fermer l'appli</button>` : ''}
      <h2>Réglages de cet appareil</h2>
      <div class="choix-mode-appli" role="radiogroup" aria-label="Mode de l'appli">
        ${MODES.map(([cle, titre]) => `<label class="puce-mode ${reglages.mode === cle ? 'actif' : ''}">
          <input type="radio" name="mode-appli" data-reglage="mode" value="${cle}" ${reglages.mode === cle ? 'checked' : ''} />
          ${barresDuMode(cle)}${titre}</label>`).join('')}
      </div>
      <label class="case-reglage"><input type="checkbox" data-reglage="telephone" ${reglages.telephone ? 'checked' : ''} />
        <span><strong>Mode téléphone</strong><span class="aide">textes et boutons plus petits</span></span></label>
      <label class="case-reglage"><input type="checkbox" data-reglage="aide" ${aideActive ? 'checked' : ''} />
        <span><strong>Bulles d'aide « ? »</strong></span></label>
      <div class="case-reglage listes-reglages seulement-expert">
        <span><strong>Libellés des points</strong><span class="aide">partagés par Drive</span></span>
        <span class="boutons-libelles">
          <button type="button" class="bouton-secondaire" data-action="libelles" data-valeur="lignes">Lignes</button>
          <button type="button" class="bouton-secondaire" data-action="libelles" data-valeur="points">Points</button>
          <button type="button" class="bouton-secondaire" data-action="libelles" data-valeur="aires">Aires</button>
        </span>
      </div>
      <div class="case-reglage listes-reglages seulement-expert">
        <span><strong>Réseaux du recollement</strong><span class="aide">partagés par Drive</span></span>
        <span class="boutons-libelles">
          <button type="button" class="bouton-secondaire" data-action="reseaux">Réseaux</button>
        </span>
      </div>
      <div class="case-reglage listes-reglages seulement-intermediaire">
        <span><strong>Listes partagées</strong><span class="aide" data-zone="compte-listes">${compteListes()}</span></span>
        <button type="button" class="bouton-secondaire" data-action="listes">Modifier</button>
      </div>
      <div class="partage-reglages" data-zone="partage"></div>
      <div class="ligne-outils">
        <button class="bouton">OK</button>
      </div>
    </form>`;
  const zonePartage = fenetre.querySelector('[data-zone="partage"]');
  let modifierNom = false; // crayon touché : le nom de l'appareil devient modifiable
  let deverrouille = false; // bon code tapé (voir outils/code.js) : vaut jusqu'à la fermeture de la fenêtre
  // On ne redessine pas pendant qu'on tape le nom de l'appareil (le curseur serait perdu).
  const rafraichir = () => {
    if (!partage || !fenetre.open || zonePartage.contains(document.activeElement)) return;
    zonePartage.innerHTML = partage.html({ modifierNom });
  };
  fenetre.addEventListener('change', (evenement) => {
    const champ = evenement.target.dataset.reglage;
    if (champ === 'mode') changerModeProtege(evenement.target);
    else if (champ === 'telephone') {
      reglages.telephone = evenement.target.checked;
      ecrireReglages(reglages);
      appliquerReglages(reglages);
    } else if (champ === 'aide') basculerAide();
    else if (evenement.target.dataset.champ === 'nom-appareil') {
      modifierNom = false;
      partage?.actions.nommerAppareil(evenement.target.value.trim());
    }
  });
  fenetre.addEventListener('click', (evenement) => {
    if (evenement.target.closest('[data-action="fermer-appli"]')) {
      fenetre.close();
      fermerAppli();
      return;
    }
    if (evenement.target.closest('[data-action="listes"]')) {
      modifierListes();
      return;
    }
    if (evenement.target.closest('[data-action="reseaux"]')) {
      modifierReseaux(() => changerMode?.());
      return;
    }
    const libelles = evenement.target.closest('[data-action="libelles"]');
    if (libelles) {
      modifierLibelles(libelles.dataset.valeur);
      return;
    }
    const bouton = evenement.target.closest('[data-zone="partage"] button[data-action]');
    if (bouton?.dataset.action === 'modifierNomAppareil') modifierNomProtege();
    else if (bouton) partage?.actions[bouton.dataset.action]?.();
  });
  /** Mode choisi : monter en Expert demande le code de sécurité (0.90.0) ; descendre, non. */
  async function changerModeProtege(choix) {
    if (choix.value === 'expert' && reglages.mode !== 'expert' && !deverrouille) {
      if (!(await demanderCode('Passer en mode Expert'))) {
        for (const radio of fenetre.querySelectorAll('[data-reglage="mode"]')) radio.checked = radio.value === reglages.mode;
        return;
      }
      deverrouille = true;
    }
    reglages.mode = choix.value;
    ecrireReglages(reglages);
    appliquerReglages(reglages);
    for (const puce of fenetre.querySelectorAll('.puce-mode')) puce.classList.toggle('actif', puce.contains(choix));
    changerMode?.();
  }

  /** Listes partagées (adresses mail, réglages swipos) : protégées par le code de sécurité. */
  async function modifierListes() {
    if (!deverrouille && !(await demanderCode('Listes partagées'))) return;
    deverrouille = true;
    ouvrirFenetreListes(() => {
      const zone = fenetre.querySelector('[data-zone="compte-listes"]');
      if (zone) zone.textContent = compteListes();
    });
  }

  /**
   * Libellés des points (0.95.0, Expert) : ceux de départ ne se modifient pas (leur couleur oui),
   * ceux ajoutés oui ; enregistrés dans les listes partagées (Drive).
   */
  function modifierLibelles(sorte) {
    modifierLibellesDeSorte(sorte, () => changerMode?.());
  }

  /** Crayon du nom de l'appareil : protégé par le code (demandé une fois par ouverture de la fenêtre). */
  async function modifierNomProtege() {
    if (!deverrouille && !(await demanderCode('Modifier le nom de l\'appareil'))) return;
    deverrouille = true;
    modifierNom = true;
    zonePartage.innerHTML = partage.html({ modifierNom });
    zonePartage.querySelector('[data-champ="nom-appareil"]')?.focus();
  }
  fenetre.addEventListener('focusout', () => setTimeout(rafraichir, 0));
  fenetre.addEventListener('close', () => fenetre.remove());
  document.body.append(fenetre);
  fenetre.showModal();
  rafraichir();
  return { rafraichir };
}
