// Fenêtre de modification d'une liste de libellés (réglages ⚙, Expert, depuis 0.95.0) :
// un tableau Abrév. | Description | Couleur, qui défile, et en bas, toujours visible, la barre
// « + Ajouter · annuler · ENREGISTRER » (demande du 24.10.2026). La couleur se voit en pastille ;
// la toucher ouvre la palette (ronds de couleur) sous la ligne. Les libellés de départ (fixes) ne
// se modifient pas et ne s'enlèvent pas : seule leur couleur se change.
import { echapper } from '../outils/echapper.js';
import { nettoyerAbreviation, COULEURS_LIBELLES, lireLibelles, enregistrerLibelles, abreviationsDepart } from './libelles.js';
import { FORMES } from '../plan/formes.js';

/** Nom d'une couleur de la palette (« noir »…), « habituelle » pour pas de couleur choisie. */
function nomCouleur(couleur) {
  return COULEURS_LIBELLES.find(([c]) => c === (couleur || ''))?.[1] ?? couleur;
}

/**
 * Ouvre la fenêtre. liste : [[abréviation, description, couleur]] ; couleurParDefaut : couleur
 * habituelle du rôle (lignes orange, points vert…), montrée pour « pas de couleur choisie » ;
 * fixes : abréviations qui ne se modifient pas (libellés de départ) ; enregistrer(liste) reçoit la
 * liste modifiée (lignes sans abréviation enlevées, une abréviation en double gardée une fois).
 */
export function ouvrirFenetreLibelles({ titre, liste, couleurParDefaut = '#6b7280', fixes = new Set(), enregistrer }) {
  let lignes = liste.map(([a, d, c, f]) => [a, d, c ?? '', f ?? '']);
  let paletteOuverte = null; // n° de la ligne dont la palette est ouverte
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-libelles';

  /** Lignes du tableau telles qu'elles sont tapées (vides comprises). */
  const lire = () => [...fenetre.querySelectorAll('tbody tr[data-ligne]')].map((ligne) => [
    nettoyerAbreviation(ligne.querySelector('[data-libelle="abreviation"]').value),
    ligne.querySelector('[data-libelle="description"]').value.trim(),
    ligne.querySelector('[data-libelle="couleur"]').dataset.couleur,
    ligne.querySelector('[data-libelle="forme"]').value,
  ]);

  function dessiner() {
    fenetre.innerHTML = `
      <h2>${echapper(titre)}</h2>
      <div class="corps-libelles">
        <table class="table-libelles">
          <thead><tr><th>Abrév.</th><th>Description</th><th>Couleur</th><th>Forme</th><th></th></tr></thead>
          <tbody>
            ${lignes.map(([abreviation, description, couleur, forme], i) => `<tr data-ligne class="${fixes.has(abreviation) ? 'libelle-fixe' : ''}">
              <td><input type="text" data-libelle="abreviation" value="${echapper(abreviation)}" maxlength="8" autocapitalize="characters" aria-label="Abréviation" ${fixes.has(abreviation) ? 'readonly' : ''} /></td>
              <td><input type="text" data-libelle="description" value="${echapper(description)}" aria-label="Description" ${fixes.has(abreviation) ? 'readonly' : ''} /></td>
              <td><button type="button" class="pastille-couleur ${couleur ? '' : 'habituelle'}" data-libelle="couleur" data-couleur="${couleur}" data-action="palette" data-valeur="${i}"
                style="background: ${couleur || couleurParDefaut}" title="${nomCouleur(couleur)}" aria-label="Couleur : ${nomCouleur(couleur)}" aria-expanded="${paletteOuverte === i}"></button></td>
              <td><select data-libelle="forme" aria-label="Forme du point" class="select-forme">${FORMES.map(([cle, nom]) => `<option value="${cle}" ${cle === forme ? 'selected' : ''}>${nom}</option>`).join('')}</select></td>
              <td>${fixes.has(abreviation) ? '' : `<button type="button" class="bouton-lien" data-action="enlever" data-valeur="${i}" aria-label="Enlever">×</button>`}</td>
            </tr>
            ${paletteOuverte === i ? `<tr class="ligne-palette"><td colspan="5"><div class="palette-couleurs">
              ${COULEURS_LIBELLES.map(([c, nom]) => `<button type="button" class="pastille-couleur ${c ? '' : 'habituelle'} ${c === couleur ? 'choisie' : ''}" data-action="choisirCouleur" data-valeur="${i}" data-couleur="${c}"
                style="background: ${c || couleurParDefaut}" title="${nom}" aria-label="${nom}"></button>`).join('')}
            </div></td></tr>` : ''}`).join('')}
          </tbody>
        </table>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="ajouter">+ Ajouter un libellé</button>
      </div>
      <div class="pied-libelles">
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="annuler">annuler</button>
        <button type="button" class="bouton bouton-enregistrer" data-action="enregistrer">Enregistrer</button>
      </div>`;
  }

  fenetre.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const { action, valeur } = bouton.dataset;
    if (action === 'palette') {
      lignes = lire();
      paletteOuverte = paletteOuverte === Number(valeur) ? null : Number(valeur);
      dessiner();
      return;
    }
    if (action === 'choisirCouleur') {
      lignes = lire();
      lignes[Number(valeur)][2] = bouton.dataset.couleur;
      paletteOuverte = null;
      dessiner();
      return;
    }
    if (action === 'ajouter' || action === 'enlever') {
      lignes = lire();
      paletteOuverte = null;
      if (action === 'ajouter') lignes.push(['', '', '', '']);
      else lignes.splice(Number(valeur), 1);
      dessiner();
      if (action === 'ajouter') fenetre.querySelector('tbody tr:last-child input')?.focus();
    } else if (action === 'annuler') fenetre.close();
    else if (action === 'enregistrer') {
      const propre = lire().filter(([abreviation], i, toutes) => abreviation && toutes.findIndex(([a]) => a === abreviation) === i);
      fenetre.close();
      enregistrer(propre);
    }
  });
  fenetre.addEventListener('close', () => fenetre.remove());
  dessiner();
  document.body.append(fenetre);
  fenetre.showModal();
}

const TITRES_LIBELLES = { lignes: 'Libellés des lignes (L-…)', points: 'Libellés des points (P-…)', aires: 'Libellés des aires (A-…)' };

/**
 * Modifie la liste de libellés d'une sorte ('lignes', 'points', 'aires') : ceux de départ gardent
 * leur nom (couleur et forme modifiables), ceux ajoutés se modifient ; enregistré dans les listes
 * partagées (Drive), donc valable partout. apres() est appelé une fois enregistré.
 */
export function modifierLibellesDeSorte(sorte, apres) {
  const tous = lireLibelles();
  ouvrirFenetreLibelles({
    titre: TITRES_LIBELLES[sorte],
    liste: tous[sorte],
    fixes: abreviationsDepart(sorte),
    couleurParDefaut: { lignes: '#ea580c', points: '#15803d', aires: '#0891b2' }[sorte],
    enregistrer: (liste) => {
      enregistrerLibelles({ ...tous, [sorte]: liste });
      apres?.();
    },
  });
}
