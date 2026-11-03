// Cadastre de Vaud par le service RDPPF du canton (0.112.4) : Vaud n'est pas en accès libre sur
// geodienste.ch (essai du 03.11). Adresse donnée par les liens « extrait RDPPF » de geo.vd.ch.
// Le service standard de la Confédération (GetEGRID) donne, pour un point, la parcelle qui le
// contient ; avec GEOMETRY=true, son contour. Le cercle est couvert par une grille de points ;
// un point déjà dans une parcelle trouvée n'est pas redemandé. Essayé à l'aveugle : les
// variantes d'adresse (EN = version 2, XY = version 1) sont essayées dans l'ordre.
import { grilleDuCercle, pasDeGrille, dansAnneau, contoursDeReponse, egridsDuTexte } from '../topo/cadastre.js';

export const ADRESSE_RDPPF_VD = 'https://www.rdppf.vd.ch/ws/RdppfSVC.svc';
const POINTS_MAX = 150; // demandes au plus pour un cercle

/** Adresses à essayer pour un point (version 2 puis version 1 du service). */
export function adressesGetEgrid(base, est, nord) {
  const en = `${est.toFixed(3)},${nord.toFixed(3)}`;
  return [
    `${base}/getegrid/json/?EN=${en}&GEOMETRY=true`,
    `${base}/getegrid/json/?XY=${en}&GEOMETRY=true`,
    `${base}/getegrid/xml/?EN=${en}&GEOMETRY=true`,
  ];
}

/**
 * Parcelles autour de centre { est, nord } (rayon m) : { points: [], lignes: [anneaux] }.
 * progres(texte) pendant le travail ; chercher : fetch (remplacé dans les tests).
 */
export async function telechargerRdppf(centre, rayon, progres = () => {}, chercher = (...args) => fetch(...args), base = ADRESSE_RDPPF_VD) {
  const grille = grilleDuCercle(centre, rayon, pasDeGrille(rayon)).slice(0, POINTS_MAX);
  const anneaux = [];
  const vus = new Set();
  let variante = null; // numéro de la variante d'adresse qui marche
  let derniere = '';
  let demandes = 0;
  for (const [n, [est, nord]] of grille.entries()) {
    if (anneaux.some((a) => dansAnneau([est, nord], a))) continue;
    progres(`Cadastre Vaud (RDPPF) : point ${n + 1} / ${grille.length}, ${anneaux.length} parcelle(s)…`);
    const adresses = adressesGetEgrid(base, est, nord);
    const essais = variante === null ? adresses.map((a, i) => [a, i]) : [[adresses[variante], variante]];
    for (const [adresse, i] of essais) {
      let texte;
      try {
        const reponse = await chercher(adresse);
        texte = await reponse.text();
        if (!reponse.ok) {
          derniere = `erreur ${reponse.status} « ${texte.replace(/\s+/g, ' ').slice(0, 120)} »`;
          continue;
        }
      } catch {
        derniere = 'injoignable (réseau ; sur le site internet, le service de Vaud refuse l\'appli : passer par l\'APK Android)';
        continue;
      }
      const contours = contoursDeReponse(texte);
      const egrids = egridsDuTexte(texte);
      if (contours.length === 0 && egrids.length === 0) {
        derniere = `réponse sans parcelle « ${texte.replace(/\s+/g, ' ').slice(0, 120)} »`;
        continue;
      }
      variante = i;
      if (contours.length === 0) derniere = `parcelle ${egrids[0]} trouvée mais sans contour (« ${texte.replace(/\s+/g, ' ').slice(0, 120)} »)`;
      for (const anneau of contours) {
        const cle = anneau.slice(0, 3).map((p) => p.map((v) => v.toFixed(2)).join(',')).join(';') + anneau.length;
        if (vus.has(cle)) continue;
        vus.add(cle);
        anneaux.push(anneau);
      }
      break;
    }
    // Aucune variante ne marche aux 5 premiers points demandés (un point peut tomber sur une route
    // sans parcelle) : inutile de continuer.
    demandes++;
    if (variante === null && demandes >= 5) throw new Error(`service RDPPF de Vaud : ${derniere}`);
  }
  if (anneaux.length === 0) throw new Error(`service RDPPF de Vaud : ${derniere || 'aucune parcelle'}`);
  return { points: [], lignes: anneaux };
}
