// Décaler une ligne (0.141.0, liste du 05.11, point 8, Intermédiaire) : une copie de la ligne, décalée
// en plan (parallèle, + = à droite en regardant du début vers la fin, − = à gauche) et en hauteur
// (+ = plus haut). La copie est rangée dans le levé libre « LV-Lignes décalées », points L-dec-n-m.
import { ligneParallele } from './ligne-implantation.js';
import { creerListeDeLevee, nommerListeDeLevee } from './leve-direct.js';
import { nouvelIdentifiant, PREFIXE_LEVE } from './surface.js';

export const NOM_LEVE_DECALAGES = `${PREFIXE_LEVE}Lignes décalées`;

const mm = (v) => Math.round(v * 1000) / 1000;

/** Vrai si la ligne revient sur son premier point (ligne fermée). */
function estFermee(sommets) {
  const a = sommets[0];
  const b = sommets.at(-1);
  return sommets.length > 3 && Math.hypot(a.est - b.est, a.nord - b.nord) < 0.0005;
}

/**
 * Sommets décalés. sommets : [{ est, nord, altitude }] (m) ; decalage : m (+ droite, − gauche) ;
 * dz : m (+ plus haut). Une ligne fermée reste fermée (les coins aussi sont décalés juste) : son
 * dernier sommet (= le premier) n'est pas répété. Renvoie { sommets, fermee }.
 */
export function ligneDecalee(sommets, decalage, dz = 0) {
  const fermee = estFermee(sommets);
  let plan;
  if (fermee) {
    const boucle = sommets.slice(0, -1);
    // On ajoute le voisin de chaque bout pour que le 1er et le dernier coin soient des angles comme les autres.
    plan = ligneParallele([boucle.at(-1), ...boucle, boucle[0]], decalage).slice(1, -1);
  } else {
    plan = ligneParallele(sommets, decalage);
  }
  return {
    fermee,
    sommets: plan.map((s) => ({ est: mm(s.est), nord: mm(s.nord), altitude: s.altitude == null ? null : mm(s.altitude + dz) })),
  };
}

/**
 * Range la ligne décalée dans le levé libre « LV-Lignes décalées » (créé la 1re fois) : points
 * L-dec-n-1, L-dec-n-2… (n = numéro de la ligne dans ce levé). nomsPris : noms déjà dans le projet.
 * Renvoie { levee, ligne, points } ou { erreur }.
 */
export function rangerLigneDecalee(projet, { sommets, fermee }, nomsPris = new Set()) {
  if (sommets.length < 2) return { erreur: 'la ligne a moins de 2 points' };
  projet.autres ??= [];
  let levee = projet.autres.find((a) => a.nom === NOM_LEVE_DECALAGES);
  if (!levee) {
    const leve = creerListeDeLevee(projet);
    levee = { id: nouvelIdentifiant(), nom: NOM_LEVE_DECALAGES, nature: 'autres', leveId: leve.id, contour: [], lignesRupture: [], points: [] };
    projet.autres.push(levee);
    nommerListeDeLevee(projet, levee);
  }
  const leve = projet.leves.find((l) => l.id === levee.leveId);
  if (!leve) return { erreur: 'liste du levé « Lignes décalées » introuvable' };
  const numeros = leve.points.map((p) => /^L-dec-(\d+)-\d+$/.exec(p.nom)?.[1]).filter(Boolean).map(Number);
  let n = Math.max(0, ...numeros) + 1;
  while (nomsPris.has(`L-dec-${n}-1`)) n += 1;
  const points = sommets.map((s, i) => ({ nom: `L-dec-${n}-${i + 1}`, est: s.est, nord: s.nord, altitude: s.altitude }));
  leve.points.push(...points);
  const ligne = { noms: points.map((p) => p.nom), fermee, libelle: 'dec', numero: n };
  levee.lignesRupture.push(ligne);
  return { levee, ligne, points };
}
