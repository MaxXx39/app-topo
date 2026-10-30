// Recollement de réseaux (0.101.0, demande du 30.10.2026) : calculs d'un levé de collecteurs.
// Formules validées par l'utilisateur (30.10.2026) :
// - fil d'eau d'un tuyau levé sur le dessus = altitude du dessus − diamètre extérieur ;
// - pente d'un tronçon = (fil d'eau du 2e point − fil d'eau du 1er) ÷ distance à plat × 100
//   (% ; négative quand ça descend du 1er vers le 2e) ; le sens d'écoulement va vers le plus bas.
// Coordonnées MN95 Est, Nord, altitude (m) ; diamètres en millimètres.

/** Fil d'eau (m) d'un tuyau levé sur le dessus : altitude du dessus − diamètre extérieur (mm). */
export function filDEauDepuisDessus(altitudeDessus, diametreExterieurMm) {
  return altitudeDessus - diametreExterieurMm / 1000;
}

/**
 * Pente d'un tronçon entre deux points { est, nord, filEau } (m). Renvoie { distance (m, à plat),
 * pente (%, négative si le fil d'eau descend du point a vers le point b), sens ('a-b' = l'eau va
 * de a vers b, 'b-a' = de b vers a, 'plat') } ; pente et sens sont null si les points sont au
 * même endroit ou sans fil d'eau.
 */
export function penteTroncon(a, b) {
  const distance = Math.hypot(b.est - a.est, b.nord - a.nord);
  if (distance < 1e-6 || a.filEau == null || b.filEau == null) return { distance, pente: null, sens: null };
  const difference = b.filEau - a.filEau;
  const pente = (difference / distance) * 100;
  const sens = Math.abs(difference) < 1e-9 ? 'plat' : difference < 0 ? 'a-b' : 'b-a';
  return { distance, pente, sens };
}

/** Profondeur d'une chambre (m) : tampon − radier si les deux existent, sinon celle tapée, sinon null. */
export function profondeurChambre({ tampon, radier, saisie }) {
  if (tampon != null && radier != null) return tampon - radier;
  return saisie ?? null;
}

/** Radier (m) : celui levé, sinon déduit du tampon et de la profondeur tapée, sinon null. */
export function radierChambre({ tampon, radier, saisie }) {
  if (radier != null) return radier;
  return tampon != null && saisie != null ? tampon - saisie : null;
}

/**
 * Chambre carrée ou rectangulaire levée avec 3 coins du cadre, pris dans n'importe quel ordre :
 * le coin d'angle droit est celui dont l'angle est le plus proche de 90°. Renvoie les 4 coins
 * dans l'ordre du pourtour, le centre, les dimensions (m), l'altitude du tampon (moyenne des 3
 * coins) et l'écart à l'angle droit (degrés, à signaler s'il est grand).
 */
export function chambreDepuisTroisCoins(points) {
  if (points.length !== 3) throw new Error('Il faut 3 coins pour une chambre carrée ou rectangulaire.');
  let meilleur = null;
  for (let i = 0; i < 3; i++) {
    const coin = points[i];
    const p = points[(i + 1) % 3];
    const q = points[(i + 2) % 3];
    const ux = p.est - coin.est, uy = p.nord - coin.nord;
    const vx = q.est - coin.est, vy = q.nord - coin.nord;
    const longueurs = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    if (longueurs < 1e-9) throw new Error('Deux coins de la chambre sont au même endroit.');
    const angle = (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / longueurs))) * 180) / Math.PI;
    const ecart = Math.abs(angle - 90);
    if (!meilleur || ecart < meilleur.ecart) meilleur = { coin, p, q, ecart };
  }
  const { coin, p, q, ecart } = meilleur;
  const quatrieme = { est: p.est + q.est - coin.est, nord: p.nord + q.nord - coin.nord };
  return {
    coins: [coin, p, quatrieme, q].map(({ est, nord }) => ({ est, nord })),
    centre: { est: (p.est + q.est) / 2, nord: (p.nord + q.nord) / 2 },
    cote1: Math.hypot(p.est - coin.est, p.nord - coin.nord),
    cote2: Math.hypot(q.est - coin.est, q.nord - coin.nord),
    tampon: points.reduce((somme, pt) => somme + pt.altitude, 0) / 3,
    ecartAngleDroit: ecart,
  };
}
