// Relais du cadastre (0.116.0) : petit programme à coller dans un « Worker » Cloudflare (gratuit).
// Le service RDPPF du canton de Vaud refuse les demandes venant d'une page web (protection CORS des
// navigateurs) ; l'APK Android passe, le site internet non. Ce relais fait la demande à la place du
// navigateur et renvoie la réponse telle quelle, avec l'autorisation pour le site de l'appli.
// Sécurité : seulement des adresses https vers le cadastre (rdppf.vd.ch, geodienste.ch), seulement en
// lecture (GET), seulement pour le site de l'appli (et l'ordinateur de développement).
// Utilisation : https://<adresse-du-relais>/?url=<adresse du service, encodée>

const HOTES_PERMIS = ['www.rdppf.vd.ch', 'rdppf.vd.ch', 'geodienste.ch', 'www.geodienste.ch'];
const SITES_PERMIS = ['https://maxxx39.github.io', 'http://localhost:5173', 'http://localhost:4173'];

export default {
  async fetch(requete) {
    const origine = requete.headers.get('Origin') ?? '';
    const entetes = new Headers({
      'Access-Control-Allow-Origin': SITES_PERMIS.includes(origine) ? origine : SITES_PERMIS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    });
    if (requete.method === 'OPTIONS') return new Response(null, { headers: entetes });
    if (requete.method !== 'GET') return new Response('seulement GET', { status: 405, headers: entetes });
    let cible;
    try {
      cible = new URL(new URL(requete.url).searchParams.get('url') ?? '');
    } catch {
      return new Response('adresse manquante ou illisible (?url=…)', { status: 400, headers: entetes });
    }
    if (cible.protocol !== 'https:' || !HOTES_PERMIS.includes(cible.hostname)) {
      return new Response('adresse refusée : seulement le cadastre (rdppf.vd.ch, geodienste.ch)', { status: 403, headers: entetes });
    }
    try {
      const reponse = await fetch(cible.toString(), { headers: { Accept: requete.headers.get('Accept') ?? '*/*' } });
      entetes.set('Content-Type', reponse.headers.get('Content-Type') ?? 'text/plain; charset=utf-8');
      return new Response(reponse.body, { status: reponse.status, headers: entetes });
    } catch (erreur) {
      return new Response(`service du cadastre injoignable : ${erreur.message}`, { status: 502, headers: entetes });
    }
  },
};
