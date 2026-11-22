// Sauvegarde du parc (0.275.0) : un fichier .zip avec tout (parc.json, et chaque photo ou document dans
// « fichiers/ »), à télécharger et à garder ; « Restaurer » remet tout depuis ce fichier. Le lecteur de zip
// sait aussi lire les zip compressés (comme un .xlsx) : il servira à l'import de l'ancien Excel (étape 3).
import { zipper } from '../recap/xlsx.js';
import { normaliserParc } from './donnees.js';

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

/** Nom du fichier de sauvegarde : « materiel_sauvegarde_2026-11-22.zip ». */
export function nomSauvegarde(jour) {
  return `materiel_sauvegarde_${jour}.zip`;
}

/**
 * Zip (Uint8Array) de la sauvegarde. fichiers : [{ id, nom, type, octets (Uint8Array) }] (photos et
 * documents). Le mot de passe swipos y est (sauvegarde complète) : garder le fichier en lieu sûr.
 */
export function creerSauvegarde(parc, fichiers) {
  const liste = fichiers.map(({ id, nom, type }) => ({ id, nom, type }));
  return zipper([
    ['parc.json', encodeur.encode(JSON.stringify(parc))],
    ['fichiers.json', encodeur.encode(JSON.stringify(liste))],
    ...fichiers.map((f) => [`fichiers/${f.id}`, f.octets]),
  ]);
}

/** Décompresse des octets « deflate » bruts (méthode 8 du zip) avec l'outil du navigateur. */
async function inflater(octets) {
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}

/**
 * Lit un zip : Map(nom → Uint8Array). Fichiers stockés ou compressés (deflate) ; lance une erreur claire
 * si ce n'est pas un zip.
 */
export async function lireZip(octets) {
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  // Fin du répertoire central : signature 0x06054b50, cherchée en partant de la fin.
  let fin = -1;
  for (let i = octets.length - 22; i >= Math.max(0, octets.length - 65557); i -= 1) {
    if (vue.getUint32(i, true) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error('ce n\'est pas un fichier .zip (ou il est abîmé)');
  const nombre = vue.getUint16(fin + 10, true);
  let p = vue.getUint32(fin + 16, true);
  const fichiers = new Map();
  for (let k = 0; k < nombre; k += 1) {
    if (vue.getUint32(p, true) !== 0x02014b50) throw new Error('fichier .zip abîmé');
    const methode = vue.getUint16(p + 10, true);
    const tailleComprimee = vue.getUint32(p + 20, true);
    const longueurNom = vue.getUint16(p + 28, true);
    const longueurExtra = vue.getUint16(p + 30, true);
    const longueurCommentaire = vue.getUint16(p + 32, true);
    const local = vue.getUint32(p + 42, true);
    const nom = decodeur.decode(octets.subarray(p + 46, p + 46 + longueurNom));
    const debut = local + 30 + vue.getUint16(local + 26, true) + vue.getUint16(local + 28, true);
    const donnees = octets.subarray(debut, debut + tailleComprimee);
    if (methode === 0) fichiers.set(nom, donnees);
    else if (methode === 8) fichiers.set(nom, await inflater(donnees));
    else throw new Error(`fichier .zip compressé d'une façon inconnue (méthode ${methode})`);
    p += 46 + longueurNom + longueurExtra + longueurCommentaire;
  }
  return fichiers;
}

/**
 * Relit une sauvegarde : { parc, fichiers: [{ id, nom, type, octets }] }. Lance une erreur claire si le
 * fichier n'est pas une sauvegarde du matériel.
 */
export async function lireSauvegarde(octets) {
  const contenu = await lireZip(octets);
  if (!contenu.has('parc.json')) throw new Error('ce .zip n\'est pas une sauvegarde du matériel (parc.json manque)');
  let brut;
  let liste;
  try {
    brut = JSON.parse(decodeur.decode(contenu.get('parc.json')));
    liste = JSON.parse(decodeur.decode(contenu.get('fichiers.json') ?? encodeur.encode('[]')));
  } catch {
    throw new Error('sauvegarde illisible (parc.json abîmé)');
  }
  const parc = normaliserParc(brut);
  parc.modifieLe = brut?.modifieLe ?? null;
  const fichiers = (Array.isArray(liste) ? liste : [])
    .filter((f) => f?.id && contenu.has(`fichiers/${f.id}`))
    .map((f) => ({ id: f.id, nom: f.nom ?? '', type: f.type ?? '', octets: contenu.get(`fichiers/${f.id}`) }));
  return { parc, fichiers };
}
