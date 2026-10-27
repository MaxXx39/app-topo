// Calculs › Dessin (mode Confirmé), simplifié en 0.66.0 : un seul « + Dessin » (noms D1-1, D1-2…),
// comme l'outil « pilote » de Leica iCON :
// 1. Point de départ : toucher le plan (accroché à un objet : point, sommet, milieu, sur une ligne,
//    centre ; rien sous le doigt = rien de pris) ou le RX2 ;
// 2. Direction du 1er côté : toucher le plan ou vers le RX2, puis la distance → « Ajouter le sommet » ;
// 3. Côtés suivants : tourner de x° (degrés) à gauche ou à droite du côté précédent (ou toucher le
//    plan), puis la distance ; « Fermer la figure » relie le dernier sommet au premier ;
// - rectangle (longueur, largeur, à gauche ou à droite) après le départ et la direction ;
// - altitudes : une altitude fixe (avec une pente le long d'un côté, facultative) ou une par sommet.
// Les plateformes, bâtiments, lignes et points d'avant 0.66.0 gardent leur type et leurs noms (PF1-1…).
// Calculs dans topo/dessin.js ; le dessin sur le plan dans plan/dessins.js.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { formaterNombre } from '../topo/format.js';
import { estFerme } from '../topo/dessin.js';
import { MODES_ACCROCHE } from '../topo/accroche.js';
import { ACCROCHES } from '../leve/ecran.js';

const nombre = (valeur) => (valeur == null ? '' : String(Math.round(valeur * 1000) / 1000));

/**
 * Crée l'écran dans "conteneur". actions (main.js) : nouveauDessin(), dessiner(id),
 * terminerDessin(), supprimerDessin(id), renommerDessin(id, nom), choisirAccrocheDessin(mode),
 * tournerCote({ angle, sens : 'gauche', 'droite' ou 'droit' }), reglerDistance(texte),
 * reglerAltitudePilote(texte), choisirAltitudePilote('idem' ou 'pente'), reglerPentePilote(texte), ajouterSommetPilote(), sommetRx2(),
 * directionRx2(), fermerFigure(), rectangleDessin({ longueur, largeur, cote }), annulerSommet(),
 * choisirModeHauteur(id:mode), reglerHauteur(id, champ, valeur), altitudeSommet(id, n°, texte), creerSurfaceDessin(id).
 * Renvoie { afficher(donnees) } ; donnees : { dessins, pilote, recepteur }.
 */
export function creerEcranDessin(conteneur, actions) {
  // « Voir les sommets » ouverts (gardés quand l'écran est redessiné) : identifiants des dessins.
  const ouverts = new Set();
  conteneur.addEventListener(
    'toggle',
    (evenement) => {
      const id = evenement.target.dataset?.sommets;
      if (!id) return;
      if (evenement.target.open) ouverts.add(id);
      else ouverts.delete(id);
    },
    true,
  );
  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton || bouton.disabled) return;
    const { action, valeur } = bouton.dataset;
    if (action === 'rectangleDessin') {
      const lire = (champ) => conteneur.querySelector(`[data-rectangle="${champ}"]`)?.value ?? '';
      actions.rectangleDessin({ longueur: lire('longueur'), largeur: lire('largeur'), cote: valeur });
      return;
    }
    // Les cases tapées sans Entrée sont lues d'abord (l'écran est redessiné après chaque réglage).
    const distance = conteneur.querySelector('[data-pilote="distance"]')?.value ?? '';
    const altitude = conteneur.querySelector('[data-pilote="altitude"]')?.value ?? '';
    actions.reglerAltitudePilote?.(altitude);
    actions.reglerPentePilote?.(conteneur.querySelector('[data-pilote="pente"]')?.value ?? '');
    if (action === 'voirDistance') {
      // OK : le prochain sommet est montré sur le plan (croix), sans l'ajouter.
      actions.reglerDistance(distance);
      return;
    }
    if (action === 'ajouterSommetPilote') {
      actions.reglerDistance(distance);
      actions.ajouterSommetPilote();
      return;
    }
    if (action === 'tournerCote') {
      actions.reglerDistance(distance);
      actions.tournerCote({ angle: conteneur.querySelector('[data-pilote="angle"]')?.value ?? '', sens: valeur });
      return;
    }
    actions[action]?.(valeur);
  });

  conteneur.addEventListener('change', (evenement) => {
    const champ = evenement.target;
    const { id } = champ.dataset;
    if (champ.dataset.champ === 'nom-dessin') actions.renommerDessin(id, champ.value.trim());
    else if (champ.dataset.pilote === 'distance') actions.reglerDistance(champ.value);
    else if (champ.dataset.pilote === 'altitude') actions.reglerAltitudePilote(champ.value);
    else if (champ.dataset.pilote === 'pente') actions.reglerPentePilote(champ.value);
    else if (champ.dataset.hauteur) actions.reglerHauteur(id, champ.dataset.hauteur, champ.value);
    else if (champ.dataset.altitudeSommet != null) actions.altitudeSommet(id, Number(champ.dataset.altitudeSommet), champ.value);
  });

  // Entrée dans la distance : ajoute le sommet (comme le bouton).
  conteneur.addEventListener('keydown', (evenement) => {
    if (evenement.key !== 'Enter' || evenement.target.dataset.pilote !== 'distance') return;
    evenement.preventDefault();
    conteneur.querySelector('[data-action="ajouterSommetPilote"]')?.click();
  });

  return {
    afficher(donnees) {
      // La case où l'on tapait garde le curseur après le nouveau dessin de l'écran.
      const actif = conteneur.contains(document.activeElement) && document.activeElement.matches('input') ? document.activeElement : null;
      const cle = actif
        ? ['data-pilote', 'data-hauteur', 'data-champ', 'data-altitude-sommet', 'data-id'].filter((a) => actif.hasAttribute(a)).map((a) => `[${a}="${actif.getAttribute(a)}"]`).join('')
        : '';
      conteneur.innerHTML = htmlDessins(donnees, ouverts);
      if (cle) conteneur.querySelector(`input${cle}`)?.focus();
    },
  };
}

/**
 * Tout l'écran : « + Dessin », puis chaque dessin. Pendant un dessin, seule sa carte est montrée
 * (moins de place, surtout sur téléphone).
 */
function htmlDessins({ dessins, pilote, recepteur }, ouverts) {
  const enCours = pilote ? dessins.find((d) => d.id === pilote.dessinId) : null;
  if (enCours) return carteDessin(enCours, pilote, recepteur, ouverts);
  return `
    <div class="boutons-dessin">
      <button type="button" class="bouton" data-action="nouveauDessin">+ Dessin</button>
    </div>
    ${dessins.length === 0 ? '<p class="vide">Aucun dessin.</p>' : dessins.map((d) => carteDessin(d, null, recepteur, ouverts)).join('')}`;
}

/** Un dessin : nom et résumé (une ligne), altitude (une ligne), départ, pilote, surface, sommets. */
function carteDessin(d, pilote, recepteur, ouverts) {
  const ferme = estFerme(d);
  const resume = [
    `${d.sommets.length} ${d.type === 'points' ? 'pt' : 'sommet(s)'}`,
    d.ferme ? 'fermé' : '',
    d.type === 'points' || d.sommets.length < 2 ? '' : `${ferme ? 'pér.' : 'long.'} ${formaterNombre(d.perimetre)} m`,
    ferme && d.sommets.length >= 3 ? `${formaterNombre(d.aire)} m²` : '',
  ].filter(Boolean).join(' · ');
  const depart = d.sommets[0]
    ? `<p class="depart-dessin"><strong>Départ</strong> ${d.nomDepart ? `${echapper(d.nomDepart)} · ` : ''}E ${formaterNombre(d.sommets[0].est)} · N ${formaterNombre(d.sommets[0].nord)}</p>`
    : '';
  return `<div class="carte-dessin sorte-${d.type} ${pilote ? 'en-edition' : ''}">
    <div class="entete-dessin">
      ${pilote ? '<button type="button" class="bouton-retour-dessin" data-action="terminerDessin" aria-label="Retour">←</button>' : ''}
      <input type="text" class="nom-dessin" data-champ="nom-dessin" data-id="${d.id}" value="${echapper(d.nom)}" aria-label="Nom du dessin" />
      <span class="resume-dessin">${resume}</span>
    </div>
    ${d.type === 'points' ? '' : htmlHauteur(d)}
    ${depart}
    ${pilote ? htmlPilote(d, pilote, recepteur) : `<div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="dessiner" data-valeur="${d.id}">${d.ferme ? 'Rouvrir et dessiner' : 'Dessiner'}</button>
        <button type="button" class="bouton-lien" data-action="supprimerDessin" data-valeur="${d.id}">supprimer</button>
      </div>`}
    ${ferme ? htmlSurface(d) : ''}
    ${htmlSommets(d, ouverts.has(d.id))}
  </div>`;
}

/**
 * Pilote, étape par étape (le nom de l'étape en évidence) : point de départ (plan ou RX2), direction
 * du 1er côté (plan ou RX2), puis pour chaque côté suivant tourner (chaque clic ajoute l'angle
 * inscrit) ou tout droit ; distance + OK (aperçu sur le plan), altitude du prochain sommet ;
 * rectangle ; fermer la figure ; annuler, terminé.
 */
function htmlPilote(d, p, recepteur) {
  const n = d.sommets.length;
  const points = d.type === 'points';
  // Accroche aux objets (comme Terrain › Implanter) : un toucher prend toujours un objet, jamais un endroit vide.
  const accroches = `<div class="barre-accroche ouverte barre-accroche-dessin">
      <div class="accroches" role="group" aria-label="Accroche : ce que l'on prend en touchant le plan">
        ${MODES_ACCROCHE.map((mode) => {
          const [mot, nom, dessin] = ACCROCHES[mode];
          return `<button type="button" class="bouton-accroche ${p.accroche === mode ? 'actif' : ''}" data-action="choisirAccrocheDessin" data-valeur="${mode}" title="${nom}" aria-label="${nom}" aria-pressed="${p.accroche === mode}">
            <svg viewBox="0 0 24 24" aria-hidden="true">${dessin}</svg><span class="mot-accroche">${mot}</span></button>`;
        }).join('')}
      </div>
    </div>`;
  let etape;
  if (points) etape = 'Point';
  else if (n === 0) etape = 'Point de départ';
  else if (n === 1) etape = 'Direction du 1er côté';
  else etape = `Côté ${n}`;
  const rx2 = recepteur
    ? (points || n === 0 ? '<button type="button" class="bouton-secondaire" data-action="sommetRx2">Point au RX2</button>' : '')
      + (n >= 1 && !points ? '<button type="button" class="bouton-secondaire" data-action="directionRx2">Direction vers le RX2</button>' : '')
    : '';
  const direction = p.direction == null ? '' : `<span class="direction-choisie">✓ ${p.reference ? echapper(p.reference) : 'direction donnée'}</span>`;
  const tourner = n >= 2 && !points
    ? `<div class="tourner-dessin">
        <input type="text" inputmode="decimal" data-pilote="angle" value="${echapper(p.angle ?? '90')}" aria-label="Angle en degrés" /><span>°</span>
        <button type="button" class="bouton-secondaire" data-action="tournerCote" data-valeur="gauche" aria-label="Tourner à gauche">↰</button>
        <button type="button" class="bouton-secondaire ${p.direction != null && p.tourne === 0 ? 'actif' : ''}" data-action="tournerCote" data-valeur="droit">↑ Tout droit</button>
        <button type="button" class="bouton-secondaire" data-action="tournerCote" data-valeur="droite" aria-label="Tourner à droite">↱</button>
      </div>`
    : '';
  const rectangle = n === 1 && d.type !== 'ligne' && !points
    ? `<details class="rectangle-dessin">
        <summary>Rectangle</summary>
        <label>Longueur<input type="text" inputmode="decimal" data-rectangle="longueur" placeholder="m" /></label>
        <label>Largeur<input type="text" inputmode="decimal" data-rectangle="largeur" placeholder="m" /></label>
        <button type="button" class="bouton-secondaire" data-action="rectangleDessin" data-valeur="gauche">↰ à gauche</button>
        <button type="button" class="bouton-secondaire" data-action="rectangleDessin" data-valeur="droite">à droite ↱</button>
      </details>`
    : '';
  return `<div class="pilote-dessin">
    <p class="etape-pilote"><strong>${etape}</strong> ${direction} ${bulle('dessin')}</p>
    ${accroches}
    ${rx2 ? `<div class="ligne-outils">${rx2}</div>` : ''}
    ${tourner}
    ${n >= 1 && !points ? `<div class="direction-distance">
        <input type="text" inputmode="decimal" data-pilote="distance" value="${echapper(p.distance ?? '')}" placeholder="distance m" aria-label="Distance (m)" />
        <button type="button" class="bouton-secondaire" data-action="voirDistance">OK</button>
        <input type="text" inputmode="decimal" data-pilote="altitude" value="${echapper(p.altitude ?? '')}" placeholder="altitude" aria-label="Altitude du prochain sommet (m)" />
      </div>
      <div class="altitude-pilote" role="group" aria-label="Altitude du prochain sommet">
        <button type="button" class="puce-choix ${p.altitudeChoix === 'idem' ? 'actif' : ''}" data-action="choisirAltitudePilote" data-valeur="idem" aria-pressed="${p.altitudeChoix === 'idem'}">= dernier point</button>
        <button type="button" class="puce-choix ${p.altitudeChoix === 'pente' ? 'actif' : ''}" data-action="choisirAltitudePilote" data-valeur="pente" aria-pressed="${p.altitudeChoix === 'pente'}">pente depuis le dernier</button>
        ${p.altitudeChoix === 'pente' ? `<input type="text" inputmode="decimal" class="champ-pente" data-pilote="pente" value="${echapper(p.pente ?? '')}" placeholder="pente %" aria-label="Pente depuis le dernier sommet (%)" />` : ''}
      </div>
      <button type="button" class="bouton bouton-large" data-action="ajouterSommetPilote">Ajouter le sommet</button>` : ''}
    ${rectangle}
    <div class="ligne-outils">
      <button type="button" class="bouton-lien" data-action="annulerSommet" ${n > 0 ? '' : 'disabled'}>annuler le dernier</button>
      ${n >= 3 && !points && !estFerme(d) ? '<button type="button" class="bouton-secondaire" data-action="fermerFigure">Fermer la figure</button>' : ''}
      <button type="button" class="bouton" data-action="terminerDessin">Terminé</button>
    </div>
  </div>`;
}

/**
 * Altitudes du dessin, sur une ligne : Fixe (altitude, pente %, et si pente : le long de quel
 * côté, depuis quel sommet) ou Par sommet (chaque sommet a la sienne, voir « Voir les sommets »).
 */
function htmlHauteur(d) {
  const h = d.hauteur;
  const n = d.sommets.length;
  const choix = (mode, titre) => `<button type="button" class="puce-choix ${h.mode === mode ? 'actif' : ''}" data-action="choisirModeHauteur" data-valeur="${d.id}:${mode}">${titre}</button>`;
  const options = (actif, texte) => Array.from({ length: n }, (_, i) => `<option value="${i}" ${i === actif ? 'selected' : ''}>${texte(i)}</option>`).join('');
  const avecPente = Boolean(h.pente?.pourcent) && n >= 2;
  return `<div class="hauteur-dessin">
    <span class="titre-hauteur">Alt.</span>${choix('fixe', 'Fixe')}${choix('sommets', 'Par sommet')}
    ${h.mode === 'fixe' ? `<input type="text" inputmode="decimal" data-hauteur="altitude" data-id="${d.id}" value="${nombre(h.altitude)}" placeholder="altitude m" aria-label="Altitude (m)" />
      <input type="text" inputmode="decimal" class="champ-pente" data-hauteur="pourcent" data-id="${d.id}" value="${nombre(h.pente?.pourcent)}" placeholder="pente %" aria-label="Pente (%)" />
      ${avecPente ? `<select data-hauteur="cote" data-id="${d.id}" aria-label="Le long du côté">${options(h.pente?.cote ?? 0, (i) => `côté ${i + 1}→${(i + 1) % n + 1}`)}</select>
      <select data-hauteur="depuis" data-id="${d.id}" aria-label="Altitude au sommet">${options(h.pente?.depuis ?? 0, (i) => `au sommet ${i + 1}`)}</select>` : ''}` : ''}
  </div>`;
}

/**
 * Surface de terrassement d'une plateforme ou d'un bâtiment : « Créer la surface », ou son nom
 * (et pourquoi elle n'est pas à jour) ; la raison si on ne peut pas encore la créer.
 */
function htmlSurface(d) {
  if (d.surface) {
    return `<p class="surface-dessin">✓ Levé « ${echapper(d.surface.nom)} » (Terrain › Lever, Volumes)${d.surface.erreur ? ` <span class="erreur">pas à jour : ${echapper(d.surface.erreur)}</span>` : ''}</p>`;
  }
  return `<div class="ligne-outils">
      <button type="button" class="bouton-secondaire" data-action="creerSurfaceDessin" data-valeur="${d.id}" ${d.empecheSurface ? 'disabled' : ''}>Créer la surface</button>
      ${d.empecheSurface ? `<span class="aide">${echapper(d.empecheSurface)}</span>` : ''}
    </div>`;
}

/** Sommets : nom, Est, Nord, altitude (toujours modifiable : le dessin passe alors « par sommet »). */
function htmlSommets(d, ouvert) {
  if (d.sommets.length === 0) return '';
  return `<details class="sommets-dessin" data-sommets="${d.id}" ${ouvert ? 'open' : ''}>
    <summary>Voir les ${d.type === 'points' ? 'points' : 'sommets'} (${d.sommets.length})</summary>
    <div class="tableau-defilant"><table>
      <thead><tr><th>Nom</th><th>Est (m)</th><th>Nord (m)</th><th>Altitude (m)</th></tr></thead>
      <tbody>${d.sommets.map((s, i) => `<tr><td>${echapper(d.noms[i] ?? String(i + 1))}</td><td>${formaterNombre(s.est)}</td><td>${formaterNombre(s.nord)}</td>
        <td><input type="text" inputmode="decimal" class="altitude-sommet" data-altitude-sommet="${i}" data-id="${d.id}" value="${nombre(d.altitudes[i])}" aria-label="Altitude du sommet ${i + 1}" /></td></tr>`).join('')}</tbody>
    </table></div>
  </details>`;
}
