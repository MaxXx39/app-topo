// Réglages de cet appareil (roue ⚙ de l'en-tête), gardés dans la mémoire du navigateur, jamais
// dans le projet :
// - « Mode téléphone » : textes, icônes et boutons plus petits, libellés plus courts
//   (classe mode-telephone sur la page, voir style.css) ;
// - bulles d'aide (même chose que le bouton « ? ») ;
// - nom de l'appareil (partage par Google Drive).
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
 * Ouvre la fenêtre des réglages. options : { nomAppareil, nommerAppareil(nom), aideActive,
 * basculerAide() }.
 */
export function ouvrirReglages({ nomAppareil, nommerAppareil, aideActive, basculerAide }) {
  const reglages = lireReglages();
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-reglages';
  fenetre.innerHTML = `
    <form method="dialog">
      <h2>Réglages de cet appareil</h2>
      <label class="case-reglage"><input type="checkbox" data-reglage="telephone" ${reglages.telephone ? 'checked' : ''} />
        <span><strong>Mode téléphone</strong><span class="aide">textes et boutons plus petits</span></span></label>
      <label class="case-reglage"><input type="checkbox" data-reglage="aide" ${aideActive ? 'checked' : ''} />
        <span><strong>Bulles d'aide « ? »</strong></span></label>
      ${nommerAppareil ? `<label class="nom-appareil">Nom de cet appareil (Drive)
        <input type="text" data-reglage="nom" value="${echapper(nomAppareil ?? '')}" placeholder="ex. Tablette Max" /></label>` : ''}
      <div class="ligne-outils"><button class="bouton">Fermer</button></div>
    </form>`;
  fenetre.addEventListener('change', (evenement) => {
    const champ = evenement.target.dataset.reglage;
    if (champ === 'telephone') {
      reglages.telephone = evenement.target.checked;
      ecrireReglages(reglages);
      appliquerReglages(reglages);
    } else if (champ === 'aide') basculerAide();
    else if (champ === 'nom') nommerAppareil(evenement.target.value.trim());
  });
  fenetre.addEventListener('close', () => fenetre.remove());
  document.body.append(fenetre);
  fenetre.showModal();
}
