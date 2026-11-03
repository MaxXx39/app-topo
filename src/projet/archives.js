// Archives (0.119.0, Expert) : un levé, une surface importée, un cadastre, un plan DXF ou un dessin
// peut être « archivé » au lieu d'être supprimé. Il quitte le projet actif (plan, volumes, exports,
// implantation : il n'existe plus pour eux) et part dans projet.archives, d'où on peut le
// restaurer tel quel, ou le supprimer pour de bon.
//
// Une archive a la forme :
//   { id, type ('leve', 'points', 'surface', 'cadastre', 'plan', 'dessin'), nom, archiveLe (date ISO),
//     contenu: { leves, surfaces, metres, autres, reseaux, mesures, calculs, plansDxf, dessins } }
// contenu : les morceaux du projet enlevés, rangés sous le même nom que dans le projet.
import { nouvelIdentifiant } from '../topo/surface.js';

// Parties du projet qu'une archive peut contenir (même nom que dans le projet).
export const CLES_ARCHIVE = ['leves', 'surfaces', 'metres', 'autres', 'reseaux', 'mesures', 'calculs', 'plansDxf', 'dessins'];

const NOMS_TYPES = { leve: 'Levé', points: 'Points importés', surface: 'Surface importée', cadastre: 'Cadastre', plan: 'Plan DXF', dessin: 'Dessin' };

/** Nom lisible d'une sorte d'archive (« Levé », « Plan DXF »…). */
export function nomDuType(type) {
  return NOMS_TYPES[type] ?? 'Élément';
}

/**
 * Enlève du projet les objets de "cle" qui répondent à "aEnlever" et les range dans "contenu".
 * Renvoie les objets enlevés.
 */
function enlever(projet, contenu, cle, aEnlever) {
  const liste = projet[cle] ?? [];
  const enleves = liste.filter(aEnlever);
  if (enleves.length === 0) return enleves;
  projet[cle] = liste.filter((o) => !aEnlever(o));
  contenu[cle] = [...(contenu[cle] ?? []), ...enleves];
  return enleves;
}

/** Calculs de volume dont la surface principale (surface 1) part dans l'archive. */
function enleverCalculs(projet, contenu, surfaces) {
  const ids = new Set(surfaces.map((s) => s.id));
  enlever(projet, contenu, 'calculs', (c) => ids.has(c.surface1Id));
}

/**
 * Archive un élément du projet. type : 'leve' (liste de points d'un levé, avec ses levées, mesures
 * et volumes), 'surface' (surface importée et ses volumes), 'cadastre' (points et plan des lignes),
 * 'plan' (plan DXF), 'dessin' (dessin et son levé « Surface »). id : identifiant de l'élément (pour
 * un levé, celui de la liste de points). Renvoie { archive } ou { erreur }.
 */
export function archiver(projet, type, id) {
  const contenu = {};
  let nom = null;
  if (type === 'leve' || type === 'cadastre') {
    const leve = (projet.leves ?? []).find((l) => l.id === id);
    if (!leve) return { erreur: 'levé introuvable' };
    nom = leve.nom;
    // Une levée (stock, métré, levé libre, réseau) prend son propre nom, plus parlant que la liste.
    const levees = [...(projet.surfaces ?? []), ...(projet.metres ?? []), ...(projet.autres ?? []), ...(projet.reseaux ?? [])].filter((o) => o.leveId === id);
    if (levees.length === 1 && levees[0].nom) nom = levees[0].nom;
    enlever(projet, contenu, 'leves', (l) => l.id === id);
    const surfaces = enlever(projet, contenu, 'surfaces', (s) => s.leveId === id);
    enleverCalculs(projet, contenu, surfaces);
    const metres = enlever(projet, contenu, 'metres', (m) => m.leveId === id);
    const idsMetres = new Set(metres.map((m) => m.id));
    enlever(projet, contenu, 'mesures', (m) => m.leveId === id || idsMetres.has(m.metreId));
    enlever(projet, contenu, 'autres', (a) => a.leveId === id);
    enlever(projet, contenu, 'reseaux', (r) => r.leveId === id);
    // Cadastre : le plan DXF des lignes part avec ses points.
    if (type === 'cadastre') enlever(projet, contenu, 'plansDxf', (p) => p.cadastre === id || (!p.cadastre && p.nom === leve.nom));
    if (projet.leveActifId === id) projet.leveActifId = projet.leves[0]?.id ?? null;
  } else if (type === 'surface') {
    const surface = (projet.surfaces ?? []).find((s) => s.id === id);
    if (!surface) return { erreur: 'surface introuvable' };
    nom = surface.nom;
    const surfaces = enlever(projet, contenu, 'surfaces', (s) => s.id === id);
    enleverCalculs(projet, contenu, surfaces);
  } else if (type === 'plan') {
    const plan = (projet.plansDxf ?? []).find((p) => p.id === id);
    if (!plan) return { erreur: 'plan introuvable' };
    nom = plan.nom;
    enlever(projet, contenu, 'plansDxf', (p) => p.id === id);
  } else if (type === 'dessin') {
    const dessin = (projet.dessins ?? []).find((d) => d.id === id);
    if (!dessin) return { erreur: 'dessin introuvable' };
    nom = dessin.nom;
    enlever(projet, contenu, 'dessins', (d) => d.id === id);
    // Son levé « Surface » (s'il a été créé) et la liste de ses points partent avec lui.
    const surfaces = enlever(projet, contenu, 'surfaces', (s) => s.dessinId === id);
    enleverCalculs(projet, contenu, surfaces);
    const listes = new Set(surfaces.map((s) => s.leveId).filter(Boolean));
    enlever(projet, contenu, 'leves', (l) => listes.has(l.id));
    if (listes.has(projet.leveActifId)) projet.leveActifId = projet.leves[0]?.id ?? null;
  } else {
    return { erreur: `impossible d'archiver « ${type} »` };
  }
  // Liste de points importés (pas un levé fait dans Lever) : rangée comme « Points importés ».
  const sorte = type === 'leve' && !(contenu.leves?.[0]?.direct) ? 'points' : type;
  const archive = { id: nouvelIdentifiant(), type: sorte, nom, archiveLe: new Date().toISOString(), contenu };
  projet.archives = [...(projet.archives ?? []), archive];
  return { archive };
}

/**
 * Remet dans le projet tout ce que contient l'archive, puis l'enlève des archives.
 * Un objet déjà présent (même identifiant) n'est pas mis en double. Renvoie { nom } ou { erreur }.
 */
export function restaurer(projet, archiveId) {
  const archive = (projet.archives ?? []).find((a) => a.id === archiveId);
  if (!archive) return { erreur: 'archive introuvable' };
  for (const cle of CLES_ARCHIVE) {
    const objets = archive.contenu?.[cle] ?? [];
    if (objets.length === 0) continue;
    const presents = new Set((projet[cle] ?? []).map((o) => o.id));
    projet[cle] = [...(projet[cle] ?? []), ...objets.filter((o) => !presents.has(o.id))];
  }
  projet.archives = projet.archives.filter((a) => a.id !== archiveId);
  return { nom: archive.nom };
}

/** Supprime une archive pour de bon. Renvoie { nom } ou { erreur }. */
export function supprimerArchive(projet, archiveId) {
  const archive = (projet.archives ?? []).find((a) => a.id === archiveId);
  if (!archive) return { erreur: 'archive introuvable' };
  projet.archives = projet.archives.filter((a) => a.id !== archiveId);
  return { nom: archive.nom };
}

/** Résumé d'une archive pour l'écran : « 124 points, 1 volume », etc. */
export function resumeArchive(archive) {
  const c = archive.contenu ?? {};
  const morceaux = [];
  const points = (c.leves ?? []).reduce((total, l) => total + (l.points?.length ?? 0), 0);
  if (points > 0) morceaux.push(`${points} point${points > 1 ? 's' : ''}`);
  const volumes = (c.calculs ?? []).length;
  if (volumes > 0) morceaux.push(`${volumes} volume${volumes > 1 ? 's' : ''}`);
  const mesures = (c.mesures ?? []).length;
  if (mesures > 0) morceaux.push(`${mesures} mesure${mesures > 1 ? 's' : ''}`);
  const plans = (c.plansDxf ?? []).length;
  if (plans > 0) morceaux.push(`${plans} plan${plans > 1 ? 's' : ''} DXF`);
  return morceaux.join(', ');
}
