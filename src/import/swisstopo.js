// Téléchargement de swissALTI3D (0.109.0, Surface Swisstopo) : on demande au catalogue de swisstopo
// (API STAC de data.geo.admin.ch) les carrés de 1 km qui couvrent la zone, puis on télécharge le
// GeoTIFF à 0,5 m le plus récent de chaque carré. Calculs dans topo/swisstopo.js.
import { versWgs84Approche, rectangleDe, carresDeLaZone, choisirFichiers } from '../topo/swisstopo.js';
import { lireGeoTiff } from '../topo/geotiff-lecture.js';

export const CATALOGUE = 'https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissalti3d/items';
const MARGE = 0.001; // degré (≈ 100 m) autour de la zone : les formules approchées font ~1 m d'erreur

/**
 * Altitudes de la zone (sommets { est, nord } en MN95). progres(texte) : message pendant le travail.
 * Renvoie (promesse) { rasters (GeoTIFF lus), fichiers [{ e, n, annee, url }] }. Erreur claire si
 * swisstopo ne répond pas ou si un carré manque. chercher : fetch (remplacé dans les tests).
 */
export async function telechargerAltitudes(sommets, progres = () => {}, chercher = (...args) => fetch(...args)) {
  const carres = carresDeLaZone(sommets);
  progres('Recherche des carrés swissALTI3D…');
  const features = await lireCatalogue(sommets, chercher);
  const { fichiers, manquants } = choisirFichiers(features, carres);
  // Un carré sans fichier est accepté s'il ne touche pas la zone (bord du rectangle) ; sinon erreur.
  if (fichiers.length === 0) throw new Error('swisstopo n\'a pas de swissALTI3D pour cette zone');
  const rasters = [];
  for (const [n, fichier] of fichiers.entries()) {
    progres(`Téléchargement swissALTI3D ${n + 1} / ${fichiers.length} (carré ${fichier.e}-${fichier.n}, ${fichier.annee})…`);
    const reponse = await demander(chercher, fichier.url);
    rasters.push(await lireGeoTiff(await reponse.arrayBuffer()));
  }
  return { rasters, fichiers, manquants };
}

/** Liste des carrés (« features ») du catalogue qui touchent la zone (toutes les pages). */
async function lireCatalogue(sommets, chercher) {
  const r = rectangleDe(sommets);
  const coins = [versWgs84Approche(r.estMin, r.nordMin), versWgs84Approche(r.estMax, r.nordMin), versWgs84Approche(r.estMin, r.nordMax), versWgs84Approche(r.estMax, r.nordMax)];
  const lon = coins.map((c) => c.longitude);
  const lat = coins.map((c) => c.latitude);
  const bbox = [Math.min(...lon) - MARGE, Math.min(...lat) - MARGE, Math.max(...lon) + MARGE, Math.max(...lat) + MARGE].map((v) => v.toFixed(6)).join(',');
  let adresse = `${CATALOGUE}?bbox=${bbox}&limit=100`;
  const features = [];
  for (let page = 0; adresse && page < 20; page++) {
    const reponse = await demander(chercher, adresse);
    let donnees;
    try {
      donnees = await reponse.json();
    } catch {
      throw new Error('réponse de swisstopo illisible');
    }
    features.push(...(donnees.features ?? []));
    adresse = (donnees.links ?? []).find((lien) => lien.rel === 'next')?.href ?? null;
  }
  return features;
}

/** fetch avec un message clair en cas d'échec. */
async function demander(chercher, adresse) {
  let reponse;
  try {
    reponse = await chercher(adresse);
  } catch {
    throw new Error('swisstopo injoignable (réseau ?)');
  }
  if (!reponse.ok) throw new Error(`swisstopo a répondu « erreur ${reponse.status} »`);
  return reponse;
}
