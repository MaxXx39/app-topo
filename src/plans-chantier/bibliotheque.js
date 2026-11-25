// Plans de chantier (0.289.0) : bibliothèque des symboles. La bibliothèque livrée (symboles-base.json, tirée du DXF de
// blocs de l'utilisateur et modernisée : voir outils-dev/convertir-symboles.mjs) est chargée à l'ouverture de la page ;
// s'y ajoutent les symboles importés d'un DXF de blocs dans le projet (projet.symboles, partagés par Drive).
import { lireBlocsDxf } from '../topo/blocs-dxf.js';
import { bibliothequeDepuisBlocs, CATEGORIES_SYMBOLES, CLE_CONTENEUR, CLE_ESCALIER } from '../topo/symboles.js';
import { grueMobile } from '../topo/grue-mobile.js';
import { panneauDeviation, CLE_DEVIATION } from '../topo/panneau-deviation.js';
import { parkingDynamique, CLE_PARKING } from '../topo/parking-dynamique.js';
import { portailDynamique, CLE_PORTAIL, PASSAGE_PORTAIL } from '../topo/portail-dynamique.js';
import { pompeDynamique, CLE_POMPE } from '../topo/pompe-dynamique.js';
import { grueFiche } from '../topo/grue-fiche.js';
import { tousLesModeles } from '../topo/grue-modele.js';
import { texteDuDxf } from '../topo/dxf-plan.js';

let promesse = null;
/** Bibliothèque livrée (chargée une fois, gardée hors ligne par le cache de l'appli). */
export function chargerBibliothequeBase() {
  promesse ??= import('./symboles-base.json').then((m) => m.default.symboles).catch(() => []);
  return promesse;
}

/**
 * Entrées proposées dans le panneau : les symboles non cachés, plus les « objets » composés : grue à tour, grue
 * automontante (flèche et châssis réglables) et base-vie à étage. Renvoie [{ cle, nom, categorie, largeur, hauteur,
 * pose : { type, … } (ce que l'outil pose), symbole (pour la vignette) }].
 */
export function entreesBibliotheque(bib) {
  const res = [];
  const grue = (modele, nom) => {
    const s = bib.filter((x) => x.modele === modele).sort((a, b) => a.fleche - b.fleche);
    if (!s.length) return;
    const milieu = s[Math.floor(s.length / 2)];
    res.push({ cle: `grue:${modele}`, nom, categorie: 'Grues', largeur: null, hauteur: null, detail: `flèche ${s[0].fleche}–${s[s.length - 1].fleche} m`, pose: { type: 'grue', modele, fleche: milieu.fleche, chassis: modele === 'auto' ? '4.20' : '4.50', rayon: true }, symbole: milieu });
  };
  grue('tour', 'Grue à tour');
  grue('auto', 'Grue automontante');
  // 0.293.0 : grue mobile dynamique (4 tailles au choix dans le panneau, tourelle et flèche réglables).
  res.push({ cle: 'grue:mobile', nom: 'Grue mobile (camion grue)', categorie: 'Grues', largeur: null, hauteur: null, detail: '40 / 100 / 200 / 350 t, tourelle et flèche réglables', pose: { type: 'grue', modele: 'mobile', tonnes: 100, fleche: 25, tourelle: 0, stabilisateurs: true, rayon: false }, symbole: grueMobile({ tonnes: 100, fleche: 25, tourelle: 0 }) });
  // 0.311.0 : une entrée par modèle de grue d'après fiche technique (Liebherr, Condecta, ceux de l'utilisateur) : flèche, tour, HSC, charges.
  for (const m of tousLesModeles()) {
    const milieu = m.fleches[Math.floor(m.fleches.length / 2)].nom;
    const pose = { type: 'grue', modele: 'fiche', modeleGrue: m.id, fleche: milieu, tour: m.tours[0].id, hauteur: 30, cercles: 'principaux', rayon: true };
    res.push({ cle: `grue:fiche:${m.id}`, nom: `Grue ${m.nom} (fiche technique)`, categorie: 'Grues', largeur: null, hauteur: null, detail: `${m.fleches.length} flèches, ${m.tours.length} tour(s), HSC et charges de la fiche`, pose, symbole: grueFiche(pose) });
  }
  // 0.293.0 : panneau de déviation suisse, texte et sens au choix (dans le panneau de droite une fois posé).
  res.push({ cle: CLE_DEVIATION, nom: 'Panneau de déviation (texte, sens)', categorie: 'Signalisation', largeur: null, hauteur: null, detail: 'texte modifiable, flèche à gauche / droite / tout droit', pose: { type: 'symbole', cle: CLE_DEVIATION, texte: 'Lugano', sens: 'droite' }, symbole: panneauDeviation({ texte: 'Lugano', sens: 'droite' }) });
  // 0.297.0 : places de parking réservées, nombre de places et couleur au choix (dans le bandeau une fois posé)
  res.push({ cle: CLE_PARKING, nom: 'Parking réservé (places, couleur)', categorie: 'Base-vie', largeur: null, hauteur: null, detail: 'nombre de places côte à côte, couleur', pose: { type: 'symbole', cle: CLE_PARKING, nombre: 1, couleur: '#1f5fae' }, symbole: parkingDynamique({ nombre: 2, couleur: '#1f5fae' }) });
  // 0.320.2 : portail réglable (largeur de passage) et portillon à 1 vantail ; les anciens portails fixes restent pour les anciens plans
  res.push({ cle: CLE_PORTAIL, nom: 'Portail (largeur de passage)', categorie: 'Sécurité', largeur: null, hauteur: null, detail: '2 vantaux ou coulissant, passage au choix', pose: { type: 'symbole', cle: CLE_PORTAIL, genre: 'portail', passage: PASSAGE_PORTAIL.portail.depart }, symbole: portailDynamique({ genre: 'portail', passage: 5 }) });
  res.push({ cle: 'dyn:portillon', nom: 'Portillon (1 vantail)', categorie: 'Sécurité', largeur: null, hauteur: null, detail: 'une porte, passage au choix', pose: { type: 'symbole', cle: CLE_PORTAIL, genre: 'portillon', passage: PASSAGE_PORTAIL.portillon.depart }, symbole: portailDynamique({ genre: 'portillon', passage: 1 }) });
  // 0.305.0 : camion pompe à béton réglable (mât plié / déplié, longueur, rotation du mât).
  res.push({ cle: CLE_POMPE, nom: 'Camion pompe à béton (mât réglable)', categorie: 'Véhicules', largeur: null, hauteur: null, detail: 'mât plié / déplié, longueur et rotation', pose: { type: 'symbole', cle: CLE_POMPE, deploye: true, longueur: 28, tourelle: 0 }, symbole: pompeDynamique({ deploye: true, longueur: 28 }) });
  const conteneur = bib.find((x) => x.cle === CLE_CONTENEUR);
  if (conteneur && bib.some((x) => x.cle === CLE_ESCALIER)) {
    res.push({ cle: 'etage', nom: 'Base-vie à étage', categorie: 'Base-vie', largeur: conteneur.largeur, hauteur: conteneur.hauteur, detail: '8 poses de l\'escalier', pose: { type: 'symbole', cle: CLE_CONTENEUR, etage: { pose: 0, textes: ['1er', 'Rez'] } }, symbole: { ...conteneur, etageDemo: true } });
  }
  for (const s of bib) {
    if (s.cache || s.nom === 'Portail' || s.nom === 'Portail coulissant') continue; // remplacés par le portail réglable
    res.push({ cle: s.cle, nom: s.nom, categorie: s.categorie, largeur: s.largeur, hauteur: s.hauteur, pose: { type: 'symbole', cle: s.cle }, symbole: s, importe: s.cle.startsWith('projet:') });
  }
  return res;
}

/** Filtre des entrées : catégorie ('' = toutes) et recherche dans le nom (sans accents ni majuscules). */
export function filtrerEntrees(entrees, categorie = '', recherche = '') {
  const simple = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const mots = simple(recherche).split(/\s+/).filter(Boolean);
  // 0.307.0 : rangés par type (ordre des catégories) puis par ordre alphabétique.
  const rang = (c) => {
    const i = CATEGORIES_SYMBOLES.indexOf(c);
    return i < 0 ? CATEGORIES_SYMBOLES.length : i;
  };
  return entrees
    .filter((x) => (!categorie || x.categorie === categorie) && mots.every((m) => simple(x.nom).includes(m)))
    .sort((a, b) => rang(a.categorie) - rang(b.categorie) || String(a.categorie ?? '').localeCompare(String(b.categorie ?? ''), 'fr') || a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base', numeric: true }));
}

export { CATEGORIES_SYMBOLES };

/**
 * Lit un DXF de blocs (octets) et en fait des symboles pour le projet (clés « projet:nom »). Renvoie { symboles, erreur }.
 * Le style moderne est ajouté à l'import (même traitement que la bibliothèque livrée).
 */
export function symbolesDuDxf(octets) {
  const { blocs, erreur } = lireBlocsDxf(texteDuDxf(octets));
  if (erreur) return { symboles: [], erreur };
  return { symboles: bibliothequeDepuisBlocs(blocs, 'projet:'), erreur: null };
}

/** Ajoute des symboles importés au projet : un symbole du même nom est remplacé. Renvoie { ajoutes, remplaces }. */
export function ajouterSymbolesProjet(projet, symboles) {
  projet.symboles ??= [];
  let remplaces = 0;
  for (const s of symboles) {
    const i = projet.symboles.findIndex((x) => x.cle === s.cle);
    if (i >= 0) {
      projet.symboles[i] = s;
      remplaces += 1;
    } else projet.symboles.push(s);
  }
  return { ajoutes: symboles.length - remplaces, remplaces };
}
