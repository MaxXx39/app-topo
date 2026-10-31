// Export d'une liste de points (Projet › bouton « Exporter » de chaque liste, 0.79.0) :
// - TXT : une ligne par point « nom, Est, Nord, altitude », séparés par des tabulations, sans
//   en-tête (se relit dans l'appli et dans Mensura) ;
// - CSV : point-virgule (réglage suisse d'Excel), avec en-tête et toutes les infos connues du point
//   (rôle dans le levé, date et heure, précisions, qualité RTK, satellites, HDOP, âge des
//   corrections, inclinaison) ;
// - DXF : les points (avec altitude en Z), leurs noms et leurs altitudes (voir export/dxf.js).
// Coordonnées MN95, m, 3 décimales.
import { formaterNombre } from '../topo/format.js';
import { genererDxf } from './dxf.js';

export const FORMATS_POINTS = [
  ['txt', 'TXT', 'nom, Est, Nord, altitude'],
  ['csv', 'CSV', 'toutes les infos (Excel)'],
  ['dxf', 'DXF', 'points, noms, altitudes'],
  ['pdf', 'PDF', 'tableau avec toutes les infos'],
];

// Titres des colonnes des infos complètes (CSV et PDF), dans l'ordre.
export const TITRES_INFOS = ['Nom', 'Est (m)', 'Nord (m)', 'Altitude (m)', 'Rôle', 'Date', 'Heure', 'Précision H (m)', 'Précision V (m)', 'Qualité', 'Satellites', 'HDOP', 'Âge corrections (s)', 'Inclinaison (°)'];

// Qualité de la position (message GGA du récepteur) : 4 = RTK fixe, 5 = RTK flottant…
const QUALITES = { 1: 'autonome', 2: 'DGPS', 4: 'RTK fixe', 5: 'RTK flottant' };

const nombre = (valeur, decimales = 3) => (typeof valeur === 'number' && Number.isFinite(valeur) ? valeur.toFixed(decimales) : '');

/** Texte TXT : « nom<tab>Est<tab>Nord<tab>altitude » (altitude vide si inconnue). */
export function txtPoints(points) {
  return points.map((p) => [p.nom, formaterNombre(p.est), formaterNombre(p.nord), p.altitude == null ? '' : formaterNombre(p.altitude)].join('\t')).join('\r\n') + '\r\n';
}

/** Un champ CSV : entre guillemets s'il contient un point-virgule, un guillemet ou un retour à la ligne. */
function champ(valeur) {
  const texte = String(valeur ?? '');
  return /[;"\r\n]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
}

/** Toutes les infos d'un point, en texte, dans l'ordre de TITRES_INFOS (CSV et PDF). */
export function infosDuPoint(p, roles = new Map()) {
  const g = p.gnss ?? {};
  const pris = g.prisLe ? new Date(g.prisLe) : null;
  return [
    p.nom,
    formaterNombre(p.est),
    formaterNombre(p.nord),
    p.altitude == null ? '' : formaterNombre(p.altitude),
    roles.get(p.nom) ?? '',
    pris ? pris.toLocaleDateString('fr-CH') : '',
    pris ? pris.toLocaleTimeString('fr-CH') : '',
    nombre(g.precisionH),
    nombre(g.precisionV),
    QUALITES[g.qualite] ?? (g.qualite ?? ''),
    g.nbSatellites ?? '',
    nombre(g.hdop, 1),
    nombre(g.ageCorrections, 1),
    nombre(g.inclinaison, 1),
  ];
}

/**
 * Texte CSV avec toutes les infos. roles : Map nom -> rôle (« contour », « ligne L-HT-1 »,
 * « point isolé »), facultatif. Date et heure de la prise (heure de Suisse, sur l'appareil).
 */
export function csvPoints(points, roles = new Map()) {
  const lignes = [TITRES_INFOS, ...points.map((p) => infosDuPoint(p, roles))];
  return lignes.map((ligne) => ligne.map(champ).join(';')).join('\r\n') + '\r\n';
}

/** Texte DXF des points (calques POINTS, NOMS, ALTITUDES). */
export function dxfPoints(points) {
  return genererDxf({ points });
}

/** Fichier de la liste dans ce format : { blob, extension }. */
export function fichierPoints(points, format, roles) {
  if (format === 'csv') return { blob: new Blob(['﻿' + csvPoints(points, roles)], { type: 'text/csv;charset=utf-8' }), extension: 'csv' };
  if (format === 'dxf') return { blob: new Blob([dxfPoints(points)], { type: 'application/dxf' }), extension: 'dxf' };
  return { blob: new Blob([txtPoints(points)], { type: 'text/plain;charset=utf-8' }), extension: 'txt' };
}
