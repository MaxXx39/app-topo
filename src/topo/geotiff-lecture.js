// Lecture d'un GeoTIFF d'altitudes (0.109.0, Surface Swisstopo) : une image dont chaque pixel est
// une altitude (swissALTI3D : pixels de 0,5 m, carré de 1 km, en MN95). Sans bibliothèque.
// Pris en charge : TIFF classique (pas BigTIFF), en bandes ou en tuiles, sans compression, LZW ou
// Deflate, prédicteur 1 (aucun), 2 (entiers) ou 3 (flottants) ; nombres flottants 32 / 64 bits ou
// entiers 16 / 32 bits ; une seule valeur par pixel. Seule la première image est lue (les images
// réduites d'un « Cloud Optimized GeoTIFF » sont ignorées).
// Position : tags ModelPixelScale (33550) et ModelTiepoint (33922) ; GTRasterTypeGeoKey (1025) dit
// si la position donnée est le coin du pixel (« area », cas habituel) ou son centre (« point »).

const TAGS = {
  largeur: 256, hauteur: 257, bits: 258, compression: 259, offsetsBandes: 273, valeursParPixel: 277,
  lignesParBande: 278, octetsBandes: 279, rangement: 284, predicteur: 317, largeurTuile: 322,
  hauteurTuile: 323, offsetsTuiles: 324, octetsTuiles: 325, formatValeur: 339, echelle: 33550,
  attache: 33922, cleGeo: 34735, sansDonnee: 42113,
};

/**
 * Lit le GeoTIFF (ArrayBuffer). Renvoie (promesse) { largeur, hauteur, valeurs (Float32Array, ligne
 * par ligne depuis le haut ; NaN = pas de donnée), est0, nord0 (centre du pixel en haut à gauche, m),
 * pas (taille du pixel, m) }. Erreur claire si le fichier n'est pas lisible.
 */
export async function lireGeoTiff(tampon) {
  const vue = new DataView(tampon);
  if (vue.byteLength < 8) throw new Error('fichier d\'altitudes vide ou coupé');
  const ordre = String.fromCharCode(vue.getUint8(0), vue.getUint8(1));
  if (ordre !== 'II' && ordre !== 'MM') throw new Error('ce n\'est pas un fichier GeoTIFF');
  const petit = ordre === 'II';
  const magique = vue.getUint16(2, petit);
  if (magique === 43) throw new Error('GeoTIFF « BigTIFF » pas pris en charge');
  if (magique !== 42) throw new Error('ce n\'est pas un fichier GeoTIFF');
  const tags = lireTags(vue, vue.getUint32(4, petit), petit);

  const un = (cle, defaut) => tags.get(TAGS[cle])?.[0] ?? defaut;
  const largeur = un('largeur');
  const hauteur = un('hauteur');
  const bits = un('bits', 1);
  const compression = un('compression', 1);
  const predicteur = un('predicteur', 1);
  const format = un('formatValeur', 1); // 1 = entier positif, 2 = entier signé, 3 = flottant
  if (!largeur || !hauteur) throw new Error('GeoTIFF sans taille d\'image');
  if (un('valeursParPixel', 1) !== 1) throw new Error('GeoTIFF à plusieurs valeurs par pixel : pas un fichier d\'altitudes');
  if (![1, 5, 8, 32946].includes(compression)) throw new Error(`compression du GeoTIFF pas prise en charge (n° ${compression})`);
  const lireValeur = lecteurDeValeur(format, bits);

  const echelle = tags.get(TAGS.echelle);
  const attache = tags.get(TAGS.attache);
  if (!echelle || !attache) throw new Error('GeoTIFF sans position (pas de géoréférence)');
  const pas = echelle[0];
  // Position donnée = coin du pixel (« area »), sauf si la clé GTRasterTypeGeoKey dit « point ».
  const auCentre = typeRaster(tags.get(TAGS.cleGeo)) === 2;
  const decalage = auCentre ? 0 : 0.5;
  const est0 = attache[3] + (decalage - attache[0]) * pas;
  const nord0 = attache[4] - (decalage - attache[1]) * echelle[1];
  if (Math.abs(echelle[1] - pas) > 1e-9) throw new Error('GeoTIFF à pixels pas carrés : pas pris en charge');

  const sansDonnee = Number.parseFloat(tags.get(TAGS.sansDonnee) ?? '');
  const octetsParValeur = bits / 8;
  const valeurs = new Float32Array(largeur * hauteur).fill(Number.NaN);

  // Blocs : tuiles, ou bandes (des lignes entières).
  const enTuiles = tags.has(TAGS.offsetsTuiles);
  const largeurBloc = enTuiles ? un('largeurTuile') : largeur;
  const hauteurBloc = enTuiles ? un('hauteurTuile') : Math.min(un('lignesParBande', hauteur), hauteur);
  const offsets = tags.get(enTuiles ? TAGS.offsetsTuiles : TAGS.offsetsBandes) ?? [];
  const tailles = tags.get(enTuiles ? TAGS.octetsTuiles : TAGS.octetsBandes) ?? [];
  const blocsParLigne = Math.ceil(largeur / largeurBloc);

  for (let n = 0; n < offsets.length; n++) {
    if (offsets[n] + tailles[n] > vue.byteLength) throw new Error('fichier d\'altitudes coupé (téléchargement incomplet ?)');
    const brut = new Uint8Array(tampon, offsets[n], tailles[n]);
    const attendu = largeurBloc * hauteurBloc * octetsParValeur;
    let octets = await decompresser(brut, compression, attendu);
    // Une bande en bas de l'image peut être plus courte.
    const lignesBloc = Math.min(hauteurBloc, Math.floor(octets.length / (largeurBloc * octetsParValeur)));
    octets = annulerPredicteur(octets, predicteur, largeurBloc, lignesBloc, octetsParValeur);
    const donnees = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    const col0 = (n % blocsParLigne) * largeurBloc;
    const lig0 = Math.floor(n / blocsParLigne) * hauteurBloc;
    // Prédicteur 3 : les octets ont été remis dans l'ordre « gros bout » (voir annulerPredicteur).
    const petitBout = predicteur === 3 ? false : petit;
    for (let l = 0; l < lignesBloc; l++) {
      const ligne = lig0 + l;
      if (ligne >= hauteur) break;
      for (let c = 0; c < largeurBloc; c++) {
        const colonne = col0 + c;
        if (colonne >= largeur) break;
        const valeur = lireValeur(donnees, (l * largeurBloc + c) * octetsParValeur, petitBout);
        if (Number.isFinite(valeur) && valeur !== sansDonnee && valeur > -9000) valeurs[ligne * largeur + colonne] = valeur;
      }
    }
  }
  return { largeur, hauteur, valeurs, est0, nord0, pas };
}

/** Tags de la première image : Map n° → tableau de nombres (ou texte pour les tags ASCII). */
function lireTags(vue, debut, petit) {
  const tags = new Map();
  const nombre = vue.getUint16(debut, petit);
  const TAILLES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };
  for (let i = 0; i < nombre; i++) {
    const position = debut + 2 + i * 12;
    const tag = vue.getUint16(position, petit);
    const type = vue.getUint16(position + 2, petit);
    const quantite = vue.getUint32(position + 4, petit);
    const taille = TAILLES[type];
    if (!taille) continue;
    const ou = taille * quantite <= 4 ? position + 8 : vue.getUint32(position + 8, petit);
    if (ou + taille * quantite > vue.byteLength) throw new Error('fichier d\'altitudes coupé (téléchargement incomplet ?)');
    if (type === 2) {
      let texte = '';
      for (let k = 0; k < quantite; k++) texte += String.fromCharCode(vue.getUint8(ou + k));
      tags.set(tag, texte.replace(/\0+$/, ''));
      continue;
    }
    const liste = [];
    for (let k = 0; k < quantite; k++) {
      const p = ou + k * taille;
      if (type === 3) liste.push(vue.getUint16(p, petit));
      else if (type === 4) liste.push(vue.getUint32(p, petit));
      else if (type === 8) liste.push(vue.getInt16(p, petit));
      else if (type === 9) liste.push(vue.getInt32(p, petit));
      else if (type === 11) liste.push(vue.getFloat32(p, petit));
      else if (type === 12) liste.push(vue.getFloat64(p, petit));
      else if (type === 16) liste.push(Number(vue.getBigUint64(p, petit)));
      else if (type === 5) liste.push(vue.getUint32(p, petit) / vue.getUint32(p + 4, petit));
      else if (type === 10) liste.push(vue.getInt32(p, petit) / vue.getInt32(p + 4, petit));
      else if (type === 6) liste.push(vue.getInt8(p));
      else liste.push(vue.getUint8(p));
    }
    tags.set(tag, liste);
  }
  return tags;
}

/** GTRasterTypeGeoKey (1 = coin du pixel, 2 = centre), lu dans le répertoire des clés GeoTIFF. */
function typeRaster(cles) {
  if (!cles) return 1;
  for (let i = 4; i + 3 < cles.length; i += 4) if (cles[i] === 1025) return cles[i + 3];
  return 1;
}

/** Fonction (donnees, position, petitBout) → nombre, selon le format des valeurs. */
function lecteurDeValeur(format, bits) {
  if (format === 3 && bits === 32) return (d, p, pb) => d.getFloat32(p, pb);
  if (format === 3 && bits === 64) return (d, p, pb) => d.getFloat64(p, pb);
  if (bits === 16) return format === 2 ? (d, p, pb) => d.getInt16(p, pb) : (d, p, pb) => d.getUint16(p, pb);
  if (bits === 32) return format === 2 ? (d, p, pb) => d.getInt32(p, pb) : (d, p, pb) => d.getUint32(p, pb);
  throw new Error(`format des altitudes du GeoTIFF pas pris en charge (${bits} bits)`);
}

/** Décompresse un bloc : 1 = rien, 5 = LZW, 8 / 32946 = Deflate (zlib). */
async function decompresser(octets, compression, attendu) {
  if (compression === 1) return octets;
  if (compression === 5) return decompresserLzw(octets, attendu);
  try {
    const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(flux).arrayBuffer());
  } catch {
    throw new Error('fichier d\'altitudes abîmé (décompression impossible)');
  }
}

/** Décompression LZW du format TIFF (codes de 9 à 12 bits, bit de poids fort d'abord). */
export function decompresserLzw(octets, attendu = 0) {
  const sortie = new Uint8Array(Math.max(attendu, octets.length * 3));
  let taille = 0;
  const ecrire = (suite) => {
    if (taille + suite.length > sortie.length) return; // plus long que prévu : on coupe
    sortie.set(suite, taille);
    taille += suite.length;
  };
  let table = [];
  const reinitialiser = () => {
    table = [];
    for (let i = 0; i < 256; i++) table.push(Uint8Array.of(i));
    table.push(null, null); // 256 = effacer, 257 = fin
  };
  reinitialiser();
  let largeurCode = 9;
  let position = 0; // en bits
  let precedent = null;
  const totalBits = octets.length * 8;
  while (position + largeurCode <= totalBits) {
    let code = 0;
    for (let b = 0; b < largeurCode; b++) {
      const bit = (octets[(position + b) >> 3] >> (7 - ((position + b) & 7))) & 1;
      code = (code << 1) | bit;
    }
    position += largeurCode;
    if (code === 257) break;
    if (code === 256) {
      reinitialiser();
      largeurCode = 9;
      precedent = null;
      continue;
    }
    let suite;
    if (code < table.length && table[code]) suite = table[code];
    else if (precedent) {
      suite = new Uint8Array(precedent.length + 1);
      suite.set(precedent);
      suite[precedent.length] = precedent[0];
    } else throw new Error('fichier d\'altitudes abîmé (LZW)');
    ecrire(suite);
    if (precedent) {
      const nouvelle = new Uint8Array(precedent.length + 1);
      nouvelle.set(precedent);
      nouvelle[precedent.length] = suite[0];
      table.push(nouvelle);
    }
    precedent = suite;
    // Changement de largeur « en avance » du TIFF : un code plus tôt que la limite.
    if (table.length + 1 >= 1 << largeurCode && largeurCode < 12) largeurCode++;
  }
  return sortie.subarray(0, taille);
}

/**
 * Annule le prédicteur : 2 = chaque valeur était l'écart à la précédente de la ligne (entiers) ;
 * 3 = flottants : écarts octet par octet, octets rangés par « plans » (poids fort d'abord) ; on
 * remet chaque valeur en ordre « gros bout ».
 */
function annulerPredicteur(octets, predicteur, largeur, lignes, octetsParValeur) {
  if (predicteur === 1) return octets;
  const copie = new Uint8Array(octets.subarray(0, largeur * lignes * octetsParValeur));
  const longueurLigne = largeur * octetsParValeur;
  if (predicteur === 2) {
    const vue = new DataView(copie.buffer);
    for (let l = 0; l < lignes; l++) {
      for (let c = 1; c < largeur; c++) {
        const p = l * longueurLigne + c * octetsParValeur;
        if (octetsParValeur === 2) vue.setUint16(p, vue.getUint16(p, true) + vue.getUint16(p - 2, true), true);
        else vue.setUint32(p, (vue.getUint32(p, true) + vue.getUint32(p - 4, true)) >>> 0, true);
      }
    }
    return copie;
  }
  if (predicteur === 3) {
    const sortie = new Uint8Array(copie.length);
    for (let l = 0; l < lignes; l++) {
      const debut = l * longueurLigne;
      for (let i = 1; i < longueurLigne; i++) copie[debut + i] = (copie[debut + i] + copie[debut + i - 1]) & 255;
      for (let c = 0; c < largeur; c++) {
        for (let k = 0; k < octetsParValeur; k++) sortie[debut + c * octetsParValeur + k] = copie[debut + k * largeur + c];
      }
    }
    return sortie;
  }
  throw new Error(`prédicteur du GeoTIFF pas pris en charge (n° ${predicteur})`);
}
