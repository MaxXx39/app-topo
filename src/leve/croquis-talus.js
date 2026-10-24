// Croquis des réglages du talus (Terrain › Implanter › Talus, roue ⚙) : il suit les réglages.
// - En plan : la ligne (drapeau vert = début, damier = fin) et le talus du côté choisi, avec ses
//   barbules (traits longs et courts qui partent du haut du talus).
// - En coupe : la ligne, le talus qui descend (ligne = haut) ou qui monte (ligne = bas), la pente
//   H / V sur un petit triangle, et l'entrée en terre (ou le bord si la longueur est donnée).
import { svgDrapeau } from '../outils/drapeaux.js';
import { traitsDeBarbules } from '../plan/barbules.js';

const LARGEUR = 340;
const HAUTEUR = 124;

/** Code SVG du croquis. reglages : { horizontal, vertical, ligneEst, cote, longueur } (voir topo/talus.js). */
export function svgCroquisTalus(reglages) {
  return `<svg class="croquis-talus" viewBox="0 0 ${LARGEUR} ${HAUTEUR}" role="img" aria-label="Croquis du talus">
    ${enPlan(reglages)}
    <path d="M136 6V${HAUTEUR - 6}" class="separation-croquis" />
    <g transform="translate(140 0)">${enCoupe(reglages)}</g>
  </svg>`;
}

/** Vue en plan (à gauche) : la ligne de gauche à droite, le talus dessous (à droite) ou dessus (à gauche). */
function enPlan({ ligneEst, cote }) {
  const yLigne = 58;
  const debut = 18;
  const fin = 118;
  const largeur = 30;
  // À droite en regardant vers la fin (vers la droite du dessin) : en dessous de la ligne.
  const yBord = cote === 'gauche' ? yLigne - largeur : yLigne + largeur;
  const surLigne = [{ x: debut + 4, y: yLigne }, { x: fin - 2, y: yLigne }];
  const surBord = [{ x: debut + 4, y: yBord }, { x: fin - 2, y: yBord }];
  const [haut, bas] = ligneEst === 'bas' ? [surBord, surLigne] : [surLigne, surBord];
  const yZone = Math.min(yLigne, yBord);
  return `<text x="68" y="11" text-anchor="middle" class="titre-croquis">En plan</text>
    <rect x="${debut}" y="${yZone}" width="${fin - debut}" height="${largeur}" class="zone-croquis" />
    <path d="${traitsDeBarbules(haut, bas, 7)}" class="barbules-croquis" />
    <path d="M${debut} ${yBord}H${fin}" class="bord-croquis" />
    <path d="M${debut} ${yLigne}H${fin}" class="ligne-croquis" />
    <path d="M${(debut + fin) / 2 - 5} ${yLigne - 5}l6 5-6 5" class="chevron-croquis" />
    ${svgDrapeau('debut', debut, yLigne, 16)}
    ${svgDrapeau('fin', fin, yLigne, 16)}
    <text x="68" y="${HAUTEUR - 6}" text-anchor="middle" class="texte-croquis">talus à ${cote === 'gauche' ? 'gauche' : 'droite'}</text>`;
}

/** Vue en coupe (à droite) : la ligne à gauche, le talus vers la droite. */
function enCoupe({ horizontal, vertical, ligneEst, longueur }) {
  const largeurTalus = 92;
  // Hauteur dessinée selon la pente (si elle est tapée), entre 22 et 56 unités pour rester lisible.
  const pente = horizontal > 0 && vertical > 0 ? vertical / horizontal : 2 / 3;
  const hauteurTalus = Math.max(22, Math.min(56, largeurTalus * pente));
  const yHaut = 34;
  const yBas = yHaut + hauteurTalus;
  const descend = ligneEst !== 'bas';
  const a = { x: 34, y: descend ? yHaut : yBas }; // la ligne
  const b = { x: a.x + largeurTalus, y: descend ? yBas : yHaut }; // entrée en terre (ou bord)
  const c = { x: b.x, y: a.y }; // coin du triangle de pente
  const valeur = (v) => (v > 0 ? String(Math.round(v * 1000) / 1000) : '?');
  const motFin = longueur > 0 ? `bord (${valeur(longueur)} m)` : 'entrée en terre';
  // Textes : « ligne » à gauche de la ligne ; H sur le côté horizontal du triangle (côté libre),
  // V dans le triangle, contre le côté vertical ; le mot de la fin à droite, sous le terrain (le
  // petit triangle de l'entrée en terre est au-dessus).
  const yTexteH = descend ? a.y - 5 : a.y + 12;
  return `<text x="100" y="11" text-anchor="middle" class="titre-croquis">En coupe</text>
    <path d="M2 ${a.y}H${a.x}" class="plateforme-croquis" />
    <path d="M${b.x} ${b.y}H196" class="terrain-croquis" />
    <path d="M${a.x} ${a.y}H${c.x}V${b.y}" class="triangle-croquis" />
    <path d="M${a.x} ${a.y}L${b.x} ${b.y}" class="talus-croquis" />
    <circle cx="${a.x}" cy="${a.y}" r="4" class="point-ligne-croquis" />
    <path d="M${b.x} ${b.y - 2}l-5 -9h10z" class="entree-croquis" />
    <text x="${a.x - 6}" y="${a.y - 5}" text-anchor="end" class="texte-croquis">ligne</text>
    <text x="${(a.x + c.x) / 2}" y="${yTexteH}" text-anchor="middle" class="cote-croquis">H ${valeur(horizontal)}</text>
    <text x="${c.x - 4}" y="${(a.y + b.y) / 2 + 4}" text-anchor="end" class="cote-croquis">V ${valeur(vertical)}</text>
    <text x="${b.x + 4}" y="${b.y + 13}" class="texte-croquis">${motFin}</text>
    <text x="100" y="${HAUTEUR - 6}" text-anchor="middle" class="texte-croquis">ligne = ${descend ? 'haut' : 'bas'} du talus</text>`;
}
