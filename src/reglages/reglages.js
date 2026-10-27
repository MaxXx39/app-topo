// Réglages de cet appareil (roue ⚙ de l'en-tête), gardés dans la mémoire du navigateur, jamais
// dans le projet :
// - « Mode téléphone » : textes, icônes et boutons plus petits, libellés plus courts
//   (classe mode-telephone sur la page, voir style.css) ;
// - mode « Base » ou « Confirmé » (demande du 26.10.2026) : en Base, les fonctions avancées sont
//   cachées (classe mode-base sur la page ; éléments .seulement-confirme, voir style.css ; et
//   estModeBase() dans le code). Rien n'est supprimé du projet. Confirmé par défaut ;
// - bulles d'aide (même chose que le bouton « ? ») ;
// - partage par Google Drive (nom de l'appareil, connexion, état), déplacé de l'onglet Projet ;
// - « Prise de main protégée » (0.67.0, changée avec le code de sécurité) : quand cet appareil a
//   la main sur un projet, un autre appareil doit taper le code de sécurité pour la lui prendre ;
// - « Onglet Lame » (Confirmé, 0.74.0) : montre le mode Lame de l'onglet Terrain et la connexion
//   d'un 2e récepteur dans la fenêtre du récepteur ; décoché (par défaut) : un seul récepteur ;
// - « Fermer l'appli » (appli Android seulement), en rouge tout en haut.
import { echapper } from '../outils/echapper.js';
import { demanderCode } from '../outils/code.js';

const CLE = 'topo-reglages';
// Étoile à 5 branches (en-tête et choix du mode).
export const ETOILE = 'M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z';
const PAR_DEFAUT = { telephone: false, mode: 'confirme', priseProtegee: false, lame: false };
// Mode retenu (relu une fois, puis gardé ici) : estModeBase() est appelé très souvent par le plan.
let modeRetenu = null;

/** Réglages enregistrés : { telephone: vrai / faux, mode: 'base' ou 'confirme', priseProtegee: vrai / faux }. */
export function lireReglages() {
  try {
    return { ...PAR_DEFAUT, ...JSON.parse(localStorage.getItem(CLE) ?? '{}') };
  } catch {
    return { ...PAR_DEFAUT };
  }
}

/** Vrai en mode Base (fonctions avancées cachées), faux en mode Confirmé. */
export function estModeBase() {
  if (modeRetenu == null) modeRetenu = lireReglages().mode;
  return modeRetenu === 'base';
}

/** Vrai si le guidage de lame (et le 2e récepteur) est montré : mode Confirmé et case « Onglet Lame » cochée. */
export function lameActive() {
  return !estModeBase() && Boolean(lireReglages().lame);
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
 * Applique les réglages à la page : classes mode-telephone et mode-base, étoile de l'en-tête
 * (☆ vide = Base, ★ pleine = Confirmé).
 */
export function appliquerReglages(reglages = lireReglages()) {
  modeRetenu = reglages.mode;
  const base = reglages.mode === 'base';
  document.body.classList.toggle('mode-telephone', Boolean(reglages.telephone));
  document.body.classList.toggle('mode-base', base);
  const etoile = document.querySelector('#bouton-mode');
  if (etoile) {
    etoile.classList.toggle('confirme', !base);
    const texte = `Mode ${base ? 'Base' : 'Confirmé'} (toucher pour changer)`;
    etoile.title = texte;
    etoile.setAttribute('aria-label', texte);
  }
}

/**
 * Ouvre la fenêtre des réglages. options : { aideActive, basculerAide(), fermerAppli() (ou null
 * hors de l'appli Android), partage: { html() (bloc Partage, voir projet/ecran.js), actions } ou null,
 * changerMode() : appelé après le passage Base ↔ Confirmé (pour redessiner les écrans) }.
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
        ${[['base', 'Base'], ['confirme', 'Confirmé']].map(([cle, titre]) => `<label class="puce-mode ${reglages.mode === cle ? 'actif' : ''}">
          <input type="radio" name="mode-appli" data-reglage="mode" value="${cle}" ${reglages.mode === cle ? 'checked' : ''} />
          <svg viewBox="0 0 24 24" aria-hidden="true" class="etoile-mode ${cle}"><path d="${ETOILE}" /></svg>${titre}</label>`).join('')}
      </div>
      <label class="case-reglage"><input type="checkbox" data-reglage="telephone" ${reglages.telephone ? 'checked' : ''} />
        <span><strong>Mode téléphone</strong><span class="aide">textes et boutons plus petits</span></span></label>
      <label class="case-reglage"><input type="checkbox" data-reglage="aide" ${aideActive ? 'checked' : ''} />
        <span><strong>Bulles d'aide « ? »</strong></span></label>
      <label class="case-reglage seulement-confirme"><input type="checkbox" data-reglage="lame" ${reglages.lame ? 'checked' : ''} />
        <span><strong>Onglet Lame</strong><span class="aide">guidage de lame, 2e récepteur</span></span></label>
      <div class="partage-reglages" data-zone="partage"></div>
      ${partage ? `<label class="case-reglage"><input type="checkbox" data-reglage="priseProtegee" ${reglages.priseProtegee ? 'checked' : ''} />
        <span><strong>Prise de main protégée</strong><span class="aide">code de sécurité demandé aux autres appareils</span></span></label>` : ''}
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
    if (champ === 'mode') {
      reglages.mode = evenement.target.value;
      ecrireReglages(reglages);
      appliquerReglages(reglages);
      for (const puce of fenetre.querySelectorAll('.puce-mode')) puce.classList.toggle('actif', puce.contains(evenement.target));
      changerMode?.();
    } else if (champ === 'telephone') {
      reglages.telephone = evenement.target.checked;
      ecrireReglages(reglages);
      appliquerReglages(reglages);
    } else if (champ === 'lame') {
      reglages.lame = evenement.target.checked;
      ecrireReglages(reglages);
      changerMode?.();
    } else if (champ === 'priseProtegee') changerPriseProtegee(evenement.target);
    else if (champ === 'aide') basculerAide();
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
    const bouton = evenement.target.closest('[data-zone="partage"] button[data-action]');
    if (bouton?.dataset.action === 'modifierNomAppareil') modifierNomProtege();
    else if (bouton) partage?.actions[bouton.dataset.action]?.();
  });
  /** « Prise de main protégée » : changée seulement avec le code de sécurité (une fois par ouverture). */
  async function changerPriseProtegee(caseACocher) {
    const voulu = caseACocher.checked;
    caseACocher.checked = !voulu; // tant que le code n'est pas bon, rien ne change
    if (!deverrouille && !(await demanderCode('Prise de main protégée'))) return;
    deverrouille = true;
    caseACocher.checked = voulu;
    reglages.priseProtegee = voulu;
    ecrireReglages(reglages);
    partage?.actions.priseProtegeeChangee?.();
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
