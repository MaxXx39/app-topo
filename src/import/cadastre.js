// Téléchargement du cadastre autour d'un point (0.112.0) : service WFS de la mensuration officielle.
// Essai « à l'aveugle » (service pas joignable depuis le cloud de développement) : l'appli demande
// d'abord la liste des couches du service (GetCapabilities), choisit celle des points limites et
// celle des parcelles d'après leur nom, puis demande ce qui est dans le carré autour du point.
// En cas d'échec le message dit ce qui a été trouvé, pour corriger le service ensuite.
// WFS 1.0.0 : l'ordre des coordonnées est toujours Est, Nord (pas de piège d'axes).
import { rectangleAutour, nomsDesCouches, choisirCouches, lireGml } from '../topo/cadastre.js';

/** Services par canton. Genève viendra dans un second temps. */
export const SERVICES = {
  VD: { canton: 'Vaud', adresse: 'https://geodienste.ch/db/av_0/fra' },
};

/**
 * Cadastre du carré autour de centre { est, nord } (rayon en m). Renvoie (promesse)
 * { points, lignes, couches } (voir lireGml). chercher : fetch (remplacé dans les tests).
 */
export async function telechargerCadastre(centre, rayon, canton = 'VD', progres = () => {}, chercher = (...args) => fetch(...args)) {
  const service = SERVICES[canton];
  if (!service) throw new Error(`canton ${canton} pas encore pris en charge`);
  progres(`Recherche des couches du cadastre (${service.canton})…`);
  const capabilities = await (await demander(chercher, `${service.adresse}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetCapabilities`)).text();
  const noms = nomsDesCouches(capabilities);
  const couches = choisirCouches(noms);
  if (!couches.points && !couches.surfaces) {
    const exemples = noms.slice(0, 12).join(', ') || 'aucune';
    throw new Error(`pas de couche « points limites » ni « parcelles » reconnue dans ${service.adresse} (couches : ${exemples})`);
  }
  const r = rectangleAutour(centre, rayon);
  const boite = [r.estMin, r.nordMin, r.estMax, r.nordMax].map((v) => v.toFixed(3)).join(',');
  const resultat = { points: [], lignes: [], couches };
  for (const [sorte, nom] of [['points', couches.points], ['parcelles', couches.surfaces]]) {
    if (!nom) continue;
    progres(`Téléchargement ${sorte === 'points' ? 'des points limites' : 'des parcelles'}…`);
    const adresse = `${service.adresse}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=${encodeURIComponent(nom)}&SRSNAME=EPSG:2056&BBOX=${boite},EPSG:2056&MAXFEATURES=20000`;
    const lu = lireGml(await (await demander(chercher, adresse)).text());
    resultat.points.push(...lu.points);
    resultat.lignes.push(...lu.lignes);
  }
  return resultat;
}

/** fetch avec un message clair en cas d'échec. */
async function demander(chercher, adresse) {
  let reponse;
  try {
    reponse = await chercher(adresse);
  } catch {
    throw new Error('service du cadastre injoignable (réseau, ou le service refuse l\'appli)');
  }
  if (!reponse.ok) throw new Error(`le service du cadastre a répondu « erreur ${reponse.status} »`);
  return reponse;
}
