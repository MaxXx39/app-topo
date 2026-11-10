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
import { silhouetteOutil } from './silhouettes.js';

/** Petit dessin de la machine (vue de derrière « gd » ou de côté « long ») pour l'écran de choix. */
function imageMachine(machine, vue, boite) {
  return `<svg viewBox="${boite}" aria-hidden="true">${silhouetteOutil(machine, vue, { x: 0, y: 0 })}</svg>`;
}

/** Texte d'un écart de coin (m) : « monter 3.2 cm », « descendre 1.0 cm » ; « hors surface ». */
export function texteEcartLame(ecart) {
  if (ecart == null) return 'hors surface';
  const cm = (Math.abs(ecart) * 100).toFixed(1);
  return ecart >= 0 ? `monter ${cm} cm` : `descendre ${cm} cm`;
}

/** Écart sans mot (0.151.1 : la flèche suffit) : « 3.2 cm » ; « hors surface ». */
function texteCm(ecart) {
  if (ecart == null) return 'hors surface';
  return `${(Math.abs(ecart) * 100).toFixed(1)} cm`;
}

/** Dévers (%) avec son signe et 2 décimales. */
const pourcent = (valeur) => {
  if (valeur == null) return '—';
  if (Math.abs(valeur) < 0.005) return '0.00 %'; // pas de « −0.00 % »
  return `${valeur > 0 ? '+' : '−'}${Math.abs(valeur).toFixed(2)} %`;
};

// Les deux coupes : [clé, titre, nom du bout de gauche, nom du bout de droite].
const COUPES = [['gd', 'Coupe G – D', 'G', 'D'], ['long', 'Coupe Arr – Av', 'Arr', 'Av']];
// Vues du Guidage (0.152.0, choisies dans ⚙) : [clé, titre].
const VUES = [['plan1', 'Plan + 1 coupe'], ['plan2', 'Plan + 2 coupes'], ['coupes', '2 coupes sans plan']];

/**
 * Écran (sans les nombres en direct). donnees : { surfaces: [{ id, etiquette }], surfaceId,
 * machine ('grader', 'bull' ou 'rateau'), inverse, tolerances: { vert, orange } (m), recepteur2 (vrai
 * si le 2e GNSS est connecté), unGnss, outil: { gauche, droite, avant, arriere, axe } }.
 */
export function htmlLame(donnees, { reglagesOuverts = false, bip = true, choixMachine = false } = {}) {
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
        ${champOutil('gauche', 'Gauche')}${champOutil('droite', 'Droite')}${machine === 'rateau' ? `${champOutil('avant', 'Avant')}${champOutil('arriere', 'Arrière')}` : ''}`
    : '<button type="button" class="bouton-secondaire" data-action="inverserLame" title="Inverser gauche et droite">⇄ Inverser G / D</button>';
  const vue = ['plan1', 'plan2', 'coupes'].includes(donnees.vue) ? donnees.vue : 'plan2';
  const coupeSeule = donnees.coupeSeule === 'long' ? 'long' : 'gd';
  const indic = donnees.indic === 'regle' ? 'regle' : 'exterieur';
  const marges = donnees.marges ?? { gauche: 1, droite: 1, devant: 2, derriere: 2 };
  const puce = (action, cle, titre, actif) => `<button type="button" class="puce-choix ${actif ? 'actif' : ''}" data-action="${action}" data-valeur="${cle}" aria-pressed="${actif}">${titre}</button>`;
  const champMarge = (cle, titre) => `<label>${titre} <input type="text" inputmode="decimal" data-marge-lame="${cle}" value="${Number(marges[cle] ?? 0).toFixed(1)}" /> m</label>`;
  const reglages = `<div class="reglages-lame-tous">
      <div class="reglages-outil">
        <p class="titre-choix">Vue</p>
        ${VUES.map(([cle, titre]) => puce('choisirVueLame', cle, titre, vue === cle)).join('')}
        ${vue === 'plan1' ? `<span class="aide">coupe :</span>${puce('choisirCoupeLame', 'gd', 'G – D', coupeSeule === 'gd')}${puce('choisirCoupeLame', 'long', 'Arr – Av', coupeSeule === 'long')}` : ''}
      </div>
      <div class="reglages-outil">
        <p class="titre-choix">Triangles et valeurs</p>
        ${puce('choisirIndicLame', 'exterieur', 'À côté de la règle', indic !== 'regle')}${puce('choisirIndicLame', 'regle', 'Sur la règle', indic === 'regle')}
      </div>
      ${nombreGnss}
      <div class="reglages-outil">${bords}</div>
      <div class="reglages-outil">
        ${champOutil('axe', `${machine === 'rateau' ? 'Râteau' : 'Lame'} depuis GNSS`, machine === 'rateau' ? 'milieu' : '0.000')}
        <span class="aide">− derrière, + devant</span>

      </div>
      <div class="reglages-outil">
        <p class="titre-choix">Longueur des coupes au-delà de l'outil</p>
        ${champMarge('gauche', 'Gauche')}${champMarge('droite', 'Droite')}${champMarge('devant', 'Devant')}${champMarge('derriere', 'Derrière')}
      </div>
      <div class="reglages-outil">
        <label>Δ Z surface <input type="text" inputmode="decimal" data-champ="delta-surface" value="${donnees.deltaSurface ? Number(donnees.deltaSurface).toFixed(3) : ''}" placeholder="0.000" /> m</label>
        <button type="button" class="bouton-secondaire" data-action="deltaSurfaceZero" ${donnees.deltaSurface ? '' : 'disabled'}>0</button>
        <span class="aide">+ plus haut</span>
      </div>
      <div class="reglages-lame">
        <label>Vert ≤ <input type="text" inputmode="decimal" data-tolerance-lame="vert" value="${cm(tolerances.vert)}" /> cm</label>
        <label>Orange ≤ <input type="text" inputmode="decimal" data-tolerance-lame="orange" value="${cm(tolerances.orange)}" /> cm</label>
      </div>
    </div>`;
  // 0.153.0 : d'abord le choix de la machine, en grand ; ensuite le guidage, sans ce bandeau.
  if (choixMachine) {
    const grosse = (cle, titre) => `<button type="button" class="grosse-machine ${machine === cle ? 'actif' : ''}" data-action="choisirMachine" data-valeur="${cle}">
      <span class="images-machine">${imageMachine(cle, 'gd', '-55 -150 110 160')}${imageMachine(cle, 'long', '-160 -150 285 160')}</span><span>${titre}</span></button>`;
    return `<div class="ecran-lame choix-machine-depart">
      <p class="titre-choix">Quelle machine ?</p>
      ${grosse('grader', 'Grader')}${grosse('bull', 'Bull')}${grosse('rateau', 'Râteau')}
    </div>`;
  }
  return `<div data-machine="${machine}" class="ecran-lame ${indic === 'regle' ? 'essai-sur-regle' : 'essai-exterieur'} ${machine === 'rateau' ? '' : 'lame-un-point'}">
    <div class="ligne-lame">
      ${surfaces.length > 0
        ? `<select data-champ="surface-lame" aria-label="Surface à suivre">
            ${surfaces.some((s) => s.id === surfaceId) ? '' : '<option value="" selected>— surface à suivre —</option>'}
            ${surfaces.map((s) => `<option value="${s.id}" ${s.id === surfaceId ? 'selected' : ''}>${echapper(s.etiquette)}</option>`).join('')}
          </select>`
        : '<p class="vide">Aucune surface.</p>'}
      <button type="button" class="bouton-bip ${bip ? '' : 'coupe'}" data-action="basculerBip" aria-pressed="${bip}" title="${bip ? 'Couper le bip' : 'Remettre le bip'}" aria-label="${bip ? 'Couper le bip' : 'Remettre le bip'}">${bip ? '🔔' : '🔕'}</button>
      <button type="button" class="bouton-roue ${reglagesOuverts ? 'actif' : ''}" data-action="reglagesLame" aria-label="Réglages">⚙</button>
      ${bulle('lame')}
      <div class="choix-coupes-bandeau" role="group" aria-label="Coupes montrées">
        ${puce('choisirCoupesBandeau', 'gd', 'G – D', vue === 'plan1' && coupeSeule === 'gd')}${puce('choisirCoupesBandeau', 'long', 'Arr – Av', vue === 'plan1' && coupeSeule === 'long')}${puce('choisirCoupesBandeau', 'deux', '2 coupes', vue !== 'plan1')}
      </div>
    </div>
    ${reglagesOuverts ? reglages : ''}
    ${donnees.recepteur2 || unGnss ? '' : '<button type="button" class="bouton-secondaire bouton-recepteur-2" data-action="ouvrirRecepteur"><span class="t-long">Connecter le 2e GNSS</span><span class="t-court">+ 2e GNSS</span></button>'}
    ${htmlLignesSuivies(donnees)}
    <p class="raison-lame" data-vivant="lame-raison" hidden></p>
    <div class="coupes-guidage vue-${vue}">
      ${COUPES.filter(([cle]) => vue !== 'plan1' || cle === coupeSeule).map(([cle, titre]) => `<section class="bloc-coupe-guidage" data-coupe="${cle}">
        <p class="titre-coupe-guidage">${titre}</p>
        <div class="corps-coupe-guidage">
          <div class="colonne-regle" data-vivant="lame-${cle}-regle-gauche">${htmlRegleHauteur(null)}</div>
          <div class="indic-coupe gauche attente" data-vivant="lame-${cle}-gauche"></div>
          <div class="coupe-guidage" data-vivant="lame-${cle}-coupe"></div>
          <div class="indic-coupe droite attente" data-vivant="lame-${cle}-droite"></div>
          <div class="colonne-regle" data-vivant="lame-${cle}-regle-droite">${htmlRegleHauteur(null)}</div>
        </div>
        <p class="pied-coupe-guidage" data-vivant="lame-${cle}-pied"></p>
      </section>`).join('')}
    </div>
  </div>`;
}

/**
 * Lignes suivies (0.154.0, Expert ; 0.171.0, maquette B du 09.11) : une seule rangée de deux cases, L1 (bord G) et
 * L2 (bord D). Toucher une case = choisir (ou changer) sa ligne sur le plan ; × l'enlève. L'écart en plan est rempli
 * en direct. Les mêmes cases sont aussi dans la bande du bas (L1 / L2), qui touchent ces boutons.
 */
function htmlLignesSuivies(donnees) {
  const lignes = donnees.lignes ?? [];
  const enChoix = donnees.choixLignes;
  const carte = (slot) => {
    const l = lignes.find((x) => x.slot === slot);
    const nom = `L${slot + 1}`;
    const texte = l ? '—' : enChoix === slot ? 'touche le plan' : '+ choisir';
    return `<div class="carte-ligne-guidage ${l ? 'choisie attente' : 'sans-ligne'} ${enChoix === slot ? 'en-choix' : ''}" data-vivant="lame-ligne-${slot}">
      <button type="button" class="corps-carte-ligne" data-action="choisirLignesGuidage" data-valeur="${slot}" aria-label="Choisir la ligne ${nom}">
        <span class="nom-ligne couleur-${nom}">${nom}</span><small>${slot === 0 ? 'bord G' : 'bord D'}</small><strong class="ecart-ligne">${texte}</strong></button>
      ${donnees.candidatLigne === slot ? `<button type="button" class="bouton-valider-ligne" data-action="validerLigneGuidage" aria-label="Valider la ligne ${nom}">✓ Valider</button>` : l ? `<button type="button" class="bouton-lien" data-action="enleverLigneGuidage" data-valeur="${slot}" aria-label="Enlever ${nom}">×</button>` : ''}
    </div>`;
  };
  return `<div class="cartes-lignes seulement-expert">${carte(0)}${carte(1)}</div>`;
}

/**
 * Place de la silhouette (0.170.0, demande du 09.11) : au milieu du trait de l'outil, TOUJOURS à la largeur
 * G – D (le tranchant = de G à D) et tournée comme le trait dessiné (hauteurs agrandies comprises, pour
 * qu'elle suive la ligne rouge). Ce qui dépasse en haut est simplement coupé par le cadre.
 */
function placeSilhouette(a, b, x, y) {
  const [xa, xb, ya, yb] = [x(a.distance), x(b.distance), y(a.altitude), y(b.altitude)];
  const angle = (Math.atan2(yb - ya, xb - xa) * 180) / Math.PI;
  // 0.188.0 : échelle fixe = largeur de l'outil à l'écran (écart horizontal) ; les hauteurs agrandies ne la changent plus.
  const largeur = Math.abs(xb - xa);
  return { x: (xa + xb) / 2, y: (ya + yb) / 2, angle, echelle: Math.max(0.05, largeur / 80) };
}

/** Triangle pointe en haut (monter) ou en bas (descendre), en SVG (0.152.0, à côté de la règle). */
function triangle(ecart) {
  const haut = ecart >= 0;
  return `<svg class="triangle-coupe" viewBox="0 0 40 36" aria-hidden="true"><path d="${haut ? 'M20 2 38 34H2Z' : 'M20 34 38 2H2Z'}" /></svg>`;
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
    if (!zone(`lame-${cle}-coupe`)) continue; // vue à une seule coupe
    // Lame vue de côté (0.153.1) : un seul écart, au milieu du bas de la lame (côté gauche), rien à droite.
    const milieu = cle === 'long' && guidage?.milieu;
    for (const [cote, nom] of [['gauche', milieu ? 'Milieu' : nomGauche], ['droite', nomDroite]]) {
      const point = milieu ? (cote === 'gauche' ? guidage.milieu : null) : guidage?.[cote];
      if (milieu && cote === 'droite') {
        zone(`lame-${cle}-${cote}`).classList.add('masque');
        zone(`lame-${cle}-regle-${cote}`).classList.add('masque');
        continue;
      }
      const element = zone(`lame-${cle}-${cote}`);
      // 0.152.0 : triangle en haut (pointe en haut = monter), valeur en bas, nom du bout dessous.
      element.className = `indic-coupe ${cote} ${point?.classe ? `ecart-${point.classe}` : 'attente'}`;
      element.innerHTML = `${point?.ecart != null ? triangle(point.ecart) : '<span class="triangle-vide"></span>'}
        <strong>${point?.ecart != null ? (Math.abs(point.ecart) * 100).toFixed(1) : '—'}</strong>
        <span class="unite-coupe">${point?.ecart != null ? 'cm' : (point ? 'hors' : '')}</span>
        <span class="nom-bout">${nom}</span>`;
      // Règle de hauteur (0.107.0) : à gauche du bout gauche, à droite du bout droit.
      zone(`lame-${cle}-regle-${cote}`).innerHTML = htmlRegleHauteur(point?.ecart ?? null, vivant.toleranceVert ?? 0.02);
    }
    // Hauteur du dessin selon la vue (0.152.0) : plus haute sans plan, plus étroite à 2 coupes côte à côte.
    const cadre = zone(`lame-${cle}-coupe`);
    const vue = cadre.closest('.coupes-guidage')?.classList;
    const hauteur = vue?.contains('vue-coupes') ? 230 : vue?.contains('vue-plan2') ? 220 : 150;
    const marquesLignes = cle === 'gd' ? (vivant.lignes ?? []).filter((l) => l.surCoupe != null) : [];
    const machine = cadre.closest('.ecran-lame')?.dataset.machine ?? 'grader';
    cadre.innerHTML = guidage && coupe ? svgCoupeGuidage(coupe, guidage, [nomGauche, nomDroite], hauteur, marquesLignes, { machine, vue: cle, penteEngin: vivant.penteEngin ?? null }) : '';
  }
  // Lignes suivies : écart en plan dans la case L1 (bord G) ou L2 (bord D), flèche vers la ligne (◀ à gauche, ▶ à droite).
  (g ? vivant.lignes ?? [] : []).forEach((l) => {
    const carte = zone(`lame-ligne-${l.slot}`);
    if (!carte) return;
    carte.className = `carte-ligne-guidage choisie ${l.classe ? `ecart-${l.classe}` : 'attente'}`;
    const ecart = carte.querySelector('.ecart-ligne');
    if (ecart) ecart.textContent = l.ecart == null ? 'pas de croisement' : `${l.ecart < 0 ? '◀ ' : ''}${Math.abs(l.ecart).toFixed(2)} m${l.ecart > 0 ? ' ▶' : ''}`;
  });
  // Sous la coupe G – D : dévers (et écart au centre d'un outil à 1 GNSS), bords de la surface.
  const fleche = (e) => (e == null ? '' : e >= 0 ? '↑ ' : '↓ ');
  const centre = g?.centre ? `Centre <strong>${fleche(g.centre.ecart)}${texteCm(g.centre.ecart)}</strong> · ` : '';
  const bord = (cote) => {
    // 0.188.0 : quand une ligne est suivie de ce côté (L1 = gauche, L2 = droite), on n'écrit plus le bord de la surface.
    const ligneDeCeCote = (vivant.lignes ?? []).some((l) => l.slot === (cote === 'gauche' ? 0 : 1));
    const b = g && !ligneDeCeCote ? vivant.bords?.[cote] : null;
    return b ? `<span class="${b.distance < 0 ? 'hors' : ''}">${cote === 'gauche' ? '◂ bord' : 'bord ▸'} ${b.distance < 0 ? '−' : ''}${Math.abs(b.distance).toFixed(2)} m</span>` : '';
  };
  const piedGd = zone('lame-gd-pied');
  if (piedGd) piedGd.innerHTML = g
    ? `${bord('gauche')}<span>${centre}Dévers <strong>${pourcent(g.devers)}</strong> · voulu <strong>${pourcent(g.deversVoulu)}</strong></span>${bord('droite')}`
    : '';
  const l = g && !vivant.long?.milieu ? vivant.long : null;
  const piedLong = zone('lame-long-pied');
  if (piedLong) piedLong.innerHTML = l
    ? `<span>Pente vers l'avant <strong>${pourcent(l.devers)}</strong> · voulue <strong>${pourcent(l.deversVoulu)}</strong></span>`
    : '';
}

/**
 * Coupe verticale de la surface (même dessin pour G – D et Arr – Av) : la surface (trait brun), la
 * pente du projet de chaque tronçon (texte), les ruptures de pente, et le trait de l'outil entre ses
 * deux bouts (de la couleur du plus grand écart). Hauteurs agrandies pour voir les centimètres.
 * coupe : voir topo/lame.js coupeEntre ; guidage : { gauche, droite } (classes) ; noms : [gauche, droite].
 */
export function svgCoupeGuidage(coupe, guidage, noms, hauteur = 140, lignes = [], outil = null) {
  const largeur = 300;
  const marge = 12;
  const { longueur, morceaux, troncons, ruptures, a, b, morceauxBase = null, delta = 0 } = coupe;
  const altitudes = [a?.altitude, b?.altitude, coupe.centre?.altitude, ...morceaux.flat().map((p) => p.altitude), ...(morceauxBase ?? []).flat().map((p) => p.altitude)].filter((z) => z != null);
  const bas = Math.min(...altitudes);
  const haut = Math.max(...altitudes);
  const milieu = (bas + haut) / 2;
  const etendue = Math.max(0.2, haut - bas) * 1.4;
  const x = (d) => marge + (d / longueur) * (largeur - 2 * marge);
  const y = (z) => hauteur / 2 - ((z - milieu) / etendue) * (hauteur - 2 * marge - 16);
  const trace = (m) => `M${m.map((p) => `${x(p.distance).toFixed(1)} ${y(p.altitude).toFixed(1)}`).join('L')}`;
  // Delta Z (0.152.0) : surface de base en gris pointillé, surface décalée en brun.
  const base = (morceauxBase ?? []).map((m) => `<path class="profil-base" d="${trace(m)}" />`).join('');
  const surface = base + morceaux.map((m) => `<path class="surface-coupe-lame" d="${trace(m)}" />`).join('');
  const texteDelta = delta ? `<text x="4" y="11" class="note-coupe-lame texte-delta-surface">Δ ${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(3)} m</text>` : '';
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
  const classes = [guidage.gauche?.classe, guidage.droite?.classe, guidage.milieu?.classe];
  const pire = classes.find((c) => c === 'rouge') ?? classes.find((c) => c === 'orange') ?? 'vert';
  if (coupe.centre) {
    // Lame vue de côté (0.153.1) : le terrain et un seul point, le bas de la lame (pas de trait).
    const xc = x(coupe.centre.distance);
    const yc = y(coupe.centre.altitude);
    // Silhouette de côté (0.155.0) : taille fixe à l'écran (les hauteurs agrandies ne la déforment pas) ; 0.171.0 : inclinée
    // comme l'engin (pente du 1er GNSS, vraie pente, avant à droite : avant plus haut = rotation vers le haut).
    const pente = outil?.penteEngin;
    const angleEngin = pente == null ? 0 : -(Math.atan(pente / 100) * 180) / Math.PI;
    const machineDeCote = outil ? silhouetteOutil(outil.machine, 'long', { x: xc, y: yc, angle: angleEngin, echelle: 0.55 }) : '';
    // Pentes du terrain derrière et devant la lame (surface suivie, avec le delta Z), en % : + = ça monte vers l'avant.
    const pentePar = (d1, d2) => (d2 - d1 > 0.2 ? ((altitudeA(d2) - altitudeA(d1)) / (d2 - d1)) * 100 : null);
    const signe = (v) => (v == null ? '—' : `${Math.abs(v) < 0.05 ? '' : v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} %`);
    const derriere = pentePar(0, coupe.centre.distance);
    const devant = pentePar(coupe.centre.distance, longueur);
    const texteEngin = outil ? `<text x="${largeur * 0.4}" y="12" text-anchor="middle" class="texte-pente-engin">Engin ${pente == null ? '—' : signe(pente)}</text>` : '';
    const textesPentes = `<text x="6" y="${hauteur - 17}" class="note-coupe-lame texte-pente-terrain">derrière ${signe(derriere)}</text>
      <text x="${largeur - 6}" y="${hauteur - 17}" text-anchor="end" class="note-coupe-lame texte-pente-terrain">devant ${signe(devant)}</text>`;
    return `<svg viewBox="0 0 ${largeur} ${hauteur}" class="svg-coupe-lame svg-coupe-guidage" role="img" aria-label="Coupe Arr – Av : bas de la lame">
      ${machineDeCote}${marques}${surface}${pentes}${texteEngin}${textesPentes}
      <circle class="coin-coupe-lame point-lame-${pire}" cx="${xc.toFixed(1)}" cy="${yc.toFixed(1)}" r="6" />
      <text x="6" y="${hauteur - 3}">◂ Arr</text>
      <text x="${largeur - 6}" y="${hauteur - 3}" text-anchor="end">Av ▸</text>
      <text x="${xc.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle" class="note-coupe-lame">bas de lame</text>
      <text x="${largeur - 4}" y="11" text-anchor="end" class="note-coupe-lame">hauteurs agrandies</text>
      ${texteDelta}
    </svg>`;
  }
  const [xa, xb] = [x(a.distance), x(b.distance)];
  const [ya, yb] = [y(a.altitude), y(b.altitude)];
  // Lignes suivies (0.154.0) : trait pointillé là où elles croisent la coupe, avec leur nom.
  // Hors de la coupe : le nom au bord, avec une flèche vers la ligne.
  const traitsLignes = lignes
    .map((l) => {
      // 0.157.0 : une couleur par ligne (L1 violet, L2 orange), comme sur le plan et dans le bandeau.
      // Deux lignes hors de la coupe du même côté : la 2e est écrite plus bas.
      const yNom = l.nom === 'L2' ? 38 : 24;
      if (l.surCoupe < 0) return `<text class="nom-ligne-coupe couleur-${l.nom}" x="4" y="${yNom}">◀ ${l.nom}</text>`;
      if (l.surCoupe > longueur) return `<text class="nom-ligne-coupe couleur-${l.nom}" x="${largeur - 4}" y="${yNom}" text-anchor="end">${l.nom} ▶</text>`;
      return `<line class="ligne-suivie-coupe couleur-${l.nom}" x1="${x(l.surCoupe).toFixed(1)}" y1="14" x2="${x(l.surCoupe).toFixed(1)}" y2="${hauteur - 16}" /><text class="nom-ligne-coupe couleur-${l.nom}" x="${x(l.surCoupe).toFixed(1)}" y="${yNom}" text-anchor="middle">${l.nom}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${largeur} ${hauteur}" class="svg-coupe-lame svg-coupe-guidage" role="img" aria-label="Coupe ${noms[0]} – ${noms[1]}">
    ${outil ? silhouetteOutil(outil.machine, outil.vue, placeSilhouette(a, b, x, y)) : ''}
    ${marques}
    ${surface}
    ${pentes}
    ${traitsLignes}
    <line class="lame-coupe lame-${pire}" x1="${xa.toFixed(1)}" y1="${ya.toFixed(1)}" x2="${xb.toFixed(1)}" y2="${yb.toFixed(1)}" />
    <circle class="coin-coupe-lame" cx="${xa.toFixed(1)}" cy="${ya.toFixed(1)}" r="5" />
    <circle class="coin-coupe-lame" cx="${xb.toFixed(1)}" cy="${yb.toFixed(1)}" r="5" />
    <text x="${xa.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle">${noms[0]}</text>
    <text x="${xb.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle">${noms[1]}</text>
    <text x="${largeur - 4}" y="11" text-anchor="end" class="note-coupe-lame">hauteurs agrandies</text>
    ${texteDelta}
  </svg>`;
}
