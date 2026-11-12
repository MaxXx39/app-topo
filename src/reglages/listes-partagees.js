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
  // Libellés des points (0.95.0, voir leve/libelles.js) : gardés tels quels s'ils existent.
  const libelles = listes?.libelles && typeof listes.libelles === 'object' ? listes.libelles : undefined;
  // Bibliothèque du Levé chantier (0.175.0, voir leve/libelles-chantier.js) : gardée telle quelle si elle existe.
  const chantier = listes?.chantier && typeof listes.chantier === 'object' ? listes.chantier : undefined;
  // Types de plans DXF (0.194.0, voir topo/types-dxf.js) : liste de noms, gardée telle quelle si elle existe.
  const typesDxf = Array.isArray(listes?.typesDxf) ? listes.typesDxf.map((t) => String(t)).filter(Boolean) : undefined;
  // Dossiers de projets (0.125.0, voir projet/dossiers.js) : gardés tels quels s'ils existent.
  const dossiers = listes?.dossiers && typeof listes.dossiers === 'object' ? listes.dossiers : undefined;
  // Date de dernière modification de chaque partie (0.136.0) : sert à fusionner partie par partie.
  const dates = {};
  for (const [partie, date] of Object.entries(listes?.dates ?? {})) if (PARTIES.includes(partie) && date) dates[partie] = String(date);
  return { adresses, swipos, ...(libelles ? { libelles } : {}), ...(chantier ? { chantier } : {}), ...(typesDxf ? { typesDxf } : {}), ...(dossiers ? { dossiers } : {}), dates, modifieLe: listes?.modifieLe ?? null };
}

/** Les parties des listes, chacune avec sa propre date de modification (0.136.0). */
export const PARTIES = ['adresses', 'swipos', 'libelles', 'chantier', 'dossiers', 'typesDxf'];

const existe = (listes, partie) => (Array.isArray(listes?.[partie]) ? listes[partie].length > 0 : listes?.[partie] !== undefined);

/** Date d'une partie ; pour une liste sans dates (avant 0.136.0), la date de toute la liste si la partie existe. */
function dateDeLaPartie(listes, partie) {
  return listes?.dates?.[partie] ?? (existe(listes, partie) ? listes?.modifieLe ?? '' : '');
}

/**
 * Fusionne deux versions des listes partie par partie (0.136.0) : pour chaque partie, la plus
 * récente gagne (égalité : celle de cet appareil). Ainsi une modification des adresses sur un
 * appareil n'efface plus les dossiers créés sur un autre. Renvoie { listes, changeLocal, changeDistant }.
 */
export function fusionnerListes(local, distant) {
  const a = nettoyerListes(local);
  const b = nettoyerListes(distant);
  const fusion = { dates: {} };
  for (const partie of PARTIES) {
    const dateLocale = dateDeLaPartie(a, partie);
    const dateDistante = dateDeLaPartie(b, partie);
    const prendreDistant = dateDistante > dateLocale;
    const source = prendreDistant ? b : a;
    if (source[partie] !== undefined && (existe(source, partie) || dateDeLaPartie(source, partie))) fusion[partie] = source[partie];
    const date = prendreDistant ? dateDistante : dateLocale;
    if (date) fusion.dates[partie] = date;
  }
  const dates = Object.values(fusion.dates);
  fusion.modifieLe = dates.length > 0 ? dates.reduce((x, y) => (x > y ? x : y)) : null;
  const propres = nettoyerListes(fusion);
  const signature = (l) => JSON.stringify(PARTIES.map((p) => [l[p] ?? null, dateDeLaPartie(l, p)]));
  return { listes: propres, changeLocal: signature(propres) !== signature(a), changeDistant: signature(propres) !== signature(b) };
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
  if (!depuisDrive) {
    // Une partie qui change ici prend la date de la modification ; les autres gardent la leur.
    const avant = lireListesPartagees();
    const dates = { ...propres.dates };
    for (const partie of PARTIES) {
      if (JSON.stringify(propres[partie] ?? null) !== JSON.stringify(avant[partie] ?? null)) dates[partie] = modifieLe;
    }
    propres.dates = dates;
  }
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
