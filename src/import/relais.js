// Relais du cadastre pour le site internet (0.116.0, voir relais/cadastre-worker.js) : le service RDPPF
// de Vaud refuse les demandes d'une page web (CORS) ; sur le site, elles passent par ce relais
// Cloudflare. Dans l'APK, elles passent par Android (lireParAndroid) et n'utilisent pas le relais.

// Adresse du relais, une fois créé sur Cloudflare (ex. 'https://cadastre-topo.xxx.workers.dev') ; vide = pas de relais.
export const ADRESSE_RELAIS_CADASTRE = 'https://cadastre-topo.topo-perrin.workers.dev/';

// Services qui refusent le navigateur : seulement ceux-là passent par le relais (geodienste.ch accepte le site).
const HOTES_PAR_RELAIS = ['www.rdppf.vd.ch', 'rdppf.vd.ch'];

/**
 * Adresse à demander sur le site : par le relais pour le service de Vaud, sinon l'adresse telle quelle.
 * relais : adresse du relais ('' = aucun, l'adresse reste telle quelle).
 */
export function adresseParRelais(adresse, relais = ADRESSE_RELAIS_CADASTRE) {
  if (!relais) return adresse;
  let hote;
  try {
    hote = new URL(adresse).hostname;
  } catch {
    return adresse;
  }
  if (!HOTES_PAR_RELAIS.includes(hote)) return adresse;
  return `${relais.replace(/\/+$/, '')}/?url=${encodeURIComponent(adresse)}`;
}
