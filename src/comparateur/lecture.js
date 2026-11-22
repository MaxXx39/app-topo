// Comparer des PDF (0.282.0) : lecture des PDF d'une comparaison avec pdf.js (déjà utilisé par Topo pour importer
// les plans PDF) : documents gardés ouverts, rendu d'une page dans un canvas, traits (pour le recalage automatique) et
// textes (pour « avant → après »). Repère : page à l'échelle 1 de pdf.js (points, y vers le bas).
import { chargerPdfjs, ouvrirPdf, contenuDeLaPage } from '../import/pdf.js';
import { MM_PAR_POINT } from '../topo/comparaison-pdf.js';

const documents = new Map(); // id du fichier → promesse du document pdf.js
const rendusEnCours = new WeakMap(); // canvas → tâche de rendu (annulée si un nouveau rendu la remplace)

/** Texte base64 → octets. */
export function octetsDeBase64(texte) {
  const binaire = atob(texte);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

/** Octets → texte base64 (par morceaux, pour les gros fichiers). */
export function base64DesOctets(octets) {
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

/** Document pdf.js d'un fichier { id, donnees (base64) } (ouvert une seule fois). */
export function documentDe(fichier) {
  if (!fichier?.donnees) return Promise.reject(new Error(`PDF « ${fichier?.nom ?? '?'} » absent sur cet appareil (pas encore reçu de Drive ?)`));
  if (!documents.has(fichier.id)) {
    const promesse = chargerPdfjs().then((pdfjs) => ouvrirPdf(pdfjs, octetsDeBase64(fichier.donnees)));
    promesse.catch(() => documents.delete(fichier.id));
    documents.set(fichier.id, promesse);
  }
  return documents.get(fichier.id);
}

/** Ferme les documents gardés ouverts (fermeture de la page). */
export function fermerDocuments() {
  for (const p of documents.values()) p.then((doc) => doc.destroy()).catch(() => {});
  documents.clear();
}

/** Taille d'une page (points) : { largeur, hauteur }. */
export async function taillePage(doc, numero) {
  const page = await doc.getPage(numero);
  const vue = page.getViewport({ scale: 1 });
  return { largeur: vue.width, hauteur: vue.height };
}

/**
 * Dessine la page dans le canvas (taille largeur × hauteur pixels), fond blanc. matrice : repère de la page (points,
 * y vers le bas) → pixels du canvas. Un rendu encore en cours sur ce canvas est annulé.
 */
export async function rendrePage(doc, numero, canvas, matrice, largeur, hauteur) {
  rendusEnCours.get(canvas)?.cancel();
  canvas.width = Math.max(1, Math.round(largeur));
  canvas.height = Math.max(1, Math.round(hauteur));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const page = await doc.getPage(numero);
  const tache = page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: 1 }), transform: matrice, background: '#ffffff' });
  rendusEnCours.set(canvas, tache);
  try {
    await tache.promise;
    return true;
  } catch (erreur) {
    if (erreur?.name === 'RenderingCancelledException') return false;
    throw erreur;
  } finally {
    if (rendusEnCours.get(canvas) === tache) rendusEnCours.delete(canvas);
  }
}

/**
 * Segments droits des traits de la page, en millimètres du papier (pour le calage automatique : ses tolérances
 * sont en « unités de la cible »), y vers le bas. Traits remplis (aplats) laissés de côté.
 */
export async function segmentsDeLaPage(doc, numero) {
  const pdfjs = await chargerPdfjs();
  const { traits, hauteur } = await contenuDeLaPage(doc, numero, pdfjs.OPS);
  const segs = [];
  for (const t of traits) {
    if (t.rempli) continue;
    const pts = t.points.map(([x, y]) => [x * MM_PAR_POINT, (hauteur - y) * MM_PAR_POINT]);
    const n = pts.length;
    for (let i = 0; i < (t.ferme ? n : n - 1); i += 1) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      if (p[0] !== q[0] || p[1] !== q[1]) segs.push([p[0], p[1], q[0], q[1]]);
    }
  }
  return segs;
}

/** Textes de la page : [{ t, x, y, w, h }] (boîte en points, y vers le bas). */
export async function textesDeLaPage(doc, numero) {
  const pdfjs = await chargerPdfjs();
  const page = await doc.getPage(numero);
  const vue = page.getViewport({ scale: 1 });
  const contenu = await page.getTextContent().catch(() => ({ items: [] }));
  const textes = [];
  for (const it of contenu.items ?? []) {
    if (!it.str?.trim() || !it.transform) continue;
    const m = pdfjs.Util.transform(vue.transform, it.transform);
    const h = Math.hypot(m[2], m[3]) || 1;
    const w = Math.max(it.width ?? 0, h * 0.5 * it.str.length);
    textes.push({ t: it.str.trim(), x: m[4], y: m[5] - h, w, h });
  }
  page.cleanup();
  return textes;
}
