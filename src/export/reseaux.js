// Exports du recollement de réseaux (0.101.0, demande du 30.10.2026) : CSV avec les attributs,
// DXF avec un calque par réseau, LandXML (PipeNetworks : Struct = ouvrage ou point de conduite,
// Pipe = tronçon) et PDF (plan des réseaux, puis tableaux des ouvrages et des tronçons).
// Entrée commune : reseaux = [{ nom, reseau (EU…), couleur ('#rrggbb'), trace (voir
// topo/reseau.js traceDuRecollement), points (points levés du réseau, avec leurs attributs) }].
// Coordonnées MN95 Est, Nord, altitude (m) ; LandXML : Nord, Est, altitude.
import { jsPDF } from 'jspdf';
import { formaterNombre } from '../topo/format.js';
import { ELEMENTS_RESEAU } from '../topo/reseau.js';
import { ecrireDxf, xyz, texteCentre, texteAscii, polyligne3D, nomDeCalque } from './dxf.js';
import { encoderEntites } from '../topo/landxml.js';
import { aciDeCouleurLibelle } from '../leve/libelles.js';
import { appliquerFormat, dessinerCadres, dessinerTitre, dessinerCartouche, COULEURS } from './pdf.js';

const NOM_ELEMENT = Object.fromEntries(ELEMENTS_RESEAU.map(([cle, titre]) => [cle, titre]));
const n = (valeur) => (valeur == null ? '' : formaterNombre(valeur));
const pente = (valeur) => (valeur == null ? '' : valeur.toFixed(2));
const sensTexte = (t) => (t.sens === 'a-b' ? `vers ${t.b.nom}` : t.sens === 'b-a' ? `vers ${t.a.nom}` : t.sens === 'plat' ? 'plat' : '');

/** Met un champ CSV entre guillemets s'il contient un point-virgule, un guillemet ou un retour à la ligne. */
function champCsv(valeur) {
  const texte = String(valeur ?? '');
  return /[;"\r\n]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
}

/**
 * CSV (point-virgule, point décimal) en trois tableaux séparés par une ligne vide : ouvrages,
 * tronçons, points levés.
 */
export function genererCsvReseaux(reseaux) {
  const lignes = [['Ouvrages'], ['Réseau', 'Levé', 'Nom', 'Type', 'Forme', 'Est', 'Nord', 'Tampon', 'Radier', 'Profondeur (m)', 'Ø (mm)', 'Matériau', 'Remarque']];
  for (const r of reseaux) {
    for (const o of r.trace.ouvrages) {
      lignes.push([r.reseau, r.nom, o.nom, NOM_ELEMENT[o.type] ?? o.type, o.forme === 'rect' ? 'rectangulaire' : 'ronde', n(o.centre.est), n(o.centre.nord), n(o.tampon), n(o.radier), n(o.profondeur), o.diametre ?? '', o.materiau, o.remarque]);
    }
  }
  lignes.push([], ['Tronçons'], ['Réseau', 'Conduite', 'De', 'À', 'Longueur 2D (m)', 'Fil d\'eau de (m)', 'Fil d\'eau à (m)', 'Pente (%)', 'Écoulement', 'Ø ext. (mm)', 'Matériau']);
  for (const r of reseaux) {
    for (const t of r.trace.troncons) {
      const tuyau = t.b.diametre != null ? t.b : t.a; // attributs du tuyau : ceux du point de conduite
      lignes.push([r.reseau, t.conduite, t.a.nom, t.b.nom, n(t.distance), n(t.a.filEau), n(t.b.filEau), pente(t.pente), sensTexte(t), tuyau.diametre ?? '', tuyau.materiau ?? '']);
    }
  }
  lignes.push([], ['Points levés'], ['Réseau', 'Nom', 'Élément', 'Est', 'Nord', 'Altitude levée', 'Fil d\'eau (m)', 'Ø (mm)', 'Matériau', 'Fouille (m)', 'Remarque']);
  for (const r of reseaux) {
    for (const p of r.points) {
      const ouvrage = ELEMENTS_RESEAU.find(([cle]) => cle === p.element)?.[2];
      const filEau = !ouvrage && p.diametre > 0 ? p.altitude - p.diametre / 1000 : null;
      lignes.push([r.reseau, p.nom, NOM_ELEMENT[p.element] ?? p.element ?? '', n(p.est), n(p.nord), n(p.altitude), n(filEau), p.diametre ?? '', p.materiau ?? '', n(p.profondeurFouille), p.remarque ?? '']);
    }
  }
  return lignes.map((ligne) => ligne.map(champCsv).join(';')).join('\r\n') + '\r\n';
}

/**
 * DXF R12, par réseau : RES_<réseau> (tronçons en 3D au fil d'eau, sinon à l'altitude levée),
 * RES_<réseau>_OUVRAGES (cercle ou cadre au tampon), RES_<réseau>_POINTS (points levés),
 * RES_<réseau>_TEXTES (noms, pente et sens « > » le long de chaque tronçon).
 */
export function genererDxfReseaux(reseaux) {
  const calques = new Map();
  const entites = [];
  for (const r of reseaux) {
    const couleur = aciDeCouleurLibelle(r.couleur) ?? 7;
    const [trait, ouvrages, points, textes] = ['', '_OUVRAGES', '_POINTS', '_TEXTES'].map((fin) => nomDeCalque(`RES_${r.reseau}${fin}`));
    for (const calque of [trait, ouvrages, points, textes]) calques.set(calque, couleur);
    const z = (noeud) => ({ ...noeud, altitude: noeud.filEau ?? noeud.altitude ?? 0 });
    for (const t of r.trace.troncons) {
      entites.push(['0', 'LINE', '8', trait, ...xyz(z(t.a), 0), ...xyz(z(t.b), 1)]);
      if (t.pente == null) continue;
      const [de, vers] = t.sens === 'b-a' ? [t.b, t.a] : [t.a, t.b];
      const angle = (Math.atan2(vers.nord - de.nord, vers.est - de.est) * 180) / Math.PI;
      // Texte lisible (pas à l'envers) : le sens est donné par « > » ou « < ».
      const retourne = angle > 90 || angle < -90;
      const texte = `${pente(t.pente)} %${t.sens === 'plat' ? '' : retourne ? '' : ' >'}`;
      const milieu = { est: (t.a.est + t.b.est) / 2, nord: (t.a.nord + t.b.nord) / 2, altitude: 0 };
      entites.push(texteCentre(milieu, 0.25, retourne ? angle + 180 : angle, retourne && t.sens !== 'plat' ? `< ${texte}` : texte, textes));
    }
    for (const o of r.trace.ouvrages) {
      if (o.coins) entites.push(...polyligne3D(o.coins.map((c) => ({ ...c, altitude: o.tampon ?? 0 })), true, ouvrages));
      else entites.push(['0', 'CIRCLE', '8', ouvrages, ...xyz({ ...o.centre, altitude: o.tampon ?? 0 }, 0), '40', ((o.diametre || 1000) / 2000).toFixed(3)]);
      const profondeur = o.profondeur == null ? '' : ` P ${formaterNombre(o.profondeur)}`;
      entites.push(['0', 'TEXT', '8', textes, ...xyz({ est: o.centre.est + 0.4, nord: o.centre.nord + 0.4, altitude: 0 }, 0), '40', '0.3', '1', texteAscii(`${o.nom}${profondeur}`)]);
    }
    for (const p of r.points) {
      entites.push(['0', 'POINT', '8', points, ...xyz(p, 0)]);
      entites.push(['0', 'TEXT', '8', textes, ...xyz({ est: p.est + 0.2, nord: p.nord - 0.4, altitude: 0 }, 0), '40', '0.2', '1', texteAscii(p.nom)]);
    }
  }
  return ecrireDxf(calques, entites);
}

// Type de réseau LandXML (pipeNetType) : eaux usées, eaux claires, eau ; les autres : « other ».
const TYPE_LANDXML = { EU: 'sanitary', EM: 'sanitary', EC: 'storm', AEP: 'water' };

/** LandXML 1.2 : un PipeNetwork par levé ; Struct pour chaque nœud, Pipe pour chaque tronçon. */
export function ecrireLandXMLReseaux(reseaux, nomProjet = 'Topo') {
  const date = new Date().toISOString();
  const e = (texte) => encoderEntites(String(texte ?? ''));
  const reseauxXml = reseaux.map((r) => {
    const structs = new Map();
    const ajouterStruct = (nom, xml) => {
      if (!structs.has(nom)) structs.set(nom, xml);
    };
    for (const o of r.trace.ouvrages) {
      const forme = o.coins
        ? `<RectStruct length="${Math.hypot(o.coins[1].est - o.coins[0].est, o.coins[1].nord - o.coins[0].nord).toFixed(3)}" width="${Math.hypot(o.coins[3].est - o.coins[0].est, o.coins[3].nord - o.coins[0].nord).toFixed(3)}"${o.materiau ? ` material="${e(o.materiau)}"` : ''} />`
        : `<CircStruct diameter="${((o.diametre || 1000) / 1000).toFixed(3)}"${o.materiau ? ` material="${e(o.materiau)}"` : ''} />`;
      const attributs = [`name="${e(o.nom)}"`, `desc="${e(o.type)}"`, o.tampon != null ? `elevRim="${o.tampon.toFixed(3)}"` : '', o.radier != null ? `elevSump="${o.radier.toFixed(3)}"` : ''].filter(Boolean).join(' ');
      ajouterStruct(o.nom, `        <Struct ${attributs}>\n          <Center>${o.centre.nord.toFixed(3)} ${o.centre.est.toFixed(3)}</Center>\n          ${forme}\n        </Struct>`);
    }
    for (const p of r.points.filter((pt) => !ELEMENTS_RESEAU.find(([cle]) => cle === pt.element)?.[2])) {
      const filEau = p.diametre > 0 ? ` elevSump="${(p.altitude - p.diametre / 1000).toFixed(3)}"` : '';
      ajouterStruct(p.nom, `        <Struct name="${e(p.nom)}" desc="${e(p.element)}" elevRim="${p.altitude.toFixed(3)}"${filEau}>\n          <Center>${p.nord.toFixed(3)} ${p.est.toFixed(3)}</Center>\n        </Struct>`);
    }
    // Nom d'un tronçon : sa conduite et son n° dans la conduite (« T-EU-1/2 »), pour ne pas le
    // confondre avec un point.
    const numeros = new Map();
    const pipes = r.trace.troncons.map((t) => {
      const cle = t.conduite || r.reseau;
      numeros.set(cle, (numeros.get(cle) ?? 0) + 1);
      const tuyau = t.b.diametre != null ? t.b : t.a;
      const diametre = tuyau.diametre ? `<CircPipe diameter="${(tuyau.diametre / 1000).toFixed(3)}"${tuyau.materiau ? ` material="${e(tuyau.materiau)}"` : ''} />` : '';
      const [debut, fin] = t.sens === 'b-a' ? [t.b, t.a] : [t.a, t.b]; // dans le sens de l'écoulement
      return `        <Pipe name="${e(`${cle}/${numeros.get(cle)}`)}" refStart="${e(debut.nom)}" refEnd="${e(fin.nom)}" length="${t.distance.toFixed(3)}"${t.pente != null ? ` slope="${(Math.abs(t.pente) / 100).toFixed(5)}"` : ''}>${diametre ? `\n          ${diametre}\n        ` : ''}</Pipe>`;
    });
    return `    <PipeNetwork name="${e(r.nom)}" pipeNetType="${TYPE_LANDXML[r.reseau] ?? 'other'}">
      <Structs>
${[...structs.values()].join('\n')}
      </Structs>
      <Pipes>
${pipes.join('\n')}
      </Pipes>
    </PipeNetwork>`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>
<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2" date="${date.slice(0, 10)}" time="${date.slice(11, 19)}">
  <Application name="Topo - Recollement" />
  <Project name="${e(nomProjet)}" />
  <Units>
    <Metric areaUnit="squareMeter" linearUnit="meter" volumeUnit="cubicMeter" diameterUnit="meter" />
  </Units>
  <PipeNetworks>
${reseauxXml.join('\n')}
  </PipeNetworks>
</LandXML>
`;
}

/** Couleur « #rrggbb » → [rouge, vert, bleu]. */
function rvb(hex) {
  return [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16) || 0);
}

/**
 * PDF A4 paysage : 1re feuille, le plan des réseaux (à l'échelle qui remplit le cadre) et la
 * légende ; puis les tableaux des ouvrages et des tronçons. cartouche : { affaire, lieu, date }.
 * Renvoie un Blob.
 */
export function pdfReseaux(reseaux, cartouche) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const infos = { ...cartouche, dessinePar: '', fichierPoints: `${reseaux.length} réseau(x)` };
  // --- Feuille 1 : plan ---
  let mise = appliquerFormat('a4');
  dessinerCadres(doc);
  let y = dessinerTitre(doc, 'Recollement des réseaux');
  const tous = reseaux.flatMap((r) => [...r.points, ...r.trace.ouvrages.map((o) => o.centre)]);
  const c = mise.cadrePlan;
  let echelle = null;
  if (tous.length > 0) {
    const minE = Math.min(...tous.map((p) => p.est));
    const maxE = Math.max(...tous.map((p) => p.est));
    const minN = Math.min(...tous.map((p) => p.nord));
    const maxN = Math.max(...tous.map((p) => p.nord));
    const marge = 8;
    // mm sur le papier par m sur le terrain : le plus grand qui fait tout tenir.
    const mmParM = Math.min((c.largeur - 2 * marge) / Math.max(maxE - minE, 1), (c.hauteur - 2 * marge) / Math.max(maxN - minN, 1));
    echelle = Math.round(1000 / mmParM);
    const versPapier = (p) => ({
      x: c.x + c.largeur / 2 + (p.est - (minE + maxE) / 2) * mmParM,
      y: c.y + c.hauteur / 2 - (p.nord - (minN + maxN) / 2) * mmParM,
    });
    for (const r of reseaux) {
      const couleur = rvb(r.couleur);
      doc.setDrawColor(...couleur);
      doc.setTextColor(...couleur);
      doc.setFillColor(...couleur);
      doc.setLineWidth(0.5);
      for (const t of r.trace.troncons) {
        const a = versPapier(t.a);
        const b = versPapier(t.b);
        doc.line(a.x, a.y, b.x, b.y);
        const longueur = Math.hypot(b.x - a.x, b.y - a.y);
        if (t.pente == null || longueur < 12) continue;
        const [de, vers] = t.sens === 'b-a' ? [b, a] : [a, b];
        const ux = (vers.x - de.x) / longueur;
        const uy = (vers.y - de.y) / longueur;
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (t.sens !== 'plat') doc.triangle(m.x + ux * 1.6, m.y + uy * 1.6, m.x - ux * 1.2 - uy * 1.1, m.y - uy * 1.2 + ux * 1.1, m.x - ux * 1.2 + uy * 1.1, m.y - uy * 1.2 - ux * 1.1, 'F');
        doc.setFontSize(6);
        doc.text(`${pente(t.pente)} %`, m.x + 1.5, m.y - 1.5);
      }
      doc.setLineWidth(0.35);
      for (const o of r.trace.ouvrages) {
        const centre = versPapier(o.centre);
        if (o.coins) {
          const coins = o.coins.map(versPapier);
          coins.forEach((p, i) => doc.line(p.x, p.y, coins[(i + 1) % 4].x, coins[(i + 1) % 4].y));
        } else doc.circle(centre.x, centre.y, Math.max(0.9, ((o.diametre || 1000) / 2000) * mmParM), 'S');
        doc.setFontSize(6.5);
        doc.text(o.profondeur == null ? o.nom : `${o.nom}  P ${formaterNombre(o.profondeur)}`, centre.x + 1.8, centre.y - 1.8);
      }
    }
  }
  // Légende : un trait de couleur par réseau.
  doc.setFontSize(8);
  for (const r of reseaux) {
    doc.setDrawColor(...rvb(r.couleur));
    doc.setLineWidth(0.8);
    doc.line(mise.colonne.x, y - 1, mise.colonne.x + 8, y - 1);
    doc.setTextColor(...COULEURS.texte);
    doc.text(`${r.nom} : ${r.trace.ouvrages.length} ouvrage(s), ${r.trace.troncons.length} tronçon(s)`, mise.colonne.x + 10, y);
    y += 5;
  }
  dessinerCartouche(doc, { ...infos, texteEchelle: echelle ? `1:${echelle} (env.)` : '-' });
  // --- Tableaux ---
  // Largeurs en mm : au plus 200 mm en tout (cadre du plan A4, comme le PDF des contrôles).
  const colonnesOuvrages = [['Réseau', 12], ['Nom', 24], ['Type', 18], ['Forme', 13], ['Est', 24], ['Nord', 24], ['Tampon', 17], ['Radier', 17], ['Prof. m', 13], ['Ø mm', 12], ['Matériau', 20]];
  const colonnesTroncons = [['Réseau', 12], ['Conduite', 18], ['De', 22], ['À', 22], ['Long. m', 15], ['FE de', 17], ['FE à', 17], ['Pente %', 14], ['Écoulement', 30], ['Ø mm', 12], ['Matériau', 18]];
  const lignesOuvrages = reseaux.flatMap((r) => r.trace.ouvrages.map((o) => [r.reseau, o.nom, NOM_ELEMENT[o.type] ?? o.type, o.forme === 'rect' ? 'rect.' : 'ronde', n(o.centre.est), n(o.centre.nord), n(o.tampon), n(o.radier), n(o.profondeur), o.diametre ?? '', o.materiau]));
  const lignesTroncons = reseaux.flatMap((r) => r.trace.troncons.map((t) => {
    const tuyau = t.b.diametre != null ? t.b : t.a;
    return [r.reseau, t.conduite, t.a.nom, t.b.nom, n(t.distance), n(t.a.filEau), n(t.b.filEau), pente(t.pente), sensTexte(t), tuyau.diametre ?? '', tuyau.materiau ?? ''];
  }));
  const feuille = (titre) => {
    doc.addPage('a4', 'landscape');
    mise = appliquerFormat('a4');
    dessinerCadres(doc);
    dessinerTitre(doc, titre);
    dessinerCartouche(doc, { ...infos, texteEchelle: '-' });
    return mise.cadrePlan.y + 7;
  };
  const ecrire = (colonnes, valeurs, yLigne, gras = false) => {
    let x = mise.cadrePlan.x + 3;
    doc.setFont('helvetica', gras ? 'bold' : 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...(gras ? COULEURS.gris : COULEURS.texte));
    colonnes.forEach(([, largeur], i) => {
      doc.text(doc.splitTextToSize(String(valeurs[i] ?? ''), largeur - 1)[0] ?? '', x, yLigne);
      x += largeur;
    });
    doc.setFont('helvetica', 'normal');
  };
  for (const [titre, colonnes, lignes] of [['Ouvrages', colonnesOuvrages, lignesOuvrages], ['Tronçons', colonnesTroncons, lignesTroncons]]) {
    if (lignes.length === 0) continue;
    let yLigne = feuille(titre);
    ecrire(colonnes, colonnes.map(([t]) => t), yLigne, true);
    yLigne += 5.5;
    for (const valeurs of lignes) {
      if (yLigne > mise.cadrePlan.y + mise.cadrePlan.hauteur - 4) {
        yLigne = feuille(`${titre} (suite)`);
        ecrire(colonnes, colonnes.map(([t]) => t), yLigne, true);
        yLigne += 5.5;
      }
      ecrire(colonnes, valeurs, yLigne);
      yLigne += 5;
    }
  }
  return doc.output('blob');
}
