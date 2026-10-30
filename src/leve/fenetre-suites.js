// Fenêtre « Lignes depuis les suites de points » (Terrain › Lever, 0.95.0, demande du 29.10.2026) :
// les suites trouvées (b1 → b5…), toutes cochées ; « Créer les lignes de rupture », et dans un stock
// sans contour « Créer le contour » (une seule suite cochée, d'au moins 3 points).
import { echapper } from '../outils/echapper.js';

/** suites : [[noms]] ; stock : vrai si le contour peut être créé ; creer(suites choisies, 'ligne' ou 'contour'). */
export function ouvrirFenetreSuites({ suites, stock = false, creer }) {
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-choix fenetre-suites';
  fenetre.innerHTML = `
    <h2>Lignes depuis les suites de points</h2>
    <div class="liste-suites">
      ${suites.map((suite, i) => `<label class="case"><input type="checkbox" data-suite="${i}" checked />
        <strong>${echapper(suite[0])} → ${echapper(suite.at(-1))}</strong> <span class="aide">${suite.length} points</span></label>`).join('')}
    </div>
    <p class="erreur" data-vivant="erreur-suites" hidden></p>
    <div class="boutons-choix">
      <button type="button" class="bouton" data-cle="ligne"><strong>Créer les lignes de rupture</strong></button>
      ${stock ? '<button type="button" class="bouton-secondaire" data-cle="contour"><strong>Créer le contour</strong></button>' : ''}
      <button type="button" class="bouton-secondaire" data-cle="annuler"><strong>Annuler</strong></button>
    </div>`;
  fenetre.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-cle]');
    if (!bouton) return;
    const cle = bouton.dataset.cle;
    if (cle === 'annuler') {
      fenetre.close();
      return;
    }
    const choisies = [...fenetre.querySelectorAll('[data-suite]:checked')].map((c) => suites[Number(c.dataset.suite)]);
    const erreur = fenetre.querySelector('[data-vivant="erreur-suites"]');
    const message = choisies.length === 0
      ? 'Coche au moins une suite'
      : cle === 'contour' && (choisies.length !== 1 || choisies[0].length < 3) ? 'Contour : coche une seule suite, d\'au moins 3 points' : '';
    if (message) {
      erreur.textContent = message;
      erreur.hidden = false;
      return;
    }
    fenetre.close();
    creer(choisies, cle);
  });
  fenetre.addEventListener('close', () => fenetre.remove());
  document.body.append(fenetre);
  fenetre.showModal();
}
