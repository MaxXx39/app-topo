// Affichage gardé par appareil (0.128.0, demande du 05.11) : listes de points masquées, plans DXF
// et calques DXF masqués sont retenus par CETTE tablette, projet par projet, même après un
// redémarrage. Ils ne sont pas partagés : une version reçue de Drive reprend l'affichage de l'appareil.
//
// Rangement (stockage de l'appareil, clé `topo-affichage`) :
//   { [idProjet]: { cachees: [id de liste], connues: [id de liste], dxf: { [idPlan]: { visible, calques: { nom: visible } } } } }
// `connues` = listes qui existaient au dernier enregistrement : une liste Cadastre plus récente
// arrive cachée (comme avant), une liste que l'utilisateur a affichée reste affichée.

import { listesDePoints, listesCadastre } from '../plan/listes-points.js';

export const CLE_AFFICHAGE = 'topo-affichage';
const PROJETS_GARDES = 200; // au-delà, les plus anciens sont oubliés (place sur l'appareil)

function stockageParDefaut() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function lireTout(stockage) {
  try {
    const lu = JSON.parse(stockage?.getItem(CLE_AFFICHAGE) ?? '{}');
    return lu && typeof lu === 'object' ? lu : {};
  } catch {
    return {};
  }
}

/** Retient l'affichage du projet sur cet appareil (appelé à chaque enregistrement). */
export function noterAffichage(projet, stockage = stockageParDefaut()) {
  if (!projet?.id || !stockage) return;
  const tout = lireTout(stockage);
  delete tout[projet.id]; // remis à la fin : le plus récent en dernier
  const dxf = {};
  for (const plan of projet.plansDxf ?? []) {
    const calques = {};
    for (const calque of plan.calques ?? []) calques[calque.nom] = calque.visible !== false;
    dxf[plan.id] = { visible: plan.visible !== false, calques };
  }
  tout[projet.id] = {
    cachees: [...(projet.listesCachees ?? [])],
    connues: listesDePoints(projet).map((l) => l.id),
    dxf,
  };
  const ids = Object.keys(tout);
  for (const id of ids.slice(0, Math.max(0, ids.length - PROJETS_GARDES))) delete tout[id];
  try {
    stockage.setItem(CLE_AFFICHAGE, JSON.stringify(tout));
  } catch {
    // stockage plein ou interdit : l'affichage reviendra simplement au départ
  }
}

/**
 * Remet sur le projet l'affichage retenu par cet appareil (ouverture, version reçue de Drive).
 * Jamais vu sur cet appareil : tout est montré, sauf les listes Cadastre (0.113).
 */
export function appliquerAffichage(projet, stockage = stockageParDefaut()) {
  const garde = lireTout(stockage)[projet.id];
  const cadastres = listesCadastre(projet);
  if (!garde) {
    projet.listesCachees = cadastres;
    for (const plan of projet.plansDxf ?? []) {
      plan.visible = true;
      for (const calque of plan.calques ?? []) calque.visible = true;
    }
    return;
  }
  const existantes = new Set(listesDePoints(projet).map((l) => l.id));
  const connues = new Set(garde.connues ?? []);
  const cachees = new Set((garde.cachees ?? []).filter((id) => existantes.has(id)));
  for (const id of cadastres) if (!connues.has(id)) cachees.add(id);
  projet.listesCachees = [...cachees];
  for (const plan of projet.plansDxf ?? []) {
    const retenu = garde.dxf?.[plan.id];
    plan.visible = retenu ? retenu.visible !== false : true;
    for (const calque of plan.calques ?? []) calque.visible = retenu?.calques?.[calque.nom] ?? true;
  }
}
