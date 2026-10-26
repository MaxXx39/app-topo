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
import { TYPES_DESSIN, estFerme } from '../topo/dessin.js';
import { MODES_ACCROCHE } from '../topo/accroche.js';
import { ACCROCHES } from '../leve/ecran.js';

const NOM_TYPE = Object.fromEntries(TYPES_DESSIN);
const nombre = (valeur) => (valeur == null ? '' : String(Math.round(valeur * 1000) / 1000));

/**
 * Crée l'écran dans "conteneur". actions (main.js) : nouveauDessin(), dessiner(id),
 * terminerDessin(), supprimerDessin(id), renommerDessin(id, nom), choisirAccrocheDessin(mode),
 * tournerCote({ angle, sens }), reglerDistance(texte), ajouterSommetPilote(), sommetRx2(),
 * directionRx2(), fermerFigure(), rectangleDessin({ longueur, largeur, cote }), annulerSommet(),
 * choisirModeHauteur(id:mode), reglerHauteur(id, champ, valeur), altitudeSommet(id, n°, texte), creerSurfaceDessin(id).
 * Renvoie { afficher(donnees) } ; donnees : { dessins, pilote, recepteur }.
 */
export function creerEcranDessin(conteneur, actions) {
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
      conteneur.innerHTML = htmlDessins(donnees);
      if (cle) conteneur.querySelector(`input${cle}`)?.focus();
    },
  };
}

/** Tout l'écran : « + Dessin », puis chaque dessin (le dessin en cours avec le pilote). */
function htmlDessins({ dessins, pilote, recepteur }) {
  return `
    <div class="boutons-dessin">
      <button type="button" class="bouton" data-action="nouveauDessin">+ Dessin</button>
    </div>
    ${dessins.length === 0 ? '<p class="vide">Aucun dessin.</p>' : dessins.map((d) => carteDessin(d, pilote?.dessinId === d.id ? pilote : null, recepteur)).join('')}`;
}

/** Un dessin : nom, résumé, pilote (s'il est en cours), altitudes, sommets. */
function carteDessin(d, pilote, recepteur) {
  const ferme = estFerme(d);
  const resume = [
    `${d.sommets.length} ${d.type === 'points' ? 'point(s)' : 'sommet(s)'}`,
    d.ferme ? 'figure fermée' : '',
    d.type === 'points' || d.sommets.length < 2 ? '' : `${ferme ? 'périmètre' : 'longueur'} ${formaterNombre(d.perimetre)} m`,
    ferme && d.sommets.length >= 3 ? `aire ${formaterNombre(d.aire)} m²` : '',
  ].filter(Boolean).join(' · ');
  // Altitude en haut (avant le pilote) ; la surface seulement pour une figure fermée.
  return `<div class="carte-dessin sorte-${d.type} ${pilote ? 'en-edition' : ''}">
    ${pilote ? '<button type="button" class="bouton-retour-dessin" data-action="terminerDessin">← Retour</button>' : ''}
    <div class="entete-dessin">
      <span class="type-dessin">${NOM_TYPE[d.type] ?? 'Dessin'}</span>
      <input type="text" class="nom-dessin" data-champ="nom-dessin" data-id="${d.id}" value="${echapper(d.nom)}" aria-label="Nom du dessin" />
    </div>
    <p class="aide">${resume}</p>
    ${d.type === 'points' ? '' : htmlHauteur(d)}
    ${pilote ? htmlPilote(d, pilote, recepteur) : `<div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="dessiner" data-valeur="${d.id}">${d.ferme ? 'Rouvrir et dessiner' : 'Dessiner'}</button>
        <button type="button" class="bouton-lien" data-action="supprimerDessin" data-valeur="${d.id}">supprimer</button>
      </div>`}
    ${ferme ? htmlSurface(d) : ''}
    ${htmlSommets(d)}
  </div>`;
}

/**
 * Pilote, étape par étape (le nom de l'étape en évidence) : point de départ (plan ou RX2), direction
 * du 1er côté (plan ou RX2) et distance, puis pour chaque côté suivant un angle (°) à gauche ou à
 * droite du côté précédent et la distance ; rectangle ; fermer la figure ; annuler, terminé.
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
  let detail;
  if (points) {
    etape = 'Point';
    detail = 'touche le plan, ou prends le point au RX2';
  } else if (n === 0) {
    etape = 'Point de départ';
    detail = 'touche le plan, ou prends le point au RX2';
  } else if (n === 1) {
    etape = 'Direction du 1er côté';
    detail = 'touche le plan (un point vers où aller), ou vers le RX2 ; puis la distance';
  } else {
    etape = `Côté ${n}`;
    detail = 'tourne à gauche ou à droite du côté précédent (ou touche le plan), puis la distance';
  }
  const direction = p.direction == null
    ? '<span class="aide">direction pas encore donnée</span>'
    : `<span class="direction-choisie">✓ direction ${p.reference ? echapper(p.reference) : 'donnée'}</span>`;
  // Toujours affichés (même sans direction) : l'écran n'a pas à être redessiné pendant la saisie.
  const rectangle = n === 1 && d.type !== 'ligne' && !points
    ? `<details class="rectangle-dessin">
        <summary>Rectangle (depuis le départ, dans la direction donnée)</summary>
        <label>Longueur<input type="text" inputmode="decimal" data-rectangle="longueur" placeholder="m" /></label>
        <label>Largeur<input type="text" inputmode="decimal" data-rectangle="largeur" placeholder="m" /></label>
        <button type="button" class="bouton-secondaire" data-action="rectangleDessin" data-valeur="gauche">↰ à gauche</button>
        <button type="button" class="bouton-secondaire" data-action="rectangleDessin" data-valeur="droite">à droite ↱</button>
      </details>`
    : '';
  const tourner = n >= 2 && !points
    ? `<div class="tourner-dessin">
        <label>Tourner de<input type="text" inputmode="decimal" data-pilote="angle" value="${echapper(p.angle ?? '90')}" aria-label="Angle en degrés" /><span>°</span></label>
        <button type="button" class="bouton-secondaire ${p.sens === 'gauche' ? 'actif' : ''}" data-action="tournerCote" data-valeur="gauche">↰ à gauche</button>
        <button type="button" class="bouton-secondaire ${p.sens === 'droite' ? 'actif' : ''}" data-action="tournerCote" data-valeur="droite">à droite ↱</button>
      </div>`
    : '';
  return `<div class="pilote-dessin">
    <p class="etape-pilote"><strong>${etape}</strong> ${bulle('dessin')}</p>
    <p class="aide">${detail}</p>
    ${accroches}
    <div class="ligne-outils">
      ${recepteur && (points || n === 0) ? '<button type="button" class="bouton-secondaire" data-action="sommetRx2">Point au RX2</button>' : ''}
      ${recepteur && n >= 1 && !points ? '<button type="button" class="bouton-secondaire" data-action="directionRx2">Direction vers le RX2</button>' : ''}
    </div>
    ${tourner}
    ${n >= 1 && !points ? `<div class="direction-distance">
        ${direction}
        <label>Distance (m)<input type="text" inputmode="decimal" data-pilote="distance" value="${echapper(p.distance ?? '')}" /></label>
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

/** Altitudes d'une plateforme ou d'un bâtiment : fixe (avec pente facultative) ou par sommet. */
function htmlHauteur(d) {
  const h = d.hauteur;
  const n = d.sommets.length;
  const choix = (mode, titre) => `<button type="button" class="puce-choix ${h.mode === mode ? 'actif' : ''}" data-action="choisirModeHauteur" data-valeur="${d.id}:${mode}">${titre}</button>`;
  const options = (actif, texte) => Array.from({ length: n }, (_, i) => `<option value="${i}" ${i === actif ? 'selected' : ''}>${texte(i)}</option>`).join('');
  return `<div class="hauteur-dessin">
    <div class="ligne-choix"><span>Altitude</span>${choix('fixe', 'Fixe')}${choix('sommets', 'Par sommet')}</div>
    ${h.mode === 'fixe' ? `<div class="champs-hauteur">
        <label>Altitude (m)<input type="text" inputmode="decimal" data-hauteur="altitude" data-id="${d.id}" value="${nombre(h.altitude)}" placeholder="ex. 450.20" /></label>
        <label>Pente (%)<input type="text" inputmode="decimal" data-hauteur="pourcent" data-id="${d.id}" value="${nombre(h.pente?.pourcent)}" placeholder="0" /></label>
        ${n >= 2 ? `<label>le long du côté<select data-hauteur="cote" data-id="${d.id}">${options(h.pente?.cote ?? 0, (i) => `${i + 1} → ${(i + 1) % n + 1}`)}</select></label>
        <label>altitude au sommet<select data-hauteur="depuis" data-id="${d.id}">${options(h.pente?.depuis ?? 0, (i) => String(i + 1))}</select></label>` : ''}
      </div>` : ''}
  </div>`;
}

/**
 * Surface de terrassement d'une plateforme ou d'un bâtiment : « Créer la surface », ou son nom
 * (et pourquoi elle n'est pas à jour) ; la raison si on ne peut pas encore la créer.
 */
function htmlSurface(d) {
  if (d.surface) {
    return `<p class="surface-dessin">✓ Surface « ${echapper(d.surface.nom)} » (Calculs › Surfaces)${d.surface.erreur ? ` <span class="erreur">pas à jour : ${echapper(d.surface.erreur)}</span>` : ''}</p>`;
  }
  return `<div class="ligne-outils">
      <button type="button" class="bouton-secondaire" data-action="creerSurfaceDessin" data-valeur="${d.id}" ${d.empecheSurface ? 'disabled' : ''}>Créer la surface</button>
      ${d.empecheSurface ? `<span class="aide">${echapper(d.empecheSurface)}</span>` : ''}
    </div>`;
}

/** Sommets : n°, Est, Nord, altitude (case à remplir en mode « par sommet »). */
function htmlSommets(d) {
  if (d.sommets.length === 0) return '';
  const parSommet = d.hauteur?.mode === 'sommets';
  return `<details class="sommets-dessin">
    <summary>Voir les ${d.type === 'points' ? 'points' : 'sommets'} (${d.sommets.length})</summary>
    <div class="tableau-defilant"><table>
      <thead><tr><th>Nom</th><th>Est (m)</th><th>Nord (m)</th><th>Altitude (m)</th></tr></thead>
      <tbody>${d.sommets.map((s, i) => `<tr><td>${echapper(d.noms[i] ?? String(i + 1))}</td><td>${formaterNombre(s.est)}</td><td>${formaterNombre(s.nord)}</td>
        <td>${parSommet
          ? `<input type="text" inputmode="decimal" class="altitude-sommet" data-altitude-sommet="${i}" data-id="${d.id}" value="${nombre(s.altitude)}" aria-label="Altitude du sommet ${i + 1}" />`
          : (d.altitudes[i] == null ? '—' : formaterNombre(d.altitudes[i]))}</td></tr>`).join('')}</tbody>
    </table></div>
  </details>`;
}
