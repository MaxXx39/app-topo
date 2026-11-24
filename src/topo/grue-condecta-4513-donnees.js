// Grue à montage rapide (automontante) Condecta EURO 4513 : données de la fiche technique du constructeur
// (« Schnelleinsatzkran EURO 4513 », 2.17/2000, reçue de l'utilisateur le 24.11 ; le PDF n'est PAS dans le dépôt).
// Les tableaux de charge de la fiche donnent, pour chaque charge, la portée maximale : on les range en paires
// [portée en m, charge en t] (« jusqu'à cette portée, cette charge »). Les charges de la fiche sont en kg : ici en t.
// Les cotes de la fiche ne donnent pas la largeur de la flèche, du mât ni de la contre-flèche : valeurs ESTIMÉES (liste `estimes`).
const paires = (kg, m) => kg.map((c, i) => [m[i], c / 1000]);
const KG_A = [6000, 5800, 5600, 5400, 5200, 5000, 4800, 4600, 4400, 4200, 4000, 3800, 3600, 3400, 3200];

export const MODELE_CONDECTA = {
  id: 'condecta-euro-4513',
  integre: true,
  nom: 'Condecta EURO 4513',
  fabricant: 'Condecta',
  type: 'automontante',
  notes: 'Fiche technique Condecta EURO 4513 (2.17/2000). Largeurs de flèche, de mât et de contre-flèche non données : estimées, à corriger si besoin.',
  estimes: ['flecheLargeur', 'contreFlecheLargeur', 'flecheDebut', 'mat'],
  dim: {
    flecheLargeur: 0.9, flecheDebut: 0, flecheProfondeur: 0.7, flecheAuDessusHsc: 2.0, teteAuDessusFleche: 3.3,
    contreFlecheArriere: 2.75, contreFlecheLargeur: 1.0, plateforme: null, cabine: null, treuil: null, arriereTotal: 2.75,
  },
  infos: [
    ['Poids de la grue', '19,7 t'],
    ['Contrepoids', '32,81 t (HSC 18 à 27 m), 34,74 t (HSC 30 m)'],
    ['Pression d\'angle', 'max. 34 t'],
    ['Puissance totale des moteurs', '26 kW'],
    ['Rayon de giration arrière', '2,75 m'],
  ],
  fleches: [
    { nom: 28, rMax: 28, charges: paires([...KG_A, 3000], [15.54, 15.99, 16.46, 16.97, 17.52, 18.11, 18.75, 19.44, 20.18, 21.00, 21.89, 22.87, 23.95, 25.15, 26.49, 28.00]) },
    { nom: 35, rMax: 35, charges: paires([...KG_A, 3000, 2800, 2600, 2400, 2200, 2050], [14.17, 14.57, 15.00, 15.46, 15.95, 16.48, 17.05, 17.67, 18.34, 19.08, 19.88, 20.76, 21.73, 22.81, 24.01, 25.36, 26.89, 28.64, 30.64, 32.98, 35.00]) },
    { nom: 40, rMax: 40, charges: paires([...KG_A, 3000, 2800, 2600, 2400, 2200, 2000, 1800, 1600], [13.28, 13.65, 14.05, 14.47, 14.93, 15.42, 15.95, 16.52, 17.14, 17.82, 18.56, 19.38, 20.28, 21.28, 22.39, 23.65, 25.06, 26.68, 28.54, 30.70, 33.25, 36.29, 40.00]) },
    { nom: 43, rMax: 43, charges: paires([...KG_A, 3000, 2800, 2600, 2400, 2200, 2000, 1800, 1600, 1400, 1350], [12.53, 12.87, 13.25, 13.64, 14.07, 14.53, 15.02, 15.55, 16.14, 16.77, 17.46, 18.22, 19.06, 20.00, 21.04, 22.21, 23.53, 25.04, 26.77, 28.79, 31.17, 34.01, 37.46, 41.75, 43.00]) },
    { nom: 45, rMax: 45, charges: paires([...KG_A, 3000, 2800, 2600, 2400, 2200, 2000, 1800, 1600, 1400, 1250], [12.35, 12.69, 13.06, 13.45, 13.87, 14.32, 14.80, 15.33, 15.90, 16.52, 17.20, 17.95, 18.78, 19.70, 20.72, 21.87, 23.17, 24.65, 26.36, 28.34, 30.68, 33.47, 36.87, 41.09, 45.00]) },
  ],
  tours: [
    {
      id: 'euro4513', nom: 'EURO 4513 · stabilisateurs 4,5 × 4,5 m', famille: 'EURO 4513', mat: 1.4, pied: { type: 'ST', c: 4.5 }, element: 3,
      hauteurs: [['18', 18, { contrepoidsT: 32.81 }], ['21', 21, { contrepoidsT: 32.81 }], ['24', 24, { contrepoidsT: 32.81 }], ['27', 27, { contrepoidsT: 32.81 }], ['30', 30, { contrepoidsT: 34.74 }]],
    },
  ],
};
