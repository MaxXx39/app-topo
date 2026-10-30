// Onglet Terrain › Guidage (0.70.0, mode Expert ; refait en 0.100.0, demande du 29.10.2026) :
// guidage d'une lame avec 2 GNSS (calculs dans topo/lame.js). En haut : la machine (Grader ou Bull)
// et la surface à suivre ; puis, pour chaque coin, une grosse flèche monter / descendre (toujours là,
// même dans la tolérance) avec l'écart et l'altitude du GNSS ; l'état des 2 récepteurs (satellites,
// précision H / V, inclinaison) ; le dévers ; la coupe vue de derrière (trait entre les 2 GNSS, la
// lame en rectangle jaune de 50 cm) ; la coupe perpendiculaire, 20 m devant et 10 m derrière (Bull :
// perpendiculaire à la lame ; Grader : dans le sens de marche).
// Les nombres changent 5 fois par seconde sans redessiner l'écran (rafraichirLame).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { formaterNombre } from '../topo/format.js';

// Hauteur de la lame dessinée au-dessus du trait entre les 2 GNSS (m).
const HAUTEUR_LAME = 0.5;

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

/**
 * Écran (sans les nombres en direct). donnees : { surfaces: [{ id, etiquette }], surfaceId,
 * machine ('grader' ou 'bull'), inverse, tolerances: { vert, orange } (m), recepteur2 (vrai si le
 * 2e GNSS est connecté) }.
 */
export function htmlLame(donnees, { reglagesOuverts = false } = {}) {
  const { surfaces, surfaceId, tolerances } = donnees;
  const cm = (m) => String(Math.round(m * 1000) / 10);
  const machine = donnees.machine === 'bull' ? 'bull' : 'grader';
  const caseMachine = (cle, titre) => `<button type="button" class="case-machine ${machine === cle ? 'actif' : ''}" data-action="choisirMachine" data-valeur="${cle}" aria-pressed="${machine === cle}">
      <span class="carre-case" aria-hidden="true">${machine === cle ? '✓' : ''}</span>${titre}</button>`;
  return `<div class="ecran-lame">
    <div class="ligne-lame choix-machine" role="group" aria-label="Machine">${caseMachine('grader', 'Grader')}${caseMachine('bull', 'Bull')}</div>
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
    ${donnees.recepteur2 ? '' : '<p class="avertissement">Connecte le 2e GNSS : bouton Récepteur › « Récepteur 2 ».</p>'}
    <p class="raison-lame" data-vivant="lame-raison" hidden></p>
    <div class="coins-lame">
      <div class="coin-lame attente" data-vivant="lame-gauche"></div>
      <div class="coin-lame attente" data-vivant="lame-droite"></div>
    </div>
    <div class="recepteurs-lame">
      <div class="recepteur-lame" data-vivant="lame-gnss-gauche"></div>
      <div class="recepteur-lame" data-vivant="lame-gnss-droite"></div>
    </div>
    <p class="devers-lame" data-vivant="lame-devers">Dévers —</p>
    <div class="coupe-lame-bords">
      <div class="bord-lame bord-gauche" data-vivant="lame-bord-gauche"></div>
      <div class="coupe-lame" data-vivant="lame-coupe"></div>
      <div class="bord-lame bord-droite" data-vivant="lame-bord-droite"></div>
    </div>
    <div class="profil-lame" data-vivant="lame-profil"></div>
  </div>`;
}

/** Grosse flèche monter (vers le haut) ou descendre (vers le bas), en SVG. */
function grosseFleche(ecart) {
  const haut = ecart >= 0;
  return `<svg class="grosse-fleche-lame" viewBox="0 0 40 48" aria-hidden="true"><path d="${haut ? 'M20 2 38 24H27V46H13V24H2Z' : 'M20 46 38 24H27V2H13V24H2Z'}" /></svg>`;
}

/** État d'un récepteur (comme la fenêtre du récepteur seul) : statut, satellites, précision, inclinaison. */
function texteRecepteur(titre, etat) {
  if (!etat?.connecte) return `<strong>${titre}</strong><span>non connecté</span>`;
  if (!etat.recu) return `<strong>${titre}</strong><span>en attente…</span>`;
  const statut = { 4: 'RTK FIXE', 5: 'RTK FLOTTANT' }[etat.qualite] ?? `GNSS ${etat.libelleQualite ?? '?'}`;
  const classe = etat.qualite === 4 ? (etat.inclinaisonPrete ? 'vert' : 'orange') : etat.qualite === 5 ? 'orange' : 'rouge';
  return `<strong>${titre}</strong>
    <span class="statut-lame statut-${classe}">${statut}${etat.nbSatellites != null ? ` · ${etat.nbSatellites} sat.` : ''}</span>
    <span>H ${formaterNombre(etat.precisionH)} · V ${formaterNombre(etat.precisionV)}</span>
    <span>Inclinaison ${etat.inclinaisonPrete ? `prête${etat.inclinaison != null ? ` (${Math.round(etat.inclinaison)}°)` : ''}` : 'pas prête'}</span>`;
}

/**
 * Met à jour les nombres en direct dans "conteneur". vivant : { raison (texte, ou null),
 * guidage (voir topo/lame.js guidageLame) ou null, coins: { gauche, droite } (positions des GNSS)
 * ou null, recepteurs: { gauche, droite } (états des 2 GNSS), coupe: { longueur, profils, gauche,
 * droite } ou null, bords (voir bordsDeLaLame) ou null, profil (coupe perpendiculaire) ou null }.
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
    const position = vivant.coins?.[cote];
    // Flèche toujours là, même dans la tolérance (verte) ; altitude du GNSS dessous.
    element.className = `coin-lame ${coin?.classe ? `ecart-${coin.classe}` : 'attente'}`;
    element.innerHTML = `<span class="titre-coin">${cote === 'gauche' ? 'Gauche' : 'Droite'}</span>
      ${coin?.ecart != null ? grosseFleche(coin.ecart) : ''}
      <strong>${coin ? texteEcartLame(coin.ecart) : '—'}</strong>
      <span class="altitude-coin">H ${position ? formaterNombre(position.altitude) : '—'}</span>`;
    zone(`lame-gnss-${cote}`).innerHTML = texteRecepteur(`GNSS ${cote === 'gauche' ? 'G' : 'D'}`, vivant.recepteurs?.[cote]);
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
  if (profil) profil.innerHTML = g && vivant.profil ? svgCoupePerpendiculaire(vivant.profil) : '';
}

/**
 * Coupe perpendiculaire (sens donné par la machine, avant à droite) : la surface, la pente de chaque
 * tronçon, les ruptures de pente (trait et distance), la lame (rectangle jaune de 50 cm) à 0 m.
 * profil : { morceaux, troncons, ruptures, devant, derriere (m), altitude (de la lame), source }.
 */
export function svgCoupePerpendiculaire(profil) {
  const largeur = 340;
  const hauteur = 150;
  const marge = 16;
  const { morceaux, troncons, ruptures, devant, derriere, altitude } = profil;
  const altitudes = [altitude, altitude + HAUTEUR_LAME, ...morceaux.flat().map((p) => p.altitude)];
  const milieu = (Math.min(...altitudes) + Math.max(...altitudes)) / 2;
  const etendue = Math.max(0.5, Math.max(...altitudes) - Math.min(...altitudes)) * 1.4;
  const x = (d) => marge + ((d + derriere) / (devant + derriere)) * (largeur - 2 * marge);
  const y = (z) => hauteur / 2 + 10 - ((z - milieu) / etendue) * (hauteur - 2 * marge - 20);
  const surface = morceaux
    .map((m) => `<path class="surface-coupe-lame" d="M${m.map((p) => `${x(p.distance).toFixed(1)} ${y(p.altitude).toFixed(1)}`).join('L')}" />`)
    .join('');
  // Pente au milieu de chaque tronçon assez long à l'écran, sous la ligne.
  const pentes = troncons
    .filter((t) => x(t.fin) - x(t.debut) > 34)
    .map((t) => {
      const d = (t.debut + t.fin) / 2;
      const morceau = morceaux.find((m) => m[0].distance <= d && m.at(-1).distance >= d) ?? [];
      const i = morceau.findIndex((p) => p.distance >= d);
      const a = morceau[Math.max(0, i - 1)];
      const b = morceau[i];
      const z = a && b && b.distance > a.distance ? a.altitude + ((d - a.distance) / (b.distance - a.distance)) * (b.altitude - a.altitude) : altitude;
      return `<text x="${x(d).toFixed(1)}" y="${(y(z) + 15).toFixed(1)}" text-anchor="middle" class="pente-profil">${t.pente >= 0 ? '+' : '−'}${Math.abs(t.pente).toFixed(1)} %</text>`;
    })
    .join('');
  // Distances des ruptures : une seule tous les 36 pixels au moins (sinon elles se chevauchent).
  let dernierTexte = -Infinity;
  const marques = ruptures
    .map((d) => {
      const xd = x(d);
      const texte = xd - dernierTexte >= 36 ? `<text x="${xd.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle" class="distance-profil">${d.toFixed(1)} m</text>` : '';
      if (texte) dernierTexte = xd;
      return `<line class="rupture-profil" x1="${xd.toFixed(1)}" y1="${marge}" x2="${xd.toFixed(1)}" y2="${hauteur - 14}" />${texte}`;
    })
    .join('');
  // La lame vue de côté : un rectangle jaune de 50 cm, son bas au tranchant.
  const lame = `<rect class="lame-jaune" x="${(x(0) - 3).toFixed(1)}" y="${y(altitude + HAUTEUR_LAME).toFixed(1)}" width="6" height="${(y(altitude) - y(altitude + HAUTEUR_LAME)).toFixed(1)}" />`;
  const titre = profil.source === 'marche' ? 'sens de marche' : 'perpendiculaire à la lame';
  return `<svg viewBox="0 0 ${largeur} ${hauteur}" class="svg-coupe-lame svg-profil-lame" role="img" aria-label="Coupe ${titre}">
    ${marques}
    ${surface}
    ${pentes}
    ${lame}
    <text x="4" y="12" class="note-coupe-lame">−${derriere} m · ${titre} · +${devant} m →</text>
    <text x="${largeur - 4}" y="12" text-anchor="end" class="note-coupe-lame">hauteurs agrandies</text>
  </svg>`;
}

/**
 * Coupe vue de derrière la lame (gauche à gauche) : la surface (trait brun), le trait entre les 2
 * GNSS (de la couleur du plus grand écart) et la lame : un rectangle jaune un peu transparent de
 * 50 cm, parallèle à ce trait. Hauteurs agrandies pour voir les centimètres.
 */
export function svgCoupeLame(coupe, guidage) {
  const largeur = 320;
  const hauteur = 130;
  const marge = 14;
  const { longueur, profils, gauche, droite } = coupe;
  const altitudes = [gauche.altitude, droite.altitude, gauche.altitude + HAUTEUR_LAME, droite.altitude + HAUTEUR_LAME, ...profils.flat().map((p) => p.altitude)];
  const milieu = (Math.min(...altitudes) + Math.max(...altitudes)) / 2;
  const etendue = Math.max(0.2, Math.max(...altitudes) - Math.min(...altitudes)) * 1.3;
  const x = (d) => marge + (d / longueur) * (largeur - 2 * marge);
  const y = (z) => hauteur / 2 - ((z - milieu) / etendue) * (hauteur - 2 * marge);
  const surface = profils
    .map((morceau) => `<path class="surface-coupe-lame" d="M${morceau.map((p) => `${x(p.distance).toFixed(1)} ${y(p.altitude).toFixed(1)}`).join('L')}" />`)
    .join('');
  const classes = [guidage.gauche, guidage.droite].map((c) => c.classe);
  const pire = classes.find((c) => c === 'rouge') ?? classes.find((c) => c === 'orange') ?? 'vert';
  const xg = x(gauche.distance);
  const xd = x(droite.distance);
  const [yg, yd] = [y(gauche.altitude), y(droite.altitude)];
  const [ygh, ydh] = [y(gauche.altitude + HAUTEUR_LAME), y(droite.altitude + HAUTEUR_LAME)];
  return `<svg viewBox="0 0 ${largeur} ${hauteur}" class="svg-coupe-lame" role="img" aria-label="Coupe vue de derrière la lame">
    ${surface}
    <path class="lame-jaune" d="M${xg.toFixed(1)} ${yg.toFixed(1)}L${xd.toFixed(1)} ${yd.toFixed(1)}L${xd.toFixed(1)} ${ydh.toFixed(1)}L${xg.toFixed(1)} ${ygh.toFixed(1)}Z" />
    <line class="lame-coupe lame-${pire}" x1="${xg.toFixed(1)}" y1="${yg.toFixed(1)}" x2="${xd.toFixed(1)}" y2="${yd.toFixed(1)}" />
    <circle class="coin-coupe-lame" cx="${xg.toFixed(1)}" cy="${yg.toFixed(1)}" r="5" />
    <circle class="coin-coupe-lame" cx="${xd.toFixed(1)}" cy="${yd.toFixed(1)}" r="5" />
    <text x="${xg.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle">G</text>
    <text x="${xd.toFixed(1)}" y="${hauteur - 3}" text-anchor="middle">D</text>
    <text x="${largeur - 4}" y="12" text-anchor="end" class="note-coupe-lame">hauteurs agrandies</text>
  </svg>`;
}
