// Plans de chantier (0.289.0, étape 3) : fond swisstopo (photo aérienne pâlie, cadastre) sous le plan de chantier,
// sur l'écran et sur la feuille (PDF). Mêmes tuiles WMTS que le plan principal (plan/fond.js), dessinées dans un canvas.
import { FONDS, niveauDeZoom, tuilesPourZone, garderLesTraits } from '../plan/fond.js';
import { versTerrain } from '../plan/vue.js';

const cache = new Map(); // adresse → { image (img ou canvas), etat : 'charge' | 'ok' | 'erreur' }
const MAX_TUILES = 250;
export const PALEUR_ORTHO = 45; // % de blanc posé sur la photo au départ (« orthophoto pâlie »)

/** Zone du terrain vue (m) d'une vue sans rotation. */
function zoneDe(vue) {
  const a = versTerrain(0, 0, vue);
  const b = versTerrain(vue.largeur, vue.hauteur, vue);
  return { estMin: Math.min(a.est, b.est), estMax: Math.max(a.est, b.est), nordMin: Math.min(a.nord, b.nord), nordMax: Math.max(a.nord, b.nord) };
}

/** Tuile d'une adresse : chargée une fois (cadastre : seulement ses traits). quandPrete() : appelé quand elle arrive. */
function tuile(adresse, traitsSeulement, quandPrete) {
  let t = cache.get(adresse);
  if (t) {
    if (t.etat === 'charge' && quandPrete) t.attente.add(quandPrete);
    return t;
  }
  const image = new Image();
  image.crossOrigin = 'anonymous'; // lire les pixels (cadastre) et poser l'image dans le PDF
  t = { image, etat: 'charge', attente: new Set(quandPrete ? [quandPrete] : []) };
  cache.set(adresse, t);
  image.onload = () => {
    try {
      t.image = traitsSeulement ? garderLesTraits(image) : image;
      t.etat = 'ok';
    } catch {
      t.etat = 'erreur';
    }
    for (const f of t.attente) f();
    t.attente.clear();
  };
  image.onerror = () => {
    t.etat = 'erreur';
    for (const f of t.attente) f();
    t.attente.clear();
  };
  image.src = adresse;
  return t;
}

/**
 * Dessine le fond swisstopo dans ctx (pixels CSS) pour la vue. fond : { ortho, paleur (%), cadastre }.
 * densite : pixels réels par pixel CSS (choix du niveau de tuiles). quandPrete() : redessiner quand une tuile arrive.
 * Renvoie { tuiles, manquantes, enCours } (manquantes = pas chargées : pas de connexion ?).
 */
export function dessinerFondSwisstopo(ctx, vue, fond, densite = 1, quandPrete = null) {
  const res = { tuiles: 0, manquantes: 0, enCours: 0 };
  const couches = [fond?.ortho ? 'satellite' : null, fond?.cadastre ? 'cadastre' : null].filter(Boolean);
  if (!couches.length) return res;
  const z = niveauDeZoom(1 / vue.echelle, densite);
  const zone = zoneDe(vue);
  const liste = tuilesPourZone(zone, z);
  if (liste.length > MAX_TUILES) return res;
  for (const nom of couches) {
    const source = FONDS[nom];
    for (const t of liste) {
      const adresse = source.url(t.z, t.colonne, t.ligne);
      const lu = tuile(adresse, source.traitsSeulement, quandPrete);
      res.tuiles += 1;
      if (lu.etat === 'charge') res.enCours += 1;
      if (lu.etat !== 'ok') {
        if (lu.etat === 'erreur') res.manquantes += 1;
        continue;
      }
      const x = (t.est - zone.estMin) * vue.echelle;
      const y = (zone.nordMax - t.nord) * vue.echelle;
      const c = t.cote * vue.echelle;
      ctx.drawImage(lu.image, Math.floor(x), Math.floor(y), Math.ceil(c) + 1, Math.ceil(c) + 1);
    }
    if (nom === 'satellite' && (fond.paleur ?? PALEUR_ORTHO) > 0) {
      // Photo pâlie : un voile blanc par-dessus, le plan se lit mieux.
      ctx.fillStyle = `rgba(255,255,255,${Math.min(95, fond.paleur ?? PALEUR_ORTHO) / 100})`;
      ctx.fillRect(0, 0, vue.largeur, vue.hauteur);
    }
  }
  return res;
}

/** Attend que les tuiles d'une vue soient chargées (feuille PDF), au plus « attente » ms. */
export function attendreTuiles(vue, fond, densite = 1, attente = 8000) {
  return new Promise((fini) => {
    const debut = Date.now();
    const essai = () => {
      const c = document.createElement('canvas').getContext('2d');
      const r = dessinerFondSwisstopo(c, vue, fond, densite, essai);
      if (!r.enCours || Date.now() - debut > attente) fini(r);
    };
    essai();
    setTimeout(() => fini(null), attente + 100);
  });
}
