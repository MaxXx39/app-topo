// Mise à jour de l'APK (0.119.0 ; 0.119.3 : plus de fenêtre au démarrage, un bouton dans les réglages ⚙,
// sous la version de l'appli) : on lit sur GitHub la version du dernier APK publié (release
// « apk-derniere-version », dont le titre contient le numéro : « APK Android - dernière version
// (0.119.0, n° 412, main) »). Plus récente : un lien télécharge Topo.apk (dans le navigateur de la
// tablette), puis on touche « Installer » (Android le demande toujours).

export const ADRESSE_APK = 'https://github.com/MaxXx39/app-topo/releases/download/apk-derniere-version/Topo.apk';
const ADRESSE_RELEASE = 'https://api.github.com/repos/MaxXx39/app-topo/releases/tags/apk-derniere-version';
// Appli Windows (0.237.0) : même principe, release « windows-derniere-version », fichiers Topo.exe et Topo-<version>.exe.
export const ADRESSE_EXE = 'https://github.com/MaxXx39/app-topo/releases/download/windows-derniere-version/Topo.exe';
const ADRESSE_RELEASE_WINDOWS = 'https://api.github.com/repos/MaxXx39/app-topo/releases/tags/windows-derniere-version';

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
  return (await apkPublie(lire))?.version ?? null;
}

/**
 * Dernier APK publié : { version, adresse } ou null. L'adresse est celle du fichier qui porte le numéro
 * (« Topo-0.174.1.apk », demande du 09.11), sinon le lien fixe « Topo.apk ».
 */
export async function apkPublie(lire = fetch) {
  return programmePublie(lire, ADRESSE_RELEASE, 'apk', ADRESSE_APK);
}

/** Dernier Topo.exe publié pour Windows : { version, adresse } ou null (« Topo-0.237.0.exe », sinon le lien fixe « Topo.exe »). */
export async function exePublie(lire = fetch) {
  return programmePublie(lire, ADRESSE_RELEASE_WINDOWS, 'exe', ADRESSE_EXE);
}

async function programmePublie(lire, adresseRelease, extension, adresseFixe) {
  try {
    const controle = new AbortController();
    const minuterie = setTimeout(() => controle.abort(), 15000);
    const reponse = await lire(adresseRelease, { headers: { Accept: 'application/vnd.github+json' }, signal: controle.signal });
    clearTimeout(minuterie);
    if (!reponse.ok) return null;
    const release = await reponse.json();
    const version = versionDuTitre(release?.name);
    if (!version) return null;
    const nom = `Topo-${version}.${extension}`;
    const fichier = (release?.assets ?? []).find((a) => a?.name === nom);
    return { version, adresse: fichier?.browser_download_url ?? adresseFixe };
  } catch {
    return null;
  }
}
