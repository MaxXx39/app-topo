// Profil en travers du talus en direct (onglet Terrain › Implanter › Talus) : la ligne à gauche,
// le talus jusqu'à l'entrée en terre (ou son bord), le terrain (surface, ou sol supposé plat à
// l'altitude de la canne) et le bout de canne (SVG). Distances en plan depuis la ligne (m),
// hauteurs à la même échelle que les longueurs tant que le dessin n'est pas trop haut.

const LARGEUR = 340;
const MARGES = { gauche: 46, droite: 10, haut: 16, bas: 20 };
const HAUTEUR_MIN = 70;
const HAUTEUR_MAX = 160;

/**
 * Code SVG du profil.
 * - talus : résultat de guidageTalus (distance, distanceVoulue, altitudeLigne, auBord, solPlat…)
 * - pente : pente signée du talus (m par m, voir penteSignee)
 * - profil : [{ distance, altitude }] du terrain (vide sans surface)
 * - altitudeCanne : altitude du bout de canne (m), ou null si elle n'est pas fiable
 * - couleurCanne : couleur du rond de la canne
 */
export function svgCoupeTalus({ talus, pente, profil = [], altitudeCanne = null, couleurCanne = '#1b2b36' }) {
  const { distance, distanceVoulue, altitudeLigne, auBord, solPlat } = talus;
  const debut = Math.min(0, distance) - 1;
  const fin = Math.max(distanceVoulue, distance, 0) + 1;
  const largeurUtile = LARGEUR - MARGES.gauche - MARGES.droite;
  const parMetre = largeurUtile / (fin - debut);
  const altitudeBout = altitudeLigne + pente * distanceVoulue;
  const altitudes = [altitudeLigne, altitudeBout, ...profil.map((p) => p.altitude), ...(altitudeCanne != null ? [altitudeCanne] : [])];
  const bas = Math.min(...altitudes) - 0.2;
  const haut = Math.max(...altitudes) + 0.2;
  // Hauteurs à l'échelle des longueurs ; écrasées si le dessin serait trop haut.
  const parMetreV = Math.min(parMetre, HAUTEUR_MAX / (haut - bas));
  const hauteurUtile = Math.max(HAUTEUR_MIN, (haut - bas) * parMetreV);
  const hauteur = hauteurUtile + MARGES.haut + MARGES.bas;
  const centre = (haut + bas) / 2;
  const x = (d) => MARGES.gauche + (d - debut) * parMetre;
  const y = (z) => MARGES.haut + hauteurUtile / 2 - (z - centre) * parMetreV;
  const yBas = MARGES.haut + hauteurUtile;
  const f = (v) => v.toFixed(1);

  // Terrain : profil de la surface (rempli dessous), ou sol plat en pointillés à l'altitude de la canne.
  let terrain = '';
  if (profil.length >= 2) {
    const points = profil.map((p) => `${f(x(p.distance))},${f(y(p.altitude))}`).join(' ');
    terrain = `<polygon points="${f(x(profil[0].distance))},${yBas} ${points} ${f(x(profil.at(-1).distance))},${yBas}" class="sous-profil" />
      <polyline points="${points}" class="profil" />`;
  } else if (solPlat && altitudeCanne != null) {
    terrain = `<line x1="${f(x(debut))}" y1="${f(y(altitudeCanne))}" x2="${f(x(fin))}" y2="${f(y(altitudeCanne))}" class="sol-plat" />`;
  }
  // Talus : de la ligne jusqu'à l'entrée en terre (ou son bord).
  const talusTrait = `<line x1="${f(x(0))}" y1="${f(y(altitudeLigne))}" x2="${f(x(distanceVoulue))}" y2="${f(y(altitudeBout))}" class="trait-talus" />`;
  const ligne = `<path d="M${f(x(0))} ${f(y(altitudeLigne) - 9)}V${f(y(altitudeLigne) + 9)}" class="repere-ligne-talus" /><circle cx="${f(x(0))}" cy="${f(y(altitudeLigne))}" r="4" class="point-ligne-talus" />`;
  const entree = `<path d="M${f(x(distanceVoulue))} ${f(y(altitudeBout) - 2)}l-6 -11h12z" class="repere-entree" />`;
  // Canne : trait vertical à sa place, rond à l'altitude du bout de canne.
  const xc = x(distance);
  let canne = `<line x1="${f(xc)}" y1="${MARGES.haut}" x2="${f(xc)}" y2="${yBas}" class="axe-canne" />`;
  if (altitudeCanne != null) {
    const yc = Math.min(Math.max(y(altitudeCanne), MARGES.haut), yBas);
    canne += `<circle cx="${f(xc)}" cy="${f(yc)}" r="5.5" class="canne" style="fill: ${couleurCanne}" />`;
  }
  // Textes du bas : « ligne » sous la ligne, « entrée en terre » (ou « bord ») sous le repère, s'ils ne se touchent pas.
  const motEntree = auBord ? 'bord' : 'entrée en terre';
  const loin = Math.abs(x(distanceVoulue) - x(0)) > 70;
  const ecart = parMetreV < parMetre - 1e-9 ? `hauteurs ×${(parMetreV / parMetre).toFixed(2)}` : 'hauteurs ×1';
  return `<svg viewBox="0 0 ${LARGEUR} ${f(hauteur)}" class="coupe-directe coupe-talus" role="img" aria-label="Profil en travers du talus">
    <text x="${LARGEUR - MARGES.droite}" y="11" class="cote" text-anchor="end">${ecart}</text>
    <text x="${MARGES.gauche - 4}" y="${MARGES.haut + 4}" class="cote" text-anchor="end">${haut.toFixed(2)}</text>
    <text x="${MARGES.gauche - 4}" y="${f(yBas)}" class="cote" text-anchor="end">${bas.toFixed(2)}</text>
    <line x1="${MARGES.gauche}" y1="${f(yBas)}" x2="${LARGEUR - MARGES.droite}" y2="${f(yBas)}" class="base-coupe" />
    ${terrain}
    ${talusTrait}
    ${ligne}
    ${entree}
    ${canne}
    <text x="${f(x(0))}" y="${f(hauteur - 5)}" class="cote" text-anchor="middle">ligne</text>
    ${loin ? `<text x="${f(x(distanceVoulue))}" y="${f(hauteur - 5)}" class="cote" text-anchor="middle">${motEntree}</text>` : ''}
  </svg>`;
}
