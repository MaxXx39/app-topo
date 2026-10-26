// Onglet Terrain › Lame (0.70.0, mode Confirmé) : guidage d'une lame de grader avec 2 RX2 (calculs
// dans topo/lame.js). En haut : la surface à suivre, puis l'écart à chaque coin en grand (monter /
// descendre, en couleur), le dévers mesuré et voulu, et la coupe vue de derrière la lame.
// Les nombres changent 5 fois par seconde sans redessiner l'écran (rafraichirLame).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { formaterNombre } from '../topo/format.js';

/** Texte d'un écart de coin (m) : « ▲ monter 3.2 cm », « ▼ descendre 1.0 cm », « ✓ 0.4 cm ». */
export function texteEcartLame(ecart, classe) {
  if (ecart == null) return 'hors surface';
  const cm = (Math.abs(ecart) * 100).toFixed(1);
  if (classe === 'vert') return `✓ ${cm} cm`;
  return ecart > 0 ? `▲ monter ${cm} cm` : `▼ descendre ${cm} cm`;
}

/** Dévers (%) avec son signe et 2 décimales. */
const pourcent = (valeur) => {
  if (valeur == null) return '—';
  if (Math.abs(valeur) < 0.005) return '0.00 %'; // pas de « −0.00 % »
  return `${valeur > 0 ? '+' : '−'}${Math.abs(valeur).toFixed(2)} %`;
};

/**
 * Écran (sans les nombres en direct). donnees : { surfaces: [{ id, etiquette }], surfaceId,
 * inverse, tolerances: { vert, orange } (m), recepteur2 (vrai si le 2e RX2 est connecté) }.
 */
export function htmlLame(donnees, { reglagesOuverts = false } = {}) {
  const { surfaces, surfaceId, tolerances } = donnees;
  const cm = (m) => String(Math.round(m * 1000) / 10);
  return `<div class="ecran-lame">
    <div class="ligne-lame">
      ${surfaces.length > 0
        ? `<select data-champ="surface-lame" aria-label="Surface à suivre">
            ${surfaceId ? '' : '<option value="">— surface à suivre —</option>'}
            ${surfaces.map((s) => `<option value="${s.id}" ${s.id === surfaceId ? 'selected' : ''}>${echapper(s.etiquette)}</option>`).join('')}
          </select>`
        : '<p class="vide">Aucune surface (Calculs › Surfaces).</p>'}
      <button type="button" class="bouton-secondaire" data-action="inverserLame" title="Inverser gauche et droite">⇄ G / D</button>
      <button type="button" class="bouton-roue ${reglagesOuverts ? 'actif' : ''}" data-action="reglagesLame" aria-label="Tolérances">⚙</button>
      ${bulle('lame')}
    </div>
    ${reglagesOuverts ? `<div class="reglages-lame">
        <label>Vert ≤ <input type="text" inputmode="decimal" data-tolerance-lame="vert" value="${cm(tolerances.vert)}" /> cm</label>
        <label>Orange ≤ <input type="text" inputmode="decimal" data-tolerance-lame="orange" value="${cm(tolerances.orange)}" /> cm</label>
      </div>` : ''}
    ${donnees.recepteur2 ? '' : '<p class="avertissement">Connecte le 2e RX2 : bouton Récepteur › « Récepteur 2 (essai) ».</p>'}
    <p class="raison-lame" data-vivant="lame-raison" hidden></p>
    <div class="coins-lame">
      <div class="coin-lame" data-vivant="lame-gauche"><span class="titre-coin">Gauche</span><strong>—</strong></div>
      <div class="coin-lame" data-vivant="lame-droite"><span class="titre-coin">Droite</span><strong>—</strong></div>
    </div>
    <p class="devers-lame" data-vivant="lame-devers">Dévers —</p>
    <div class="coupe-lame" data-vivant="lame-coupe"></div>
  </div>`;
}

/**
 * Met à jour les nombres en direct dans "conteneur". vivant : { raison (texte, ou null),
 * guidage (voir topo/lame.js guidageLame) ou null, coupe: { longueur, profils, gauche: { distance,
 * altitude }, droite: { … } } ou null }.
 */
export function rafraichirLame(conteneur, vivant) {
  const zone = (nom) => conteneur.querySelector(`[data-vivant="${nom}"]`);
  const raison = zone('lame-raison');
  if (!raison) return;
  raison.hidden = !vivant.raison;
  raison.textContent = vivant.raison ?? '';
  const g = vivant.raison ? null : vivant.guidage;
  for (const cote of ['gauche', 'droite']) {
    const element = zone(`lame-${cote}`);
    const coin = g?.[cote];
    element.className = `coin-lame ${coin?.classe ? `ecart-${coin.classe}` : 'attente'}`;
    element.querySelector('strong').textContent = coin ? texteEcartLame(coin.ecart, coin.classe) : '—';
  }
  zone('lame-devers').innerHTML = g
    ? `Dévers <strong>${pourcent(g.devers)}</strong> · voulu <strong>${pourcent(g.deversVoulu)}</strong>${g.ecartDevers == null ? '' : ` · écart ${pourcent(g.ecartDevers)}`} · lame ${formaterNombre(g.largeur)} m`
    : 'Dévers —';
  zone('lame-coupe').innerHTML = g && vivant.coupe ? svgCoupeLame(vivant.coupe, g) : '';
}

/**
 * Coupe vue de derrière la lame (gauche à gauche) : la surface (trait brun), la lame (trait épais
 * de la couleur de son plus grand écart), les coins. Hauteurs agrandies pour voir les centimètres.
 */
export function svgCoupeLame(coupe, guidage) {
  const largeur = 320;
  const hauteur = 130;
  const marge = 14;
  const { longueur, profils, gauche, droite } = coupe;
  const altitudes = [gauche.altitude, droite.altitude, ...profils.flat().map((p) => p.altitude)];
  const milieu = (Math.min(...altitudes) + Math.max(...altitudes)) / 2;
  const etendue = Math.max(0.2, Math.max(...altitudes) - Math.min(...altitudes)) * 1.3;
  const x = (d) => marge + (d / longueur) * (largeur - 2 * marge);
  const y = (z) => hauteur / 2 - ((z - milieu) / etendue) * (hauteur - 2 * marge);
  const surface = profils
    .map((morceau) => `<path class="surface-coupe-lame" d="M${morceau.map((p) => `${x(p.distance).toFixed(1)} ${y(p.altitude).toFixed(1)}`).join('L')}" />`)
    .join('');
  const pire = [guidage.gauche, guidage.droite].map((c) => c.classe).find((c) => c === 'rouge') ?? [guidage.gauche, guidage.droite].map((c) => c.classe).find((c) => c === 'orange') ?? 'vert';
  const xg = x(gauche.distance);
  const xd = x(droite.distance);
  return `<svg viewBox="0 0 ${largeur} ${hauteur}" class="svg-coupe-lame" role="img" aria-label="Coupe vue de derrière la lame">
    ${surface}
    <line class="lame-coupe lame-${pire}" x1="${xg.toFixed(1)}" y1="${y(gauche.altitude).toFixed(1)}" x2="${xd.toFixed(1)}" y2="${y(droite.altitude).toFixed(1)}" />
    <circle class="coin-coupe-lame" cx="${xg.toFixed(1)}" cy="${y(gauche.altitude).toFixed(1)}" r="5" />
    <circle class="coin-coupe-lame" cx="${xd.toFixed(1)}" cy="${y(droite.altitude).toFixed(1)}" r="5" />
    <text x="${xg.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle">G</text>
    <text x="${xd.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle">D</text>
    <text x="${largeur - 4}" y="12" text-anchor="end" class="note-coupe-lame">hauteurs agrandies</text>
  </svg>`;
}
