// Fenêtre « Exporter » (0.79.0, demande du 27.10.2026 : l'ancienne barre « Envoyer » n'était pas
// pratique) : une seule fenêtre pour tous les exports. On choisit le format s'il y en a plusieurs
// (liste de points : TXT, CSV, DXF), puis :
// - « Enregistrer » : téléchargé (site) ou enregistré sur la tablette (APK) ;
// - « Envoyer par mail » : à une adresse de la liste partagée (réglages ⚙) ;
// - « Envoyer autrement » : le partage de l'appareil (WhatsApp, Drive…).
import { echapper } from '../outils/echapper.js';
import { envoyerParMail, partagerFichier } from './partager.js';
import { lireListesPartagees } from '../reglages/listes-partagees.js';

// Adresse choisie la dernière fois (pendant que l'appli est ouverte).
let derniereAdresse = null;

/**
 * Ouvre la fenêtre. titre : ce qu'on exporte ; formats : [[cle, titre, detail]] ou null ;
 * fabriquer(format) : { blob, nom } (le fichier) ; enregistrer(blob, nom) : téléchargement ;
 * message(texte) : petit message à l'écran.
 */
export function ouvrirFenetreExport({ titre, formats = null, fabriquer, enregistrer, message }) {
  const adresses = lireListesPartagees().adresses;
  let format = formats?.[0]?.[0] ?? null;
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-choix fenetre-export';
  fenetre.innerHTML = `
    <div class="entete-fenetre-champs">
      <h2>Exporter « ${echapper(titre)} »</h2>
      <button type="button" class="bouton-retour" data-cle="fermer" title="Fermer" aria-label="Fermer">✕</button>
    </div>
    ${formats ? `<div class="formats-export" role="radiogroup" aria-label="Format">
        ${formats.map(([cle, nom, detail]) => `<label class="puce-format ${cle === format ? 'actif' : ''}">
          <input type="radio" name="format-export" value="${cle}" ${cle === format ? 'checked' : ''} /><strong>${nom}</strong><span>${echapper(detail ?? '')}</span></label>`).join('')}
      </div>` : ''}
    <div class="boutons-choix">
      <button type="button" class="bouton" data-cle="enregistrer"><strong>Enregistrer</strong><span>sur cet appareil</span></button>
      <div class="envoi-mail">
        ${adresses.length > 0
          ? `<select data-champ="adresse" aria-label="Adresse mail">${adresses.map((a) => `<option ${a === derniereAdresse ? 'selected' : ''}>${echapper(a)}</option>`).join('')}</select>`
          : '<p class="aide">Aucune adresse : réglages ⚙ › Listes partagées.</p>'}
        <button type="button" class="bouton-secondaire" data-cle="mail" ${adresses.length > 0 ? '' : 'disabled'}><strong>Envoyer par mail</strong></button>
      </div>
      <button type="button" class="bouton-secondaire" data-cle="partager"><strong>Envoyer autrement</strong><span>WhatsApp, Drive…</span></button>
    </div>`;
  fenetre.addEventListener('change', (evenement) => {
    if (evenement.target.name !== 'format-export') return;
    format = evenement.target.value;
    for (const puce of fenetre.querySelectorAll('.puce-format')) puce.classList.toggle('actif', puce.contains(evenement.target));
  });
  fenetre.addEventListener('click', async (evenement) => {
    const bouton = evenement.target.closest('button[data-cle]');
    if (!bouton) return;
    const cle = bouton.dataset.cle;
    if (cle === 'fermer') {
      fenetre.close();
      return;
    }
    const { blob, nom } = await fabriquer(format);
    if (cle === 'enregistrer') {
      enregistrer(blob, nom);
      message(`« ${nom} » enregistré`);
    } else if (cle === 'mail') {
      derniereAdresse = fenetre.querySelector('[data-champ="adresse"]')?.value ?? null;
      const probleme = await envoyerParMail(blob, nom, derniereAdresse, enregistrer);
      if (probleme) message(probleme);
    } else if (cle === 'partager') {
      const probleme = await partagerFichier(blob, nom);
      if (probleme) message(probleme);
    }
    fenetre.close();
  });
  fenetre.addEventListener('close', () => fenetre.remove());
  document.body.append(fenetre);
  fenetre.showModal();
}
