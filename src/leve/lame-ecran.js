// Onglet Terrain › Lame (0.70.0, mode Expert) : guidage d'une lame de grader avec 2 RX2 (calculs
// dans topo/lame.js). En haut : la surface à suivre, puis l'écart à chaque coin en grand (monter /
// descendre, en couleur), le dévers mesuré et voulu, la coupe vue de derrière la lame et (0.73.0)
// le profil en long dans le sens de marche, avec un petit dessin de niveleuse. De chaque côté de la
// coupe (0.75.0) : le bord de la surface dans le prolongement de la lame (distance, altitude).
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
        ? `<select data-champ="surface-lame" aria-label="Levé à suivre">
            ${surfaceId ? '' : '<option value="">— levé à suivre —</option>'}
            ${surfaces.map((s) => `<option value="${s.id}" ${s.id === surfaceId ? 'selected' : ''}>${echapper(s.etiquette)}</option>`).join('')}
          </select>`
        : '<p class="vide">Aucun levé (Terrain › Lever).</p>'}
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
    <div class="coupe-lame-bords">
      <div class="bord-lame bord-gauche" data-vivant="lame-bord-gauche"></div>
      <div class="coupe-lame" data-vivant="lame-coupe"></div>
      <div class="bord-lame bord-droite" data-vivant="lame-bord-droite"></div>
    </div>
    <div class="reglages-profil-lame">
      <span class="titre-profil">Profil en long</span>
      ${[['gauche', 'Gauche'], ['milieu', 'Milieu'], ['droite', 'Droite']].map(([cle, titre]) => `<button type="button" class="puce-choix ${donnees.pointProfil === cle ? 'actif' : ''}" data-action="choisirPointProfil" data-valeur="${cle}">${titre}</button>`).join('')}
      <label>devant <input type="text" inputmode="decimal" data-profil-lame="devant" value="${donnees.devant}" /> m</label>
      <label>derrière <input type="text" inputmode="decimal" data-profil-lame="derriere" value="${donnees.derriere}" /> m</label>
    </div>
    <div class="profil-lame" data-vivant="lame-profil"></div>
  </div>`;
}

/**
 * Met à jour les nombres en direct dans "conteneur". vivant : { raison (texte, ou null),
 * guidage (voir topo/lame.js guidageLame) ou null, coupe: { longueur, profils, gauche: { distance,
 * altitude }, droite: { … } } ou null, bords: { gauche, droite } (voir bordsDeLaLame) ou null }.
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
  // Bords de la surface dans le prolongement de la lame (0.75.0) : distance (négative hors surface) et altitude.
  for (const cote of ['gauche', 'droite']) {
    const element = zone(`lame-bord-${cote}`);
    const bord = g ? vivant.bords?.[cote] : null;
    element.classList.toggle('hors', Boolean(bord && bord.distance < 0));
    element.innerHTML = bord
      ? `<span class="titre-bord">${cote === 'gauche' ? '◂ bord' : 'bord ▸'}</span><strong>${bord.distance < 0 ? '−' : ''}${Math.abs(bord.distance).toFixed(2)} m</strong><span>H ${formaterNombre(bord.altitude)}</span>`
      : '';
  }
  const profil = zone('lame-profil');
  if (profil) profil.innerHTML = g && vivant.profil ? svgProfilLame(vivant.profil) : '';
}

/** Niveleuse vue de derrière, au-dessus de la lame (coins en pixels) : petit dessin, mâts sur les coins. */
function niveleuseDeDerriere(xg, yg, xd, yd) {
  const xm = (xg + xd) / 2;
  const ym = (yg + yd) / 2;
  return `<g class="niveleuse">
    <path d="M${(xg).toFixed(1)} ${yg.toFixed(1)}V${(yg - 22).toFixed(1)}M${xd.toFixed(1)} ${yd.toFixed(1)}V${(yd - 22).toFixed(1)}" class="mat" />
    <circle cx="${xg.toFixed(1)}" cy="${(yg - 24).toFixed(1)}" r="2.5" class="antenne" /><circle cx="${xd.toFixed(1)}" cy="${(yd - 24).toFixed(1)}" r="2.5" class="antenne" />
    <rect x="${(xm - 16).toFixed(1)}" y="${(ym - 40).toFixed(1)}" width="32" height="16" rx="2" class="cabine" />
    <rect x="${(xm - 22).toFixed(1)}" y="${(ym - 26).toFixed(1)}" width="44" height="8" rx="2" />
  </g>`;
}

/** Niveleuse vue de côté (avant à droite), lame en x, y (pixels) : petit dessin, toujours de la même taille. */
function niveleuseDeCote(x, y) {
  return `<g class="niveleuse" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
    <path d="M-34 -14H34L40 -8V-4H-38V-10Z" />
    <path d="M-30 -14V-30H-14L-10 -14Z" class="cabine" />
    <path d="M0 0V-18" class="mat" /><circle cx="0" cy="-20" r="2.5" class="antenne" />
    <circle cx="-26" cy="-4" r="5" /><circle cx="-14" cy="-4" r="5" /><circle cx="32" cy="-4" r="5" />
    <path d="M-4 0H4" class="lame" />
  </g>`;
}

/**
 * Profil en long (sens de marche, avant à droite) : la surface, la pente de chaque tronçon, les
 * ruptures de pente (trait et distance), la niveleuse sur la lame (distance 0). profil : { morceaux,
 * troncons, ruptures, devant, derriere (m), altitude (de la lame), source ('marche' ou 'lame') }.
 */
export function svgProfilLame(profil) {
  const largeur = 340;
  const hauteur = 150;
  const marge = 16;
  const { morceaux, troncons, ruptures, devant, derriere, altitude } = profil;
  const altitudes = [altitude, ...morceaux.flat().map((p) => p.altitude)];
  const milieu = (Math.min(...altitudes) + Math.max(...altitudes)) / 2;
  const etendue = Math.max(0.5, Math.max(...altitudes) - Math.min(...altitudes)) * 1.4;
  const x = (d) => marge + ((d + derriere) / (devant + derriere)) * (largeur - 2 * marge);
  const y = (z) => hauteur / 2 + 10 - ((z - milieu) / etendue) * (hauteur - 2 * marge - 20);
  const surface = morceaux
    .map((m) => `<path class="surface-coupe-lame" d="M${m.map((p) => `${x(p.distance).toFixed(1)} ${y(p.altitude).toFixed(1)}`).join('L')}" />`)
    .join('');
  // Pente au milieu de chaque tronçon assez long à l'écran.
  const pentes = troncons
    .filter((t) => x(t.fin) - x(t.debut) > 34)
    .map((t) => {
      const d = (t.debut + t.fin) / 2;
      const morceau = morceaux.find((m) => m[0].distance <= d && m.at(-1).distance >= d) ?? [];
      const i = morceau.findIndex((p) => p.distance >= d);
      const a = morceau[Math.max(0, i - 1)];
      const b = morceau[i];
      const z = a && b && b.distance > a.distance ? a.altitude + ((d - a.distance) / (b.distance - a.distance)) * (b.altitude - a.altitude) : altitude;
      // Sous la ligne : au-dessus, la niveleuse pourrait la cacher.
      return `<text x="${x(d).toFixed(1)}" y="${(y(z) + 15).toFixed(1)}" text-anchor="middle" class="pente-profil">${t.pente >= 0 ? '+' : '−'}${Math.abs(t.pente).toFixed(1)} %</text>`;
    })
    .join('');
  const marques = ruptures
    .map((d) => `<line class="rupture-profil" x1="${x(d).toFixed(1)}" y1="${marge}" x2="${x(d).toFixed(1)}" y2="${hauteur - 14}" />
      <text x="${x(d).toFixed(1)}" y="${hauteur - 3}" text-anchor="middle" class="distance-profil">${d.toFixed(1)} m</text>`)
    .join('');
  return `<svg viewBox="0 0 ${largeur} ${hauteur}" class="svg-coupe-lame svg-profil-lame" role="img" aria-label="Profil en long devant la lame">
    ${marques}
    ${surface}
    ${pentes}
    ${niveleuseDeCote(x(0), y(altitude))}
    <text x="4" y="12" class="note-coupe-lame">${profil.source === 'marche' ? 'sens de marche' : 'perpendiculaire à la lame (arrêté)'} →</text>
    <text x="${largeur - 4}" y="12" text-anchor="end" class="note-coupe-lame">hauteurs agrandies</text>
  </svg>`;
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
    ${niveleuseDeDerriere(xg, y(gauche.altitude), xd, y(droite.altitude))}
    <text x="${xg.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle">G</text>
    <text x="${xd.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle">D</text>
    <text x="${largeur - 4}" y="12" text-anchor="end" class="note-coupe-lame">hauteurs agrandies</text>
  </svg>`;
}
