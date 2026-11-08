// Mesure rapide (0.158.0) : « Enregistrer » range la mesure dans le levé libre « LV-Mesures rapides »
// (validé le 08.11) : ses points (MR-n-1, MR-n-2… : n = numéro de la mesure) et, dès 2 points, une ligne
// (fermée à partir de 3 points). Un point seul devient un point isolé. Sans altitude, le point est gardé
// tel quel (le levé libre accepte les points sans altitude).
import { creerListeDeLevee, nommerListeDeLevee } from './leve-direct.js';
import { nouvelIdentifiant, PREFIXE_LEVE } from './surface.js';

export const NOM_LEVE_MESURES_RAPIDES = `${PREFIXE_LEVE}Mesures rapides`;

/**
 * Range les points (dans l'ordre choisi) dans le levé libre « LV-Mesures rapides » (créé s'il manque).
 * nomsPris : noms déjà utilisés dans le projet (jamais deux fois le même nom).
 * Renvoie { levee, points, numero } ou { erreur }.
 */
export function rangerMesureRapide(projet, pointsMesure, nomsPris = new Set()) {
  if (pointsMesure.length === 0) return { erreur: 'aucun point mesuré' };
  projet.autres ??= [];
  let levee = projet.autres.find((a) => a.nom === NOM_LEVE_MESURES_RAPIDES);
  if (!levee) {
    const leve = creerListeDeLevee(projet);
    levee = { id: nouvelIdentifiant(), nom: NOM_LEVE_MESURES_RAPIDES, nature: 'autres', leveId: leve.id, contour: [], lignesRupture: [], points: [] };
    projet.autres.push(levee);
    nommerListeDeLevee(projet, levee);
  }
  const leve = projet.leves.find((l) => l.id === levee.leveId);
  if (!leve) return { erreur: 'liste du levé « Mesures rapides » introuvable' };
  const numeros = leve.points.map((p) => /^MR-(\d+)-\d+$/.exec(p.nom)?.[1]).filter(Boolean).map(Number);
  let numero = Math.max(0, ...numeros) + 1;
  while (nomsPris.has(`MR-${numero}-1`)) numero += 1;
  const points = pointsMesure.map((p, i) => ({ nom: `MR-${numero}-${i + 1}`, est: p.est, nord: p.nord, altitude: p.altitude ?? null }));
  leve.points.push(...points);
  if (points.length === 1) levee.points.push(points[0].nom);
  else levee.lignesRupture.push({ noms: points.map((p) => p.nom), fermee: points.length >= 3, libelle: 'MR', numero });
  return { levee, points, numero };
}
