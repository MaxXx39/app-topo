// Réglages de cet appareil (roue ⚙ de l'en-tête), gardés dans la mémoire du navigateur, jamais
// dans le projet :
// - « Mode téléphone » : textes, icônes et boutons plus petits, libellés plus courts
//   (classe mode-telephone sur la page, voir style.css) ;
// - bulles d'aide (même chose que le bouton « ? ») ;
// - partage par Google Drive (nom de l'appareil, connexion, état), déplacé de l'onglet Projet ;
// - « Fermer l'appli » (appli Android seulement), en rouge tout en haut.
import { echapper } from '../outils/echapper.js';

const CLE = 'topo-reglages';

/** Réglages enregistrés : { telephone: vrai / faux }. */
export function lireReglages() {
  try {
    return { telephone: false, ...JSON.parse(localStorage.getItem(CLE) ?? '{}') };
  } catch {
    return { telephone: false };
  }
}

function ecrireReglages(reglages) {
  try {
    localStorage.setItem(CLE, JSON.stringify(reglages));
  } catch {
    // Mémoire indisponible : le réglage vaut jusqu'à la fermeture de l'appli.
  }
}

/** Applique les réglages à la page (classe mode-telephone). */
export function appliquerReglages(reglages = lireReglages()) {
  document.body.classList.toggle('mode-telephone', Boolean(reglages.telephone));
}

/**
 * Ouvre la fenêtre des réglages. options : { aideActive, basculerAide(), fermerAppli() (ou null
 * hors de l'appli Android), partage: { html() (bloc Partage, voir projet/ecran.js), actions } ou null }.
 * Renvoie { rafraichir() } : redessine le bloc Partage (son état a changé), tant que la fenêtre est ouverte.
 */
export function ouvrirReglages({ aideActive, basculerAide, fermerAppli, partage }) {
  const reglages = lireReglages();
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-reglages';
  fenetre.innerHTML = `
    <form method="dialog">
      ${fermerAppli ? `<button type="button" class="bouton bouton-fermer-appli" data-action="fermer-appli">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8" /><path d="M6.3 6.8a8 8 0 1 0 11.4 0" /></svg>Fermer l'appli</button>` : ''}
      <h2>Réglages de cet appareil</h2>
      <label class="case-reglage"><input type="checkbox" data-reglage="telephone" ${reglages.telephone ? 'checked' : ''} />
        <span><strong>Mode téléphone</strong><span class="aide">textes et boutons plus petits</span></span></label>
      <label class="case-reglage"><input type="checkbox" data-reglage="aide" ${aideActive ? 'checked' : ''} />
        <span><strong>Bulles d'aide « ? »</strong></span></label>
      <div class="partage-reglages" data-zone="partage"></div>
      <div class="ligne-outils">
        <button class="bouton">OK</button>
      </div>
    </form>`;
  const zonePartage = fenetre.querySelector('[data-zone="partage"]');
  // On ne redessine pas pendant qu'on tape le nom de l'appareil (le curseur serait perdu).
  const rafraichir = () => {
    if (!partage || !fenetre.open || zonePartage.contains(document.activeElement)) return;
    zonePartage.innerHTML = partage.html();
  };
  fenetre.addEventListener('change', (evenement) => {
    const champ = evenement.target.dataset.reglage;
    if (champ === 'telephone') {
      reglages.telephone = evenement.target.checked;
      ecrireReglages(reglages);
      appliquerReglages(reglages);
    } else if (champ === 'aide') basculerAide();
    else if (evenement.target.dataset.champ === 'nom-appareil') partage?.actions.nommerAppareil(evenement.target.value.trim());
  });
  fenetre.addEventListener('click', (evenement) => {
    if (evenement.target.closest('[data-action="fermer-appli"]')) {
      fenetre.close();
      fermerAppli();
      return;
    }
    const bouton = evenement.target.closest('[data-zone="partage"] button[data-action]');
    if (bouton) partage?.actions[bouton.dataset.action]?.();
  });
  fenetre.addEventListener('focusout', () => setTimeout(rafraichir, 0));
  fenetre.addEventListener('close', () => fenetre.remove());
  document.body.append(fenetre);
  fenetre.showModal();
  rafraichir();
  return { rafraichir };
}
