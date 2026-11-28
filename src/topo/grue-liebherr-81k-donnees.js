// Grue à montage rapide (automontante, à rotation par le bas) Liebherr 81 K.1 : données de la fiche technique du constructeur
// (« Turmdrehkran 81 K.1 », TCS-000878-LBC-01, EN 14439:2009 – C25, 04.20, reçue de l'utilisateur le 28.11 ; le PDF n'est PAS
// dans le dépôt). Tableaux de charge « LM 1 » (= Tableau 1) et « Load-Plus » (= Tableau 2 : vitesses et conditions de
// fonctionnement différentes), flèche horizontale. Charges de la fiche en kg : ici en t, en paires [portée en m, charge en t]
// (colonnes de la fiche : la charge vaut jusqu'à cette portée). rPlein = fin de la zone à 6 t (« 3,0 – 12,0 m : 6000 kg »).
// Flèche relevée à 30° : pas gérée par l'appli (tableau écrit dans les infos).
// Cotes : largeur / hauteur de la flèche et du mât d'après la liste de colisage (rallonge de flèche 0,87 × 0,84 m ; élément de
// mât 1,10 × 1,10 m). Rayon arrière = rayon du lest tournant (3,50 m avec 35 t, 2,75 m avec 40 t ; on dessine 3,50 m).
const COLONNES = [12, 15, 18, 21, 23, 25, 27, 29, 31, 33, 35, 37, 40, 42, 45, 48];
const paires = (kg) => kg.map((c, i) => [COLONNES[i], c / 1000]);

// LM 1
const LM1 = {
  48: [6000, 4620, 3730, 3110, 2790, 2530, 2300, 2110, 1940, 1800, 1670, 1550, 1410, 1320, 1200, 1100],
  45: [6000, 5220, 4230, 3540, 3180, 2890, 2640, 2420, 2230, 2070, 1920, 1800, 1630, 1530, 1400],
  42: [6000, 5570, 4520, 3790, 3410, 3090, 2820, 2590, 2400, 2220, 2070, 1930, 1750, 1650],
  37: [6000, 6000, 4930, 4150, 3740, 3400, 3110, 2870, 2650, 2460, 2300, 2150],
  31: [6000, 6000, 5370, 4520, 4080, 3710, 3400, 3130, 2900],
};
// Load-Plus
const LP = {
  48: [6000, 4830, 4030, 3440, 3120, 2860, 2630, 2430, 2260, 2110, 1970, 1850, 1690, 1590, 1460, 1350],
  45: [6000, 5360, 4500, 3870, 3530, 3240, 2990, 2770, 2580, 2410, 2260, 2130, 1950, 1840, 1700],
  42: [6000, 5640, 4710, 4030, 3670, 3370, 3100, 2870, 2670, 2500, 2340, 2200, 2010, 1900],
  37: [6000, 6000, 5040, 4310, 3930, 3600, 3320, 3070, 2860, 2670, 2500, 2350],
  31: [6000, 6000, 5470, 4720, 4320, 3980, 3690, 3430, 3200],
};
// Zone à 6 t : de 3,0 m jusqu'à …
const PLEIN = { 48: 12.0, 45: 13.3, 42: 14.1, 37: 15.1, 31: 16.3 };

const fleche = (nom) => ({ nom, rMax: nom, rMin: 3.0, rPlein: PLEIN[nom], charges: paires(LM1[nom]), charges2: paires(LP[nom]), rPlein2: PLEIN[nom] });

export const MODELE_LIEBHERR_81K = {
  id: 'liebherr-81k1',
  integre: true,
  nom: 'Liebherr 81 K.1',
  fabricant: 'Liebherr',
  type: 'automontante',
  court: '81 K.1',
  nomsTableaux: ['LM 1', 'Load-Plus'], // noms des deux tableaux de charge dans la liste « Charges »
  notes: 'Fiche technique Liebherr 81 K.1 (TCS-000878-LBC-01, 04.20). Tableau 1 = LM 1, Tableau 2 = Load-Plus (vitesses et conditions de fonctionnement différentes). HSC = hauteurs sous crochet de la page 1 (flèche horizontale), validées par l\'utilisateur le 28.11 ; rayon arrière 3,50 m (lest 35 t) retenu. Flèche relevée à 30° non gérée.',
  estimes: ['flecheDebut', 'contreFlecheLargeur', 'teteAuDessusFleche'],
  dim: {
    flecheLargeur: 0.87, flecheDebut: 0, flecheProfondeur: 0.84, flecheAuDessusHsc: 2.0, teteAuDessusFleche: 3.2,
    contreFlecheArriere: 3.5, contreFlecheLargeur: 2.5, plateforme: null, cabine: { l: 2.65, b: 2.0 }, treuil: null, arriereTotal: 3.5,
  },
  infos: [
    ['Norme', 'EN 14439:2009 – C25'],
    ['Poids de la grue', '20,3 t (sans lest)'],
    ['Lest tournant', '35 t à r = 3,50 m ou 40 t à r = 2,75 m (voir manuel de service)'],
    ['Châssis', '4,5 × 4,5 m'],
    ['Hauteur totale', 'min. 22,6 m, max. 45,6 m'],
    ['Treuil 15 kW FU', '6000 kg à 0–12,7 m/min, 400 kg à 0–76,1 m/min'],
    ['Flèche relevée à 30°', '45 m : 1,4 t à 38,6 m ; 42 m : 1,65 t à 36,0 m ; 37 m : 2,15 t à 31,7 m ; 31 m : 2,9 t à 26,5 m (3 t jusqu\'à 15,8 / 17,7 / 21,2 / 25,3 m)'],
    ['Alimentation', '380–480 V, 50/60 Hz, 22 kVA'],
  ],
  fleches: [31, 37, 42, 45, 48].map(fleche),
  tours: [
    {
      id: '81k1', nom: '81 K.1 · châssis 4,5 × 4,5 m', famille: '81 K.1', mat: 1.1, pied: { type: 'ST', c: 4.5 }, element: 2.5,
      // ↓ = montage bas (éléments 0 à 3), ↑ = montage haut (éléments 0 à 6) ; * = voir manuel de service (fiche)
      hauteurs: [['0 ↓', 17.4], ['1 ↓', 19.8], ['2 ↓', 22.2], ['3 ↓', 24.6], ['0 ↑', 26.0], ['1 ↑', 28.4], ['2 ↑', 30.8], ['3 ↑', 33.2], ['4 ↑', 35.6], ['5 ↑', 38.0], ['6 ↑', 40.4, { etoile: 'voir le manuel de service' }]],
    },
  ],
};
