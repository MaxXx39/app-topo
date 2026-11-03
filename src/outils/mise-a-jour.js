// Mise à jour de l'APK (0.119.0, tous les modes) : au démarrage, l'appli Android regarde sur GitHub
// la version du dernier APK publié (release « apk-derniere-version », dont le titre contient le
// numéro : « APK Android - dernière version (0.119.0, n° 412, main) »). Si elle est plus récente,
// une fenêtre propose de la télécharger : le lien s'ouvre dans le navigateur de la tablette, qui
// télécharge Topo.apk ; on touche ensuite « Installer » (Android le demande toujours).

export const ADRESSE_APK = 'https://github.com/MaxXx39/app-topo/releases/download/apk-derniere-version/Topo.apk';
const ADRESSE_RELEASE = 'https://api.github.com/repos/MaxXx39/app-topo/releases/tags/apk-derniere-version';

/** Numéro de version « 0.119.0 » trouvé dans le titre de la release, ou null. */
export function versionDuTitre(titre) {
  return String(titre ?? '').match(/\((\d+\.\d+(?:\.\d+)?)\s*[,)]/)?.[1] ?? null;
}

/** Vrai si la version "a" (« 0.119.0 ») est plus récente que "b" (chiffre par chiffre). */
export function estPlusRecente(a, b) {
  const pa = String(a ?? '').split('.').map(Number);
  const pb = String(b ?? '').split('.').map(Number);
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return false;
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const ecart = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (ecart !== 0) return ecart > 0;
  }
  return false;
}

/**
 * Version du dernier APK publié sur GitHub (« 0.119.0 »), ou null (pas de réseau, réponse
 * illisible : on ne dérange pas l'utilisateur pour ça). lire : fonction comme fetch (pour les tests).
 */
export async function versionPubliee(lire = fetch) {
  try {
    const controle = new AbortController();
    const minuterie = setTimeout(() => controle.abort(), 15000);
    const reponse = await lire(ADRESSE_RELEASE, { headers: { Accept: 'application/vnd.github+json' }, signal: controle.signal });
    clearTimeout(minuterie);
    if (!reponse.ok) return null;
    const release = await reponse.json();
    return versionDuTitre(release?.name);
  } catch {
    return null;
  }
}
