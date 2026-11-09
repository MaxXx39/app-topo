// Fenêtre de la bibliothèque du Levé chantier (0.175.0, Expert) : libellés (nom, nom court, abréviation, forme du point, réseau ou
// bordure, ouvrage, mode d'altitude, champs demandés), ordre, et les natures avec leur couleur. 0.175.5 : la FORME du point vient du
// libellé, la COULEUR vient de la nature. Enregistrée dans les listes partagées (Drive) : valable sur toutes les tablettes.
import { echapper } from '../outils/echapper.js';
import { lireLibellesChantier, lireNaturesChantier, enregistrerBibliothequeChantier } from './libelles-chantier.js';
import { LIBELLES_CHANTIER_DEPART, NATURES_RESEAU_DEPART, NATURES_BORDURE_DEPART, couleurDeNature } from '../topo/chantier.js';
import { FORMES } from '../plan/formes.js';

const MODES = [['', 'aucun'], ['dessus,fe', 'Dessus / Fil d\'eau'], ['tampon,fe', 'Tampon / Fil d\'eau']];
const CHAMPS = [['diametre', 'Ø'], ['gaine', 'Gaine'], ['nombre', 'Nb'], ['profondeur', 'Prof.'], ['materiau', 'Matér.'], ['remarque', 'Rem.']];

/** Ouvre la fenêtre ; apres() est appelé une fois la bibliothèque enregistrée. */
export function ouvrirFenetreChantier(apres) {
  let libelles = lireLibellesChantier();
  const lues = lireNaturesChantier();
  // Natures : [{ nom, couleur }] pour les réseaux et pour les bordures.
  const natures = {
    reseau: lues.reseau.map((nom) => ({ nom, couleur: couleurDeNature(nom, lues.couleurs) })),
    bordure: lues.bordure.map((nom) => ({ nom, couleur: couleurDeNature(nom, lues.couleurs) })),
  };
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-chantier';

  const lire = () => [...fenetre.querySelectorAll('[data-lib]')].map((tr) => ({
    abreviation: tr.querySelector('[data-f="abreviation"]').value,
    nom: tr.querySelector('[data-f="nom"]').value,
    court: tr.querySelector('[data-f="court"]').value,
    forme: tr.querySelector('[data-f="forme"]').value,
    reseau: tr.querySelector('[data-f="type"]').value === 'reseau',
    ouvrage: tr.querySelector('[data-f="ouvrage"]').checked,
    modes: tr.querySelector('[data-f="modes"]').value.split(',').filter(Boolean),
    champs: CHAMPS.map(([c]) => c).filter((c) => tr.querySelector(`[data-champ="${c}"]`).checked),
  }));
  const lireNatures = (cle) => [...fenetre.querySelectorAll(`[data-nature-groupe="${cle}"] [data-nat]`)]
    .map((r) => ({ nom: r.querySelector('[data-n="nom"]').value.trim(), couleur: r.querySelector('[data-n="couleur"]').value }))
    .filter((n) => n.nom);

  function groupeNatures(cle, titre) {
    return `<div class="groupe-natures" data-nature-groupe="${cle}"><strong>${titre}</strong>
      ${natures[cle].map((n, i) => `<div class="ligne-nature" data-nat><input data-n="couleur" type="color" value="${echapper(n.couleur)}" aria-label="Couleur de ${echapper(n.nom)}" />
        <input data-n="nom" value="${echapper(n.nom)}" aria-label="Nature" /><button type="button" class="bouton-lien" data-action="enlever-nature" data-groupe="${cle}" data-valeur="${i}" aria-label="Enlever">×</button></div>`).join('')}
      <button type="button" class="bouton-lien bouton-lien-neutre" data-action="ajouter-nature" data-groupe="${cle}">+ Nature</button></div>`;
  }

  function dessiner() {
    fenetre.innerHTML = `
      <h2>Bibliothèque du Levé chantier</h2>
      <div class="corps-chantier">
        <p class="aide-chantier">La <b>forme</b> du point sur le plan vient du libellé, sa <b>couleur</b> vient de la nature.</p>
        ${libelles.map((l, i) => `<div class="ligne-bibliotheque" data-lib>
          <input data-f="nom" value="${echapper(l.nom)}" aria-label="Nom" placeholder="Nom" />
          <input data-f="court" value="${echapper(l.court ?? l.nom)}" maxlength="10" aria-label="Nom court (rangée de Lever)" placeholder="Nom court" />
          <input data-f="abreviation" value="${echapper(l.abreviation)}" maxlength="6" aria-label="Abréviation (début du nom des points)" placeholder="Abrév." autocapitalize="characters" />
          <select data-f="forme" aria-label="Forme du point">${FORMES.map(([c, s]) => `<option value="${c}" ${c === l.forme ? 'selected' : ''}>${s}</option>`).join('')}</select>
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
        <div class="natures-bibliotheque">${groupeNatures('reseau', 'Natures des réseaux')}${groupeNatures('bordure', 'Natures des bordures')}</div>
      </div>
      <div class="pied-libelles">
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="depart">listes de départ</button>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="annuler">annuler</button>
        <button type="button" class="bouton bouton-enregistrer" data-action="enregistrer">Enregistrer</button>
      </div>`;
  }

  fenetre.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const { action } = bouton.dataset;
    const i = Number(bouton.dataset.valeur);
    if (['monter', 'descendre', 'enlever', 'ajouter', 'depart', 'enlever-nature', 'ajouter-nature'].includes(action)) {
      libelles = lire();
      natures.reseau = lireNatures('reseau');
      natures.bordure = lireNatures('bordure');
      if (action === 'monter' && i > 0) [libelles[i - 1], libelles[i]] = [libelles[i], libelles[i - 1]];
      else if (action === 'descendre' && i < libelles.length - 1) [libelles[i + 1], libelles[i]] = [libelles[i], libelles[i + 1]];
      else if (action === 'enlever') libelles.splice(i, 1);
      else if (action === 'ajouter') libelles.push({ abreviation: '', nom: '', court: '', forme: '', reseau: true, ouvrage: false, modes: [], champs: ['remarque'] });
      else if (action === 'enlever-nature') natures[bouton.dataset.groupe].splice(i, 1);
      else if (action === 'ajouter-nature') natures[bouton.dataset.groupe].push({ nom: '', couleur: '#6b7280' });
      else if (action === 'depart') {
        libelles = structuredClone(LIBELLES_CHANTIER_DEPART);
        natures.reseau = NATURES_RESEAU_DEPART.map((nom) => ({ nom, couleur: couleurDeNature(nom) }));
        natures.bordure = NATURES_BORDURE_DEPART.map((nom) => ({ nom, couleur: couleurDeNature(nom) }));
      }
      dessiner();
    } else if (action === 'annuler') fenetre.close();
    else if (action === 'enregistrer') {
      const propres = lire().filter((l, k, toutes) => l.abreviation.trim() && l.nom.trim() && toutes.findIndex((x) => x.abreviation === l.abreviation) === k);
      if (propres.length === 0) return;
      const reseau = lireNatures('reseau');
      const bordure = lireNatures('bordure');
      const couleurs = Object.fromEntries([...reseau, ...bordure].map((n) => [n.nom, n.couleur]));
      enregistrerBibliothequeChantier({ libelles: propres, natures: { reseau: reseau.map((n) => n.nom), bordure: bordure.map((n) => n.nom), couleurs } });
      fenetre.close();
      apres?.();
    }
  });
  fenetre.addEventListener('close', () => fenetre.remove());
  dessiner();
  document.body.append(fenetre);
  fenetre.showModal();
}
