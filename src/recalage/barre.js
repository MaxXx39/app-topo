// Barre du recalage d'un plan DXF, posée en bas du plan (comme le pointage). Depuis 0.92.0 (demande
// du 29.10.2026), en étapes écrites, 2 par point de calage (voir etapeRecalage) :
// 1. touche le 1er point sur le DXF à recaler (accroche sur ce DXF) ;
// 2. donne sa position calée : touche un point levé ou de contrôle, ou une accroche d'un autre DXF,
//    ou prends la position du GNSS (ou tape Est / Nord) ;
// 3. et 4. : la même chose pour le 2e point. Ensuite : écarts et paramètres, « Appliquer », ou
// d'autres points pour contrôler (écart de chaque point dès 3, case pour en désactiver un).
// Les calculs sont dans topo/recalage.js ; main.js garde l'état et fait les actions.
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { calculerHelmert, rotationLisible, etapeRecalage } from '../topo/recalage.js';

// Accroches sur le DXF à recaler (étapes impaires).
const ACCROCHES_DXF = [['sommet', 'Sommet'], ['milieu', 'Milieu'], ['ligne', 'Sur ligne'], ['centre', 'Centre']];
// Accroches pour la position calée (étapes paires) : point levé ou de contrôle, ou un autre DXF.
const ACCROCHES_CALE = [['point', 'Point'], ['sommet', 'Sommet DXF'], ['milieu', 'Milieu DXF'], ['ligne', 'Sur ligne DXF'], ['centre', 'Centre DXF']];

/**
 * Crée la barre dans "cadre" (le cadre du plan). actions : choisirAccroche(mode), choisirAccrocheCale(mode),
 * ajouterPaire({ est, nord }) (tapés), prendreAuRx2(), basculerTaper(), oublierChoix(),
 * basculerPaire(index, actif), enleverPaire(index), validerCandidat(), appliquer(), annulerRecalage(), fermer().
 * Renvoie { afficher(etat), enlever() } ; etat : { nomPlan, accroche, accrocheCale, choix ({ x, y } ou null),
 * candidat (point touché, pas encore validé : { x, y, nom } ou null), taper (champs Est / Nord ouverts),
 * rx2 (vrai dans l'appli Android), paires }.
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
      actions.ajouterPaire({ est: lire('est'), nord: lire('nord') });
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
      const etape = etapeRecalage(etat.paires.length, Boolean(etat.choix));
      barre.innerHTML = `
        <div class="ligne-barre-pointage">
          <span class="titre-pointage">Recaler « ${echapper(etat.nomPlan)} »</span>
          <button type="button" class="bouton-lien" data-action="fermer">fermer</button>
        </div>
        ${texteEtape(etape)}
        ${etape.sorte === 'dxf' ? accrochesDxf(etat) : positionCalee(etat)}
        ${pointTouche(etat.candidat)}
        ${etat.paires.length > 0 ? tablePaires(etat.paires, helmert) : ''}
        ${helmert ? parametres(helmert) : ''}
        <div class="ligne-barre-pointage">
          <button type="button" class="bouton" data-action="appliquer" ${helmert && !helmert.erreur ? '' : 'disabled'}>Appliquer</button>
          <button type="button" class="bouton-lien" data-action="annulerRecalage">annuler le recalage</button>
        </div>`;
    },
    enlever() {
      barre.remove();
    },
  };
}

/** « Étape 3 / 4 » et ce qu'il faut faire, en gros (on sait toujours où on en est). */
function texteEtape(etape) {
  const ordinal = etape.rang === 1 ? '1er' : `${etape.rang}e`;
  let texte;
  if (etape.sorte === 'dxf') {
    texte = etape.pret
      ? `Recalage prêt : vérifie les écarts, puis « Appliquer ». Ou, pour contrôler, touche un ${ordinal} point sur le DXF à recaler.`
      : `Touche le ${ordinal} point sur le DXF à recaler (une croix le montre), puis « Valider »`;
  } else {
    texte = `Position calée du ${ordinal} point : touche un point (levé ou de contrôle) ou une accroche d'un autre DXF (une croix le montre, puis « Valider »), ou prends la position du GNSS`;
  }
  const contexte = etape.pret && etape.sorte === 'dxf' ? `${etape.numero} (facultative)` : `${etape.numero} / ${etape.total}`;
  return `<p class="etape-recalage etape-${etape.sorte}"><span class="numero-etape">Étape ${contexte}</span>${texte}</p>`;
}

/** Point touché sur le plan (croix) : ses coordonnées et « Valider » (0.104.0). */
function pointTouche(candidat) {
  if (!candidat) return '';
  const nom = candidat.nom ? `${echapper(candidat.nom)} · ` : '';
  return `<div class="choix-pointage point-touche-recalage">
    <span class="coordonnees-pointage">Point touché (croix) : ${nom}x ${formaterNombre(candidat.x)} · y ${formaterNombre(candidat.y)}</span>
    <div class="ligne-barre-pointage">
      <button type="button" class="bouton" data-action="validerCandidat">Valider</button>
    </div>
  </div>`;
}

/** Étapes impaires : accroche sur le DXF à recaler. */
function accrochesDxf(etat) {
  return `<div class="ligne-barre-pointage">
    ${ACCROCHES_DXF.map(([cle, titre]) => `<button type="button" class="puce-choix ${etat.accroche === cle ? 'actif' : ''}" data-action="choisirAccroche" data-valeur="${cle}">${titre}</button>`).join('')}
  </div>`;
}

/** Étapes paires : le point touché sur le DXF, puis sa position calée (toucher, GNSS ou tapée). */
function positionCalee(etat) {
  const taper = etat.taper
    ? `<div class="ligne-barre-pointage">
        <label>Est<input type="text" inputmode="decimal" data-calage="est" autocomplete="off" /></label>
        <label>Nord<input type="text" inputmode="decimal" data-calage="nord" autocomplete="off" /></label>
        <button type="button" class="bouton" data-action="ajouter">Ajouter</button>
      </div>`
    : '';
  return `<div class="choix-pointage">
    <span class="coordonnees-pointage">Point du DXF : x ${formaterNombre(etat.choix.x)} · y ${formaterNombre(etat.choix.y)}
      <button type="button" class="bouton-lien bouton-lien-neutre" data-action="oublierChoix">en toucher un autre</button></span>
    <div class="ligne-barre-pointage">
      ${ACCROCHES_CALE.map(([cle, titre]) => `<button type="button" class="puce-choix ${etat.accrocheCale === cle ? 'actif' : ''}" data-action="choisirAccrocheCale" data-valeur="${cle}">${titre}</button>`).join('')}
    </div>
    <div class="ligne-barre-pointage">
      ${etat.rx2 ? '<button type="button" class="bouton" data-action="prendreAuRx2">Position GNSS</button>' : ''}
      <button type="button" class="puce-choix ${etat.taper ? 'actif' : ''}" data-action="basculerTaper">Taper E / N</button>
    </div>
    ${taper}
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
