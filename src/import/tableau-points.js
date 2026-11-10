// Tableau « Contenu du projet › Points » (0.191.0, maquette du 10.11, Base) : tous les points du projet en une seule liste,
// qu'on filtre avec des boutons de catégories (Contrôle, Levé, Import, Annotation, Chantier…) puis avec les listes de points
// de ces catégories. Chaque ligne : nom, libellé, E, N, H, précisions, date, tablette, remarque, photo, liste.
// Calculs seulement (rien d'écran ici) : lignes, tri, texte CSV. Aucune valeur inventée : une info inconnue reste vide.
import { lireNomLeve } from '../topo/leve-direct.js';
import { dateDuPoint, jourDuPoint } from '../topo/date-point.js';

/**
 * Catégories : [clé, titre, couleur de la pastille]. 0.197.0 : un levé est rangé par sa nature (Libre, Stock, Terrain,
 * Terrassement, Métré, Chantier), à côté de Contrôle, Recollement, Annotation et des points Importés. Le cadastre est dans
 * « Plans ». Un bouton n'est montré que si le projet a du contenu dans cette catégorie.
 */
export const CATEGORIES_POINTS = [
  ['controle', 'Contrôle', '#b91c1c'],
  ['libre', 'Levé libre', '#eab308'],
  ['stock', 'Stock', '#b45309'],
  ['terrain', 'Terrain', '#15803d'],
  ['terrassement', 'Terrassement', '#0891b2'],
  ['metre', 'Métré', '#ea580c'],
  ['chantier', 'Chantier', '#0f766e'],
  ['recollement', 'Recollement', '#16a34a'],
  ['annotation', 'Annotation', '#7c4a1e'],
  ['import', 'Importés', '#2563eb'],
];

/** Catégories de points qui sont des levés (tout sauf Contrôle et Importés). */
export const CATEGORIES_LEVES = ['libre', 'stock', 'terrain', 'terrassement', 'metre', 'chantier', 'recollement', 'annotation'];

/** Colonnes : [clé, titre, valeur numérique ?]. */
export const COLONNES_POINTS = [
  ['nom', 'Nom', false],
  ['libelle', 'Libellé', false],
  ['est', 'E', true],
  ['nord', 'N', true],
  ['altitude', 'H', true],
  ['precision', 'Préc. H / V', true],
  ['date', 'Date', false],
  ['tablette', 'Tablette', false],
  ['remarque', 'Remarque', false],
  ['photos', 'Photo', true],
  ['liste', 'Liste', false],
];

/**
 * Ordre des colonnes à l'écran (0.198.0) : « Nom » reste toujours à gauche ; les autres suivent l'ordre choisi (liste de
 * clés), les colonnes inconnues sont ignorées et les colonnes oubliées se rangent à la fin dans l'ordre de départ.
 * (L'export CSV garde toujours l'ordre de départ.)
 */
export function ordreColonnes(choisi = []) {
  const depart = COLONNES_POINTS.map(([cle]) => cle).filter((cle) => cle !== 'nom');
  const gardees = (Array.isArray(choisi) ? choisi : []).filter((cle, i, tout) => depart.includes(cle) && tout.indexOf(cle) === i);
  return ['nom', ...gardees, ...depart.filter((cle) => !gardees.includes(cle))];
}

/** Déplace une colonne : sens -1 (vers la gauche), 1 (vers la droite) ou 'premier' (juste après « Nom »). « Nom » ne bouge pas. */
export function deplacerColonne(ordre, cle, sens) {
  const mobiles = ordreColonnes(ordre).filter((c) => c !== 'nom');
  const i = mobiles.indexOf(cle);
  if (i < 0) return ordreColonnes(ordre);
  mobiles.splice(i, 1);
  const j = sens === 'premier' ? 0 : Math.max(0, Math.min(mobiles.length, i + sens));
  mobiles.splice(j, 0, cle);
  return ['nom', ...mobiles];
}

/**
 * Catégorie d'une liste de points (levé du projet) : 'import', 'annotation', 'chantier', 'recollement', 'metre', 'stock',
 * 'terrain', 'terrassement' ou 'libre'. Le cadastre n'est pas dans le tableau (null : il est dans « Plans »).
 */
export function categorieDeListe(projet, leve) {
  if (leve.cadastre) return null;
  if (!leve.direct) return 'import';
  if ((projet.reseaux ?? []).some((r) => r.leveId === leve.id)) return 'recollement';
  const proprietaire = proprietaireDeListe(projet, leve);
  const nature = proprietaire?.nature ?? (proprietaire ? 'stock' : 'libre');
  if (nature === 'reseau' || nature === 'recollement') return 'recollement';
  if (['annotation', 'chantier', 'metre', 'stock', 'terrain', 'terrassement'].includes(nature)) return nature;
  // Surface du Dessin (rangée dans les surfaces) ou levé libre.
  return (projet.surfaces ?? []).some((o) => o.leveId === leve.id) ? 'stock' : 'libre';
}

/** Objet qui possède une liste (surface, métré, chantier, annotation, réseau) : il garde les photos. */
function proprietaireDeListe(projet, leve) {
  return [...(projet.surfaces ?? []), ...(projet.metres ?? []), ...(projet.autres ?? []), ...(projet.reseaux ?? [])].find((o) => o.leveId === leve.id) ?? null;
}

/** Listes de points du projet : [{ id, nom, categorie, nombre }] (les points de contrôle forment la liste « controle »). */
export function listesDuTableau(projet) {
  const listes = [];
  if ((projet.pointsControle ?? []).length > 0) listes.push({ id: 'controle', nom: 'Points de contrôle', categorie: 'controle', nombre: projet.pointsControle.length });
  for (const leve of projet.leves ?? []) {
    const categorie = categorieDeListe(projet, leve);
    if (categorie && leve.points.length > 0) listes.push({ id: leve.id, nom: leve.nom, categorie, nombre: leve.points.length });
  }
  return listes;
}

/** Texte de la précision « H / V » en m (3 décimales), ou ''. */
function textePrecision(h, v) {
  const n = (x) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(3) : '—');
  return h == null && v == null ? '' : `${n(h)} / ${n(v)}`;
}

/** Ligne du tableau pour un point. Les champs inconnus restent vides (jamais inventés). */
function ligneDuPoint(p, categorie, liste, photos) {
  const g = p.gnss ?? {};
  const a = p.annotation ?? {};
  const c = p.chantier ?? {};
  const libelle = c.libelle ?? lireNomLeve(p.nom)?.libelle ?? '';
  const remarques = [...(a.remarques ?? []), c.remarque].filter(Boolean);
  const mesPhotos = photos.filter((ph) => ph.point === p.nom || (ph.pointId && ph.pointId === p.id));
  return {
    nom: p.nom,
    libelle,
    est: p.est,
    nord: p.nord,
    altitude: p.altitude ?? null,
    precision: textePrecision(g.precisionH ?? a.precision ?? null, g.precisionV ?? null),
    precisionTri: g.precisionH ?? a.precision ?? null,
    date: dateDuPoint(p),
    tablette: g.appareil ?? a.appareil ?? p.creePar ?? '',
    remarque: remarques.join(' | ') || p.remarque || '',
    photos: mesPhotos.length,
    photoId: mesPhotos[0]?.id ?? null,
    liste: liste.nom,
    listeId: liste.id,
    categorie,
  };
}

/**
 * Lignes du tableau : points des catégories choisies (Set de clés), sans les listes décochées (Set d'identifiants de
 * listes), pour un jour au choix (« AAAA-MM-JJ », '' = tous ; un point sans date n'est pas gardé quand un jour est choisi).
 */
export function lignesDuTableau(projet, { categories, listesDecochees = new Set(), jour = '' } = {}) {
  const lignes = [];
  const aGarder = (id, categorie) => categories.has(categorie) && !listesDecochees.has(id);
  if (aGarder('controle', 'controle')) {
    const liste = { id: 'controle', nom: 'Points de contrôle' };
    for (const p of projet.pointsControle ?? []) lignes.push(ligneDuPoint(p, 'controle', liste, projet.photosControle ?? []));
  }
  for (const leve of projet.leves ?? []) {
    const categorie = categorieDeListe(projet, leve);
    if (!categorie || !aGarder(leve.id, categorie)) continue;
    const photos = proprietaireDeListe(projet, leve)?.photos ?? [];
    for (const p of leve.points) lignes.push(ligneDuPoint(p, categorie, leve, photos));
  }
  return jour ? lignes.filter((l) => l.date && jourDuPoint({ creeLe: l.date }) === jour) : lignes;
}

/** Lignes triées par colonne (asc : croissant). Les valeurs vides restent toujours à la fin. */
export function trierLignes(lignes, colonne, asc = true) {
  const numerique = COLONNES_POINTS.find(([cle]) => cle === colonne)?.[2];
  const valeur = (l) => (colonne === 'precision' ? l.precisionTri : l[colonne]);
  const vide = (v) => v == null || v === '';
  const avec = lignes.filter((l) => !vide(valeur(l)));
  const sans = lignes.filter((l) => vide(valeur(l)));
  avec.sort((a, b) => {
    const x = valeur(a);
    const y = valeur(b);
    const r = numerique ? x - y : String(x).localeCompare(String(y), 'fr', { numeric: true });
    return asc ? r : -r;
  });
  return [...avec, ...sans];
}

/** Date et heure à la suisse (« 10.11.2026 14:32 »), ou '' sans date. */
export function texteDate(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('fr-CH')} ${d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Texte CSV (séparateur « ; ») de lignes déjà triées : mêmes colonnes que le tableau. */
export function csvDuTableau(lignes) {
  const champ = (v) => {
    const t = String(v ?? '');
    return /[;"\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
  };
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3) : '');
  const titres = [...COLONNES_POINTS.map(([, titre]) => titre), 'Catégorie'];
  const nom = (cle) => CATEGORIES_POINTS.find(([c]) => c === cle)?.[1] ?? cle;
  const corps = lignes.map((l) => [l.nom, l.libelle, n(l.est), n(l.nord), n(l.altitude), l.precision, texteDate(l.date), l.tablette, l.remarque, l.photos || '', l.liste, nom(l.categorie)]);
  return [titres, ...corps].map((ligne) => ligne.map(champ).join(';')).join('\r\n') + '\r\n';
}
