// Export d'un plan DXF recalé (voir topo/recalage.js), pour AutoCAD et Mensura : format R12, les
// objets lus par l'appli (lignes et polylignes, arcs découpés en petits segments, cercles, textes,
// aplats, points ; blocs éclatés), avec leurs calques et leurs couleurs. Les hachures et les
// images, non lues à l'import, n'y sont pas (décision du 23.10.2026).
import { couleurAci } from '../topo/dxf-plan.js';

/**
 * Texte du fichier DXF d'un plan (coordonnées rangées comme à la lecture : origine + valeurs au mm,
 * voir topo/dxf-plan.js). Les calques cachés dans l'appli sont exportés aussi.
 */
export function genererDxfPlan(plan) {
  const { origine, calques = [], contenu = {} } = plan;
  const nomCalque = (c) => nomDeCalque(calques[c]?.nom ?? '0');
  const couleur = (objet) => (objet.k ? ['62', String(aciLePlusProche(objet.k))] : []);
  const e = (x) => (origine.est + x).toFixed(3);
  const n = (y) => (origine.nord + y).toFixed(3);
  const entites = [];
  for (const trait of contenu.traits ?? []) {
    const en3D = Array.isArray(trait.z);
    entites.push(['0', 'POLYLINE', '8', nomCalque(trait.c), ...couleur(trait), '66', '1', '10', '0', '20', '0', '30', '0', '70', String((en3D ? 8 : 0) + (trait.f ? 1 : 0))]);
    for (let i = 0; i < trait.p.length; i += 2) {
      entites.push(['0', 'VERTEX', '8', nomCalque(trait.c), '10', e(trait.p[i]), '20', n(trait.p[i + 1]), '30', en3D ? (trait.z[i / 2] ?? 0).toFixed(3) : '0', '70', en3D ? '32' : '0']);
    }
    entites.push(['0', 'SEQEND', '8', nomCalque(trait.c)]);
  }
  for (const plein of contenu.pleins ?? []) {
    // Rangé dans l'ordre du contour (1, 2, 4, 3) : on remet l'ordre « en Z » du DXF.
    const p = plein.p;
    const sommet = (i, code) => [String(10 + code), e(p[2 * i]), String(20 + code), n(p[2 * i + 1]), String(30 + code), '0'];
    entites.push(['0', 'SOLID', '8', nomCalque(plein.c), ...couleur(plein), ...sommet(0, 0), ...sommet(1, 1), ...sommet(3, 2), ...sommet(2, 3)]);
  }
  for (const cercle of contenu.cercles ?? []) {
    entites.push(['0', 'CIRCLE', '8', nomCalque(cercle.c), ...couleur(cercle), '10', e(cercle.x), '20', n(cercle.y), '30', '0', '40', cercle.r.toFixed(3)]);
  }
  for (const texte of contenu.textes ?? []) {
    const aligne = texte.ah || texte.av;
    entites.push([
      '0', 'TEXT', '8', nomCalque(texte.c), ...couleur(texte),
      '10', e(texte.x), '20', n(texte.y), '30', '0', '40', texte.h.toFixed(3), '1', texte.t, '50', (texte.a ?? 0).toFixed(2),
      ...(aligne ? ['72', String(texte.ah ?? 0), '73', String(texte.av ?? 0), '11', e(texte.x), '21', n(texte.y), '31', '0'] : []),
    ]);
  }
  for (const point of contenu.points ?? []) {
    entites.push(['0', 'POINT', '8', nomCalque(point.c), ...couleur(point), '10', e(point.x), '20', n(point.y), '30', (point.z ?? 0).toFixed(3)]);
  }
  const tableCalques = calques.map((c) => ['0', 'LAYER', '2', nomDeCalque(c.nom), '70', '0', '62', String(aciLePlusProche(c.couleur)), '6', 'CONTINUOUS']);
  const lignes = [
    '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$DWGCODEPAGE', '3', 'ANSI_1252', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(tableCalques.length), ...tableCalques.flat(), '0', 'ENDTAB', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES', ...entites.flat(), '0', 'ENDSEC', '0', 'EOF',
  ];
  return `${lignes.join('\r\n')}\r\n`;
}

/**
 * Octets du fichier, en Windows-1252 (accents des textes lus par AutoCAD et Mensura comme dans un
 * DXF R12 ; un caractère hors de ce jeu devient « ? »).
 */
export function octetsDxf(texte) {
  const octets = new Uint8Array(texte.length);
  for (let i = 0; i < texte.length; i++) {
    const code = texte.charCodeAt(i);
    octets[i] = code <= 0xff ? code : 0x3f;
  }
  return octets;
}

/** Numéro de couleur AutoCAD (1 à 255) le plus proche d'une couleur « #rrggbb ». */
export function aciLePlusProche(hex) {
  const rvb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0);
  const voulu = rvb(hex);
  let meilleur = 7;
  let distance = Infinity;
  for (let numero = 1; numero <= 255; numero++) {
    const essai = rvb(couleurAci(numero));
    const d = essai.reduce((somme, v, i) => somme + (v - voulu[i]) ** 2, 0);
    if (d < distance) {
      distance = d;
      meilleur = numero;
    }
  }
  return meilleur;
}

/** Nom de calque accepté par AutoCAD R12 : sans accent ni caractère spécial, 31 caractères au plus. */
function nomDeCalque(texte) {
  return (
    String(texte)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9_$-]+/g, '_')
      .slice(0, 31) || '0'
  );
}
