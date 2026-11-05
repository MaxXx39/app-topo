/**
 * Lecture d'un plan PDF (0.129.0) avec pdf.js (bibliothèque libre de Mozilla, version « legacy »
 * pour les tablettes un peu anciennes).
 *
 * pdf.js est gros (environ 2 Mo) : il n'est téléchargé qu'à la première ouverture d'un PDF
 * (import dynamique), puis gardé sur l'appareil (voir runtimeCaching dans vite.config.js).
 *
 * On lit une page : ses traits (chemins tracés ou remplis), ses textes et ses calques
 * (« contenu optionnel » du PDF : AutoCAD y met ses calques). Les images ne sont pas lues :
 * un PDF scanné n'a que des images, il n'a donc pas de traits.
 */
import { IDENTITE, multiplier, appliquer, traitsDuChemin, CALQUE_TRAITS, CALQUE_REMPLIS } from '../topo/pdf-dxf.js';

let pdfjsCharge = null;

/** Charge pdf.js (une seule fois) et règle son « travailleur » (le fil qui décode le PDF). */
export function chargerPdfjs() {
  pdfjsCharge ??= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, { default: adresseTravailleur }]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = adresseTravailleur;
    return pdfjs;
  }).catch((erreur) => {
    pdfjsCharge = null;
    throw new Error(`lecture des PDF pas chargée (réseau ?) : ${erreur.message}`);
  });
  return pdfjsCharge;
}

/** Ouvre un PDF (octets). Renvoie le document de pdf.js (doc.numPages = nombre de pages). */
export async function ouvrirPdf(pdfjs, octets) {
  try {
    return await pdfjs.getDocument({ data: octets, isEvalSupported: false, verbosity: 0 }).promise;
  } catch (erreur) {
    if (erreur?.name === 'PasswordException') throw new Error('PDF protégé par un mot de passe : enregistre-le sans mot de passe');
    throw new Error(`PDF illisible : ${erreur?.message ?? erreur}`);
  }
}

/** Couleur de pdf.js (« #rrggbb » en général) → « #rrggbb » ou null. */
function couleurLue(valeur) {
  return typeof valeur === 'string' && /^#[0-9a-f]{6}$/i.test(valeur) ? valeur.toLowerCase() : null;
}

/** Vrai pour le blanc (fonds de page, cadres blancs) : pas utile sur le plan. */
const estBlanc = (couleur) => couleur === '#ffffff';

/**
 * Lit la page "numero" (à partir de 1) : { traits, textes, calques, images, largeur, hauteur }.
 * Coordonnées en points PDF, origine en bas à gauche de la page, y vers le haut (rotation
 * de la page comprise). "OPS" : codes des opérations de pdf.js (pdfjs.OPS).
 */
export async function contenuDeLaPage(doc, numero, OPS) {
  const page = await doc.getPage(numero);
  const vue = page.getViewport({ scale: 1 });
  // Vue de pdf.js : y vers le bas ; on le retourne pour avoir y vers le haut, comme en MN95.
  const versPlan = multiplier([1, 0, 0, -1, 0, vue.height], vue.transform);

  // Calques du PDF (contenu optionnel) : nom et visibilité de départ.
  const configuration = await doc.getOptionalContentConfig().catch(() => null);
  const nomDuGroupe = (id) => configuration?.getGroup?.(id)?.name ?? null;
  const calques = [];
  const calquesVus = new Set();
  const noterCalque = (nom, id) => {
    if (!nom || calquesVus.has(nom)) return;
    calquesVus.add(nom);
    let visible = true;
    try {
      visible = configuration?.isVisible?.({ type: 'OCG', id }) !== false;
    } catch {
      visible = true;
    }
    calques.push({ nom, visible });
  };

  const { fnArray, argsArray } = await page.getOperatorList();
  const traits = [];
  let images = 0;
  // État graphique : matrice, couleurs ; sauvegardé / remis par save / restore.
  let etat = { matrice: IDENTITE, trait: '#000000', remplissage: '#000000' };
  const pile = [];
  const pileCalques = []; // calque de chaque « contenu marqué » ouvert (null = pas un calque)
  const calqueCourant = () => {
    for (let i = pileCalques.length - 1; i >= 0; i--) if (pileCalques[i]) return pileCalques[i];
    return null;
  };

  for (let i = 0; i < fnArray.length; i++) {
    const op = fnArray[i];
    const args = argsArray[i];
    switch (op) {
      case OPS.save:
        pile.push(etat);
        etat = { ...etat };
        break;
      case OPS.restore:
        etat = pile.pop() ?? etat;
        break;
      case OPS.transform:
        etat.matrice = multiplier(etat.matrice, args);
        break;
      case OPS.paintFormXObjectBegin:
        pile.push(etat);
        etat = { ...etat };
        if (Array.isArray(args?.[0]) || ArrayBuffer.isView(args?.[0])) etat.matrice = multiplier(etat.matrice, [...args[0]]);
        break;
      case OPS.paintFormXObjectEnd:
        etat = pile.pop() ?? etat;
        break;
      case OPS.setStrokeRGBColor:
        etat.trait = couleurLue(args?.[0]) ?? etat.trait;
        break;
      case OPS.setFillRGBColor:
        etat.remplissage = couleurLue(args?.[0]) ?? etat.remplissage;
        break;
      case OPS.beginMarkedContentProps: {
        let nom = null;
        if (args?.[0] === 'OC' && args[1]) {
          const id = args[1].id ?? args[1].ids?.[0];
          nom = id ? nomDuGroupe(id) : null;
          noterCalque(nom, id);
        }
        pileCalques.push(nom);
        break;
      }
      case OPS.beginMarkedContent:
        pileCalques.push(null);
        break;
      case OPS.endMarkedContent:
        pileCalques.pop();
        break;
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
      case OPS.paintImageXObjectRepeat:
      case OPS.paintImageMaskXObjectRepeat:
        images++;
        break;
      case OPS.constructPath: {
        const [peinture, [donnees]] = args;
        if (!donnees) break;
        const trace = [OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(peinture);
        const rempli = [OPS.fill, OPS.eoFill].includes(peinture);
        if (!trace && !rempli) break; // chemin de découpe ou invisible
        const couleur = trace ? etat.trait : etat.remplissage;
        if (estBlanc(couleur)) break;
        const calque = calqueCourant() ?? (trace ? CALQUE_TRAITS : CALQUE_REMPLIS);
        const matrice = multiplier(versPlan, etat.matrice);
        for (const morceau of traitsDuChemin(donnees, matrice)) {
          traits.push({ ...morceau, calque, couleur, rempli });
        }
        break;
      }
      default:
        break;
    }
  }

  // Textes (les vrais textes ; un texte AutoCAD en police SHX est déjà en traits).
  const textes = [];
  const contenuTexte = await page.getTextContent().catch(() => ({ items: [] }));
  for (const element of contenuTexte.items ?? []) {
    if (!element.str || !element.str.trim() || !element.transform) continue;
    const [a, b, c, d, e, f] = element.transform;
    const [x, y] = appliquer(versPlan, e, f);
    const [xa, ya] = appliquer(versPlan, e + a, f + b);
    const [xh, yh] = appliquer(versPlan, e + c, f + d);
    textes.push({
      x,
      y,
      // Taille de la police → hauteur des majuscules (celle d'un texte DXF) : environ 70 %.
      hauteur: 0.7 * Math.hypot(xh - x, yh - y),
      angle: (Math.atan2(ya - y, xa - x) * 180) / Math.PI,
      texte: element.str,
    });
  }

  page.cleanup();
  return { traits, textes, calques, images, largeur: vue.width, hauteur: vue.height };
}
