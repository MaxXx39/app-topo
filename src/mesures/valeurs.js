// Valeurs d'une mesure : titre, unité et écriture, partagées par l'écran, le plan, le PDF et le CSV.
// Chaque valeur peut être cochée (mesure.afficher) pour être montrée sur le plan et dans le PDF.
import { formaterNombre } from '../topo/format.js';
import { pointInterieur } from '../plan/etiquettes.js';

/** Nombre avec son signe (+ ou -) et 3 décimales : « +1.234 ». */
const avecSigne = (valeur) => `${valeur >= 0 ? '+' : '-'}${formaterNombre(Math.abs(valeur))}`;

/** Pente en % avec 2 décimales et son signe, ou « - » si elle n'existe pas (points l'un sur l'autre). */
export function formaterPente(valeur) {
  if (valeur === null) return '-';
  return `${valeur >= 0 ? '+' : '-'}${Math.abs(valeur).toFixed(2)} %`;
}

/**
 * Valeurs de chaque sorte de mesure : { cle, titre (dans les tableaux), court (sur le plan), ecrire(résultat) }.
 * "cle" est aussi celle de la case à cocher dans mesure.afficher.
 */
export const VALEURS = {
  longueur: [
    { cle: 'l2d', titre: 'Longueur 2D', court: 'L 2D', ecrire: (r) => `${formaterNombre(r.l2d)} m` },
    { cle: 'l3d', titre: 'Longueur 3D', court: 'L 3D', ecrire: (r) => `${formaterNombre(r.l3d)} m` },
    { cle: 'denivele', titre: 'Dénivelé (fin - début)', court: 'Déniv.', ecrire: (r) => `${avecSigne(r.denivele)} m` },
    { cle: 'pente', titre: 'Pente', court: 'Pente', ecrire: (r) => formaterPente(r.pente) },
  ],
  aire: [
    { cle: 'a2d', titre: 'Aire 2D', court: 'A 2D', ecrire: (r) => `${formaterNombre(r.a2d)} m²` },
    { cle: 'a3d', titre: 'Aire 3D', court: 'A 3D', ecrire: (r) => `${formaterNombre(r.a3d)} m²` },
    { cle: 'p2d', titre: 'Périmètre 2D', court: 'P 2D', ecrire: (r) => `${formaterNombre(r.p2d)} m` },
    { cle: 'p3d', titre: 'Périmètre 3D', court: 'P 3D', ecrire: (r) => `${formaterNombre(r.p3d)} m` },
  ],
  nombre: [{ cle: 'nombre', titre: 'Nombre de points', court: 'Nb', ecrire: (r) => `${r.nombre} pce` }],
};

/** Texte de la case « morceaux » de chaque sorte de mesure. */
export const TEXTE_MORCEAUX = {
  longueur: 'Chaque morceau sur le plan',
  aire: 'Chaque côté sur le plan',
  nombre: null, // pas de morceaux
};

/**
 * Couleurs proposées pour une mesure : { couleur (écran et PDF), nom, aci (numéro de couleur AutoCAD, pour le DXF) }.
 * Le cyan est la couleur de départ.
 */
export const COULEURS_MESURES = [
  { couleur: '#0891b2', nom: 'Cyan', aci: 4 },
  { couleur: '#2563eb', nom: 'Bleu', aci: 5 },
  { couleur: '#7c3aed', nom: 'Violet', aci: 6 },
  { couleur: '#db2777', nom: 'Rose', aci: 221 },
  { couleur: '#dc2626', nom: 'Rouge', aci: 1 },
  { couleur: '#ea580c', nom: 'Orange', aci: 30 },
  { couleur: '#16a34a', nom: 'Vert', aci: 3 },
  { couleur: '#1b2b36', nom: 'Bleu nuit', aci: 7 },
];

/** Couleur d'une mesure (de la palette), cyan si elle n'en a pas. */
export function couleurDeMesure(mesure) {
  return (COULEURS_MESURES.find((c) => c.couleur === mesure.couleur) ?? COULEURS_MESURES[0]).couleur;
}

/** Numéro de couleur AutoCAD (DXF) d'une mesure. */
export function aciDeMesure(mesure) {
  return (COULEURS_MESURES.find((c) => c.couleur === mesure.couleur) ?? COULEURS_MESURES[0]).aci;
}

/** '#0891b2' -> [8, 145, 178] (rouge, vert, bleu), pour le PDF. facteur < 1 : plus foncé. */
export function rvbDeCouleur(couleur, facteur = 1) {
  return [1, 3, 5].map((i) => Math.round(parseInt(couleur.slice(i, i + 2), 16) * facteur));
}

/** Nom affiché d'une sorte de mesure. */
export const NOM_TYPE = { longueur: 'Longueur', aire: 'Aire', nombre: 'Nombre' };

/**
 * Valeur principale d'une mesure, pour la liste et la petite étiquette du plan : la première
 * valeur cochée (« L 2D 31.788 m »), sinon la valeur 2D.
 */
export function valeurPrincipale(mesure, resultat) {
  const valeurs = VALEURS[mesure.type];
  const valeur = valeurs.find((v) => mesure.afficher?.[v.cle]) ?? valeurs[0];
  return `${valeur.court} ${valeur.ecrire(resultat)}`;
}

/** Lignes de l'étiquette d'une mesure sur le plan : son nom, puis les valeurs cochées (« L 2D 12.345 m »). */
export function lignesEtiquette(mesure, resultat) {
  const valeurs = VALEURS[mesure.type].filter((v) => mesure.afficher?.[v.cle]);
  return [mesure.nom, ...valeurs.map((v) => `${v.court} ${v.ecrire(resultat)}`)];
}

/**
 * Texte écrit sur un morceau (longueur) ou un côté (aire) : les valeurs cochées du morceau.
 * Longueur : longueurs 2D et 3D, dénivelé, pente. Aire : longueur du côté (2D, et 3D si le
 * périmètre 3D est coché). Si rien n'est coché, la longueur 2D.
 */
export function texteMorceau(mesure, morceau) {
  const a = mesure.afficher ?? {};
  const textes = [];
  if (mesure.type === 'longueur') {
    if (a.l2d) textes.push(`${formaterNombre(morceau.l2d)} m`);
    if (a.l3d) textes.push(`3D ${formaterNombre(morceau.l3d)} m`);
    if (a.denivele) textes.push(`${avecSigne(morceau.denivele)} m`);
    if (a.pente) textes.push(formaterPente(morceau.pente));
  } else {
    if (a.p2d || !a.p3d) textes.push(`${formaterNombre(morceau.l2d)} m`);
    if (a.p3d) textes.push(`3D ${formaterNombre(morceau.l3d)} m`);
  }
  return textes.length > 0 ? textes.join(' · ') : `${formaterNombre(morceau.l2d)} m`;
}

/** Valeurs d'un morceau pour le tableau de détail : [L 2D, L 3D, dénivelé, pente]. */
export function valeursMorceau(morceau) {
  return [`${formaterNombre(morceau.l2d)} m`, `${formaterNombre(morceau.l3d)} m`, `${avecSigne(morceau.denivele)} m`, formaterPente(morceau.pente)];
}

/**
 * Où écrire l'étiquette d'une mesure (m, MN95) : au milieu de la longueur (à mi-chemin le long
 * de la ligne), ou à l'intérieur de l'aire.
 */
export function placeEtiquetteMesure(mesure, resultat) {
  if (mesure.type === 'aire') {
    return pointInterieur(resultat.triangles) ?? resultat.sommets[0];
  }
  // Nombre : au milieu des points comptés.
  if (mesure.type === 'nombre') {
    const n = resultat.sommets.length;
    return { est: resultat.sommets.reduce((s, p) => s + p.est, 0) / n, nord: resultat.sommets.reduce((s, p) => s + p.nord, 0) / n };
  }
  let reste = resultat.l2d / 2;
  for (const { debut, fin, l2d } of resultat.morceaux) {
    if (l2d >= reste && l2d > 0) {
      const t = reste / l2d;
      return { est: debut.est + t * (fin.est - debut.est), nord: debut.nord + t * (fin.nord - debut.nord) };
    }
    reste -= l2d;
  }
  return resultat.sommets[0];
}
