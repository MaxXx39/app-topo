// Téléchargement du cadastre autour d'un point (0.112.0) : service WFS de la mensuration officielle.
// Essai « à l'aveugle » (service pas joignable depuis le cloud de développement) : l'appli demande
// d'abord la liste des couches du service (GetCapabilities), choisit celle des points limites et
// celle des parcelles d'après leur nom, puis demande ce qui est dans le carré autour du point.
// En cas d'échec le message dit ce qui a été trouvé, pour corriger le service ensuite.
// WFS 1.0.0 : l'ordre des coordonnées est toujours Est, Nord (pas de piège d'axes).
import { rectangleAutour, nomsDesCouches, choisirCouches, lireGml } from '../topo/cadastre.js';

/** Services par canton. geodienste.ch couvre toute la Suisse ; essai du 03.11 : Genève marche, Vaud répond vide (pas en accès libre). */
export const SERVICES = {
  VD: { canton: 'mensuration officielle', adresse: 'https://geodienste.ch/db/av_0/fra' },
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
    const exemples = noms.join(', ') || 'aucune';
    throw new Error(`pas de couche « points limites » ni « parcelles » reconnue dans ${service.adresse} (couches : ${exemples})`);
  }
  const r = rectangleAutour(centre, rayon);
  const boite = [r.estMin, r.nordMin, r.estMax, r.nordMax].map((v) => v.toFixed(3)).join(',');
  const resultat = { points: [], lignes: [], couches, essais: [] };
  for (const [sorte, nom] of [['points', couches.points], ['parcelles', couches.surfaces]]) {
    if (!nom) continue;
    progres(`Téléchargement ${sorte === 'points' ? 'des points limites' : 'des parcelles'}…`);
    // 0.112.2 : plusieurs façons de demander (versions du WFS), on garde la première qui donne quelque chose.
    for (const adresse of adressesGetFeature(service.adresse, nom, boite)) {
      const texte = await (await demander(chercher, adresse)).text();
      const lu = lireGml(texte);
      if (lu.points.length > 0 || lu.lignes.length > 0) {
        resultat.points.push(...lu.points);
        resultat.lignes.push(...lu.lignes);
        break;
      }
      resultat.essais.push(`${nom} ${/VERSION=([\d.]+)/.exec(adresse)[1]} : ${texte.length} car. « ${texte.replace(/\s+/g, ' ').slice(0, 160)} »`);
    }
  }
  if (resultat.points.length === 0 && resultat.lignes.length === 0) {
    // 0.112.3 : réponses valides mais vides = pas de données en accès libre ici (cas de Vaud, essai du 03.11).
    if (resultat.essais.every((e) => /FeatureCollection/.test(e))) {
      throw new Error('pas de données en accès libre à cet endroit sur geodienste.ch (Vaud n\'y est pas en accès libre ; Genève marche)');
    }
    throw new Error(`le service ne renvoie rien (couches ${[couches.points, couches.surfaces].filter(Boolean).join(', ')}). Réponses : ${resultat.essais.slice(0, 3).join(' | ')}`);
  }
  return resultat;
}

/** Adresses GetFeature à essayer dans l'ordre (WFS 1.0.0, 1.1.0, 2.0.0, puis 1.0.0 le plus simple). */
export function adressesGetFeature(base, nom, boite) {
  const couche = encodeURIComponent(nom);
  return [
    `${base}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=${couche}&SRSNAME=EPSG:2056&BBOX=${boite},EPSG:2056&MAXFEATURES=20000`,
    `${base}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=${couche}&SRSNAME=EPSG:2056&BBOX=${boite},EPSG:2056&MAXFEATURES=20000`,
    `${base}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${couche}&SRSNAME=urn:ogc:def:crs:EPSG::2056&BBOX=${boite},urn:ogc:def:crs:EPSG::2056&COUNT=20000`,
    `${base}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=${couche}&BBOX=${boite}`,
  ];
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
