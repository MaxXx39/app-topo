// Export « Cadastre · Swisstopo · photo » en un clic (0.121.0) : un ZIP avec le DXF (voir pack-dxf.js)
// et la photo aérienne swisstopo en GeoTIFF (déjà placée en MN95, voir geotiff.js ; internet nécessaire).
import { zipper } from '../recap/xlsx.js';
import { genererDxfPaquet } from './pack-dxf.js';
import { octetsDxf } from './dxf-recale.js';
import { emprisePhoto, fabriquerGeotiff, PIXELS_MAX } from './geotiff.js';
import { planDuCadastre } from '../plan/listes-points.js';
import { nomDeFichierProjet } from '../projet/projet.js';

/** Ce que le projet peut donner : { cadastres: [{ leve, plan }], surfaces (swisstopo) }. */
export function contenuDuPaquet(projet) {
  return {
    cadastres: projet.leves.filter((l) => l.cadastre).map((leve) => ({ leve, plan: planDuCadastre(projet, leve) })),
    surfaces: projet.surfaces.filter((s) => s.type === 'swisstopo'),
  };
}

/**
 * Fabrique le ZIP. options : { cadastre, swisstopo, photo (cases cochées), marge (m), resolution (m) }.
 * trianglesDe(surface) : triangles de la surface ; pointsDe(surface) : ses points ; dire(texte) : avancement.
 * Renvoie { blob, nom } ou { erreur }.
 */
export async function fabriquerPaquet(projet, options, { trianglesDe, pointsDe, dire = () => {} }) {
  const { cadastres, surfaces } = contenuDuPaquet(projet);
  const cadastresVoulus = options.cadastre ? cadastres : [];
  const surfacesVoulues = options.swisstopo ? surfaces : [];
  if (cadastresVoulus.length + surfacesVoulues.length === 0) return { erreur: 'Rien à exporter : coche le cadastre ou la surface Swisstopo (ou importe-les d\'abord).' };
  const fichiers = [];
  const base = nomDeFichierProjet(projet);
  dire('DXF : écriture…');
  const texte = genererDxfPaquet({
    cadastres: cadastresVoulus,
    swisstopo: surfacesVoulues.map((s) => ({ triangles: trianglesDe(s) ?? [] })),
  });
  fichiers.push([`${base}_cadastre_swisstopo.dxf`, octetsDxf(texte)]);
  if (options.photo) {
    // La photo couvre tous les points exportés (cadastre et surface), avec la marge choisie.
    const points = [...cadastresVoulus.flatMap(({ leve }) => leve.points), ...surfacesVoulues.flatMap((s) => pointsDe(s) ?? [])];
    const emprise = emprisePhoto(points, options.marge, options.resolution);
    if (!emprise) return { erreur: 'Photo aérienne : aucun point sur lequel la placer.' };
    if (emprise.largeur * emprise.hauteur > PIXELS_MAX) {
      return { erreur: `Photo aérienne trop grande (${emprise.largeur} × ${emprise.hauteur} pixels) : choisis un pixel plus grand ou une marge plus petite.` };
    }
    try {
      const blob = await fabriquerGeotiff(emprise, options.resolution, (fait, total) => dire(`Photo aérienne : morceau ${fait} / ${total}…`));
      fichiers.push([`${base}_swissimage.tif`, new Uint8Array(await blob.arrayBuffer())]);
    } catch (erreur) {
      return { erreur: `Photo aérienne impossible (pas de connexion ?) : ${erreur.message}` };
    }
  }
  dire('ZIP : assemblage…');
  return { blob: new Blob([zipper(fichiers)], { type: 'application/zip' }), nom: `${base}_cadastre_swisstopo.zip` };
}
