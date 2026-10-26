// Autocontrôle sur des points connus (Terrain › Contrôle, demande du 26.10.2026) : on mesure à
// nouveau un point de contrôle du projet et on compare à ses coordonnées connues.
// - écarts Est, Nord, en plan et en hauteur (m) ;
// - couleur selon deux limites par tolérance : vert jusqu'à la 1re, orange jusqu'à la 2e, rouge au-delà ;
// - rappel : un contrôle réussi (vert ou orange) est demandé chaque jour, puis toutes les 4 heures.

// Tolérances par défaut (m), choisies par l'utilisateur le 26.10.2026 : plan et hauteur 2 cm / 4 cm.
export const TOLERANCES_PAR_DEFAUT = { plan: { vert: 0.02, orange: 0.04 }, hauteur: { vert: 0.02, orange: 0.04 } };
// Délai après le dernier contrôle réussi avant d'en redemander un (ms) : 4 heures.
export const DELAI_CONTROLE_MS = 4 * 60 * 60 * 1000;

const ORDRE = ['vert', 'orange', 'rouge'];

/**
 * Écarts mesuré − connu (m) : { est, nord, plan (distance horizontale), hauteur (null si une des
 * deux altitudes manque) }.
 */
export function ecartsControle(connu, mesure) {
  const est = mesure.est - connu.est;
  const nord = mesure.nord - connu.nord;
  const hauteur = connu.altitude != null && mesure.altitude != null ? mesure.altitude - connu.altitude : null;
  return { est, nord, plan: Math.hypot(est, nord), hauteur };
}

/**
 * Couleur d'un écart (m) selon une tolérance { vert, orange } (m) : 'vert' jusqu'à la 1re limite,
 * 'orange' jusqu'à la 2e, sinon 'rouge' ; null si l'écart n'est pas connu. Arrondi au 1/10 de mm,
 * pour qu'un écart affiché « 0.020 » soit bien vert avec une limite de 2 cm.
 */
export function classeTolerance(ecart, tolerance) {
  if (ecart == null) return null;
  const valeur = Math.round(Math.abs(ecart) * 10000) / 10000;
  if (valeur <= tolerance.vert) return 'vert';
  if (valeur <= tolerance.orange) return 'orange';
  return 'rouge';
}

/**
 * Résultat d'un contrôle : { plan, hauteur, global } ; global = la plus mauvaise des couleurs
 * connues (la hauteur ne compte pas si le point n'a pas d'altitude).
 */
export function resultatControle(ecarts, tolerances) {
  const plan = classeTolerance(ecarts.plan, tolerances.plan);
  const hauteur = classeTolerance(ecarts.hauteur, tolerances.hauteur);
  const global = ORDRE[Math.max(...[plan, hauteur].filter(Boolean).map((c) => ORDRE.indexOf(c)))];
  return { plan, hauteur, global };
}

/** Vrai pour un contrôle réussi : une mesure verte ou orange (pas un refus, pas un rouge). */
export function estControleReussi(controle) {
  return controle.type === 'mesure' && controle.resultat?.global !== 'rouge';
}

/** Jour local d'une date (« 2026-10-26 »), pour savoir si deux moments sont le même jour. */
function jourLocal(date) {
  const deux = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

/**
 * Vrai s'il faut faire un contrôle : aucun contrôle réussi aujourd'hui, ou le dernier date de
 * 4 heures ou plus. controles : ceux du projet ({ type, resultat, le (date ISO) }) ; maintenant : Date.
 */
export function controleNecessaire(controles, maintenant = new Date()) {
  const reussis = (controles ?? []).filter(estControleReussi).map((c) => new Date(c.le)).filter((d) => !Number.isNaN(d.getTime()));
  if (reussis.length === 0) return true;
  const dernier = new Date(Math.max(...reussis));
  if (jourLocal(dernier) !== jourLocal(maintenant)) return true;
  return maintenant - dernier >= DELAI_CONTROLE_MS;
}

/**
 * Tolérances lues dans des textes tapés en cm ({ planVert, planOrange, hauteurVert, hauteurOrange }) :
 * { tolerances (m) } ou { erreur } (nombre illisible, négatif, ou 2e limite plus petite que la 1re).
 */
export function lireTolerances(textes) {
  const lire = (texte) => {
    const valeur = Number(String(texte ?? '').trim().replace(',', '.'));
    return String(texte ?? '').trim() !== '' && Number.isFinite(valeur) && valeur > 0 ? valeur / 100 : null;
  };
  const tolerances = {};
  for (const [cle, titre] of [['plan', 'en plan'], ['hauteur', 'en hauteur']]) {
    const vert = lire(textes[`${cle}Vert`]);
    const orange = lire(textes[`${cle}Orange`]);
    if (vert == null || orange == null) return { erreur: `tolérance ${titre} illisible : écris deux nombres en cm, par exemple 2 et 4` };
    if (orange < vert) return { erreur: `tolérance ${titre} : la limite orange doit être plus grande que la verte` };
    tolerances[cle] = { vert, orange };
  }
  return { tolerances };
}

/** Date et heure à la suisse (« 26.10.2026 08:15 »), en heure locale. */
export function dateHeure(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const deux = (n) => String(n).padStart(2, '0');
  return `${deux(date.getDate())}.${deux(date.getMonth() + 1)}.${date.getFullYear()} ${deux(date.getHours())}:${deux(date.getMinutes())}`;
}

/**
 * Lignes CSV (point-virgule, comme les autres exports) des contrôles : un contrôle mesuré par ligne
 * (coordonnées connues et mesurées, écarts en m à 3 décimales, couleurs, précision du RX2…) ; un
 * refus a seulement sa date, son appareil et « Refus ».
 */
export function csvControles(controles) {
  const n = (valeur) => (valeur == null ? '' : valeur.toFixed(3));
  const texte = (valeur) => {
    const t = String(valeur ?? '');
    return /[;"\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
  };
  const lignes = ['Date;Type;Point;Est connu;Nord connu;Altitude connue;Est mesuré;Nord mesuré;Altitude mesurée;dEst;dNord;Écart plan;dAltitude;Résultat plan;Résultat hauteur;Résultat;Précision H;Précision V;Satellites;Appareil;Remarque'];
  for (const c of controles) {
    if (c.type === 'refus') {
      lignes.push([dateHeure(c.le), 'Refus', '', '', '', '', '', '', '', '', '', '', '', '', '', 'refusé', '', '', '', texte(c.appareil), texte(c.remarque)].join(';'));
      continue;
    }
    const { connu, mesure, ecarts, resultat, gnss = {} } = c;
    lignes.push([
      dateHeure(c.le), 'Contrôle', texte(c.nom),
      n(connu.est), n(connu.nord), n(connu.altitude), n(mesure.est), n(mesure.nord), n(mesure.altitude),
      n(ecarts.est), n(ecarts.nord), n(ecarts.plan), n(ecarts.hauteur),
      resultat.plan ?? '', resultat.hauteur ?? '', resultat.global ?? '',
      n(gnss.precisionH), n(gnss.precisionV), gnss.nbSatellites ?? '', texte(c.appareil), texte(c.remarque),
    ].join(';'));
  }
  return `${lignes.join('\r\n')}\r\n`;
}

/**
 * Ajoute des points (importés ou choisis) à la liste des points de contrôle, sans nom en double.
 * points : [{ nom, est, nord, altitude }] ; nouvelId() : identifiant d'un nouveau point.
 * Renvoie { ajoutes: nombre, deja: [noms déjà dans la liste], sansNom: nombre }. La liste est modifiée.
 */
export function ajouterPointsControle(liste, points, nouvelId) {
  const noms = new Set(liste.map((p) => p.nom));
  const deja = [];
  let ajoutes = 0;
  let sansNom = 0;
  for (const point of points) {
    const nom = String(point.nom ?? '').trim();
    if (!nom) {
      sansNom += 1;
      continue;
    }
    if (noms.has(nom)) {
      deja.push(nom);
      continue;
    }
    noms.add(nom);
    liste.push({ id: nouvelId(), nom, est: point.est, nord: point.nord, altitude: point.altitude ?? null });
    ajoutes += 1;
  }
  return { ajoutes, deja, sansNom };
}
