// Calculs › Dessin (demande du 26.10.2026, mode Confirmé) : plateformes, bâtiments, lignes et points
// dessinés dans l'appli, comme avec l'outil « pilote » de Leica iCON :
// - un point de départ (toucher le plan, coordonnées tapées, ou le RX2) ;
// - puis, depuis le dernier sommet, une direction (toucher le plan, gisement en gon, vers le RX2,
//   ou tourner de 90°) et une distance → « Ajouter le sommet » ;
// - plateforme et bâtiment : figures fermées ; « Rectangle » (longueur, largeur, à droite ou à gauche) ;
// - altitudes : une altitude fixe (avec une pente le long d'un côté, facultative) ou une par sommet.
// Calculs dans topo/dessin.js ; le dessin sur le plan dans plan/dessins.js.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { formaterNombre } from '../topo/format.js';
import { TYPES_DESSIN, estFerme } from '../topo/dessin.js';

const NOM_TYPE = Object.fromEntries(TYPES_DESSIN);
const nombre = (valeur) => (valeur == null ? '' : String(Math.round(valeur * 1000) / 1000));

/**
 * Crée l'écran dans "conteneur". actions (main.js) : nouveauDessin(type), dessiner(id),
 * terminerDessin(), supprimerDessin(id), renommerDessin(id, nom), choisirToucher(mode),
 * reglerDirection(texte), tournerDirection(sens), reglerDistance(texte), ajouterSommetPilote(),
 * ouvrirSommetTape(), sommetRx2(), directionRx2(), rectangleDessin({ longueur, largeur, cote }),
 * annulerSommet(), reglerHauteur(id, champ, valeur), altitudeSommet(id, n°, texte).
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
    if (action === 'ajouterSommetPilote') {
      // Les cases tapées sans Entrée sont lues d'abord, toutes les deux avant de les envoyer
      // (l'écran est redessiné après chaque réglage).
      const direction = conteneur.querySelector('[data-pilote="direction"]')?.value ?? '';
      const distance = conteneur.querySelector('[data-pilote="distance"]')?.value ?? '';
      actions.reglerDirection(direction);
      actions.reglerDistance(distance);
      actions.ajouterSommetPilote();
      return;
    }
    actions[action]?.(valeur);
  });

  conteneur.addEventListener('change', (evenement) => {
    const champ = evenement.target;
    const { id } = champ.dataset;
    if (champ.dataset.champ === 'nom-dessin') actions.renommerDessin(id, champ.value.trim());
    else if (champ.dataset.pilote === 'direction') actions.reglerDirection(champ.value);
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

/** Tout l'écran : boutons de création, puis chaque dessin (le dessin en cours avec le pilote). */
function htmlDessins({ dessins, pilote, recepteur }) {
  return `
    <div class="boutons-dessin">
      ${TYPES_DESSIN.map(([cle, titre]) => `<button type="button" class="bouton-secondaire" data-action="nouveauDessin" data-valeur="${cle}">+ ${titre}</button>`).join('')}
    </div>
    ${dessins.length === 0 ? '<p class="vide">Aucun dessin.</p>' : dessins.map((d) => carteDessin(d, pilote?.dessinId === d.id ? pilote : null, recepteur)).join('')}`;
}

/** Un dessin : nom, résumé, pilote (s'il est en cours), altitudes, sommets. */
function carteDessin(d, pilote, recepteur) {
  const ferme = estFerme(d);
  const resume = [
    `${d.sommets.length} ${d.type === 'points' ? 'point(s)' : 'sommet(s)'}`,
    d.type === 'points' || d.sommets.length < 2 ? '' : `${ferme ? 'périmètre' : 'longueur'} ${formaterNombre(d.perimetre)} m`,
    ferme && d.sommets.length >= 3 ? `aire ${formaterNombre(d.aire)} m²` : '',
  ].filter(Boolean).join(' · ');
  return `<div class="carte-dessin type-${d.type} ${pilote ? 'en-edition' : ''}">
    <div class="entete-dessin">
      <span class="type-dessin">${NOM_TYPE[d.type]}</span>
      <input type="text" class="nom-dessin" data-champ="nom-dessin" data-id="${d.id}" value="${echapper(d.nom)}" aria-label="Nom du dessin" />
    </div>
    <p class="aide">${resume}</p>
    ${pilote ? htmlPilote(d, pilote, recepteur) : `<div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="dessiner" data-valeur="${d.id}">Dessiner</button>
        <button type="button" class="bouton-lien" data-action="supprimerDessin" data-valeur="${d.id}">supprimer</button>
      </div>`}
    ${d.type === 'plateforme' || d.type === 'batiment' ? htmlHauteur(d) : ''}
    ${htmlSommets(d)}
  </div>`;
}

/**
 * Pilote : ce que fait un toucher sur le plan (sommet ou direction), départ par coordonnées ou RX2,
 * direction (gon, ±90°) et distance, rectangle, annuler, terminé.
 */
function htmlPilote(d, p, recepteur) {
  const avecDepart = d.sommets.length > 0;
  const puce = (mode, titre, permis = true) => `<button type="button" class="puce-choix ${p.toucher === mode ? 'actif' : ''}" data-action="choisirToucher" data-valeur="${mode}" ${permis ? '' : 'disabled'}>${titre}</button>`;
  const rectangle = (d.type === 'plateforme' || d.type === 'batiment') && d.sommets.length === 1 && p.direction != null
    ? `<div class="rectangle-dessin">
        <span>Rectangle</span>
        <label>Longueur<input type="text" inputmode="decimal" data-rectangle="longueur" placeholder="m" /></label>
        <label>Largeur<input type="text" inputmode="decimal" data-rectangle="largeur" placeholder="m" /></label>
        <button type="button" class="bouton-secondaire" data-action="rectangleDessin" data-valeur="gauche">↰ à gauche</button>
        <button type="button" class="bouton-secondaire" data-action="rectangleDessin" data-valeur="droite">à droite ↱</button>
      </div>`
    : '';
  return `<div class="pilote-dessin">
    <p class="etape-pilote">${avecDepart ? `Depuis le sommet ${d.sommets.length} : direction et distance` : 'Point de départ'} ${bulle('dessin')}</p>
    <div class="ligne-choix"><span>Toucher le plan</span>${puce('sommet', d.type === 'points' ? 'Point' : 'Sommet')}${d.type === 'points' ? '' : puce('direction', 'Direction', avecDepart)}</div>
    <div class="ligne-outils">
      <button type="button" class="bouton-secondaire" data-action="ouvrirSommetTape">+ Coordonnées</button>
      ${recepteur ? '<button type="button" class="bouton-secondaire" data-action="sommetRx2">+ Point RX2</button>' : ''}
      ${recepteur && avecDepart && d.type !== 'points' ? '<button type="button" class="bouton-secondaire" data-action="directionRx2">Direction vers RX2</button>' : ''}
    </div>
    ${avecDepart && d.type !== 'points' ? `<div class="direction-distance">
        <label>Direction (gon)<input type="text" inputmode="decimal" data-pilote="direction" value="${p.direction == null ? '' : p.direction.toFixed(4)}" placeholder="touche le plan" /></label>
        <button type="button" class="bouton-secondaire" data-action="tournerDirection" data-valeur="gauche" ${p.direction == null ? 'disabled' : ''} aria-label="Tourner de 90° à gauche">↰ 90°</button>
        <button type="button" class="bouton-secondaire" data-action="tournerDirection" data-valeur="droite" ${p.direction == null ? 'disabled' : ''} aria-label="Tourner de 90° à droite">90° ↱</button>
        <label>Distance (m)<input type="text" inputmode="decimal" data-pilote="distance" value="${echapper(p.distance ?? '')}" /></label>
        ${p.reference ? `<span class="aide">vers ${echapper(p.reference)}</span>` : ''}
      </div>
      <button type="button" class="bouton bouton-large" data-action="ajouterSommetPilote">Ajouter le sommet</button>` : ''}
    ${rectangle}
    ${p.ecartFermeture != null ? `<p class="aide">Écart de fermeture : ${formaterNombre(p.ecartFermeture)} m</p>` : ''}
    <div class="ligne-outils">
      <button type="button" class="bouton-lien" data-action="annulerSommet" ${avecDepart ? '' : 'disabled'}>annuler le dernier</button>
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
