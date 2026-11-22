// Excel du planning d'un mois (0.275.0), repris de l'appli d'origine (export_mois.py, excel_mois) : même
// disposition que l'ancien fichier (catégorie verticale, N° MS, n° interne en couleur, une colonne par jour,
// cellules fusionnées en couleur « n° – chantier – responsable »), pour qu'un collègue puisse le modifier.
// Il n'est pas relu par l'appli (décidé). Fichier .xlsx écrit sans bibliothèque (zip de XML, voir recap/xlsx.js),
// avec ce qu'il faut en plus du recap : couleurs, bords, fusions, textes tournés, mise en page A4 paysage.
import { zipper, nomColonne } from '../recap/xlsx.js';
import { MOIS, JOURS_COURTS } from './planning.js';

const encodeur = new TextEncoder();
const xml = (texte) => String(texte)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const couleurXlsx = (hexa) => `FF${String(hexa).replace('#', '').toUpperCase()}`;

/** N° de série Excel d'un jour 'AAAA-MM-JJ' (jours depuis le 30.12.1899). */
export function serieExcel(iso) {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000);
}

/**
 * Petit classeur d'un seul onglet avec styles. feuille : { nom, largeurs: [] (par colonne), hauteurs: { ligne: pt },
 * cellules: Map('ligne,colonne' → { v (texte, nombre), riche: [{ texte, police }], style }), fusions: ['B2:B3'],
 * figer: 'D4', zoneImpression: 'A1:AH20' }. style : { police: { taille, gras, italique, couleur }, fond,
 * align: { h, v, rotation, retour }, bord: { g, d, h, b } ('thin' | 'medium'), format: 'dd.mm.yyyy' }.
 * Lignes et colonnes comptées depuis 1.
 */
export function classeurUnOnglet(feuille) {
  const styles = [{}];
  const cleStyles = new Map([['{}', 0]]);
  const indexStyle = (style = {}) => {
    const cle = JSON.stringify(style);
    if (!cleStyles.has(cle)) {
      cleStyles.set(cle, styles.length);
      styles.push(style);
    }
    return cleStyles.get(cle);
  };
  // Polices, fonds, bords, formats : chacun dédoublonné.
  const tables = { polices: ['{}'], fonds: ['none', 'gray125'], bords: ['{}'], formats: [] };
  const indice = (table, cle) => {
    let i = tables[table].indexOf(cle);
    if (i < 0) i = tables[table].push(cle) - 1;
    return i;
  };
  const xmlPolice = (p = {}) => `<font>${p.gras ? '<b/>' : ''}${p.italique ? '<i/>' : ''}<sz val="${p.taille ?? 11}"/>${p.couleur ? `<color rgb="${couleurXlsx(p.couleur)}"/>` : ''}<name val="Calibri"/></font>`;

  const lignes = new Map();
  for (const [cle, cellule] of feuille.cellules) {
    const [r, c] = cle.split(',').map(Number);
    if (!lignes.has(r)) lignes.set(r, []);
    lignes.get(r).push({ c, ...cellule, s: indexStyle(cellule.style) });
  }
  const xmlCellule = (r, cel) => {
    const ref = `${nomColonne(cel.c - 1)}${r}`;
    if (cel.riche) {
      const runs = cel.riche.map((m) => `<r><rPr>${m.police?.gras ? '<b/>' : ''}${m.police?.italique ? '<i/>' : ''}<sz val="${m.police?.taille ?? 11}"/>${m.police?.couleur ? `<color rgb="${couleurXlsx(m.police.couleur)}"/>` : ''}<rFont val="Calibri"/></rPr><t xml:space="preserve">${xml(m.texte)}</t></r>`).join('');
      return `<c r="${ref}" s="${cel.s}" t="inlineStr"><is>${runs}</is></c>`;
    }
    if (cel.v === null || cel.v === undefined || cel.v === '') return `<c r="${ref}" s="${cel.s}"/>`;
    if (typeof cel.v === 'number') return `<c r="${ref}" s="${cel.s}"><v>${cel.v}</v></c>`;
    return `<c r="${ref}" s="${cel.s}" t="inlineStr"><is><t xml:space="preserve">${xml(cel.v)}</t></is></c>`;
  };
  const rangs = [...lignes.keys()].sort((a, b) => a - b).map((r) => {
    const hauteur = feuille.hauteurs?.[r];
    const cellules = lignes.get(r).sort((a, b) => a.c - b.c).map((cel) => xmlCellule(r, cel)).join('');
    return `<row r="${r}"${hauteur ? ` ht="${hauteur}" customHeight="1"` : ''}>${cellules}</row>`;
  }).join('');
  // Lignes avec une hauteur mais sans cellule
  const cols = (feuille.largeurs ?? []).map((l, i) => `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"/>`).join('');
  const [colFige, ligneFige] = feuille.figer ? [feuille.figer.match(/[A-Z]+/)[0], Number(feuille.figer.match(/\d+/)[0])] : [];
  const colonnesFigees = colFige ? colFige.split('').reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0) - 1 : 0;
  const vue = feuille.figer
    ? `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${colonnesFigees}" ySplit="${ligneFige - 1}" topLeftCell="${feuille.figer}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`
    : '';
  const fusions = feuille.fusions?.length ? `<mergeCells count="${feuille.fusions.length}">${feuille.fusions.map((f) => `<mergeCell ref="${f}"/>`).join('')}</mergeCells>` : '';
  const feuilleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${vue}<cols>${cols}</cols><sheetData>${rangs}</sheetData>${fusions}<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/></worksheet>`;

  // Styles (après les cellules : tous les styles sont connus)
  const xfs = styles.map((st) => {
    const police = indice('polices', JSON.stringify(st.police ?? {}));
    const fond = st.fond ? indice('fonds', st.fond.toUpperCase()) : 0;
    const bord = indice('bords', JSON.stringify(st.bord ?? {}));
    const format = st.format ? 164 + indice('formats', st.format) : 0;
    const a = st.align;
    const align = a ? `<alignment${a.h ? ` horizontal="${a.h}"` : ''}${a.v ? ` vertical="${a.v}"` : ''}${a.rotation ? ` textRotation="${a.rotation}"` : ''}${a.retour ? ' wrapText="1"' : ''}/>` : '';
    return `<xf numFmtId="${format}" fontId="${police}" fillId="${fond}" borderId="${bord}" xfId="0" applyFont="1" applyFill="1" applyBorder="1"${format ? ' applyNumberFormat="1"' : ''}${align ? ` applyAlignment="1">${align}</xf>` : '/>'}`;
  });
  const xmlBord = (b) => {
    const cote = (nom, v) => (v ? `<${nom} style="${v}"><color rgb="${v === 'thin' && b.gris ? 'FF808080' : 'FF000000'}"/></${nom}>` : `<${nom}/>`);
    return `<border>${cote('left', b.g)}${cote('right', b.d)}${cote('top', b.h)}${cote('bottom', b.b)}<diagonal/></border>`;
  };
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${tables.formats.length ? `<numFmts count="${tables.formats.length}">${tables.formats.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${xml(f)}"/>`).join('')}</numFmts>` : ''}<fonts count="${tables.polices.length}">${tables.polices.map((p) => xmlPolice(JSON.parse(p))).join('')}</fonts><fills count="${tables.fonds.length}">${tables.fonds.map((f, i) => (i < 2 ? `<fill><patternFill patternType="${f}"/></fill>` : `<fill><patternFill patternType="solid"><fgColor rgb="${couleurXlsx(f)}"/><bgColor indexed="64"/></patternFill></fill>`)).join('')}</fills><borders count="${tables.bords.length}">${tables.bords.map((b) => xmlBord(JSON.parse(b))).join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const nom = String(feuille.nom).replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Feuille';
  const zone = feuille.zoneImpression
    ? `<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'${xml(nom.replace(/'/g, "''"))}'!${feuille.zoneImpression.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName></definedNames>`
    : '';
  const fichiers = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(nom)}" sheetId="1" r:id="rId1"/></sheets>${zone}</workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', stylesXml],
    ['xl/worksheets/sheet1.xml', feuilleXml],
  ];
  return zipper(fichiers.map(([n, texte]) => [n, encodeur.encode(texte)]));
}

const GRIS_CODE = '#D9D9D9';
const MIN_LIGNES_GROUPE = 3;

/** Excel (Uint8Array) du mois. donnees : donneesDuMois(parc, annee, mois) (sans la veille). */
export function excelDuMois(donnees) {
  const { annee, mois, n, jours, groupes } = donnees;
  const cellules = new Map();
  const mettre = (r, c, cellule) => cellules.set(`${r},${c}`, { ...(cellules.get(`${r},${c}`) ?? {}), ...cellule });
  const fusions = [];
  const fusionner = (r1, c1, r2, c2) => fusions.push(`${nomColonne(c1 - 1)}${r1}:${nomColonne(c2 - 1)}${r2}`);
  const derniereCol = 3 + n;
  const police = { taille: 9 };
  const centre = { h: 'center', v: 'center' };

  // En-tête : mois (ligne 1), date tournée (ligne 2), jour (ligne 3).
  fusionner(1, 4, 1, derniereCol);
  mettre(1, 4, { v: MOIS[mois - 1].toUpperCase(), style: { police: { taille: 10, gras: true }, align: centre } });
  fusionner(2, 2, 3, 2);
  mettre(2, 2, { v: 'N° MS - A facturer', style: { police, fond: GRIS_CODE, align: { h: 'center', v: 'center', rotation: 90, retour: true } } });
  mettre(3, 2, { style: { fond: GRIS_CODE } });
  for (const jour of jours) {
    const col = 3 + jour.j;
    const tourne = { h: 'center', v: 'bottom', rotation: 90 };
    mettre(2, col, { v: serieExcel(jour.iso), style: { police: { taille: 7 }, align: tourne, format: 'dd.mm.yyyy', bord: { g: 'thin', d: 'thin', h: 'medium', gris: true } } });
    mettre(3, col, { v: JOURS_COURTS[jour.semaine], style: { police: { taille: 7 }, align: tourne, bord: { g: 'thin', d: 'thin', b: 'medium', gris: true } } });
  }

  let r = 4;
  const hauteurs = { 1: 14, 2: 58, 3: 22 };
  for (const g of groupes) {
    const nb = g.articles.length;
    const hauteur = nb >= MIN_LIGNES_GROUPE ? 15 : (15 * MIN_LIGNES_GROUPE) / nb;
    const rGroupe = r;
    for (const { article, barres } of g.articles) {
      hauteurs[r] = hauteur;
      const premier = r === rGroupe;
      const dernier = r === rGroupe + nb - 1;
      const bordLigne = (col) => ({
        g: col > 3 ? 'thin' : 'thin', d: col === 3 ? 'medium' : 'thin', h: premier ? 'medium' : 'thin', b: dernier ? 'medium' : 'thin', gris: col > 3,
      });
      for (let col = 2; col <= derniereCol; col += 1) mettre(r, col, { style: { police, bord: bordLigne(col) } });
      mettre(r, 2, { v: article.codeCompta || null, style: { police, fond: GRIS_CODE, align: centre, bord: bordLigne(2) } });
      mettre(r, 3, { v: article.numero, style: { police, fond: article.couleur, align: { v: 'center' }, bord: bordLigne(3) } });
      for (const b of barres) {
        const c1 = 3 + b.j1;
        const c2 = 3 + b.j2;
        if (c2 > c1) fusionner(r, c1, r, c2);
        for (let col = c1; col <= c2; col += 1) {
          mettre(r, col, { style: { police: { taille: 8 }, fond: article.couleur, align: c2 > c1 ? centre : { h: 'left', v: 'center' }, bord: { g: col === c1 ? 'thin' : undefined, d: col === c2 ? 'thin' : undefined, h: premier ? 'medium' : 'thin', b: dernier ? 'medium' : 'thin' } } });
        }
        mettre(r, c1, b.responsable
          ? { riche: [{ texte: b.principal, police: { taille: 8 } }, { texte: ` – ${b.responsable}`, police: { taille: 7, italique: true, couleur: '#595959' } }] }
          : { v: b.principal });
      }
      r += 1;
    }
    if (r - 1 > rGroupe) fusionner(rGroupe, 1, r - 1, 1);
    for (let rr = rGroupe; rr < r; rr += 1) {
      mettre(rr, 1, { style: { police: { taille: 9, gras: true }, align: { h: 'center', v: 'center', rotation: 90, retour: true }, bord: { g: 'medium', d: 'thin', h: rr === rGroupe ? 'medium' : undefined, b: rr === r - 1 ? 'medium' : undefined } } });
    }
    mettre(rGroupe, 1, { v: g.categorie.nom });
  }

  return classeurUnOnglet({
    nom: `${MOIS[mois - 1][0].toUpperCase()}${MOIS[mois - 1].slice(1)} ${annee}`,
    largeurs: [11, 6.5, 18, ...Array(n).fill(3.4)],
    hauteurs,
    cellules,
    fusions,
    figer: 'D4',
    zoneImpression: `A1:${nomColonne(derniereCol - 1)}${Math.max(r - 1, 3)}`,
  });
}
