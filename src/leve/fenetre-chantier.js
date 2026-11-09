// Fenêtre de la bibliothèque du Levé chantier (0.175.0, Expert) : libellés (nom, abréviation, couleur, forme, réseau ou
// bordure, ouvrage, mode d'altitude, champs demandés), ordre, et les deux listes de natures. Enregistrée dans les listes
// partagées (Drive) : valable sur toutes les tablettes.
import { echapper } from '../outils/echapper.js';
import { lireLibellesChantier, lireNaturesChantier, enregistrerBibliothequeChantier } from './libelles-chantier.js';
import { LIBELLES_CHANTIER_DEPART, NATURES_RESEAU_DEPART, NATURES_BORDURE_DEPART } from '../topo/chantier.js';

const FORMES = [['rond', '● rond'], ['carre', '■ carré'], ['triangle', '▲ triangle'], ['losange', '◆ losange']];
const MODES = [['', 'aucun'], ['dessus,fe', 'Dessus / Fil d\'eau'], ['tampon,fe', 'Tampon / Fil d\'eau']];
const CHAMPS = [['diametre', 'Ø'], ['profondeur', 'Prof.'], ['materiau', 'Matér.'], ['remarque', 'Rem.']];

/** Ouvre la fenêtre ; apres() est appelé une fois la bibliothèque enregistrée. */
export function ouvrirFenetreChantier(apres) {
  let libelles = lireLibellesChantier();
  const natures = lireNaturesChantier();
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-chantier';

  const lire = () => [...fenetre.querySelectorAll('[data-lib]')].map((tr) => ({
    abreviation: tr.querySelector('[data-f="abreviation"]').value,
    nom: tr.querySelector('[data-f="nom"]').value,
    couleur: tr.querySelector('[data-f="couleur"]').value,
    forme: tr.querySelector('[data-f="forme"]').value,
    reseau: tr.querySelector('[data-f="type"]').value === 'reseau',
    ouvrage: tr.querySelector('[data-f="ouvrage"]').checked,
    modes: tr.querySelector('[data-f="modes"]').value.split(',').filter(Boolean),
    champs: CHAMPS.map(([c]) => c).filter((c) => tr.querySelector(`[data-champ="${c}"]`).checked),
  }));

  function dessiner() {
    fenetre.innerHTML = `
      <h2>Bibliothèque du Levé chantier</h2>
      <div class="corps-chantier">
        ${libelles.map((l, i) => `<div class="ligne-bibliotheque" data-lib>
          <input data-f="nom" value="${echapper(l.nom)}" aria-label="Nom" placeholder="Nom" />
          <input data-f="abreviation" value="${echapper(l.abreviation)}" maxlength="6" aria-label="Abréviation (début du nom des points)" placeholder="Abrév." autocapitalize="characters" />
          <input data-f="couleur" type="color" value="${echapper(l.couleur)}" aria-label="Couleur" />
          <select data-f="forme" aria-label="Forme">${FORMES.map(([c, n]) => `<option value="${c}" ${c === l.forme ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <select data-f="type" aria-label="Natures proposées"><option value="reseau" ${l.reseau ? 'selected' : ''}>Réseaux</option><option value="bordure" ${l.reseau ? '' : 'selected'}>Bordures</option></select>
          <label class="coche"><input data-f="ouvrage" type="checkbox" ${l.ouvrage ? 'checked' : ''} /> Ouvrage (1 point ou 3 coins)</label>
          <select data-f="modes" aria-label="Altitude levée">${MODES.map(([c, n]) => `<option value="${c}" ${c === l.modes.join(',') ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <span class="champs-bibliotheque">${CHAMPS.map(([c, n]) => `<label class="coche"><input data-champ="${c}" type="checkbox" ${l.champs.includes(c) ? 'checked' : ''} /> ${n}</label>`).join('')}</span>
          <span class="actions-ligne">
            <button type="button" class="bouton-lien" data-action="monter" data-valeur="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Monter">▲</button>
            <button type="button" class="bouton-lien" data-action="descendre" data-valeur="${i}" ${i === libelles.length - 1 ? 'disabled' : ''} aria-label="Descendre">▼</button>
            <button type="button" class="bouton-lien" data-action="enlever" data-valeur="${i}" aria-label="Enlever">×</button>
          </span>
        </div>`).join('')}
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="ajouter">+ Ajouter un libellé</button>
        <div class="natures-bibliotheque">
          <label>Natures des réseaux (une par ligne)<textarea data-natures="reseau" rows="6">${echapper(natures.reseau.join('\n'))}</textarea></label>
          <label>Natures des bordures (une par ligne)<textarea data-natures="bordure" rows="6">${echapper(natures.bordure.join('\n'))}</textarea></label>
        </div>
      </div>
      <div class="pied-libelles">
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="depart">listes de départ</button>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="annuler">annuler</button>
        <button type="button" class="bouton bouton-enregistrer" data-action="enregistrer">Enregistrer</button>
      </div>`;
  }

  const lireNatures = (cle) => fenetre.querySelector(`[data-natures="${cle}"]`).value.split('\n').map((t) => t.trim()).filter(Boolean);

  fenetre.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const { action } = bouton.dataset;
    const i = Number(bouton.dataset.valeur);
    if (['monter', 'descendre', 'enlever', 'ajouter', 'depart'].includes(action)) {
      libelles = lire();
      natures.reseau = lireNatures('reseau');
      natures.bordure = lireNatures('bordure');
      if (action === 'monter' && i > 0) [libelles[i - 1], libelles[i]] = [libelles[i], libelles[i - 1]];
      else if (action === 'descendre' && i < libelles.length - 1) [libelles[i + 1], libelles[i]] = [libelles[i], libelles[i + 1]];
      else if (action === 'enlever') libelles.splice(i, 1);
      else if (action === 'ajouter') libelles.push({ abreviation: '', nom: '', couleur: '#5f6d77', forme: 'rond', reseau: true, ouvrage: false, modes: [], champs: ['remarque'] });
      else if (action === 'depart') {
        libelles = structuredClone(LIBELLES_CHANTIER_DEPART);
        natures.reseau = [...NATURES_RESEAU_DEPART];
        natures.bordure = [...NATURES_BORDURE_DEPART];
      }
      dessiner();
    } else if (action === 'annuler') fenetre.close();
    else if (action === 'enregistrer') {
      const propres = lire().filter((l, k, toutes) => l.abreviation.trim() && l.nom.trim() && toutes.findIndex((x) => x.abreviation === l.abreviation) === k);
      if (propres.length === 0) return;
      enregistrerBibliothequeChantier({ libelles: propres, natures: { reseau: lireNatures('reseau'), bordure: lireNatures('bordure') } });
      fenetre.close();
      apres?.();
    }
  });
  fenetre.addEventListener('close', () => fenetre.remove());
  dessiner();
  document.body.append(fenetre);
  fenetre.showModal();
}
