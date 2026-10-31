// Fenêtre de modification d'une liste de libellés (réglages ⚙, Expert, depuis 0.95.0) :
// un tableau Abrév. | Description | Couleur, qui défile, et en bas, toujours visible, la barre
// « + Ajouter · annuler · ENREGISTRER » (demande du 24.10.2026). La couleur se voit en pastille ;
// la toucher ouvre la palette (ronds de couleur) sous la ligne. Les libellés de départ (fixes) ne
// se modifient pas et ne s'enlèvent pas : seule leur couleur se change (sauf en Expert, 0.105.5).
import { echapper } from '../outils/echapper.js';
import { nettoyerAbreviation, COULEURS_LIBELLES, COULEURS_HABITUELLES, lireLibellesDetail, lireLibellesParDefaut, lireLibellesProjet, enregistrerLibelles, enregistrerLibellesProjet } from './libelles.js';
import { aAcces } from '../reglages/reglages.js';
import { FORMES } from '../plan/formes.js';
import { lireReseaux, enregistrerReseaux, abreviationsReseauxDepart } from './reseaux.js';

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
export function ouvrirFenetreLibelles({ titre, liste, couleurParDefaut = '#6b7280', fixes = new Set(), avecForme = true, avecGroupes = false, avecDefaut = false, texteAjouter = '+ Ajouter un libellé', enregistrer }) {
  // avecGroupes (libellés, 0.105.6) : 5e case = « par défaut » (vrai : dans tous les projets, faux : ce projet seulement) ;
  // les lignes par défaut sont d'abord, puis celles du projet. avecDefaut (Expert) : la coche se change et les flèches
  // changent l'ordre dans le groupe.
  const trier = (l) => (avecGroupes ? [...l.filter((x) => x[4]), ...l.filter((x) => !x[4])] : l);
  let lignes = trier(liste.map(([a, d, c, f, defaut]) => [a, d, c ?? '', f ?? '', avecGroupes ? Boolean(defaut) : false]));
  let paletteOuverte = null; // n° de la ligne dont la palette est ouverte
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-libelles';

  /** Lignes du tableau telles qu'elles sont tapées (vides comprises). */
  const lire = () => [...fenetre.querySelectorAll('tbody tr[data-ligne]')].map((ligne) => [
    nettoyerAbreviation(ligne.querySelector('[data-libelle="abreviation"]').value),
    ligne.querySelector('[data-libelle="description"]').value.trim(),
    ligne.querySelector('[data-libelle="couleur"]').dataset.couleur,
    ligne.querySelector('[data-libelle="forme"]')?.value ?? '',
    avecDefaut ? ligne.querySelector('[data-libelle="defaut"]').checked : ligne.dataset.defaut === 'oui',
  ]);

  function dessiner() {
    const colonnes = 4 + (avecForme ? 1 : 0) + (avecDefaut ? 2 : 0);
    fenetre.innerHTML = `
      <h2>${echapper(titre)}</h2>
      <div class="corps-libelles">
        <table class="table-libelles">
          <thead><tr><th>Abrév.</th><th>Description</th><th>Couleur</th>${avecForme ? '<th>Forme</th>' : ''}${avecDefaut ? '<th title="Dans tous les projets">Défaut</th><th>Ordre</th>' : ''}<th></th></tr></thead>
          <tbody>
            ${lignes.map(([abreviation, description, couleur, forme, defaut], i) => `${avecGroupes && (i === 0 || lignes[i - 1][4] !== defaut) ? `<tr class="titre-groupe-libelles"><th colspan="${colonnes}">${defaut ? 'Par défaut (tous les projets)' : 'Ce projet seulement'}</th></tr>` : ''}<tr data-ligne data-defaut="${defaut ? 'oui' : 'non'}" class="${fixes.has(abreviation) ? 'libelle-fixe' : ''}">
              <td><input type="text" data-libelle="abreviation" value="${echapper(abreviation)}" maxlength="8" autocapitalize="characters" aria-label="Abréviation" ${fixes.has(abreviation) ? 'readonly' : ''} /></td>
              <td><input type="text" data-libelle="description" value="${echapper(description)}" aria-label="Description" ${fixes.has(abreviation) ? 'readonly' : ''} /></td>
              <td><button type="button" class="pastille-couleur ${couleur ? '' : 'habituelle'}" data-libelle="couleur" data-couleur="${couleur}" data-action="palette" data-valeur="${i}"
                style="background: ${couleur || couleurParDefaut}" title="${nomCouleur(couleur)}" aria-label="Couleur : ${nomCouleur(couleur)}" aria-expanded="${paletteOuverte === i}"></button></td>
              ${avecForme ? `<td><select data-libelle="forme" aria-label="Forme du point" class="select-forme">${FORMES.map(([cle, nom]) => `<option value="${cle}" ${cle === forme ? 'selected' : ''}>${nom}</option>`).join('')}</select></td>` : ''}
 ${avecDefaut ? `<td><input type="checkbox" data-libelle="defaut" ${defaut ? 'checked' : ''} aria-label="Par défaut dans tous les projets" /></td>
              <td class="fleches-libelle"><button type="button" class="bouton-lien" data-action="monter" data-valeur="${i}" ${i > 0 && lignes[i - 1][4] === defaut ? '' : 'disabled'} aria-label="Monter">▲</button><button type="button" class="bouton-lien" data-action="descendre" data-valeur="${i}" ${i < lignes.length - 1 && lignes[i + 1][4] === defaut ? '' : 'disabled'} aria-label="Descendre">▼</button></td>` : ''}
              <td>${fixes.has(abreviation) ? '' : `<button type="button" class="bouton-lien" data-action="enlever" data-valeur="${i}" aria-label="Enlever">×</button>`}</td>
            </tr>
            ${paletteOuverte === i ? `<tr class="ligne-palette"><td colspan="${colonnes}"><div class="palette-couleurs">
              ${COULEURS_LIBELLES.map(([c, nom]) => `<button type="button" class="pastille-couleur ${c ? '' : 'habituelle'} ${c === couleur ? 'choisie' : ''}" data-action="choisirCouleur" data-valeur="${i}" data-couleur="${c}"
                style="background: ${c || couleurParDefaut}" title="${nom}" aria-label="${nom}"></button>`).join('')}
            </div></td></tr>` : ''}`).join('')}
          </tbody>
        </table>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="ajouter">${texteAjouter}</button>
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
    if (action === 'monter' || action === 'descendre') {
      lignes = lire();
      const i = Number(valeur);
      const j = action === 'monter' ? i - 1 : i + 1;
      if (lignes[j] && lignes[j][4] === lignes[i][4]) [lignes[i], lignes[j]] = [lignes[j], lignes[i]];
      paletteOuverte = null;
      dessiner();
      return;
    }
    if (action === 'ajouter' || action === 'enlever') {
      lignes = lire();
      paletteOuverte = null;
      if (action === 'ajouter') lignes.push(['', '', '', '', false]); // un nouveau libellé : ce projet seulement
      else lignes.splice(Number(valeur), 1);
      dessiner();
      if (action === 'ajouter') fenetre.querySelector('tbody tr:last-child input')?.focus();
    } else if (action === 'annuler') fenetre.close();
    else if (action === 'enregistrer') {
      const propre = trier(lire()).filter(([abreviation], i, toutes) => abreviation && toutes.findIndex(([a]) => a === abreviation) === i);
      fenetre.close();
      enregistrer(propre);
    }
  });
  // Coche « par défaut » changée : la ligne passe dans l'autre groupe.
  fenetre.addEventListener('change', (evenement) => {
    if (evenement.target.dataset.libelle !== 'defaut') return;
    lignes = trier(lire());
    paletteOuverte = null;
    dessiner();
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
  const detail = lireLibellesDetail()[sorte];
  const expert = aAcces('expert');
  ouvrirFenetreLibelles({
    titre: TITRES_LIBELLES[sorte],
    liste: detail,
    // Expert : tout se modifie, se range et se coche « par défaut » ; sinon, les libellés par défaut ne changent que de
    // couleur et de forme, et ceux qu'on ajoute sont pour ce projet seulement.
    fixes: expert ? new Set() : new Set(detail.filter((l) => l[4]).map((l) => l[0])),
    avecGroupes: true,
    avecDefaut: expert,
    couleurParDefaut: COULEURS_HABITUELLES[sorte],
    enregistrer: (liste) => {
      const sans = ([a, d, c, f]) => [a, d, c, f];
      enregistrerLibelles({ ...lireLibellesParDefaut(), [sorte]: liste.filter((l) => l[4]).map(sans) });
      enregistrerLibellesProjet({ ...lireLibellesProjet(), [sorte]: liste.filter((l) => !l[4]).map(sans) });
      apres?.();
    },
  });
}

/**
 * Modifie la liste des réseaux du recollement (0.101.0) : ceux de départ gardent leur nom (couleur
 * modifiable), ceux ajoutés se modifient ; partagée par Drive. apres() est appelé une fois enregistré.
 */
export function modifierReseaux(apres) {
  ouvrirFenetreLibelles({
    titre: 'Réseaux du recollement',
    liste: lireReseaux(),
    fixes: abreviationsReseauxDepart(),
    avecForme: false,
    texteAjouter: '+ Ajouter un réseau',
    enregistrer: (liste) => {
      // Un réseau sans couleur prend le gris (sa couleur sert au dessin du réseau).
      enregistrerReseaux(liste.map(([a, d, c]) => [a, d, c || '#6b7280']));
      apres?.();
    },
  });
}
