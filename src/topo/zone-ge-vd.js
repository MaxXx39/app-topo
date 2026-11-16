// Zone « Genève – Vaud » en MN95 (mètres), décidée le 16.11 : Est 2 480 000 à 2 595 000, Nord 1 105 000 à 1 210 000.
// Sert seulement à AVERTIR à l'import (jamais à refuser) quand des points semblent hors de la zone habituelle
// (coordonnées en MN03, en degrés, ou colonnes inversées).

export const ZONE_GE_VD = { estMin: 2_480_000, estMax: 2_595_000, nordMin: 1_105_000, nordMax: 1_210_000 };

/** Vrai si le point (Est, Nord en MN95) est dans la zone Genève – Vaud. */
export function estDansZoneGeVd(point) {
  const { estMin, estMax, nordMin, nordMax } = ZONE_GE_VD;
  return point.est >= estMin && point.est <= estMax && point.nord >= nordMin && point.nord <= nordMax;
}

/** Texte d'avertissement si des points sont hors zone, sinon '' (cite jusqu'à 3 noms). */
export function avertissementHorsZone(points) {
  const hors = points.filter((p) => !estDansZoneGeVd(p));
  if (hors.length === 0) return '';
  const noms = hors.slice(0, 3).map((p) => p.nom).join(', ');
  return `${hors.length} point(s) hors de la zone Genève–Vaud (MN95 : Est 2 480 000 à 2 595 000, Nord 1 105 000 à 1 210 000) : ${noms}${hors.length > 3 ? '…' : ''}. Vérifie que le fichier est bien en MN95.`;
}
