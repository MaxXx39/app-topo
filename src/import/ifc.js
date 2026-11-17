// Lecture d'un fichier IFC avec la bibliothèque web-ifc (accord du 17.11) : elle transforme chaque
// objet (mur, dalle, poteau…) en triangles, ouvertures (portes, fenêtres, trémies) déjà découpées.
// La bibliothèque est lourde (~1,5 Mo) : elle n'est chargée qu'au moment d'importer un IFC.
//
// web-ifc donne des coordonnées en mètres, axe Y vers le haut : Est = X, altitude = Y, Nord = −Z.
// La position vient du fichier lui-même (coordonnées partagées de Revit, ou IfcMapConversion lu par
// web-ifc) : aucune conversion, l'IFC doit être en MN95.
import { rangerMaquette } from '../topo/ifc.js';

/**
 * Lit les octets d'un IFC avec l'API web-ifc déjà prête (api : IfcAPI après Init) et la classe des
 * types (W : le module web-ifc, pour IFCBUILDINGSTOREY).
 * Renvoie { maquette, compte: { objets, triangles, ignores }, schema }.
 */
export function lireIfcAvecApi(api, W, octets) {
  const modele = api.OpenModel(octets, { COORDINATE_TO_ORIGIN: false });
  try {
    const objets = [];
    let ignores = 0;
    api.StreamAllMeshes(modele, (mesh) => {
      const ligne = api.GetLine(modele, mesh.expressID);
      const type = api.GetNameFromTypeCode(ligne.type);
      if (/^IFCOPENINGELEMENT$|^IFCSPACE$|^IFCSITE$/i.test(type)) return; // vides, pièces, terrain : pas dessinés
      const sommets = [];
      const triangles = [];
      for (let g = 0; g < mesh.geometries.size(); g++) {
        const morceau = mesh.geometries.get(g);
        const geometrie = api.GetGeometry(modele, morceau.geometryExpressID);
        const v = api.GetVertexArray(geometrie.GetVertexData(), geometrie.GetVertexDataSize());
        const ix = api.GetIndexArray(geometrie.GetIndexData(), geometrie.GetIndexDataSize());
        const m = morceau.flatTransformation; // matrice 4 × 4 (colonnes), en nombres « doubles »
        const depart = sommets.length / 3;
        // Chaque sommet : 6 nombres (x, y, z, puis la normale, pas utilisée).
        for (let k = 0; k < v.length; k += 6) {
          const x = v[k];
          const y = v[k + 1];
          const z = v[k + 2];
          const X = m[0] * x + m[4] * y + m[8] * z + m[12];
          const Y = m[1] * x + m[5] * y + m[9] * z + m[13];
          const Z = m[2] * x + m[6] * y + m[10] * z + m[14];
          sommets.push(X, -Z, Y); // Est, Nord, altitude
        }
        for (let k = 0; k < ix.length; k++) triangles.push(ix[k] + depart);
        geometrie.delete();
      }
      if (triangles.length === 0) {
        ignores++;
        return;
      }
      objets.push({ type, nom: texteIfc(ligne.Name?.value), sommets, triangles });
    });
    const niveaux = lireNiveaux(api, W, modele);
    const maquette = rangerMaquette(objets, niveaux);
    const triangles = maquette.objets.reduce((n, o) => n + o.i.length / 3, 0);
    return { maquette, compte: { objets: maquette.objets.length, triangles, ignores }, schema: api.GetModelSchema?.(modele) ?? '' };
  } finally {
    api.CloseModel(modele);
  }
}

/** Niveaux (étages) : nom et altitude du sol fini (m), lue sur la position de l'étage dans le fichier. */
function lireNiveaux(api, W, modele) {
  const niveaux = [];
  const facteur = facteurLongueur(api, W, modele);
  const ids = api.GetLineIDsWithType(modele, W.IFCBUILDINGSTOREY);
  for (let k = 0; k < ids.size(); k++) {
    const etage = api.GetLine(modele, ids.get(k));
    const placement = etage.ObjectPlacement?.value;
    if (!placement) continue;
    const m = api.GetWorldTransformMatrix(modele, placement);
    // Matrice brute du fichier (unité du fichier, Z vers le haut) : altitude = translation en Z × unité.
    const altitude = m?.[14] * facteur;
    if (!Number.isFinite(altitude)) continue;
    niveaux.push({ nom: texteIfc(etage.Name?.value) || texteIfc(etage.LongName?.value) || `Niveau ${k + 1}`, altitude: Math.round(altitude * 1000) / 1000 });
  }
  return niveaux;
}

// Préfixes des unités SI de l'IFC (ex. CENTI.METRE = cm) → facteur vers le mètre.
const PREFIXES = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3, HECTO: 100, DECA: 10, DECI: 0.1, CENTI: 0.01, MILLI: 0.001, MICRO: 1e-6 };

/**
 * Facteur de l'unité de longueur du fichier vers le mètre (1 pour m, 0.01 pour cm, 0.001 pour mm,
 * 0.3048 pour le pied). Lu dans l'unité de longueur (IFCSIUNIT ou unité convertie) du fichier.
 */
function facteurLongueur(api, W, modele) {
  const si = api.GetLineIDsWithType(modele, W.IFCSIUNIT);
  for (let k = 0; k < si.size(); k++) {
    const unite = api.GetLine(modele, si.get(k));
    if (unite.UnitType?.value !== 'LENGTHUNIT') continue;
    return unite.Prefix?.value ? (PREFIXES[unite.Prefix.value] ?? 1) : 1;
  }
  const converties = api.GetLineIDsWithType(modele, W.IFCCONVERSIONBASEDUNIT);
  for (let k = 0; k < converties.size(); k++) {
    const unite = api.GetLine(modele, converties.get(k));
    if (unite.UnitType?.value !== 'LENGTHUNIT') continue;
    if (/foot|feet|pied/i.test(unite.Name?.value ?? '')) return 0.3048;
    if (/inch|pouce/i.test(unite.Name?.value ?? '')) return 0.0254;
  }
  return 1;
}

/**
 * Texte d'un IFC : les accents y sont écrits en codes (\X\E9 = é, \X2\00E9\X0\ = é). web-ifc les
 * laisse parfois tels quels : on les remet en lettres.
 */
export function texteIfc(texte) {
  if (texte == null) return '';
  return String(texte)
    .replace(/\\X2\\([0-9A-F]+)\\X0\\/gi, (_, hex) => hex.match(/.{4}/g).map((h) => String.fromCharCode(parseInt(h, 16))).join(''))
    .replace(/\\X\\([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

let apiPrete = null;

/**
 * Lit un fichier IFC dans le navigateur (octets : Uint8Array). Charge web-ifc la première fois.
 * Renvoie le même résultat que lireIfcAvecApi.
 */
export async function lireIfc(octets) {
  if (!apiPrete) {
    apiPrete = (async () => {
      const [W, { default: urlWasm }] = await Promise.all([import('web-ifc'), import('web-ifc/web-ifc.wasm?url')]);
      const api = new W.IfcAPI();
      // Un seul fil (forceSingleThread) : la version à plusieurs fils demande des réglages du serveur.
      await api.Init(() => urlWasm, true);
      return { api, W };
    })().catch((erreur) => {
      apiPrete = null;
      throw new Error(`lecteur IFC pas chargé (${erreur.message})`);
    });
  }
  const { api, W } = await apiPrete;
  return lireIfcAvecApi(api, W, octets);
}
