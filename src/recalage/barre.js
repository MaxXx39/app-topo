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
import { calculerHelmert, rotationLisible, etapeRecalage, calageParAxes } from '../topo/recalage.js';

// Accroches sur le DXF à recaler (étapes impaires) ; « Point » (0.116.0) : un point levé ou de contrôle.
const ACCROCHES_DXF = [['sommet', 'Sommet'], ['milieu', 'Milieu'], ['ligne', 'Sur ligne'], ['croisement', 'Croisement'], ['centre', 'Centre'], ['point', 'Point']];
// Accroches pour la position calée (étapes paires) : point levé ou de contrôle, ou un autre DXF.
const ACCROCHES_CALE = [['point', 'Point'], ['sommet', 'Sommet DXF'], ['milieu', 'Milieu DXF'], ['ligne', 'Sur ligne DXF'], ['croisement', 'Croisement'], ['centre', 'Centre DXF']];

/**
 * Crée la barre dans "cadre" (le cadre du plan). actions : choisirAccroche(mode), choisirAccrocheCale(mode),
 * ajouterPaire({ est, nord }) (tapés), prendreAuRx2(), basculerTaper(), oublierChoix(),
 * basculerPaire(index, actif), enleverPaire(index), deplacerLoupe(sens), zoomLoupe(zoom), validerCandidat(), appliquer(), annulerRecalage(), fermer().
 * Renvoie { afficher(etat), enlever() } ; etat : { nomPlan, pdf ('image', 'traits' ou null, 0.130.0), zoomLoupe, accroche, accrocheCale, choix ({ x, y } ou null),
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
      // 0.152.0 (Expert) : par points (Helmert) ou par axes (2 lignes et 2 lignes calées).
      const methode = `<div class="ligne-barre-pointage choix-methode-recalage seulement-expert">
          <button type="button" class="puce-choix ${etat.methode !== 'axes' ? 'actif' : ''}" data-action="choisirMethode" data-valeur="points">Par points</button>
          <button type="button" class="puce-choix ${etat.methode === 'axes' ? 'actif' : ''}" data-action="choisirMethode" data-valeur="axes">Par axes (2 lignes)</button>
        </div>`;
      if (etat.methode === 'axes') {
        barre.innerHTML = `
          <div class="ligne-barre-pointage">
            <span class="titre-pointage">Recaler « ${echapper(etat.nomPlan)} »</span>
            <button type="button" class="bouton-lien" data-action="fermer">fermer</button>
          </div>
          ${methode}
          ${htmlAxes(etat)}`;
        return;
      }
      const helmert = etat.paires.length >= 2 ? calculerHelmert(etat.paires) : null;
      const etape = etapeRecalage(etat.paires.length, Boolean(etat.choix));
      barre.innerHTML = `
        <div class="ligne-barre-pointage">
          <span class="titre-pointage">Recaler « ${echapper(etat.nomPlan)} »</span>
          <button type="button" class="bouton-lien" data-action="fermer">fermer</button>
        </div>
        ${methode}
        ${texteEtape(etape, etat.accroche === 'manuel')}
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
function texteEtape(etape, manuel = false) {
  const ordinal = etape.rang === 1 ? '1er' : `${etape.rang}e`;
  let texte;
  if (etape.sorte === 'dxf') {
    texte = etape.pret
      ? `Recalage prêt : vérifie les écarts, puis « Appliquer ». Ou, pour contrôler, touche un ${ordinal} point sur le DXF à recaler.`
      : `Touche le ${ordinal} point sur le DXF à recaler, ou un point levé ou de contrôle avec « Point » (une croix le montre), puis « Valider »`;
    if (!etape.pret && manuel) texte = `Tire la main : mets la croix de la loupe sur le ${ordinal} point du plan à recaler, puis « Valider »`;
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

// Main de l'accroche « Manuel » (0.130.0).
const MAIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-4 0" /><path d="M14 10V4a2 2 0 0 0-4 0v2" /><path d="M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" /></svg>';
// Zooms de la loupe proposés.
export const ZOOMS_LOUPE = [2, 4, 8];

/**
 * Accroches proposées aux étapes impaires : etat.pdf = 'image' (PDF scanné : seulement « Manuel »
 * et « Point »), 'traits' (PDF vectoriel : toutes + « Manuel »), sinon (DXF) : sans « Manuel ».
 */
export function accrochesProposees(pdf) {
  const manuel = ['manuel', 'Manuel'];
  if (pdf === 'image') return [manuel, ACCROCHES_DXF.find(([cle]) => cle === 'point')];
  if (pdf === 'traits') return [...ACCROCHES_DXF, manuel];
  return ACCROCHES_DXF;
}

/** Étapes impaires : accroche sur le DXF à recaler ; « Manuel » : flèches du réglage fin et zoom. */
function accrochesDxf(etat) {
  const puces = accrochesProposees(etat.pdf).map(([cle, titre]) => `<button type="button" class="puce-choix ${cle === 'manuel' ? 'puce-manuel' : ''} ${etat.accroche === cle ? 'actif' : ''}" data-action="choisirAccroche" data-valeur="${cle}">${cle === 'manuel' ? MAIN : ''}${titre}</button>`).join('');
  const reglage = etat.accroche === 'manuel' ? `<div class="reglage-loupe">
      <div class="fleches-loupe">
        <span></span><button type="button" class="bouton-fleche-loupe" data-action="deplacerLoupe" data-valeur="haut" aria-label="Monter la croix">▲</button><span></span>
        <button type="button" class="bouton-fleche-loupe" data-action="deplacerLoupe" data-valeur="gauche" aria-label="Croix à gauche">◀</button>
        <button type="button" class="bouton-fleche-loupe" data-action="deplacerLoupe" data-valeur="bas" aria-label="Descendre la croix">▼</button>
        <button type="button" class="bouton-fleche-loupe" data-action="deplacerLoupe" data-valeur="droite" aria-label="Croix à droite">▶</button>
      </div>
      <div class="zooms-loupe">
        <span>Zoom</span>
        ${ZOOMS_LOUPE.map((z) => `<button type="button" class="puce-choix ${etat.zoomLoupe === z ? 'actif' : ''}" data-action="zoomLoupe" data-valeur="${z}">×${z}</button>`).join('')}
      </div>
    </div>` : '';
  return `<div class="ligne-barre-pointage">${puces}</div>${reglage}`;
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

// --- Calage par axes (0.152.0, Expert) -----------------------------------------------------------
// Étapes : 1. ligne 1 sur le plan à caler ; 2. la même ligne en MN95 ; 3. ligne 2 sur le plan ;
// 4. la même ligne en MN95 ; ensuite le résultat. Une ligne : touchée (un trait), ou entre 2 points.
// Avant, si besoin : mise à l'échelle (2 points du plan et leur distance réelle).

/** Étape du calage par axes : { numero (1 à 4, ou 5 = prêt), cote ('plan' ou 'cale'), rang (1 ou 2) }. */
export function etapeAxes(axes) {
  const n = axes.lignesPlan.length + axes.lignesCalees.length;
  if (n >= 4) return { numero: 5, cote: null, rang: null };
  return { numero: n + 1, cote: n % 2 === 0 ? 'plan' : 'cale', rang: Math.floor(n / 2) + 1 };
}

/** Point ou ligne touché(e) pendant le calage par axes (0.223.0) : montré(e) sur le plan, puis « Valider ». */
function candidatAxes(candidat) {
  if (!candidat) return '';
  const quoi = candidat.sorte === 'ligne' ? 'Ligne touchée (en orange sur le plan)' : 'Point touché (croix sur le plan)';
  return `<div class="choix-pointage point-touche-recalage">
    <span class="coordonnees-pointage">${quoi}</span>
    <div class="ligne-barre-pointage"><button type="button" class="bouton" data-action="validerCandidat">Valider</button></div>
  </div>`;
}

function htmlAxes(etat) {
  const { axes } = etat;
  const etape = etapeAxes(axes);
  const puce = (action, cle, titre, actif) => `<button type="button" class="puce-choix ${actif ? 'actif' : ''}" data-action="${action}" data-valeur="${cle}">${titre}</button>`;
  // Mise à l'échelle en cours : 2 points sur le plan à caler, puis la distance.
  if (axes.miseEchelle) {
    const n = axes.miseEchelle.points.length;
    return `<p class="etape-recalage etape-dxf"><span class="numero-etape">Mise à l'échelle</span>Touche le ${n === 0 ? '1er' : '2e'} point sur le plan à caler (puis tu tapes leur distance réelle)</p>
      ${accrochesDxf(etat)}
      ${candidatAxes(axes.candidat)}
      <div class="ligne-barre-pointage"><button type="button" class="bouton-lien" data-action="annulerEchelle">annuler la mise à l'échelle</button></div>`;
  }
  const echelle = `<div class="ligne-barre-pointage">
      <span>Échelle ${axes.echelle.toFixed(6)}</span>
      <button type="button" class="bouton-secondaire" data-action="commencerEchelle">Mettre à l'échelle</button>
      ${axes.echelle !== 1 ? '<button type="button" class="bouton-lien bouton-lien-neutre" data-action="echelleUn">échelle 1</button>' : ''}
    </div>`;
  const faite = (l) => (l ? '✓' : '—');
  const liste = `<p class="aide lignes-axes">Plan : ligne 1 ${faite(axes.lignesPlan[0])} · ligne 2 ${faite(axes.lignesPlan[1])} — calées : ligne 1 ${faite(axes.lignesCalees[0])} · ligne 2 ${faite(axes.lignesCalees[1])}
      ${axes.lignesPlan.length + axes.lignesCalees.length > 0 ? '<button type="button" class="bouton-lien" data-action="effacerLigneAxes">effacer la dernière</button>' : ''}</p>`;
  if (etape.numero === 5) {
    const r = calageParAxes(axes.lignesPlan, axes.lignesCalees, { echelle: axes.echelle, tourne: axes.tourne });
    const resultat = r.erreur
      ? `<p class="erreur-recalage">${echapper(r.erreur)}</p>`
      : (() => {
        const { gon, degres } = rotationLisible(r.rotation);
        const ecart = rotationLisible(r.ecartAngle);
        return `<p class="parametres-recalage">
          Croisement calé en E ${formaterNombre(r.croisementCale.est)} · N ${formaterNombre(r.croisementCale.nord)}<br />
          Rotation ${gon.toFixed(4)} gon (${degres.toFixed(4)}°) · Échelle ${r.echelle.toFixed(6)}<br />
          <strong>Écart d'angle de la ligne 2 : ${ecart.gon.toFixed(4)} gon (${ecart.degres.toFixed(3)}°)</strong>
        </p>`;
      })();
    return `<p class="etape-recalage etape-dxf"><span class="numero-etape">Résultat</span>Le plan posé est montré en rouge transparent : vérifie qu'il est dans le bon sens (sinon « Tourner de 180° »), puis « Appliquer ». Calé sur la ligne 1 ; la ligne 2 sert de contrôle.</p>
      ${echelle}${liste}${resultat}
      <div class="ligne-barre-pointage">
        <button type="button" class="bouton-secondaire" data-action="tournerAxes">Tourner de 180°</button>
        <button type="button" class="bouton" data-action="appliquerAxes" ${r.erreur ? 'disabled' : ''}>Appliquer</button>
        <button type="button" class="bouton-lien" data-action="annulerRecalage">annuler le recalage</button>
      </div>`;
  }
  const texte = etape.cote === 'plan'
    ? `Ligne ${etape.rang} sur le plan à caler : ${axes.facon === 'points' ? `touche ${axes.premier ? 'le 2e point' : 'le 1er point'}` : 'touche un trait'}`
    : `La même ligne ${etape.rang} déjà calée (autre plan, levé, dessin) : ${axes.facon === 'points' ? `touche ${axes.premier ? 'le 2e point' : 'le 1er point'}` : 'touche un trait'}`;
  const accroches = axes.facon === 'points'
    ? (etape.cote === 'plan' ? accrochesDxf(etat) : `<div class="ligne-barre-pointage">${ACCROCHES_CALE.map(([cle, titre]) => puce('choisirAccrocheCale', cle, titre, etat.accrocheCale === cle)).join('')}</div>`)
    : '';
  return `<p class="etape-recalage etape-${etape.cote === 'plan' ? 'dxf' : 'cale'}"><span class="numero-etape">Étape ${etape.numero} / 4</span>${texte}</p>
    <div class="ligne-barre-pointage">${puce('choisirFaconAxes', 'ligne', 'Toucher une ligne', axes.facon !== 'points')}${puce('choisirFaconAxes', 'points', 'Ligne entre 2 points', axes.facon === 'points')}</div>
    ${accroches}
    ${candidatAxes(axes.candidat)}
    ${etape.numero === 1 ? echelle : ''}
    ${liste}
    <div class="ligne-barre-pointage"><button type="button" class="bouton-lien" data-action="annulerRecalage">annuler le recalage</button></div>`;
}
