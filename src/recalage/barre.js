// Barre du recalage d'un plan DXF, posée en bas du plan (comme le pointage) : accroche, point
// touché sur le DXF, ses coordonnées MN95 (point du projet, tapées ou prises au RX2), liste des
// points de calage avec leur écart (case pour désactiver un point), paramètres et « Appliquer ».
// Les calculs sont dans topo/recalage.js ; main.js garde l'état et fait les actions.
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { calculerHelmert, rotationLisible } from '../topo/recalage.js';

const ACCROCHES = [['sommet', 'Sommet'], ['milieu', 'Milieu'], ['ligne', 'Sur ligne'], ['centre', 'Centre']];

/**
 * Crée la barre dans "cadre" (le cadre du plan). actions : choisirAccroche(mode), choisirSource(source),
 * ajouterPaire({ nom, est, nord } ou { nomPoint }), toucherPointProjet(), annulerToucherProjet(),
 * prendreAuRx2(), basculerPaire(index, actif),
 * enleverPaire(index), appliquer(), annulerRecalage(), fermer().
 * Renvoie { afficher(etat), enlever() } ; etat : { nomPlan, accroche, choix ({ x, y } ou null),
 * source ('projet', 'tape', 'rx2'), groupesPoints ([{ titre, noms }] : points du projet par levé),
 * toucherProjet (on touche le plan pour prendre un point du projet), rx2 (vrai dans l'appli Android),
 * paires, dejaRecale }.
 */
export function creerBarreRecalage(cadre, actions) {
  const barre = document.createElement('div');
  barre.className = 'barre-pointage barre-recalage';
  cadre.append(barre);

  barre.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const { action, valeur } = bouton.dataset;
    if (action === 'ajouter') {
      const lire = (champ) => barre.querySelector(`[data-calage="${champ}"]`)?.value ?? '';
      actions.ajouterPaire({ nomPoint: lire('nom-point'), est: lire('est'), nord: lire('nord') });
    } else if (action === 'enlever') actions.enleverPaire(Number(valeur));
    else actions[action]?.(valeur);
  });
  barre.addEventListener('change', (evenement) => {
    const index = evenement.target.dataset.paire;
    if (index !== undefined) actions.basculerPaire(Number(index), evenement.target.checked);
  });
  barre.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter' && evenement.target.dataset.calage) barre.querySelector('[data-action="ajouter"]')?.click();
  });

  return {
    afficher(etat) {
      const helmert = etat.paires.length >= 2 ? calculerHelmert(etat.paires) : null;
      barre.innerHTML = `
        <div class="ligne-barre-pointage">
          <span class="titre-pointage">Recaler « ${echapper(etat.nomPlan)} »</span>
          <button type="button" class="bouton-lien" data-action="fermer">fermer</button>
        </div>
        <div class="ligne-barre-pointage">
          ${ACCROCHES.map(([cle, titre]) => `<button type="button" class="puce-choix ${etat.accroche === cle ? 'actif' : ''}" data-action="choisirAccroche" data-valeur="${cle}">${titre}</button>`).join('')}
        </div>
        ${etat.choix ? choixMn95(etat) : '<p class="aide-pointage">Touche un coin du plan DXF</p>'}
        ${etat.paires.length > 0 ? tablePaires(etat.paires, helmert) : ''}
        ${helmert ? parametres(helmert) : ''}
        <div class="ligne-barre-pointage">
          <button type="button" class="bouton" data-action="appliquer" ${helmert && !helmert.erreur ? '' : 'disabled'}>Appliquer</button>
          ${etat.dejaRecale ? '<button type="button" class="bouton-lien" data-action="annulerRecalage">annuler le recalage</button>' : ''}
        </div>`;
    },
    enlever() {
      barre.remove();
    },
  };
}

/** Point touché sur le DXF, puis ses coordonnées MN95 : point du projet, tapées, ou RX2. */
function choixMn95(etat) {
  const sources = [['projet', 'Point du projet'], ['tape', 'E / N tapés'], ...(etat.rx2 ? [['rx2', 'RX2']] : [])];
  let saisie;
  if (etat.source === 'projet' && etat.toucherProjet) {
    saisie = `<p class="aide-pointage">Touche un point du projet sur le plan</p>
      <button type="button" class="bouton-lien" data-action="annulerToucherProjet">annuler</button>`;
  } else if (etat.source === 'projet') {
    // Liste des points du projet, rangés par levé (pas besoin de connaître le nom), ou sur le plan.
    saisie = `<label class="large">Point<select data-calage="nom-point">
        <option value="">— choisir —</option>
        ${etat.groupesPoints.map((g) => `<optgroup label="${echapper(g.titre)}">${g.noms.map((nom) => `<option value="${echapper(nom)}">${echapper(nom)}</option>`).join('')}</optgroup>`).join('')}
      </select></label>
      <button type="button" class="bouton" data-action="ajouter">Ajouter</button>
      <button type="button" class="puce-choix" data-action="toucherPointProjet">Sur le plan</button>`;
  } else if (etat.source === 'tape') {
    saisie = `<label>Est<input type="text" inputmode="decimal" data-calage="est" autocomplete="off" /></label>
      <label>Nord<input type="text" inputmode="decimal" data-calage="nord" autocomplete="off" /></label>
      <button type="button" class="bouton" data-action="ajouter">Ajouter</button>`;
  } else {
    saisie = '<button type="button" class="bouton" data-action="prendreAuRx2">Prendre au RX2</button>';
  }
  return `<div class="choix-pointage">
    <span class="coordonnees-pointage">DXF : x ${formaterNombre(etat.choix.x)} · y ${formaterNombre(etat.choix.y)} → MN95 :</span>
    <div class="ligne-barre-pointage">${sources.map(([cle, titre]) => `<button type="button" class="puce-choix ${etat.source === cle ? 'actif' : ''}" data-action="choisirSource" data-valeur="${cle}">${titre}</button>`).join('')}</div>
    ${saisie}
  </div>`;
}

/** Points de calage : n°, nom ou source, écart (dès 3 points), case « actif », ×. */
function tablePaires(paires, helmert) {
  const ecarts = helmert && !helmert.erreur ? helmert.ecarts : null;
  const actives = paires.filter((p) => p.actif !== false).length;
  return `<table class="table-calage">
    <thead><tr><th></th><th>Point</th><th>Écart</th><th></th></tr></thead>
    <tbody>${paires.map((p, i) => `<tr class="${p.actif === false ? 'inactif' : ''}">
      <td><input type="checkbox" data-paire="${i}" ${p.actif !== false ? 'checked' : ''} aria-label="Point actif" /></td>
      <td>${i + 1}. ${echapper(p.nom)}</td>
      <td>${ecarts && (actives >= 3 || p.actif === false) ? `${formaterNombre(ecarts[i].distance)} m` : '—'}</td>
      <td><button type="button" class="bouton-lien" data-action="enlever" data-valeur="${i}" aria-label="Enlever">×</button></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

/** Paramètres trouvés (déplacement, rotation, échelle, écart-type), pour contrôle. */
function parametres(helmert) {
  if (helmert.erreur) return `<p class="erreur-recalage">${echapper(helmert.erreur)}</p>`;
  const { gon, degres } = rotationLisible(helmert.rotation);
  const ppm = (helmert.echelle - 1) * 1e6;
  return `<p class="parametres-recalage">
    Déplacement E ${formaterNombre(helmert.tEst)} · N ${formaterNombre(helmert.tNord)}<br />
    Rotation ${gon.toFixed(4)} gon (${degres.toFixed(4)}°) · Échelle ${helmert.echelle.toFixed(6)} (${ppm >= 0 ? '+' : ''}${ppm.toFixed(0)} ppm)
    ${helmert.ecartType != null ? `<br />Écart-type ${formaterNombre(helmert.ecartType)} m` : '<br />2 points : solution exacte (pas de contrôle)'}
  </p>`;
}
