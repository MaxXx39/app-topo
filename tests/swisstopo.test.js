import { describe, it, expect } from 'vitest';
import { deflateSync } from 'node:zlib';
import { lireGeoTiff, decompresserLzw } from '../src/topo/geotiff-lecture.js';
import {
  versWgs84Approche, erreurDuContour, carresDeLaZone, choisirFichiers, grilleDeLaZone,
  nombreEnGrille, nombreIntelligent, pointsDuChoix, surfaceSwisstopo, trianglesDansContour,
} from '../src/topo/swisstopo.js';
import { telechargerAltitudes } from '../src/import/swisstopo.js';
import { prefixeDuNom, estImportee, estSurfaceFichier, calculerSurface } from '../src/topo/surface.js';

/**
 * Fabrique un GeoTIFF d'altitudes (comme swissALTI3D) : largeur × hauteur pixels de "pas" m, coin
 * haut gauche (est, nord), altitude = f(est, nord) au centre de chaque pixel. Tuiles de 16 × 16,
 * flottants 32 bits. compression : 1 (aucune), 8 (Deflate, avec prédicteur 3) ou 5 (LZW).
 */
function fabriquerGeoTiff({ largeur, hauteur, pas, est, nord, f, compression = 1 }) {
  const tuile = 16;
  const parLigne = Math.ceil(largeur / tuile);
  const nbTuiles = parLigne * Math.ceil(hauteur / tuile);
  const blocs = [];
  for (let n = 0; n < nbTuiles; n++) {
    const brut = new DataView(new ArrayBuffer(tuile * tuile * 4));
    for (let l = 0; l < tuile; l++) {
      for (let c = 0; c < tuile; c++) {
        const col = (n % parLigne) * tuile + c;
        const lig = Math.floor(n / parLigne) * tuile + l;
        const valeur = col < largeur && lig < hauteur ? f(est + (col + 0.5) * pas, nord - (lig + 0.5) * pas) : -9999;
        brut.setFloat32((l * tuile + c) * 4, valeur, compression !== 8);
      }
    }
    let octets = new Uint8Array(brut.buffer);
    if (compression === 8) {
      // Prédicteur 3 : octets en plans (gros bout déjà), puis écarts octet par octet.
      const plans = new Uint8Array(octets.length);
      const ligne = tuile * 4;
      for (let l = 0; l < tuile; l++) {
        for (let c = 0; c < tuile; c++) for (let k = 0; k < 4; k++) plans[l * ligne + k * tuile + c] = octets[l * ligne + c * 4 + k];
        for (let i = ligne - 1; i > 0; i--) plans[l * ligne + i] = (plans[l * ligne + i] - plans[l * ligne + i - 1]) & 255;
      }
      octets = new Uint8Array(deflateSync(plans));
    } else if (compression === 5) octets = comprimerLzw(octets);
    blocs.push(octets);
  }
  const tags = [
    [256, 3, [largeur]], [257, 3, [hauteur]], [258, 3, [32]], [259, 3, [compression]], [277, 3, [1]],
    [317, 3, [compression === 8 ? 3 : 1]], [322, 3, [tuile]], [323, 3, [tuile]], [324, 4, null], [325, 4, blocs.map((b) => b.length)],
    [339, 3, [3]], [33550, 12, [pas, pas, 0]], [33922, 12, [0, 0, 0, est, nord, 0]],
    [34735, 3, [1, 1, 0, 1, 1025, 0, 1, 1]], [42113, 2, '-9999'],
  ];
  const tailleType = { 2: 1, 3: 2, 4: 4, 12: 8 };
  const debutIfd = 8;
  let suite = debutIfd + 2 + tags.length * 12 + 4;
  const extras = [];
  const offsetsTuiles = [];
  // Place des valeurs trop longues, puis des tuiles.
  const placer = (longueur) => {
    const ou = suite;
    suite += longueur + (longueur % 2);
    return ou;
  };
  const places = tags.map(([, type, valeurs]) => {
    const longueur = (valeurs === null ? nbTuiles : valeurs.length + (type === 2 ? 1 : 0)) * tailleType[type];
    return longueur > 4 ? placer(longueur) : null;
  });
  for (const bloc of blocs) offsetsTuiles.push(placer(bloc.length));
  const tampon = new ArrayBuffer(suite);
  const vue = new DataView(tampon);
  vue.setUint8(0, 73);
  vue.setUint8(1, 73);
  vue.setUint16(2, 42, true);
  vue.setUint32(4, debutIfd, true);
  vue.setUint16(debutIfd, tags.length, true);
  tags.forEach(([tag, type, valeurs], k) => {
    const liste = valeurs ?? offsetsTuiles;
    const quantite = type === 2 ? liste.length + 1 : liste.length;
    const p = debutIfd + 2 + k * 12;
    vue.setUint16(p, tag, true);
    vue.setUint16(p + 2, type, true);
    vue.setUint32(p + 4, quantite, true);
    const ou = places[k] ?? p + 8;
    if (places[k] !== null) vue.setUint32(p + 8, places[k], true);
    if (type === 2) [...liste].forEach((car, i) => vue.setUint8(ou + i, car.charCodeAt(0)));
    else liste.forEach((v, i) => {
      if (type === 3) vue.setUint16(ou + i * 2, v, true);
      else if (type === 4) vue.setUint32(ou + i * 4, v, true);
      else vue.setFloat64(ou + i * 8, v, true);
    });
  });
  blocs.forEach((bloc, n) => new Uint8Array(tampon).set(bloc, offsetsTuiles[n]));
  return tampon;
}

/** Compression LZW du TIFF (pour fabriquer un fichier de test). */
function comprimerLzw(octets) {
  const bits = [];
  let largeur = 9;
  const ecrire = (code) => {
    for (let b = largeur - 1; b >= 0; b--) bits.push((code >> b) & 1);
  };
  let table = new Map();
  let prochain = 258;
  const reinit = () => {
    table = new Map();
    for (let i = 0; i < 256; i++) table.set(String(i), i);
    prochain = 258;
    largeur = 9;
  };
  reinit();
  ecrire(256);
  let w = '';
  for (const o of octets) {
    const wc = w === '' ? String(o) : `${w},${o}`;
    if (table.has(wc)) w = wc;
    else {
      ecrire(table.get(w));
      table.set(wc, prochain++);
      if (prochain >= 1 << largeur && largeur < 12) largeur++;
      if (prochain >= 4093) {
        ecrire(256);
        reinit();
      }
      w = String(o);
    }
  }
  if (w !== '') ecrire(table.get(w));
  ecrire(257);
  const sortie = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((bit, i) => {
    if (bit) sortie[i >> 3] |= 1 << (7 - (i & 7));
  });
  return sortie;
}

// Faux carré swissALTI3D : 40 × 40 pixels de 0,5 m (20 m × 20 m), coin haut gauche 2600000 / 1200020.
const PENTE = (est, nord) => 500 + 0.1 * (est - 2600000) + 0.05 * (nord - 1200000);
const BOSSE = (est, nord) => 500 + Math.max(0, 3 - Math.hypot(est - 2600010, nord - 1200010));
const CARRE = { largeur: 40, hauteur: 40, pas: 0.5, est: 2600000, nord: 1200020 };
const ZONE = [{ est: 2600002, nord: 1200002 }, { est: 2600018, nord: 1200002 }, { est: 2600018, nord: 1200018 }, { est: 2600002, nord: 1200018 }];

describe('Lecture GeoTIFF', () => {
  for (const compression of [1, 5, 8]) {
    it(`lit les altitudes et la position (compression ${compression})`, async () => {
      const raster = await lireGeoTiff(fabriquerGeoTiff({ ...CARRE, f: PENTE, compression }));
      expect(raster.largeur).toBe(40);
      expect(raster.est0).toBeCloseTo(2600000.25, 6);
      expect(raster.nord0).toBeCloseTo(1200019.75, 6);
      // Pixel ligne 3, colonne 7 : centre E 2600003.75, N 1200018.25.
      expect(raster.valeurs[3 * 40 + 7]).toBeCloseTo(PENTE(2600003.75, 1200018.25), 3);
    });
  }
  it('refuse un fichier qui n\'est pas un GeoTIFF', async () => {
    await expect(lireGeoTiff(new TextEncoder().encode('bonjour le monde').buffer)).rejects.toThrow(/GeoTIFF/);
  });
  it('LZW : redonne les octets de départ', () => {
    const octets = new Uint8Array(5000).map((_, i) => (i * 7) % 13);
    expect([...decompresserLzw(comprimerLzw(octets), 5000)]).toEqual([...octets]);
  });
});

describe('Zone et carrés', () => {
  it('formules approchées de swisstopo : Berne (point de départ MN95)', () => {
    const { longitude, latitude } = versWgs84Approche(2600000, 1200000);
    expect(longitude).toBeCloseTo(7.43863, 4);
    expect(latitude).toBeCloseTo(46.95108, 4);
  });
  it('contrôle du contour', () => {
    expect(erreurDuContour(ZONE.slice(0, 2))).toMatch(/3 sommets/);
    expect(erreurDuContour([{ est: 0, nord: 0 }, { est: 10, nord: 0 }, { est: 0, nord: 10 }])).toMatch(/Suisse/);
    expect(erreurDuContour([{ est: 2600000, nord: 1200000 }, { est: 2603000, nord: 1200000 }, { est: 2603000, nord: 1201000 }])).toMatch(/trop grande/);
    expect(erreurDuContour(ZONE)).toBeNull();
  });
  it('carrés de 1 km touchés', () => {
    expect(carresDeLaZone([{ est: 2600900, nord: 1199900 }, { est: 2601100, nord: 1199900 }, { est: 2601100, nord: 1200100 }])).toEqual([
      { e: 2600, n: 1199 }, { e: 2600, n: 1200 }, { e: 2601, n: 1199 }, { e: 2601, n: 1200 },
    ]);
  });
  it('choisit le fichier 0,5 m le plus récent de chaque carré', () => {
    const feature = (annee) => ({
      id: `swissalti3d_${annee}_2600-1200`,
      assets: {
        [`swissalti3d_${annee}_2600-1200_2_2056_5728.tif`]: { href: `https://x/${annee}_2_2056_5728.tif` },
        [`swissalti3d_${annee}_2600-1200_0.5_2056_5728.tif`]: { href: `https://x/${annee}_0.5_2056_5728.tif` },
      },
    });
    const { fichiers, manquants } = choisirFichiers([feature(2019), feature(2023), feature(2021)], [{ e: 2600, n: 1200 }, { e: 2601, n: 1200 }]);
    expect(fichiers).toEqual([{ e: 2600, n: 1200, annee: 2023, url: 'https://x/2023_0.5_2056_5728.tif' }]);
    expect(manquants).toEqual([{ e: 2601, n: 1200 }]);
  });
});

describe('Grille, réduction et surface', () => {
  it('grille de 0,5 m dans le contour, altitudes des pixels', async () => {
    const raster = await lireGeoTiff(fabriquerGeoTiff({ ...CARRE, f: PENTE }));
    const grille = grilleDeLaZone(ZONE, [raster]);
    // 16 m × 16 m : pixels de centre 2.25 … 17.75 → 32 × 32.
    expect(grille.valides).toBe(32 * 32);
    expect(nombreEnGrille(grille, 0.5)).toBe(1024);
    expect(nombreEnGrille(grille, 1)).toBe(256);
    expect(nombreEnGrille(grille, 2)).toBe(64);
    const points = pointsDuChoix(grille, { sorte: 'grille', pas: 0.5 });
    for (const p of points) expect(Math.abs(p.altitude - PENTE(p.est, p.nord))).toBeLessThan(0.001);
    expect(points.every((p) => (p.est * 100) % 50 === 25)).toBe(true);
  });
  it('Intelligent : un plan incliné garde peu de points, une bosse en garde plus', async () => {
    const plan = grilleDeLaZone(ZONE, [await lireGeoTiff(fabriquerGeoTiff({ ...CARRE, f: PENTE }))]);
    const bosse = grilleDeLaZone(ZONE, [await lireGeoTiff(fabriquerGeoTiff({ ...CARRE, f: BOSSE }))]);
    const surPlan = nombreIntelligent(plan, 0.05);
    expect(surPlan).toBeLessThan(40);
    expect(nombreIntelligent(bosse, 0.05)).toBeGreaterThan(surPlan);
    expect(nombreIntelligent(bosse, 0.2)).toBeLessThanOrEqual(nombreIntelligent(bosse, 0.05));
  });
  it('Intelligent : tout le terrain reste dans la tolérance', async () => {
    const grille = grilleDeLaZone(ZONE, [await lireGeoTiff(fabriquerGeoTiff({ ...CARRE, f: BOSSE }))]);
    const points = pointsDuChoix(grille, { sorte: 'intelligent', tolerance: 0.1 });
    const surface = surfaceSwisstopo('', points, ZONE, 'test');
    const { triangles } = calculerSurface(surface, []);
    // Chaque pixel couvert par un triangle : écart au triangle ≤ 10 cm.
    let ecartMax = 0;
    const tous = pointsDuChoix(grille, { sorte: 'grille', pas: 0.5 });
    for (const p of tous) {
      for (const [a, b, c] of triangles) {
        const det = (b.nord - c.nord) * (a.est - c.est) + (c.est - b.est) * (a.nord - c.nord);
        const l1 = ((b.nord - c.nord) * (p.est - c.est) + (c.est - b.est) * (p.nord - c.nord)) / det;
        const l2 = ((c.nord - a.nord) * (p.est - c.est) + (a.est - c.est) * (p.nord - c.nord)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
        ecartMax = Math.max(ecartMax, Math.abs(p.altitude - (l1 * a.altitude + l2 * b.altitude + l3 * c.altitude)));
        break;
      }
    }
    expect(ecartMax).toBeLessThanOrEqual(0.1 + 0.002);
  });
  it('surface : nom « SWISSTOP … », triangles dans le contour seulement', () => {
    // Zone en L : les triangles du creux sont enlevés.
    const zoneL = [{ est: 0, nord: 0 }, { est: 10, nord: 0 }, { est: 10, nord: 5 }, { est: 5, nord: 5 }, { est: 5, nord: 10 }, { est: 0, nord: 10 }];
    const points = [];
    for (let e = 0; e <= 10; e += 1) for (let n = 0; n <= 10; n += 1) if (e <= 5 || n <= 5) points.push({ est: e, nord: n, altitude: 1 });
    const faces = trianglesDansContour(points, zoneL);
    const aire = faces.reduce((s, [a, b, c]) => s + Math.abs((points[b].est - points[a].est) * (points[c].nord - points[a].nord) - (points[c].est - points[a].est) * (points[b].nord - points[a].nord)) / 2, 0);
    expect(aire).toBeCloseTo(75, 6);
    const surface = surfaceSwisstopo('1', points, zoneL, 'swissALTI3D');
    expect(surface.nom).toBe('SWISSTOP 1');
    expect(surface.points[0].nom).toBe('SW-1');
    expect(prefixeDuNom(surface)).toBe('SWISSTOP ');
    expect(estImportee(surface)).toBe(true);
    expect(estSurfaceFichier(surface)).toBe(true);
  });
});

describe('Téléchargement (faux swisstopo)', () => {
  it('cherche les carrés, télécharge et lit les GeoTIFF', async () => {
    const tiff = fabriquerGeoTiff({ ...CARRE, f: PENTE, compression: 8 });
    const demandes = [];
    const fauxFetch = async (adresse) => {
      demandes.push(adresse);
      if (adresse.includes('/items')) {
        return { ok: true, json: async () => ({ features: [{ id: 'swissalti3d_2022_2600-1200', assets: { a: { href: 'https://x/swissalti3d_2022_2600-1200_0.5_2056_5728.tif' } } }], links: [] }) };
      }
      return { ok: true, arrayBuffer: async () => tiff };
    };
    const { rasters, fichiers } = await telechargerAltitudes(ZONE, () => {}, fauxFetch);
    expect(fichiers).toHaveLength(1);
    expect(rasters[0].largeur).toBe(40);
    expect(demandes[0]).toMatch(/bbox=7\.43/);
  });
  it('message clair sans réseau', async () => {
    await expect(telechargerAltitudes(ZONE, () => {}, async () => { throw new TypeError('Failed to fetch'); })).rejects.toThrow(/injoignable/);
  });
});
