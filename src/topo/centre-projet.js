// Centre d'un projet (0.216.0, demande du 12.11) : le centre de la boîte qui entoure tout ce que le projet contient (points des levés
// et des listes importées, points de contrôle, points à implanter, surfaces importées, dessins, plans DXF recalés ou en MN95).
// Il est gardé en mémoire avec le projet (jamais affiché comme un point) et sert à placer le projet sur la carte des projets.
// Coordonnées MN95 en mètres ; seules les coordonnées qui tombent en Suisse comptent (un plan en coordonnées locales est ignoré).

import { planRecale } from './recalage.js';

const EST_MIN = 2480000;
const EST_MAX = 2840000;
const NORD_MIN = 1070000;
const NORD_MAX = 1300000;

/** Vrai si le point { est, nord } est en Suisse (MN95). */
export function estEnSuisse(p) {
  return Number.isFinite(p?.est) && Number.isFinite(p?.nord) && p.est >= EST_MIN && p.est <= EST_MAX && p.nord >= NORD_MIN && p.nord <= NORD_MAX;
}

/** Boîte { estMin, estMax, nordMin, nordMax } des points { est, nord } en Suisse (les autres sont ignorés), ou null s'il n'y en a pas. */
export function boiteDesPoints(points) {
  let boite = null;
  for (const p of points) {
    if (!estEnSuisse(p)) continue;
    if (!boite) boite = { estMin: p.est, estMax: p.est, nordMin: p.nord, nordMax: p.nord };
    else {
      boite.estMin = Math.min(boite.estMin, p.est);
      boite.estMax = Math.max(boite.estMax, p.est);
      boite.nordMin = Math.min(boite.nordMin, p.nord);
      boite.nordMax = Math.max(boite.nordMax, p.nord);
    }
  }
  return boite;
}

/**
 * Centre { est, nord } du projet (arrondi au mètre), ou null si le projet ne contient encore rien en Suisse.
 * Un plan DXF compte avec ses coins (bornes) s'il est recalé ou s'il a été importé « déjà calé » ; sinon seulement s'il est en MN95.
 */
export function centreDuProjet(projet) {
  const points = [];
  for (const levee of projet.leves ?? []) points.push(...(levee.points ?? []));
  for (const p of projet.pointsControle ?? []) points.push(p);
  for (const p of projet.aImplanter ?? []) points.push(p);
  for (const surface of projet.surfaces ?? []) points.push(...(surface.points ?? []).filter((p) => typeof p === 'object'));
  for (const dessin of projet.dessins ?? []) points.push(...(dessin.sommets ?? []));
  for (const plan of projet.plansDxf ?? []) {
    const b = planRecale(plan).bornes; // plan recalé : ses coins en MN95 ; sinon tel qu'importé (compté seulement s'il est en Suisse)
    if (!b) continue;
    points.push({ est: b.estMin, nord: b.nordMin }, { est: b.estMax, nord: b.nordMax });
  }
  const boite = boiteDesPoints(points);
  if (!boite) return null;
  return { est: Math.round((boite.estMin + boite.estMax) / 2), nord: Math.round((boite.nordMin + boite.nordMax) / 2) };
}

/** Texte du centre pour Drive (propriété du dossier) : « est,nord ». */
export function texteDuCentre(centre) {
  return estEnSuisse(centre) ? `${Math.round(centre.est)},${Math.round(centre.nord)}` : null;
}

/** Centre lu depuis le texte « est,nord » de Drive, ou null s'il est illisible ou hors de Suisse. */
export function centreDuTexte(texte) {
  const [est, nord] = String(texte ?? '').split(',').map(Number);
  const centre = { est, nord };
  return estEnSuisse(centre) ? centre : null;
}
