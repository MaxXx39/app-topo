// Partage des projets par Google Drive : un projet est rangé dans un dossier Drive, découpé en
// plusieurs fichiers pour ne renvoyer que ce qui a changé :
// - projet.json.gz : le projet sans les images des photos ni le contenu des plans DXF (léger) ;
// - plan-<id>.json.gz : le contenu d'un plan DXF (lourd, ne change presque jamais) ;
// - photo-<id>.json.gz : l'image et la miniature d'une photo.
// Chaque fichier est comprimé (gzip, fait par le navigateur lui-même) : un plan DXF devient
// plusieurs fois plus petit, ce qui accélère l'envoi sur le réseau du chantier.

export const FICHIER_PROJET = 'projet.json.gz';
const prefixePlan = 'plan-';
const prefixePhoto = 'photo-';
const FIN = '.json.gz';

/**
 * Découpe un projet en fichiers : Map nom -> objet à écrire (avant compression).
 * Le projet lui-même n'est pas modifié.
 */
export function projetVersFichiers(projet) {
  const fichiers = new Map();
  // Photos des surfaces et des mesures : l'image part dans son propre fichier.
  const sansImages = (objet) => !objet.photos?.length ? objet : ({
    ...objet,
    photos: (objet.photos ?? []).map((photo) => {
      fichiers.set(`${prefixePhoto}${photo.id}${FIN}`, { image: photo.image, miniature: photo.miniature });
      return { ...photo, image: null, miniature: null };
    }),
  });
  const surfaces = (projet.surfaces ?? []).map(sansImages);
  const mesures = projet.mesures ? { mesures: projet.mesures.map(sansImages) } : {};
  const plansDxf = (projet.plansDxf ?? []).map((plan) => {
    fichiers.set(`${prefixePlan}${plan.id}${FIN}`, plan.contenu);
    return { ...plan, contenu: null };
  });
  // Le lien vers Drive est propre à chaque appareil : il ne part pas avec le projet.
  const { drive, ...reste } = projet;
  fichiers.set(FICHIER_PROJET, { ...reste, surfaces, ...mesures, plansDxf });
  return fichiers;
}

/**
 * Recompose un projet à partir de ses fichiers (Map nom -> objet lu). Une photo ou un plan dont
 * le fichier manque garde une image ou un contenu vide (null), sans planter.
 */
export function fichiersVersProjet(fichiers) {
  const projet = structuredClone(fichiers.get(FICHIER_PROJET));
  if (!projet) throw new Error('fichier projet absent du dossier Drive');
  for (const objet of [...(projet.surfaces ?? []), ...(projet.mesures ?? [])]) {
    for (const photo of objet.photos ?? []) Object.assign(photo, fichiers.get(`${prefixePhoto}${photo.id}${FIN}`) ?? {});
  }
  for (const plan of projet.plansDxf ?? []) plan.contenu = fichiers.get(`${prefixePlan}${plan.id}${FIN}`) ?? null;
  return projet;
}

/** Comprime un objet en JSON gzip : renvoie un Blob. */
export async function comprimer(objet) {
  const flux = new Blob([JSON.stringify(objet)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(flux).blob();
}

/** Décomprime un Blob (ou ArrayBuffer) gzip et lit le JSON. */
export async function decomprimer(donnees) {
  const blob = donnees instanceof Blob ? donnees : new Blob([donnees]);
  const flux = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(flux).text());
}

/**
 * Empreinte d'un objet (texte court) : sert à savoir si un fichier a changé depuis le dernier
 * envoi, sans le renvoyer. Calculée sur le JSON (SHA-256, fait par le navigateur).
 */
export async function empreinte(objet) {
  const octets = new TextEncoder().encode(JSON.stringify(objet));
  const resume = new Uint8Array(await crypto.subtle.digest('SHA-256', octets));
  return Array.from(resume.slice(0, 12), (o) => o.toString(16).padStart(2, '0')).join('');
}
