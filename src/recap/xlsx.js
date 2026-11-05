// Fichier Excel (.xlsx) sans bibliothèque (0.119.0) : un .xlsx est un zip de petits fichiers XML.
// On écrit seulement ce qu'il faut pour le recap : plusieurs onglets, textes, nombres, titres en
// gras, largeur des colonnes. Le zip est « stocké » (sans compression) : le recap est petit.

const encodeur = new TextEncoder();

/** Texte sûr dans du XML. */
function xml(texte) {
  return String(texte)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // caractères de contrôle interdits en XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/** Nom de colonne Excel : 0 → A, 25 → Z, 26 → AA. */
export function nomColonne(index) {
  let nom = '';
  let n = index + 1;
  while (n > 0) {
    const reste = (n - 1) % 26;
    nom = String.fromCharCode(65 + reste) + nom;
    n = Math.floor((n - 1) / 26);
  }
  return nom;
}

/** Nom d'onglet accepté par Excel : 31 caractères au plus, sans : \ / ? * [ ]. */
function nomOnglet(nom, pris) {
  let propre = String(nom).replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Feuille';
  let n = 2;
  const base = propre;
  while (pris.has(propre.toLowerCase())) propre = `${base.slice(0, 28)} ${n++}`;
  pris.add(propre.toLowerCase());
  return propre;
}

/**
 * Cellule : texte, nombre, null (vide), ou { v, style } avec style 'gras' ou 'titre'.
 * Renvoie le XML de la cellule.
 */
function cellule(valeur, reference) {
  const styles = { normal: 0, gras: 1, titre: 2, nombre: 3, orange: 4, rouge: 5 };
  let v = valeur;
  let style = 'normal';
  if (v && typeof v === 'object') {
    style = v.style ?? 'normal';
    v = v.v;
  }
  if (v == null || v === '') return style === 'normal' ? '' : `<c r="${reference}" s="${styles[style]}"/>`;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const s = style === 'normal' && !Number.isInteger(v) ? styles.nombre : styles[style] ?? 0; // orange / rouge : écart hors tolérance (0.127.0)
    return `<c r="${reference}" s="${s}"><v>${v}</v></c>`;
  }
  return `<c r="${reference}" s="${styles[style] ?? 0}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
}

/** XML d'un onglet : lignes (tableau de tableaux de cellules), largeurs (caractères par colonne). */
function feuilleXml({ lignes, largeurs = [] }) {
  const cols = largeurs.length > 0
    ? `<cols>${largeurs.map((l, i) => `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const rangs = lignes.map((ligne, i) => `<row r="${i + 1}">${(ligne ?? []).map((v, j) => cellule(v, `${nomColonne(j)}${i + 1}`)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rangs}</sheetData></worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.000"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDBA74"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF87171"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/><xf numFmtId="164" fontId="1" fillId="4" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * Fichier .xlsx (Uint8Array) à partir des onglets [{ nom, lignes, largeurs }].
 */
export function creerXlsx(onglets) {
  const pris = new Set();
  const noms = onglets.map((o) => nomOnglet(o.nom, pris));
  const fichiers = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${onglets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${noms.map((nom, i) => `<sheet name="${xml(nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${onglets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${onglets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', STYLES],
    ...onglets.map((o, i) => [`xl/worksheets/sheet${i + 1}.xml`, feuilleXml(o)]),
  ];
  return zipper(fichiers.map(([nom, texte]) => [nom, encodeur.encode(texte)]));
}

// --- Zip « stocké » (sans compression) ---

let tableCrc = null;
/** Somme de contrôle CRC-32 d'octets (celle du format zip). */
export function crc32(octets) {
  if (!tableCrc) {
    tableCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tableCrc[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const o of octets) crc = tableCrc[(crc ^ o) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Zip (Uint8Array) de fichiers [[nom, octets]], sans compression. */
export function zipper(fichiers) {
  const morceaux = [];
  const central = [];
  let position = 0;
  for (const [nom, octets] of fichiers) {
    const nomOctets = encodeur.encode(nom);
    const crc = crc32(octets);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version
    local.setUint16(6, 0x0800, true); // noms en UTF-8
    local.setUint16(8, 0, true); // stocké
    local.setUint32(14, crc, true);
    local.setUint32(18, octets.length, true);
    local.setUint32(22, octets.length, true);
    local.setUint16(26, nomOctets.length, true);
    morceaux.push(new Uint8Array(local.buffer), nomOctets, octets);
    const entree = new DataView(new ArrayBuffer(46));
    entree.setUint32(0, 0x02014b50, true);
    entree.setUint16(4, 20, true);
    entree.setUint16(6, 20, true);
    entree.setUint16(8, 0x0800, true);
    entree.setUint16(10, 0, true);
    entree.setUint32(16, crc, true);
    entree.setUint32(20, octets.length, true);
    entree.setUint32(24, octets.length, true);
    entree.setUint16(28, nomOctets.length, true);
    entree.setUint32(42, position, true);
    central.push(new Uint8Array(entree.buffer), nomOctets);
    position += 30 + nomOctets.length + octets.length;
  }
  const tailleCentral = central.reduce((t, m) => t + m.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, fichiers.length, true);
  fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentral, true);
  fin.setUint32(16, position, true);
  const tout = [...morceaux, ...central, new Uint8Array(fin.buffer)];
  const resultat = new Uint8Array(tout.reduce((t, m) => t + m.length, 0));
  let i = 0;
  for (const m of tout) {
    resultat.set(m, i);
    i += m.length;
  }
  return resultat;
}
