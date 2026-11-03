// Cadastre de Vaud par le service RDPPF du canton (0.112.4) : Vaud n'est pas en accès libre sur
// geodienste.ch (essai du 03.11). Adresse donnée par les liens « extrait RDPPF » de geo.vd.ch.
// Le service standard de la Confédération (GetEGRID) donne, pour un point, la parcelle qui le
// contient ; avec GEOMETRY=true, son contour. Le cercle est couvert par une grille de points ;
// un point déjà dans une parcelle trouvée n'est pas redemandé. Essayé à l'aveugle : les
// variantes d'adresse (EN = version 2, XY = version 1) sont essayées dans l'ordre.
import { grilleDuCercle, pasDeGrille, dansAnneau, contoursDeReponse, egridsDuTexte, contourDuExtrait } from '../topo/cadastre.js';

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
  const raisons = [];
  const egridsFaits = new Set();
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
          derniere = `erreur ${reponse.status} : ${raisonDuService(texte)} (${adresse.replace(base, '')})`;
          // 0.112.7 : le service refuse la demande : on garde sa raison et on arrête tout de suite.
          raisons.push(derniere);
          continue;
        }
      } catch {
        derniere = 'injoignable (réseau ; sur le site internet, le service de Vaud passe par le relais du cadastre : relais pas encore réglé ou injoignable ; sinon passer par l\'APK Android)';
        continue;
      }
      const contours = contoursDeReponse(texte);
      const egrids = egridsDuTexte(texte);
      if (contours.length === 0 && egrids.length === 0) {
        derniere = `réponse sans parcelle « ${texte.replace(/\s+/g, ' ').slice(0, 120)} »`;
        continue;
      }
      variante = i;
      // 0.112.8 : Vaud répond sans contour (essai du 03.11) : on demande l'extrait de chaque parcelle.
      if (contours.length === 0) {
        for (const egrid of egrids) {
          if (egridsFaits.has(egrid)) continue;
          egridsFaits.add(egrid);
          progres(`Cadastre Vaud (RDPPF) : contour de la parcelle ${egrid}…`);
          contours.push(...(await contourParExtrait(chercher, base, egrid)));
        }
      }
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
    if (variante === null && raisons.length >= adressesGetEgrid(base, 0, 0).length) throw new Error(`service RDPPF de Vaud : ${raisons.join(' | ')}`);
    if (variante === null && demandes >= 5) throw new Error(`service RDPPF de Vaud : ${derniere}`);
  }
  if (anneaux.length === 0) throw new Error(`service RDPPF de Vaud : ${derniere || 'aucune parcelle'}`);
  return { points: [], lignes: anneaux };
}

/** Raison donnée par le service dans une réponse d'erreur : texte de <Message>, sinon le début de la réponse. */
export function raisonDuService(texte) {
  const message = /<(?:\w+:)?Message\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Message>/i.exec(texte)?.[1]
    ?? /"message"\s*:\s*"([^"]*)"/i.exec(texte)?.[1];
  const net = (message ?? texte.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  return `« ${net.slice(0, 300)} »`;
}

/** Adresses de l'extrait RDPPF d'une parcelle (avec la géométrie), à essayer dans l'ordre. */
export function adressesExtrait(base, egrid) {
  // 0.112.9 : le XML d'abord (seul format où Vaud donne le contour, essai du 03.11).
  return [
    `${base}/extract/xml/?EGRID=${egrid}&GEOMETRY=true`,
    `${base}/extract/json/?EGRID=${egrid}&GEOMETRY=true`,
  ];
}

let varianteExtrait = null; // variante d'adresse de l'extrait qui a marché (gardée pour la suite)

/** Contour d'une parcelle par son extrait RDPPF ; erreur claire (raisons du service) sinon. */
async function contourParExtrait(chercher, base, egrid) {
  const adresses = adressesExtrait(base, egrid);
  const ordre = varianteExtrait === null ? adresses.map((_, i) => i) : [varianteExtrait, ...adresses.map((_, i) => i).filter((i) => i !== varianteExtrait)];
  const raisons = [];
  for (const i of ordre) {
    let texte;
    try {
      const reponse = await chercher(adresses[i]);
      texte = await reponse.text();
      if (!reponse.ok) {
        raisons.push(`erreur ${reponse.status} : ${raisonDuService(texte)} (${adresses[i].replace(base, '')})`);
        continue;
      }
    } catch (erreur) {
      raisons.push(`${erreur.message} (${adresses[i].replace(base, '')})`);
      continue;
    }
    const anneaux = contourDuExtrait(texte);
    if (anneaux.length > 0) {
      varianteExtrait = i;
      return anneaux;
    }
    raisons.push(`extrait sans contour « ${texte.replace(/\s+/g, ' ').slice(0, 150)} » (${adresses[i].replace(base, '')})`);
  }
  throw new Error(`service RDPPF de Vaud, parcelle ${egrid} : ${raisons.join(' | ')}`);
}
