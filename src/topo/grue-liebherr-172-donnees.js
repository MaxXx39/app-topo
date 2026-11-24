// Grue à tour Liebherr 172 EC-B 8 Litronic (EN 14439:2009 – C25) : données de la fiche technique du constructeur
// (TCS-001859-LBC-01, 2025-02, reçue de l'utilisateur le 24.11 ; le PDF n'est PAS dans le dépôt).
// Tout ce fichier est recopié de la fiche : rien n'est calculé ni deviné ici. Les contrôles faits à l'extraction :
//  - somme des longueurs des éléments de flèche − 0,4 m = nom de la flèche (16 flèches) ;
//  - dernière valeur du tableau de charge = charge en bout de flèche du dessin de la page 4 (LM 1 et LM 2) ;
//  - charge totale des contrepoids = 2,5 t × A + 1,6 t × B + 0,55 t × E.
// Les nombres sont en m, t ou kg selon la colonne ; point décimal.

/** Éléments de flèche (numéros ①–⑨ de la fiche) : longueur nominale du dessin (p. 4), longueur réelle et poids (p. 13). */
export const ELEMENTS_FLECHE = {
  1: { nom: 11.7, reel: 11.95, kg: 3700, titre: 'Pied de flèche avec chariot et crochet' },
  2: { nom: 5.6, reel: 5.84, kg: 920, titre: 'Élément intermédiaire' },
  3: { nom: 11.7, reel: 11.92, kg: 1580, titre: 'Élément intermédiaire' },
  4: { nom: 5.0, reel: 5.21, kg: 590, titre: 'Élément intermédiaire' },
  5: { nom: 2.5, reel: 2.72, kg: 360, titre: 'Élément intermédiaire' },
  6: { nom: 10.0, reel: 10.2, kg: 920, titre: 'Élément intermédiaire' },
  7: { nom: 10.0, reel: 10.2, kg: 630, titre: 'Élément intermédiaire' },
  8: { nom: 5.0, reel: 5.17, kg: 300, titre: 'Élément intermédiaire' },
  9: { nom: 1.4, reel: 1.48, kg: 160, titre: 'Pointe de flèche' },
};

/** Largeurs (m) des pièces vues de dessus (page 12–13, « B »). */
export const DIMENSIONS = {
  flecheLargeur: 1.2, // éléments de flèche (B)
  piedFlecheLargeur: 1.51, // élément ① avec chariot (B)
  pointeLargeur: 1.39, // pointe de flèche (B)
  plateforme: { l: 5.52, b: 2.32 }, // plate-forme tournante avec passerelles (L × B)
  cabine: { l: 2.4, b: 2.09 },
  armoire: { l: 2.31, b: 2.02 },
  contreFleche: { l: 13.5, b: 2.3 },
  debutFleche: 1.06, // m entre l'axe de la tour et le début de la flèche (cotes 1,03 / 1,06 m de la page 4)
  arriereTotal: 14.5, // m entre l'axe et l'arrière des contrepoids (cote de la page 4)
  contreFlecheArriere: 13.4, // m entre l'axe et le bout de la contre-flèche (cote de la page 4)
};

/** Contrepoids : A, B, E (page 11). Dimensions en m, poids en t. */
export const BLOCS = {
  A: { t: 2.5, haut: 3.15, long: 1.18, ep: 0.28, couleur: '#5b87a8' },
  B: { t: 1.6, haut: 2.0, long: 1.18, ep: 0.28, couleur: '#1ea872' },
  E: { t: 0.55, haut: 0.675, long: 1.18, ep: 0.28, couleur: '#6b7280' },
};

/**
 * Les 16 longueurs de flèche. nom = longueur nominale (m) ; rMax = portée maximale (« r » du tableau, pointe de flèche) ;
 * rMin / rPlein = zone où la charge maximale (8 t) est levée (2,6 – rPlein) ; sections = éléments ①–⑨ dans l'ordre ;
 * lm1 / lm2 = tableaux de charge [[rayon du crochet m, charge t], …] ; contrepoids = { t, blocs } du treuil 24 kW FU.
 * LM 2 = « vitesses et conditions de fonctionnement différentes » (sens exact à confirmer) : seulement de 40,0 à 62,5 m.
 */
export const FLECHES = [
  { nom: 24.4, rMax: 25.9, rMin: 2.6, rPlein: 22.9, sections: [1,3,9], lm1: [[16.0,8],[18.0,8],[22.0,8],[24.4,7.45]], contrepoids: { t: 7.5, blocs: ["A","A","A"] } },
  { nom: 26.9, rMax: 28.4, rMin: 2.6, rPlein: 22.9, sections: [1,3,5,9], lm1: [[16.0,8],[18.0,8],[22.0,8],[24.4,7.46],[26.9,6.7]], contrepoids: { t: 8.6, blocs: ["A","A","A","E","E"] } },
  { nom: 30, rMax: 31.5, rMin: 2.6, rPlein: 22.9, sections: [1,2,3,9], lm1: [[16.0,8],[18.0,8],[22.0,8],[24.4,7.47],[26.9,6.71],[30.0,5.95]], contrepoids: { t: 9.65, blocs: ["A","A","A","B","E"] } },
  { nom: 32.5, rMax: 34, rMin: 2.6, rPlein: 22.9, sections: [1,2,3,5,9], lm1: [[16.0,8],[18.0,8],[22.0,8],[24.4,7.48],[26.9,6.73],[30.0,5.96],[32.5,5.45]], contrepoids: { t: 10.55, blocs: ["A","A","A","A","E"] } },
  { nom: 35, rMax: 36.5, rMin: 2.6, rPlein: 22.9, sections: [1,2,3,4,9], lm1: [[16.0,8],[18.0,8],[22.0,8],[24.4,7.47],[26.9,6.71],[30.0,5.95],[32.5,5.44],[35.0,5]], contrepoids: { t: 11.1, blocs: ["A","A","A","A","E","E"] } },
  { nom: 37.5, rMax: 39, rMin: 2.6, rPlein: 23, sections: [1,2,3,4,5,9], lm1: [[16.0,8],[18.0,8],[22.0,8],[24.4,7.51],[26.9,6.75],[30.0,5.99],[32.5,5.47],[35.0,5.03],[37.5,4.65]], contrepoids: { t: 12.15, blocs: ["A","A","A","A","B","E"] } },
  { nom: 40, rMax: 41.5, rMin: 2.6, rPlein: 23, sections: [1,2,3,6,9], lm1: [[16.0,8],[18.0,8],[22.0,8],[24.4,7.49],[26.9,6.73],[30.0,5.97],[32.5,5.45],[35.0,5.01],[37.5,4.63],[40.0,4.3]], rPlein2: 24.3, lm2: [[16.0,8],[19.0,8],[22.0,8],[25.0,7.77],[28.0,6.87],[31.0,6.14],[34.0,5.54],[37.0,5.03],[40.0,4.6]], contrepoids: { t: 12.15, blocs: ["A","A","A","A","B","E"] } },
  { nom: 42.5, rMax: 44, rMin: 2.6, rPlein: 22.4, sections: [1,2,3,5,6,9], lm1: [[16.0,8],[18.0,8],[22.0,8],[24.4,7.31],[26.9,6.56],[30.0,5.82],[32.5,5.32],[35.0,4.89],[37.5,4.51],[40.0,4.19],[42.5,3.9]], rPlein2: 23.7, lm2: [[16.0,8],[19.0,8],[22.0,8],[25.0,7.54],[28.0,6.66],[31.0,5.95],[34.0,5.36],[37.0,4.87],[40.0,4.45],[42.5,4.15]], contrepoids: { t: 13.05, blocs: ["A","A","A","A","A","E"] } },
  { nom: 45, rMax: 46.5, rMin: 2.6, rPlein: 22.5, sections: [1,2,3,4,6,9], lm1: [[16.0,8],[18.0,8],[22.0,8],[24.4,7.32],[26.9,6.57],[30.0,5.82],[32.5,5.32],[35.0,4.89],[37.5,4.52],[40.0,4.2],[42.5,3.91],[45.0,3.65]], rPlein2: 23.8, lm2: [[16.0,8],[19.0,8],[22.0,8],[25.0,7.57],[28.0,6.69],[31.0,5.98],[34.0,5.39],[37.0,4.9],[40.0,4.48],[42.5,4.17],[45.0,3.9]], contrepoids: { t: 13.75, blocs: ["A","A","A","A","B","B","E"] } },
  { nom: 47.5, rMax: 49, rMin: 2.6, rPlein: 21.5, sections: [1,2,3,4,5,6,9], lm1: [[16.0,8],[18.0,8],[22.0,7.82],[24.4,6.99],[26.9,6.27],[30.0,5.56],[32.5,5.08],[35.0,4.66],[37.5,4.31],[40.0,3.99],[42.5,3.72],[45.0,3.47],[47.5,3.25]], rPlein2: 22.9, lm2: [[16.0,8],[19.0,8],[22.0,8],[25.0,7.28],[28.0,6.42],[31.0,5.74],[34.0,5.17],[37.0,4.69],[40.0,4.29],[42.5,4],[45.0,3.73],[47.5,3.5]], contrepoids: { t: 14.65, blocs: ["A","A","A","A","A","B","E"] } },
  { nom: 50, rMax: 51.5, rMin: 2.6, rPlein: 21.5, sections: [1,2,3,6,7,9], lm1: [[16.0,8],[18.0,8],[22.0,7.82],[24.4,6.98],[26.9,6.27],[30.0,5.55],[32.5,5.07],[35.0,4.66],[37.5,4.3],[40.0,3.99],[42.5,3.71],[45.0,3.47],[47.5,3.25],[50.0,3.05]], rPlein2: 23, lm2: [[16.0,8],[19.0,8],[22.0,8],[25.0,7.3],[28.0,6.44],[31.0,5.75],[34.0,5.19],[37.0,4.71],[40.0,4.3],[42.5,4.01],[45.0,3.75],[47.5,3.51],[50.0,3.3]], contrepoids: { t: 13.75, blocs: ["A","A","A","A","B","B","E"] } },
  { nom: 52.5, rMax: 54, rMin: 2.6, rPlein: 20.2, sections: [1,2,3,5,6,7,9], lm1: [[16.0,8],[18.0,8],[22.0,7.29],[24.4,6.51],[26.9,5.84],[30.0,5.17],[32.5,4.72],[35.0,4.33],[37.5,3.99],[40.0,3.7],[42.5,3.44],[45.0,3.21],[47.5,3],[50.0,2.82],[52.5,2.65]], rPlein2: 21.4, lm2: [[16.0,8],[19.0,8],[22.0,7.77],[25.0,6.76],[28.0,5.96],[31.0,5.32],[34.0,4.79],[37.0,4.34],[40.0,3.96],[42.5,3.69],[45.0,3.44],[47.5,3.23],[50.0,3.03],[52.5,2.85]], contrepoids: { t: 14.65, blocs: ["A","A","A","A","A","B","E"] } },
  { nom: 55, rMax: 56.5, rMin: 2.6, rPlein: 20.2, sections: [1,2,3,4,6,7,9], lm1: [[16.0,8],[18.0,8],[22.0,7.3],[24.4,6.52],[26.9,5.85],[30.0,5.17],[32.5,4.72],[35.0,4.33],[37.5,4],[40.0,3.71],[42.5,3.45],[45.0,3.21],[47.5,3.01],[50.0,2.82],[52.5,2.65],[55.0,2.5]], rPlein2: 21.5, lm2: [[16.0,8],[19.0,8],[22.0,7.8],[25.0,6.78],[28.0,5.98],[31.0,5.34],[34.0,4.81],[37.0,4.36],[40.0,3.98],[42.5,3.7],[45.0,3.46],[47.5,3.24],[50.0,3.04],[52.5,2.86],[55.0,2.7]], contrepoids: { t: 15.55, blocs: ["A","A","A","A","A","A","E"] } },
  { nom: 57.5, rMax: 59, rMin: 2.6, rPlein: 17.8, sections: [1,2,3,4,5,6,7,9], lm1: [[16.0,8],[18.0,7.92],[22.0,6.36],[24.4,5.67],[26.9,5.08],[30.0,4.49],[32.5,4.09],[35.0,3.74],[37.5,3.45],[40.0,3.19],[42.5,2.96],[45.0,2.76],[47.5,2.57],[50.0,2.41],[52.5,2.26],[55.0,2.12],[57.5,2]], rPlein2: 19.2, lm2: [[16.0,8],[19.0,8],[22.0,6.88],[25.0,5.98],[28.0,5.26],[31.0,4.69],[34.0,4.21],[37.0,3.81],[40.0,3.48],[42.5,3.23],[45.0,3.01],[47.5,2.81],[50.0,2.64],[52.5,2.48],[55.0,2.33],[57.5,2.2]], contrepoids: { t: 16.6, blocs: ["A","A","A","A","A","A","B"] } },
  { nom: 60, rMax: 61.5, rMin: 2.6, rPlein: 17.9, sections: [1,2,3,4,6,7,8,9], lm1: [[16.0,8],[18.0,7.97],[22.0,6.4],[24.4,5.7],[26.9,5.11],[30.0,4.51],[32.5,4.11],[35.0,3.77],[37.5,3.47],[40.0,3.21],[42.5,2.98],[45.0,2.77],[47.5,2.59],[50.0,2.42],[52.5,2.27],[55.0,2.14],[57.5,2.01],[60.0,1.9]], rPlein2: 19.3, lm2: [[16.0,8],[19.0,8],[22.0,6.94],[25.0,6.03],[28.0,5.31],[31.0,4.73],[34.0,4.25],[37.0,3.85],[40.0,3.51],[42.5,3.26],[45.0,3.04],[47.5,2.84],[50.0,2.66],[52.5,2.5],[55.0,2.36],[57.5,2.22],[60.0,2.1]], contrepoids: { t: 16.6, blocs: ["A","A","A","A","A","A","B"] } },
  { nom: 62.5, rMax: 64, rMin: 2.6, rPlein: 16.5, sections: [1,2,3,4,5,6,7,8,9], lm1: [[16.0,8],[18.0,7.29],[22.0,5.85],[24.4,5.21],[26.9,4.66],[30.0,4.11],[32.5,3.74],[35.0,3.42],[37.5,3.15],[40.0,2.9],[42.5,2.69],[45.0,2.5],[47.5,2.33],[50.0,2.18],[52.5,2.04],[55.0,1.92],[57.5,1.8],[60.0,1.7],[62.5,1.6]], rPlein2: 18, lm2: [[16.0,8],[19.0,7.53],[22.0,6.41],[25.0,5.56],[28.0,4.89],[31.0,4.35],[34.0,3.91],[37.0,3.53],[40.0,3.22],[42.5,2.99],[45.0,2.78],[47.5,2.6],[50.0,2.43],[52.5,2.28],[55.0,2.14],[57.5,2.02],[60.0,1.91],[62.5,1.8]], contrepoids: { t: 17.5, blocs: ["A","A","A","A","A","A","A"] } },
];

/** Mécanismes (page 10). */
export const TREUILS = {
  24: { nom: '24 kW FU', modele: 'WIW 230 MZ 427', kva: 35, cable: 113, couches: 4, vitesses: [[8, '0–16'], [0.5, '0–86']] },
  45: { nom: '45 kW FU', modele: 'WIW 260 MZ 423', kva: 54, cable: 179, couches: 6, vitesses: [[8, '0–29'], [0.58, '0–174']] },
};
export const MECANISMES = { orientation: '0–0,8 tr/min (7,5 kW FU)', chariot: '0–100 m/min (5,5 kW FU)', translation: '25 m/min' };

/** Les hauteurs de la fiche ne valent que jusqu'à cette hauteur sous crochet (note de la page 4). */
export const HAUTEUR_CHARGES_MAX = 50;

// ---------------------------------------------------------------- Tours et pieds : hauteurs sous crochet (pages 7 à 9)
// Chaque ligne = [étiquette de la fiche, hauteur sous crochet m, options] ; options : etoile (repère « *) » de la fiche,
// pictogramme dont le sens n'est pas expliqué), speciaux (éléments de mât spéciaux demandés), suspect (valeur qui semble
// fausse dans la fiche, gardée telle qu'imprimée).
const A = '1 × TST-0390c';
const E16 = ['0', '1', '0+1', '2', '1+1', '3', '2+1', '4', '3+1', '5', '4+1', '6', '5+1', '7', '6+1', '8', '7+1', '9', '8+1', '10', '9+1', '11', '10+1', '12', '11+1', '13'];
const sp = (a, b) => `${A}${b ? ` + ${b} × TS-0390c` : ''}`;
const lignes = (etiquettes, valeurs) => etiquettes.map((e, i) => valeurs[i] === null || valeurs[i] === undefined ? null : (Array.isArray(valeurs[i]) ? [e, ...valeurs[i]] : [e, valeurs[i]])).filter(Boolean);
const E = (h, extra = {}) => [h, { etoile: true, ...extra }];

const EC_BAS = [3.8, 5.8, 7.7, 9.7, 11.6, 13.6, 15.5, 17.5, 19.4, 21.4, 23.3, 25.3, 27.2, 29.2, 31.1, E(33.0), E(35.0)];
const EC_HAUT = [E(37.0, { speciaux: sp(1, 0) }), E(38.9, { speciaux: sp(1, 1) }), E(40.8, { speciaux: sp(1, 2) }), E(42.8, { speciaux: sp(1, 2) }), E(44.8, { speciaux: sp(1, 3) }), E(46.7, { speciaux: sp(1, 4) }), E(48.7, { speciaux: sp(1, 5) }), E(50.6, { speciaux: sp(1, 6) }), E(52.5, { speciaux: sp(1, 6) })];
const CB380 = [4.7, 6.6, 8.6, 10.5, 12.5, 14.4, 16.4, 18.3, 20.3, 22.2, 24.2, 26.1, 28.1, 30.0, 32.0, E(33.9), E(35.9)];
const CB450_BAS = [5.6, 7.5, 9.4, 11.3, 13.2, 15.1, 17.0, 18.9, 20.8, 22.7, 24.6, 26.5, 28.4, 30.3, 32.2, E(34.2), E(36.1)];
const CB450_HAUT = [E(38.1, { speciaux: sp(1, 0) }), E(40.0, { speciaux: sp(1, 1) }), E(42.0, { speciaux: sp(1, 2) }), E(43.9, { speciaux: sp(1, 2) }), E(45.9, { speciaux: sp(1, 3) }), E(47.8, { speciaux: sp(1, 4) }), E(49.8, { speciaux: sp(1, 5) }), E(51.7, { speciaux: sp(1, 6) }), E(53.7, { speciaux: sp(1, 6) })];

const n = (max) => Array.from({ length: max + 1 }, (_, i) => String(i));

/**
 * Configurations de tour : id, nom, famille, mat (largeur du mât, m), pied { type : 'FA' ancrage fixe | 'UC' châssis
 * roulant | 'CB' croix de fondation, c : côté en m du carré d'appui (ex. UC-0460 = 4,60 m) }, element (hauteur d'un
 * élément de mât, m), hauteurs [[étiquette, h, options]].
 */
export const TOURS = [
  { id: 'ec160-fa', nom: '16 EC 160 · FA (ancrage fixe)', famille: '16 EC', mat: 1.68, pied: { type: 'FA' }, element: 3.9, hauteurs: lignes(E16, [...EC_BAS]) },
  { id: 'ec300-fa', nom: '20 EC 300 · FA (ancrage fixe)', famille: '16 EC', mat: 1.68, pied: { type: 'FA' }, element: 3.9, hauteurs: lignes(E16, [...EC_BAS, ...EC_HAUT]) },
  { id: 'ec160-cb380', nom: '16 EC 160 · CB-0380m (croix 3,80 m)', famille: '16 EC', mat: 1.68, pied: { type: 'CB', c: 3.8 }, element: 3.9, hauteurs: lignes(E16, [...CB380]) },
  { id: 'ec300-cb450', nom: '20 EC 300 · CB-0450m (croix 4,50 m)', famille: '16 EC', mat: 1.68, pied: { type: 'CB', c: 4.5 }, element: 3.9, hauteurs: lignes(E16, [...CB450_BAS, ...CB450_HAUT]) },
  { id: 'hc175-uc460m', nom: '16 HC 175 · UC-0460m (châssis 4,60 m)', famille: '16 HC 175', mat: 1.8, pied: { type: 'UC', c: 4.6 }, element: 2.5, hauteurs: lignes(n(11), [14.8, 17.3, 19.8, 22.3, 24.8, 27.3, 29.8, 32.3, 34.8, 37.3, E(39.8), E(42.3)]) },
  { id: 'hc175-uc460m-b', nom: '16 HC 175 · UC-0460m (variante 2, châssis 4,0 m)', famille: '16 HC 175', mat: 1.8, pied: { type: 'UC', c: 4.6 }, element: 2.5, hauteurs: lignes(n(11), [14.3, 16.8, 19.3, 21.8, 24.3, 26.8, 29.3, 31.8, 34.3, 36.8, E(39.3), E(41.8)]) },
  { id: 'hc175-uc460mr', nom: '16 HC 175 · UC-0460mr (renforcé)', famille: '16 HC 175', mat: 1.8, pied: { type: 'UC', c: 4.6 }, element: 2.5, hauteurs: lignes(n(11), [24.8, 27.3, 29.8, 32.3, 34.8, 37.3, 39.8, E(42.3), E(44.8)]) },
  { id: 'hc175-uc460mr-b', nom: '16 HC 175 · UC-0460mr (variante 2, châssis 4,0 m)', famille: '16 HC 175', mat: 1.8, pied: { type: 'UC', c: 4.6 }, element: 2.5, hauteurs: lignes(n(11), [24.3, 26.8, 29.3, 31.8, 34.3, 36.8, 39.3, 41.8, 44.3, E(46.8), E(49.3)]) },
  { id: 'hc175-far', nom: '16 HC 175 · FAr (ancrage fixe renforcé)', famille: '16 HC 175', mat: 1.8, pied: { type: 'FA' }, element: 2.5, hauteurs: lignes(n(11), [10.5, 13.0, 15.5, 18.0, 20.5, 23.0, 25.5, 28.0, 30.5, 33.0, E(35.5), E(38.0)]) },
  { id: 'hc175-far-b', nom: '16 HC 175 · FAr (variante 2, mât TSB r)', famille: '16 HC 175', mat: 1.8, pied: { type: 'FA' }, element: 2.5, hauteurs: lignes(n(11), [20.5, 23.0, 25.5, 28.0, 30.5, 33.0, 35.5, 38.0, 40.5, E(43.0), E(45.5)]) },
  { id: 'hc175-cb460r', nom: '16 HC 175 · CB-0460r (croix 4,60 m)', famille: '16 HC 175', mat: 1.8, pied: { type: 'CB', c: 4.6 }, element: 2.5, hauteurs: lignes(n(11), [21.9, 24.4, 26.9, 29.4, 31.9, 34.4, 36.9, 39.4, 41.9, E(44.4), E(46.9)]) },
  { id: 'hc200-far', nom: '17 HC 200 · FAr (légende de la fiche : « 21 HC 290 FAr »)', famille: '17 HC 200', mat: 1.9, pied: { type: 'FA' }, element: 4.14, hauteurs: lignes(n(9), [11.8, 15.9, 20.1, 24.2, 28.4, 32.5, 36.6, 40.8, E(44.9), E(49.1)]) },
  { id: 'hc200-far-b', nom: '17 HC 200 · FAr (variante 2, mât TSB r ; légende de la fiche : « 21 HC 290 FAr »)', famille: '17 HC 200', mat: 1.9, pied: { type: 'FA' }, element: 4.14, hauteurs: lignes(n(9), [21.4, 25.5, 29.7, 33.8, 38.0, 42.1, 46.2, E(50.4), E(54.5)]) },
  { id: 'hc200-uc460r', nom: '17 HC 200 · UC-0460r (châssis 4,60 m)', famille: '17 HC 200', mat: 1.9, pied: { type: 'UC', c: 4.6 }, element: 4.14, hauteurs: lignes(n(9), [15.8, 20.0, 24.1, 28.3, 32.4, 36.5, E(40.7), E(44.8)]) },
  { id: 'hc200-cb450', nom: '17 HC 200 · CB (légende de la fiche : « 21 HC 290 CB-0450 »)', famille: '17 HC 200', mat: 1.9, pied: { type: 'CB', c: 4.5 }, element: 4.14, hauteurs: lignes(n(9), [22.8, 27.0, 31.1, 35.3, 39.4, 43.5, 47.7, E(51.8), E(56.0, { etoile2: true })]) },
  { id: 'hc290-far', nom: '21 HC 290 · FAr (ancrage fixe renforcé)', famille: '21 HC 290', mat: 2.3, pied: { type: 'FA' }, element: 4.14, hauteurs: lignes(n(12), [13.4, 17.6, 21.7, 25.8, 30.0, 34.1, 38.3, 42.4, 46.5, 50.7, 54.8, E(59.0), E(63.1)]) },
  { id: 'hc290-far-b', nom: '21 HC 290 · FAr (variante 2, mât TSB r)', famille: '21 HC 290', mat: 2.3, pied: { type: 'FA' }, element: 4.14, hauteurs: lignes(n(12), [[25.8, { suspect: true }], [25.5, { suspect: true }], 34.1, 38.3, 42.4, 46.5, 50.7, 54.8, 59.0, 63.1, 67.2, E(71.4)]) },
  { id: 'hc290-uc600', nom: '21 HC 290 · UC-0600 (châssis 6,0 m)', famille: '21 HC 290', mat: 2.3, pied: { type: 'UC', c: 6.0 }, element: 4.14, hauteurs: lignes(n(12), [18.1, 22.3, 26.4, 30.5, 34.7, 38.8, 43.0, 47.1, 51.2, 55.4, E(59.5)]) },
  { id: 'hc290-uc800', nom: '21 HC 290 · UC-0800 (châssis 8,0 m)', famille: '21 HC 290', mat: 2.3, pied: { type: 'UC', c: 8.0 }, element: 4.14, hauteurs: lignes(n(12), [21.0, 25.1, 29.2, 33.4, 37.5, 41.7, 45.8, 49.9, 54.1, E(58.2), E(62.4), E(66.5, { etoile2: true })]) },
];
