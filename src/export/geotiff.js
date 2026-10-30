// Photo aérienne swisstopo (SWISSIMAGE) en GeoTIFF, jointe à l'export DXF (0.98.0, demande du
// 30.10.2026, d'après le module « Orthophoto → GeoTIFF » de l'utilisateur) :
// - emprise : le rectangle de tous les points exportés, élargi d'une marge (20 à 50 m) ;
// - image demandée au service WMS de swisstopo directement en MN95 (EPSG:2056), par morceaux de
//   2000 × 2000 pixels au plus, puis écrite en GeoTIFF RVB 8 bits non compressé, bande par bande ;
// - le GeoTIFF porte sa position (MN95, taille du pixel) : AutoCAD Map / Civil, QGIS, Mensura le
//   placent tout seuls.
// Coordonnées : Est, Nord (m, MN95).

export const SERVICE_WMS = 'https://wms.geo.admin.ch/';
export const COUCHE_PHOTO = 'ch.swisstopo.swissimage';
const MORCEAU = 2000; // pixels : côté maximal d'une image demandée au service
// Au-delà, la tablette risque de manquer de mémoire (≈ 3 octets par pixel).
export const PIXELS_MAX = 120e6;

/**
 * Emprise de l'image : le rectangle des points ({ est, nord }), élargi de "marge" m de chaque côté,
 * aligné sur la grille des pixels (résolution en m). Renvoie { estMin, estMax, nordMin, nordMax,
 * largeur, hauteur (pixels) } ou null s'il n'y a pas de point.
 */
export function emprisePhoto(points, marge, resolution) {
  const valides = points.filter((p) => Number.isFinite(p?.est) && Number.isFinite(p?.nord));
  if (valides.length === 0 || !(resolution > 0)) return null;
  const est = valides.map((p) => p.est);
  const nord = valides.map((p) => p.nord);
  // Petit écart (1e-6 pixel) : 1100000.2 / 0.1 ne tombe pas juste en virgule flottante.
  const enBas = (v) => Math.floor(v / resolution + 1e-6) * resolution;
  const enHaut = (v) => Math.ceil(v / resolution - 1e-6) * resolution;
  const estMin = enBas(Math.min(...est) - marge);
  const nordMin = enBas(Math.min(...nord) - marge);
  const estMax = enHaut(Math.max(...est) + marge);
  const nordMax = enHaut(Math.max(...nord) + marge);
  return { estMin, estMax, nordMin, nordMax, largeur: Math.round((estMax - estMin) / resolution), hauteur: Math.round((nordMax - nordMin) / resolution) };
}

/**
 * En-tête et fin d'un GeoTIFF RVB 8 bits non compressé de largeur × hauteur pixels, en bandes de
 * "lignesParBande" lignes. (estMin, nordMax) = coin en haut à gauche ; resolution = taille du pixel (m).
 * Les pixels se placent entre "debut" et "fin", bande après bande (chaque bande complétée à une
 * longueur paire). Renvoie { debut, fin, octets (taille totale) }.
 */
export function enveloppeTiff(largeur, hauteur, lignesParBande, estMin, nordMax, resolution) {
  const nbBandes = Math.ceil(hauteur / lignesParBande);
  const tailles = [];
  const positions = [];
  let position = 8;
  for (let k = 0; k < nbBandes; k++) {
    const taille = Math.min(lignesParBande, hauteur - k * lignesParBande) * largeur * 3;
    positions.push(position);
    tailles.push(taille);
    position += taille + (taille % 2);
  }
  const debutIfd = position;
  const nbEntrees = 13;
  let q = debutIfd + 2 + nbEntrees * 12 + 4;
  const posBits = q; q += 8;
  const posEchelle = q; q += 24;
  const posAttache = q; q += 48;
  const posGeo = q; q += 32;
  const posPositions = q; q += 4 * nbBandes;
  const posTailles = q; q += 4 * nbBandes;
  const total = q;
  if (total >= 4294967295) throw new Error('image trop grande pour un fichier TIFF');

  const debut = new Uint8Array(8);
  const vd = new DataView(debut.buffer);
  vd.setUint8(0, 0x49); // « II » : octets dans l'ordre petit-boutiste
  vd.setUint8(1, 0x49);
  vd.setUint16(2, 42, true);
  vd.setUint32(4, debutIfd, true);

  const fin = new Uint8Array(total - debutIfd);
  const vf = new DataView(fin.buffer);
  const COURT = 3;
  const LONG = 4;
  const DOUBLE = 12;
  let p = 0;
  vf.setUint16(p, nbEntrees, true);
  p += 2;
  const entree = (etiquette, type, nombre, valeur) => {
    vf.setUint16(p, etiquette, true);
    vf.setUint16(p + 2, type, true);
    vf.setUint32(p + 4, nombre, true);
    if (type === COURT && nombre === 1) vf.setUint16(p + 8, valeur, true);
    else vf.setUint32(p + 8, valeur, true);
    p += 12;
  };
  entree(256, LONG, 1, largeur);
  entree(257, LONG, 1, hauteur);
  entree(258, COURT, 3, posBits);
  entree(259, COURT, 1, 1); // pas de compression
  entree(262, COURT, 1, 2); // RVB
  entree(273, LONG, nbBandes, nbBandes === 1 ? positions[0] : posPositions);
  entree(277, COURT, 1, 3);
  entree(278, LONG, 1, lignesParBande);
  entree(279, LONG, nbBandes, nbBandes === 1 ? tailles[0] : posTailles);
  entree(284, COURT, 1, 1);
  entree(33550, DOUBLE, 3, posEchelle); // taille du pixel
  entree(33922, DOUBLE, 6, posAttache); // coin en haut à gauche
  entree(34735, COURT, 16, posGeo); // clés GeoTIFF : MN95 (EPSG:2056)
  vf.setUint32(p, 0, true);

  const r = (x) => x - debutIfd;
  for (let i = 0; i < 3; i++) vf.setUint16(r(posBits) + i * 2, 8, true);
  [resolution, resolution, 0].forEach((v, i) => vf.setFloat64(r(posEchelle) + i * 8, v, true));
  [0, 0, 0, estMin, nordMax, 0].forEach((v, i) => vf.setFloat64(r(posAttache) + i * 8, v, true));
  [1, 1, 0, 3, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, 2056].forEach((v, i) => vf.setUint16(r(posGeo) + i * 2, v, true));
  positions.forEach((v, i) => vf.setUint32(r(posPositions) + i * 4, v, true));
  tailles.forEach((v, i) => vf.setUint32(r(posTailles) + i * 4, v, true));
  return { debut, fin, octets: total };
}

/** Adresse WMS d'un morceau de photo (emprise MN95, taille en pixels). */
export function adresseMorceau(estMin, nordMin, estMax, nordMax, largeur, hauteur) {
  const parametres = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: COUCHE_PHOTO,
    STYLES: '',
    SRS: 'EPSG:2056',
    BBOX: [estMin, nordMin, estMax, nordMax].join(','),
    WIDTH: String(largeur),
    HEIGHT: String(hauteur),
    FORMAT: 'image/jpeg',
  });
  return `${SERVICE_WMS}?${parametres}`;
}

/** Un morceau de photo (image prête à dessiner), en réessayant 3 fois (réseau du chantier…). */
async function chargerMorceau(adresse) {
  let derniereErreur;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const reponse = await fetch(adresse);
      if (!reponse.ok) throw new Error(`le service swisstopo a répondu ${reponse.status}`);
      const blob = await reponse.blob();
      if (!blob.type.startsWith('image/')) throw new Error(`réponse inattendue du service swisstopo (${blob.type})`);
      return await createImageBitmap(blob);
    } catch (erreur) {
      derniereErreur = erreur;
      await new Promise((attendre) => setTimeout(attendre, 800 * essai));
    }
  }
  throw derniereErreur;
}

/**
 * Fabrique le GeoTIFF de cette emprise (voir emprisePhoto). progression(fait, total) est appelé après
 * chaque morceau. Renvoie un Blob « image/tiff ».
 */
export async function fabriquerGeotiff(emprise, resolution, progression = () => {}) {
  const { largeur, hauteur, estMin, nordMax } = emprise;
  const enveloppe = enveloppeTiff(largeur, hauteur, MORCEAU, estMin, nordMax, resolution);
  const morceaux = [enveloppe.debut];
  const colonnes = Math.ceil(largeur / MORCEAU);
  const rangees = Math.ceil(hauteur / MORCEAU);
  const toile = document.createElement('canvas');
  const contexte = toile.getContext('2d', { willReadFrequently: true });
  let fait = 0;
  for (let ry = 0; ry < rangees; ry++) {
    const h = Math.min(MORCEAU, hauteur - ry * MORCEAU);
    const bande = new Uint8Array(h * largeur * 3);
    for (let cx = 0; cx < colonnes; cx++) {
      const x0 = cx * MORCEAU;
      const l = Math.min(MORCEAU, largeur - x0);
      const eMin = estMin + x0 * resolution;
      const nMax = nordMax - ry * MORCEAU * resolution;
      const image = await chargerMorceau(adresseMorceau(eMin, nMax - h * resolution, eMin + l * resolution, nMax, l, h));
      toile.width = l;
      toile.height = h;
      contexte.drawImage(image, 0, 0);
      image.close?.();
      const pixels = contexte.getImageData(0, 0, l, h).data;
      for (let y = 0; y < h; y++) {
        let source = y * l * 4;
        let cible = (y * largeur + x0) * 3;
        for (let x = 0; x < l; x++, source += 4, cible += 3) {
          bande[cible] = pixels[source];
          bande[cible + 1] = pixels[source + 1];
          bande[cible + 2] = pixels[source + 2];
        }
      }
      fait += 1;
      progression(fait, colonnes * rangees);
    }
    morceaux.push(bande);
    if (bande.length % 2) morceaux.push(new Uint8Array(1));
  }
  morceaux.push(enveloppe.fin);
  return new Blob(morceaux, { type: 'image/tiff' });
}
