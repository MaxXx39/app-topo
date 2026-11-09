// Applications de l'appli (0.156.0, demande du 08.11) : la barre du bas à 7 boutons est remplacée
// par un seul bouton « application | sous-application » en bas à gauche ; un toucher sur l'application
// ouvre la page « Applications » (bandeau du projet, puis une tuile par application).
// Ici : la liste des applications (nom, couleur, icône) et les favoris de la roue (appui long),
// retenus par tablette (clé « topo-favoris-applis »). Rien ici ne touche l'écran : tout est testé.

// Une application : cle, titre, couleur (fond du bouton), texte (couleur du texte sur ce fond),
// icone (tracé SVG 24 × 24), niveau ('intermediaire' / 'expert' : mode minimum), apk (vrai : seulement
// dans l'appli Android, avec un récepteur), site (vrai : aussi sur le site), titreSite (nom sur le site).
// 0.159.0 : Réglages n'est plus une application (bouton à part en bas de la page Applications).
export const APPLIS = [
  {
    cle: 'lever',
    titre: 'Lever',
    titreSite: 'Édition Lever',
    couleur: '#d98a00',
    texte: '#ffffff',
    site: true,
    icone: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6" /><circle cx="12" cy="12" r="2.5" />',
  },
  {
    // Recollement et Métré (0.161.0, demande du 08.11, Expert) : sortis de Lever, chacun son écran de levé.
    cle: 'recollement',
    titre: 'Recollement',
    court: 'Recoll.', // 0.172.0 : écrit ainsi en mode téléphone
    couleur: '#4d7c0f',
    texte: '#ffffff',
    site: true,
    niveau: 'expert',
    icone: '<path d="M3 8h18M3 16h18" /><circle cx="8" cy="8" r="2" /><circle cx="16" cy="16" r="2" />',
  },
  {
    cle: 'metre',
    titre: 'Métré',
    couleur: '#c2410c',
    texte: '#ffffff',
    site: true,
    niveau: 'expert',
    icone: '<path d="M3 17 17 3l4 4L7 21z" /><path d="M7 13l2 2M10 10l2 2M13 7l2 2" /><path d="M3 21h6" />',
  },
  {
    cle: 'implanter',
    titre: 'Implanter',
    couleur: '#0d9488',
    texte: '#ffffff',
    apk: true,
    icone: '<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M1 12h4M19 12h4" />',
  },
  {
    // Mesure rapide (0.158.0, dès Intermédiaire) : points touchés sur le plan ou pris au GNSS.
    cle: 'mesure',
    titre: 'Mesure rapide',
    court: 'Mesure',
    couleur: '#7c3aed',
    texte: '#ffffff',
    site: true,
    niveau: 'intermediaire',
    icone: '<path d="M3 17 17 3l4 4L7 21z" /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" />',
  },
  {
    cle: 'controle',
    titre: 'Contrôle',
    couleur: '#9b2c3a',
    texte: '#ffffff',
    site: true,
    niveauSite: 'intermediaire',
    icone: '<path d="m5 12 5 5 9-10" />',
  },
  {
    cle: 'guidage',
    titre: 'Guidage',
    couleur: '#1d4ed8',
    texte: '#ffffff',
    apk: true,
    niveau: 'expert',
    icone: '<path d="M12 4v16M6 10l6-6 6 6M6 14l6 6 6-6" />',
  },
  {
    cle: 'calculs',
    titre: 'Calculs',
    couleur: '#db2777',
    texte: '#ffffff',
    site: true,
    niveau: 'intermediaire',
    icone: '<path d="M2 19 9 7l4 6 2-3 7 9z" />',
  },
  {
    cle: 'plan',
    titre: 'Plan',
    couleur: '#475569',
    texte: '#ffffff',
    site: true,
    icone: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />',
  },
  {
    cle: 'recepteur',
    titre: 'Récepteur',
    couleur: '#0284c7',
    texte: '#ffffff',
    apk: true,
    icone: '<path d="M8.5 3.2a5 5 0 0 1 7 0M6.6 1.3a7.8 7.8 0 0 1 10.8 0" /><ellipse cx="12" cy="9" rx="6" ry="2.6" /><path d="M6 9v1.4a6 2.6 0 0 0 12 0V9M12 13v9" />',
  },
];

// Le projet n'est pas une tuile (il a son bandeau en haut de la page Applications), mais c'est
// l'application montrée par le bouton quand on est sur la page Projet.
export const APPLI_PROJET = {
  cle: 'projet',
  titre: 'Projet',
  couleur: '#1b2b36',
  texte: '#ffffff',
  icone: '<path d="M3 7h6l2 2h10v10H3z" />',
};

/** Application d'après sa clé (projet compris), ou undefined. */
export function appliDeCle(cle) {
  return cle === 'projet' ? APPLI_PROJET : APPLIS.find((a) => a.cle === cle);
}

/**
 * Applications proposées : dans l'appli Android (avecRecepteur) toutes celles permises par le mode ;
 * sur le site, seulement celles marquées « site ». aAcces('intermediaire' | 'expert') dit si le mode le permet.
 */
export function applisDisponibles({ avecRecepteur, aAcces }) {
  return APPLIS.filter((a) => {
    if (avecRecepteur ? false : !a.site) return false;
    const niveau = avecRecepteur ? a.niveau : (a.niveauSite ?? a.niveau);
    return !niveau || aAcces(niveau);
  });
}

/**
 * Application en cours d'après l'onglet affiché (document.body.dataset.onglet) et le mode de Terrain
 * ('lever', 'controler' = Implanter, 'autocontrole' = Contrôle, 'lame' = Guidage) ; familleLever : 'leve' (Stock, Terrain,
 * Libre), 'reseau' (Recollement) ou 'metre' (0.161.0).
 */
export function appliCourante(onglet, modeTerrain, familleLever = 'leve') {
  if (onglet === 'projets') return 'projet';
  if (onglet === 'plan') return 'plan';
  if (onglet === 'mesure-rapide') return 'mesure';
  if (['volumes', 'mesures', 'dessin', 'surfaces', 'calculs'].includes(onglet)) return 'calculs';
  if (onglet === 'terrain') {
    const lever = { reseau: 'recollement', metre: 'metre' }[familleLever] ?? 'lever'; // 0.161.0
    return { controler: 'implanter', autocontrole: 'controle', lame: 'guidage' }[modeTerrain] ?? lever;
  }
  return 'projet';
}

// --- Favoris de la roue (appui long sur le bouton de l'application) ---

export const CLE_FAVORIS = 'topo-favoris-applis';
export const FAVORIS_DEPART = ['lever', 'implanter', 'plan'];
export const MAX_FAVORIS = 4; // 0.159.0 : 4 au plus (demande du 08.11)

/** Favoris retenus sur cet appareil (clés d'applications connues, 5 au plus), sinon ceux de départ. */
export function lireFavoris(stockage = globalThis.localStorage) {
  try {
    const lus = JSON.parse(stockage?.getItem(CLE_FAVORIS) ?? 'null');
    if (Array.isArray(lus)) return lus.filter((cle) => APPLIS.some((a) => a.cle === cle)).slice(0, MAX_FAVORIS);
  } catch {
    // Mémoire illisible : favoris de départ.
  }
  return [...FAVORIS_DEPART];
}

/** Retient les favoris sur cet appareil (rien de grave si la mémoire est indisponible). */
export function ecrireFavoris(liste, stockage = globalThis.localStorage) {
  try {
    stockage?.setItem(CLE_FAVORIS, JSON.stringify(liste));
  } catch {
    // Mémoire indisponible : les favoris ne seront pas retenus.
  }
}

/**
 * Coche / décoche une application dans les favoris. Renvoie { liste, refuse } : refuse = vrai quand
 * on voulait en ajouter une 6e (la liste ne change pas).
 */
export function basculerFavori(liste, cle) {
  if (liste.includes(cle)) return { liste: liste.filter((c) => c !== cle), refuse: false };
  if (liste.length >= MAX_FAVORIS) return { liste, refuse: true };
  return { liste: [...liste, cle], refuse: false };
}

// --- Ordre des tuiles (0.157.0 : appui long sur une tuile pour la déplacer), gardé par tablette ---

export const CLE_ORDRE = 'topo-ordre-applis';

/** Ordre retenu sur cet appareil (liste de clés), ou [] (ordre de départ). */
export function lireOrdre(stockage = globalThis.localStorage) {
  try {
    const lu = JSON.parse(stockage?.getItem(CLE_ORDRE) ?? 'null');
    return Array.isArray(lu) ? lu.filter((cle) => typeof cle === 'string') : [];
  } catch {
    return [];
  }
}

/** Retient l'ordre des tuiles sur cet appareil. */
export function ecrireOrdre(liste, stockage = globalThis.localStorage) {
  try {
    stockage?.setItem(CLE_ORDRE, JSON.stringify(liste));
  } catch {
    // Mémoire indisponible : l'ordre ne sera pas retenu.
  }
}

/**
 * Range les applications selon l'ordre retenu : celles de l'ordre d'abord (dans cet ordre), puis
 * les autres à la fin, dans l'ordre de départ (une application qui apparaît, par exemple en passant en Expert).
 */
export function ordonner(applis, ordre) {
  const rang = (a) => {
    const i = ordre.indexOf(a.cle);
    return i < 0 ? Infinity : i;
  };
  return applis.map((a, depart) => ({ a, depart })).sort((x, y) => rang(x.a) - rang(y.a) || x.depart - y.depart).map(({ a }) => a);
}
