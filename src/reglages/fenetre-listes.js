// Fenêtre « Listes partagées » (réglages ⚙, après le code de sécurité, 0.79.0) : les adresses mail
// (une par ligne) et les réglages swipos (utilisateur, serveur, port, point de montage, mot de
// passe). « Enregistrer » les garde sur cet appareil et les envoie sur Drive (tous les appareils).
import { echapper } from '../outils/echapper.js';
import { lireListesPartagees, ecrireListesPartagees, estAdresseMail } from './listes-partagees.js';

const CHAMPS_SWIPOS = [
  ['utilisateur', 'Utilisateur', 'text'],
  ['hote', 'Serveur', 'text'],
  ['port', 'Port', 'text'],
  ['pointDeMontage', 'Point de montage', 'text'],
  ['motDePasse', 'Mot de passe', 'password'],
];

/** Ouvre la fenêtre. quandEnregistre() : appelé après « Enregistrer ». */
export function ouvrirFenetreListes(quandEnregistre = () => {}) {
  const listes = lireListesPartagees();
  let adresses = listes.adresses.join('\n');
  let swipos = listes.swipos.map((s) => ({ ...s }));
  let erreur = '';
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-choix fenetre-listes';

  /** Relit les cases (avant de redessiner, pour ne rien perdre de ce qui est tapé). */
  function lire() {
    adresses = fenetre.querySelector('[data-champ="adresses"]')?.value ?? adresses;
    swipos = [...fenetre.querySelectorAll('.reglage-swipos')].map((bloc, i) => ({
      ...swipos[i],
      ...Object.fromEntries(CHAMPS_SWIPOS.map(([cle]) => [cle, bloc.querySelector(`[data-swipos="${cle}"]`).value])),
    }));
  }

  function dessiner() {
    fenetre.innerHTML = `
      <div class="entete-fenetre-champs">
        <h2>Listes partagées</h2>
        <button type="button" class="bouton-retour" data-action="fermer" title="Fermer" aria-label="Fermer">✕</button>
      </div>
      <p class="titre-choix">Adresses mail (une par ligne)</p>
      <textarea data-champ="adresses" rows="4" placeholder="ex. bureau@geometre.ch" autocapitalize="off" spellcheck="false">${echapper(adresses)}</textarea>
      <p class="titre-choix">Réglages swipos</p>
      ${swipos.map((s, i) => `<div class="reglage-swipos">
          ${CHAMPS_SWIPOS.map(([cle, titre, type]) => `<label>${titre}<input type="${type}" data-swipos="${cle}" value="${echapper(String(s[cle] ?? ''))}" autocapitalize="off" spellcheck="false" autocomplete="off" ${cle === 'port' ? 'inputmode="numeric" placeholder="2101"' : ''} /></label>`).join('')}
          <button type="button" class="bouton-lien" data-action="supprimer" data-index="${i}">supprimer ce réglage</button>
        </div>`).join('')}
      <div class="ligne-outils"><button type="button" class="bouton-secondaire" data-action="ajouter">+ Ajouter un réglage swipos</button></div>
      ${erreur ? `<p class="erreur">${echapper(erreur)}</p>` : ''}
      <div class="boutons-choix"><button type="button" class="bouton" data-action="enregistrer"><strong>Enregistrer</strong><span>sur tous les appareils (Drive)</span></button></div>`;
  }

  fenetre.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const action = bouton.dataset.action;
    if (action === 'fermer') {
      fenetre.close();
      return;
    }
    lire();
    if (action === 'ajouter') swipos.push({ utilisateur: '', hote: '', port: 2101, pointDeMontage: '', motDePasse: '' });
    else if (action === 'supprimer') swipos.splice(Number(bouton.dataset.index), 1);
    else if (action === 'enregistrer') {
      const lignes = adresses.split(/[\n,;]+/).map((a) => a.trim()).filter(Boolean);
      const mauvaises = lignes.filter((a) => !estAdresseMail(a));
      const incomplets = swipos.filter((s) => !String(s.hote).trim() || !String(s.utilisateur).trim()).length;
      erreur = mauvaises.length > 0
        ? `Adresse illisible : ${mauvaises.join(', ')}`
        : incomplets > 0 ? `${incomplets} réglage(s) swipos sans serveur ou sans utilisateur` : '';
      if (!erreur) {
        ecrireListesPartagees({ adresses: lignes, swipos });
        fenetre.close();
        quandEnregistre();
        return;
      }
    }
    dessiner();
  });
  fenetre.addEventListener('close', () => fenetre.remove());
  dessiner();
  document.body.append(fenetre);
  fenetre.showModal();
}
