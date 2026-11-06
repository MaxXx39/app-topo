// Onglet Terrain › Guidage (0.70.0, mode Expert ; refait en 0.100.0 et 0.151.0, demandes du 29.10 et
// du 06.11.2026) : guidage d'une lame (Grader, Bull) ou d'un râteau (calculs dans topo/lame.js et
// topo/outil.js). En haut : la machine et la surface à suivre ; tous les réglages dans ⚙ (nombre de
// GNSS, inverser G / D, distances de l'outil, axe G – D, tolérances). Puis deux coupes du même modèle :
// - coupe G – D (sur l'axe G – D, à « axe » m du GNSS) : écart à gauche et à droite en petit au-dessus,
//   règle de hauteur à gauche, la coupe au milieu (surface, pentes du projet, trait de l'outil), règle à
//   droite ; dessous le dévers et les bords de la surface ;
// - coupe Arr – Av (au milieu de l'outil, perpendiculaire) : pareil, l'arrière à gauche, l'avant à droite.
// Les nombres changent 5 fois par seconde sans redessiner l'écran (rafraichirLame).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { formaterNombre } from '../topo/format.js';
import { htmlRegleHauteur } from './regle-hauteur.js';

/** Texte d'un écart de coin (m) : « monter 3.2 cm », « descendre 1.0 cm » ; « hors surface ». */
export function texteEcartLame(ecart) {
  if (ecart == null) return 'hors surface';
  const cm = (Math.abs(ecart) * 100).toFixed(1);
  return ecart >= 0 ? `monter ${cm} cm` : `descendre ${cm} cm`;
}

/** Dévers (%) avec son signe et 2 décimales. */
const pourcent = (valeur) => {
  if (valeur == null) return '—';
  if (Math.abs(valeur) < 0.005) return '0.00 %'; // pas de « −0.00 % »
  return `${valeur > 0 ? '+' : '−'}${Math.abs(valeur).toFixed(2)} %`;
};

// Les deux coupes : [clé, titre, nom du bout de gauche, nom du bout de droite].
const COUPES = [['gd', 'Coupe G – D', 'G', 'D'], ['long', 'Coupe Arr – Av', 'Arr', 'Av']];

/**
 * Écran (sans les nombres en direct). donnees : { surfaces: [{ id, etiquette }], surfaceId,
 * machine ('grader', 'bull' ou 'rateau'), inverse, tolerances: { vert, orange } (m), recepteur2 (vrai
 * si le 2e GNSS est connecté), unGnss, outil: { gauche, droite, avant, arriere, axe } }.
 */
export function htmlLame(donnees, { reglagesOuverts = false, bip = true } = {}) {
  const { surfaces, surfaceId, tolerances } = donnees;
  const cm = (m) => String(Math.round(m * 1000) / 10);
  const machine = ['bull', 'rateau'].includes(donnees.machine) ? donnees.machine : 'grader';
  // Outil à 1 GNSS (0.142.0) : râteau, ou Bull réglé sur 1 GNSS ; distances depuis le bas du mât.
  const unGnss = Boolean(donnees.unGnss);
  const outil = donnees.outil ?? {};
  const valeur = (cle) => (outil[cle] == null || outil[cle] === '' ? '' : Number(outil[cle]).toFixed(3));
  const champOutil = (cle, titre, attente = '0.000') => `<label>${titre} <input type="text" inputmode="decimal" data-outil="${cle}" value="${valeur(cle)}" placeholder="${attente}" /> m</label>`;
  // Réglages (0.151.0 : tous dans ⚙).
  const nombreGnss = machine === 'bull'
    ? `<div class="ligne-lame choix-gnss" role="radiogroup" aria-label="Nombre de GNSS">
        <button type="button" class="case-machine petite ${unGnss ? 'actif' : ''}" role="radio" data-action="choisirRecepteursBull" data-valeur="1" aria-checked="${unGnss}">1 GNSS</button>
        <button type="button" class="case-machine petite ${unGnss ? '' : 'actif'}" role="radio" data-action="choisirRecepteursBull" data-valeur="2" aria-checked="${!unGnss}">2 GNSS</button>
      </div>`
    : '';
  const bords = unGnss
    ? `<p class="titre-choix">Depuis le bas du GNSS jusqu'au bord ${machine === 'rateau' ? 'du râteau' : 'de la lame'}</p>
        ${champOutil('gauche', 'Gauche')}${champOutil('droite', 'Droite')}`
    : '<button type="button" class="bouton-secondaire" data-action="inverserLame" title="Inverser gauche et droite">⇄ Inverser G / D</button>';
  const reglages = `<div class="reglages-lame-tous">
      ${nombreGnss}
      <div class="reglages-outil">${bords}</div>
      <div class="reglages-outil">
        <p class="titre-choix">Coupes (depuis ${unGnss ? 'le GNSS' : 'la ligne des GNSS'})</p>
        ${champOutil('axe', 'Axe G – D', machine === 'rateau' ? 'milieu' : '0.000')}
        <span class="aide">− derrière, + devant</span>
        ${champOutil('avant', 'Avant')}${champOutil('arriere', 'Arrière')}
      </div>
      <div class="reglages-lame">
        <label>Vert ≤ <input type="text" inputmode="decimal" data-tolerance-lame="vert" value="${cm(tolerances.vert)}" /> cm</label>
        <label>Orange ≤ <input type="text" inputmode="decimal" data-tolerance-lame="orange" value="${cm(tolerances.orange)}" /> cm</label>
      </div>
    </div>`;
  // Grader, Bull ou Râteau (0.114.0) : boutons côte à côte, un seul choisi à la fois.
  const caseMachine = (cle, titre) => `<button type="button" class="case-machine ${machine === cle ? 'actif' : ''}" role="radio" data-action="choisirMachine" data-valeur="${cle}" aria-checked="${machine === cle}">${titre}</button>`;
  return `<div class="ecran-lame">
    <div class="ligne-lame choix-machine" role="radiogroup" aria-label="Machine">${caseMachine('grader', 'Grader')}${caseMachine('bull', 'Bull')}${caseMachine('rateau', 'Râteau')}</div>
    <div class="ligne-lame">
      ${surfaces.length > 0
        ? `<select data-champ="surface-lame" aria-label="Levé à suivre">
            ${surfaces.some((s) => s.id === surfaceId) ? '' : '<option value="" selected>— levé à suivre —</option>'}
            ${surfaces.map((s) => `<option value="${s.id}" ${s.id === surfaceId ? 'selected' : ''}>${echapper(s.etiquette)}</option>`).join('')}
          </select>`
        : '<p class="vide">Aucun levé (Terrain › Lever).</p>'}
      <button type="button" class="bouton-bip ${bip ? '' : 'coupe'}" data-action="basculerBip" aria-pressed="${bip}" title="${bip ? 'Couper le bip' : 'Remettre le bip'}" aria-label="${bip ? 'Couper le bip' : 'Remettre le bip'}">${bip ? '🔔' : '🔕'}</button>
      <button type="button" class="bouton-roue ${reglagesOuverts ? 'actif' : ''}" data-action="reglagesLame" aria-label="Réglages">⚙</button>
      ${bulle('lame')}
    </div>
    ${reglagesOuverts ? reglages : ''}
    ${donnees.recepteur2 || unGnss ? '' : '<button type="button" class="bouton-secondaire bouton-recepteur-2" data-action="ouvrirRecepteur">Connecter le 2e GNSS</button>'}
    <p class="raison-lame" data-vivant="lame-raison" hidden></p>
    ${COUPES.map(([cle, titre]) => `<section class="bloc-coupe-guidage" data-coupe="${cle}">
        <div class="tete-coupe-guidage">
          <div class="ecart-coupe attente" data-vivant="lame-${cle}-gauche"></div>
          <span class="titre-coupe-guidage">${titre}</span>
          <div class="ecart-coupe attente" data-vivant="lame-${cle}-droite"></div>
        </div>
        <div class="corps-coupe-guidage">
          <div class="colonne-regle" data-vivant="lame-${cle}-regle-gauche">${htmlRegleHauteur(null)}</div>
          <div class="coupe-guidage" data-vivant="lame-${cle}-coupe"></div>
          <div class="colonne-regle" data-vivant="lame-${cle}-regle-droite">${htmlRegleHauteur(null)}</div>
        </div>
        <p class="pied-coupe-guidage" data-vivant="lame-${cle}-pied"></p>
      </section>`).join('')}
  </div>`;
}

/** Petite flèche monter (vers le haut) ou descendre (vers le bas), en SVG. */
function petiteFleche(ecart) {
  const haut = ecart >= 0;
  return `<svg class="fleche-coupe" viewBox="0 0 40 48" aria-hidden="true"><path d="${haut ? 'M20 2 38 24H27V46H13V24H2Z' : 'M20 46 38 24H27V2H13V24H2Z'}" /></svg>`;
}

/**
 * Met à jour les nombres en direct dans "conteneur". vivant : { raison (texte, ou null), guidage
 * (axe G – D, voir topo/lame.js guidageLame) ou null, long (axe Arr – Av : gauche = arrière, droite =
 * avant, devers = pente vers l'avant) ou null, coupe et coupeLong (voir coupeEntre) ou null, bords
 * (voir bordsDeLaLame) ou null, unGnss, toleranceVert }.
 */
export function rafraichirLame(conteneur, vivant) {
  const zone = (nom) => conteneur.querySelector(`[data-vivant="${nom}"]`);
  const raison = zone('lame-raison');
  if (!raison) return;
  raison.hidden = !vivant.raison;
  raison.textContent = vivant.raison ?? '';
  const g = vivant.raison ? null : vivant.guidage;
  const donnees = { gd: { guidage: g, coupe: vivant.coupe }, long: { guidage: g ? vivant.long : null, coupe: vivant.coupeLong } };
  for (const [cle, , nomGauche, nomDroite] of COUPES) {
    const { guidage, coupe } = donnees[cle];
    for (const [cote, nom] of [['gauche', nomGauche], ['droite', nomDroite]]) {
      const point = guidage?.[cote];
      const element = zone(`lame-${cle}-${cote}`);
      element.className = `ecart-coupe ${point?.classe ? `ecart-${point.classe}` : 'attente'}`;
      element.innerHTML = `<span class="nom-bout">${nom}</span>${point?.ecart != null ? petiteFleche(point.ecart) : ''}<strong>${point ? texteEcartLame(point.ecart) : '—'}</strong>`;
      // Règle de hauteur (0.107.0) : à gauche du bout gauche, à droite du bout droit.
      zone(`lame-${cle}-regle-${cote}`).innerHTML = htmlRegleHauteur(point?.ecart ?? null, vivant.toleranceVert ?? 0.02);
    }
    zone(`lame-${cle}-coupe`).innerHTML = guidage && coupe ? svgCoupeGuidage(coupe, guidage, [nomGauche, nomDroite]) : '';
  }
  // Sous la coupe G – D : dévers (et écart au centre d'un outil à 1 GNSS), bords de la surface.
  const centre = g?.centre ? `Centre <strong>${texteEcartLame(g.centre.ecart)}</strong> · ` : '';
  const bord = (cote) => {
    const b = g ? vivant.bords?.[cote] : null;
    return b ? `<span class="${b.distance < 0 ? 'hors' : ''}">${cote === 'gauche' ? '◂ bord' : 'bord ▸'} ${b.distance < 0 ? '−' : ''}${Math.abs(b.distance).toFixed(2)} m</span>` : '';
  };
  zone('lame-gd-pied').innerHTML = g
    ? `${bord('gauche')}<span>${centre}Dévers <strong>${pourcent(g.devers)}</strong> · voulu <strong>${pourcent(g.deversVoulu)}</strong></span>${bord('droite')}`
    : '';
  const l = g ? vivant.long : null;
  zone('lame-long-pied').innerHTML = l
    ? `<span>Pente vers l'avant <strong>${pourcent(l.devers)}</strong> · voulue <strong>${pourcent(l.deversVoulu)}</strong></span>`
    : '';
}

/**
 * Coupe verticale de la surface (même dessin pour G – D et Arr – Av) : la surface (trait brun), la
 * pente du projet de chaque tronçon (texte), les ruptures de pente, et le trait de l'outil entre ses
 * deux bouts (de la couleur du plus grand écart). Hauteurs agrandies pour voir les centimètres.
 * coupe : voir topo/lame.js coupeEntre ; guidage : { gauche, droite } (classes) ; noms : [gauche, droite].
 */
export function svgCoupeGuidage(coupe, guidage, noms) {
  const largeur = 300;
  const hauteur = 140;
  const marge = 12;
  const { longueur, morceaux, troncons, ruptures, a, b } = coupe;
  const altitudes = [a.altitude, b.altitude, ...morceaux.flat().map((p) => p.altitude)].filter((z) => z != null);
  const bas = Math.min(...altitudes);
  const haut = Math.max(...altitudes);
  const milieu = (bas + haut) / 2;
  const etendue = Math.max(0.2, haut - bas) * 1.4;
  const x = (d) => marge + (d / longueur) * (largeur - 2 * marge);
  const y = (z) => hauteur / 2 - ((z - milieu) / etendue) * (hauteur - 2 * marge - 16);
  const surface = morceaux
    .map((m) => `<path class="surface-coupe-lame" d="M${m.map((p) => `${x(p.distance).toFixed(1)} ${y(p.altitude).toFixed(1)}`).join('L')}" />`)
    .join('');
  // Pente du projet au milieu de chaque tronçon assez long à l'écran, sous la ligne.
  const altitudeA = (d) => {
    const m = morceaux.find((k) => k[0].distance <= d && k.at(-1).distance >= d) ?? [];
    const i = m.findIndex((p) => p.distance >= d);
    const p1 = m[Math.max(0, i - 1)];
    const p2 = m[i];
    return p1 && p2 && p2.distance > p1.distance ? p1.altitude + ((d - p1.distance) / (p2.distance - p1.distance)) * (p2.altitude - p1.altitude) : milieu;
  };
  const pentes = troncons
    .filter((t) => x(t.fin) - x(t.debut) > 40)
    .map((t) => {
      const d = (t.debut + t.fin) / 2;
      return `<text x="${x(d).toFixed(1)}" y="${(y(altitudeA(d)) + 16).toFixed(1)}" text-anchor="middle" class="pente-profil">${Math.abs(t.pente) < 0.05 ? '' : t.pente > 0 ? '+' : '−'}${Math.abs(t.pente).toFixed(1)} %</text>`;
    })
    .join('');
  const marques = ruptures
    .map((d) => `<line class="rupture-profil" x1="${x(d).toFixed(1)}" y1="${marge}" x2="${x(d).toFixed(1)}" y2="${hauteur - 14}" />`)
    .join('');
  const classes = [guidage.gauche?.classe, guidage.droite?.classe];
  const pire = classes.find((c) => c === 'rouge') ?? classes.find((c) => c === 'orange') ?? 'vert';
  const [xa, xb] = [x(a.distance), x(b.distance)];
  const [ya, yb] = [y(a.altitude), y(b.altitude)];
  return `<svg viewBox="0 0 ${largeur} ${hauteur}" class="svg-coupe-lame svg-coupe-guidage" role="img" aria-label="Coupe ${noms[0]} – ${noms[1]}">
    ${marques}
    ${surface}
    ${pentes}
    <line class="lame-coupe lame-${pire}" x1="${xa.toFixed(1)}" y1="${ya.toFixed(1)}" x2="${xb.toFixed(1)}" y2="${yb.toFixed(1)}" />
    <circle class="coin-coupe-lame" cx="${xa.toFixed(1)}" cy="${ya.toFixed(1)}" r="5" />
    <circle class="coin-coupe-lame" cx="${xb.toFixed(1)}" cy="${yb.toFixed(1)}" r="5" />
    <text x="${xa.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle">${noms[0]}</text>
    <text x="${xb.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle">${noms[1]}</text>
    <text x="${largeur - 4}" y="11" text-anchor="end" class="note-coupe-lame">hauteurs agrandies</text>
  </svg>`;
}
