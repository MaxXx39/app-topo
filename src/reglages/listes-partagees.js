// Listes partagées par tous les appareils (0.79.0, demande du 27.10.2026), modifiées avec le code de
// sécurité (réglages ⚙) :
// - adresses mail, à choisir quand on envoie un fichier par mail (fenêtre « Exporter ») ;
// - réglages swipos (NTRIP) : nom de l'utilisateur, serveur, port, point de montage et mot de passe,
//   à choisir dans les réglages des corrections du récepteur. Le mot de passe va sur Drive avec la
//   liste (accepté par l'utilisateur) ; il n'est jamais mis dans un projet.
// Gardées dans la mémoire du navigateur (« topo-listes-partagees ») et copiées dans le dossier
// « App Topo » de Drive (voir partage/synchro.js) : la version la plus récente (modifieLe) gagne.

const CLE = 'topo-listes-partagees';
const VIDE = { adresses: [], swipos: [], modifieLe: null };
let ecouteurs = [];

/** Vrai si le texte ressemble à une adresse mail (quelque chose@quelque chose.quelque chose). */
export function estAdresseMail(texte) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(texte ?? '').trim());
}

/**
 * Remet les listes en ordre : adresses valides sans double ; réglages swipos avec un serveur et
 * un utilisateur, port 2101 par défaut. Renvoie { adresses, swipos, modifieLe }.
 */
export function nettoyerListes(listes) {
  const adresses = [...new Set((listes?.adresses ?? []).map((a) => String(a).trim()).filter(estAdresseMail))];
  const swipos = (listes?.swipos ?? [])
    .map((s, i) => ({
      id: String(s.id || `swipos-${Date.now()}-${i}`),
      utilisateur: String(s.utilisateur ?? '').trim(),
      hote: String(s.hote ?? '').trim(),
      port: Number(s.port) > 0 ? Math.round(Number(s.port)) : 2101,
      pointDeMontage: String(s.pointDeMontage ?? '').trim(),
      motDePasse: String(s.motDePasse ?? ''),
    }))
    .filter((s) => s.hote && s.utilisateur);
  return { adresses, swipos, modifieLe: listes?.modifieLe ?? null };
}

/** Listes de cet appareil. */
export function lireListesPartagees() {
  try {
    return nettoyerListes(JSON.parse(localStorage.getItem(CLE) ?? 'null') ?? VIDE);
  } catch {
    return { ...VIDE };
  }
}

/**
 * Enregistre les listes sur cet appareil. modifieLe : date de la modification (maintenant pour une
 * modification ici ; celle de Drive pour une version reçue). Prévient les écouteurs (envoi sur Drive…).
 */
export function ecrireListesPartagees(listes, { modifieLe = new Date().toISOString(), depuisDrive = false } = {}) {
  const propres = { ...nettoyerListes(listes), modifieLe };
  try {
    localStorage.setItem(CLE, JSON.stringify(propres));
  } catch {
    // Mémoire indisponible : les listes valent jusqu'à la fermeture de l'appli.
  }
  for (const ecouteur of ecouteurs) ecouteur(propres, { depuisDrive });
  return propres;
}

/** Appelle fonction(listes, { depuisDrive }) à chaque changement des listes. */
export function surChangementListes(fonction) {
  ecouteurs.push(fonction);
}

/** Laquelle garder : 'local', 'drive' ou null (pareilles). Dates ISO (null = jamais modifiée). */
export function versionAGarder(local, drive) {
  if ((local ?? '') === (drive ?? '')) return null;
  if (!drive) return 'local';
  if (!local) return 'drive';
  return local > drive ? 'local' : 'drive';
}
