// Mesure de durée d'un point (0.214.0, demande du 12.11, maquette 5 B) : pour gagner en précision, la position est lue
// chaque seconde pendant 5, 15 ou 30 secondes, puis on garde la MOYENNE (Est, Nord, altitude : moyenne arithmétique des lectures).
// Chaque lecture est vérifiée comme un point normal (RTK fixe, inclinaison prête, corrections de moins de 2 s) :
// si une seule lecture est refusée (RTK perdu…), toute la mesure est refusée, aucun point n'est gardé.
// Coordonnées MN95 en mètres.

/** Durées proposées (secondes). */
export const DUREES_MESURE = [5, 15, 30];

const moyenne = (valeurs) => valeurs.reduce((t, v) => t + v, 0) / valeurs.length;

/**
 * Point moyen de plusieurs lectures [{ est, nord, altitude, precisionH, precisionV, … }] (au moins une). Renvoie le dernier point lu,
 * avec la moyenne en Est, Nord et altitude (null si une lecture n'a pas d'altitude : jamais inventée), la plus mauvaise précision
 * H / V des lectures, et mesureDuree : { dureeS, lectures, ecartMaxPlan } (écart maximal d'une lecture à la moyenne, en plan, m).
 */
export function moyennerPoints(lectures, dureeS) {
  const est = moyenne(lectures.map((p) => p.est));
  const nord = moyenne(lectures.map((p) => p.nord));
  const avecAltitude = lectures.every((p) => p.altitude != null && Number.isFinite(p.altitude));
  const pire = (cle) => {
    const valeurs = lectures.map((p) => p[cle]).filter((v) => Number.isFinite(v));
    return valeurs.length > 0 ? Math.max(...valeurs) : null;
  };
  const dernier = lectures.at(-1);
  return {
    ...dernier,
    est,
    nord,
    altitude: avecAltitude ? moyenne(lectures.map((p) => p.altitude)) : null,
    precisionH: pire('precisionH'),
    precisionV: pire('precisionV'),
    pdop: pire('pdop'), // 0.220.0 : le plus mauvais PDOP des lectures (null si le récepteur n'en donne pas)
    mesureDuree: { dureeS, lectures: lectures.length, ecartMaxPlan: Math.max(...lectures.map((p) => Math.hypot(p.est - est, p.nord - nord))) },
  };
}

/**
 * Lance la mesure : une lecture tout de suite, puis une par seconde jusqu'à dureeS secondes.
 * prendre() → { ok, point } ou { ok: false, raison } (une lecture comme un point normal) ;
 * quandTic(secondesRestantes) à chaque seconde ; quandFin({ ok: true, point } ou { ok: false, raison } ou { ok: false, annule: true }).
 * Renvoie { annuler() }.
 */
export function demarrerMesure({ dureeS, prendre, quandTic = () => {}, quandFin }) {
  const lectures = [];
  let ecoule = 0;
  let fini = false;
  let minuterie = null;
  const terminer = (resultat) => {
    if (fini) return;
    fini = true;
    if (minuterie != null) clearInterval(minuterie);
    quandFin(resultat);
  };
  const lire = () => {
    const reponse = prendre();
    if (!reponse?.ok) {
      terminer({ ok: false, raison: reponse?.raison ?? 'lecture refusée' });
      return false;
    }
    lectures.push(reponse.point);
    return true;
  };
  if (lire()) {
    quandTic(dureeS);
    minuterie = setInterval(() => {
      ecoule += 1;
      if (!lire()) return;
      quandTic(Math.max(0, dureeS - ecoule));
      if (ecoule >= dureeS) terminer({ ok: true, point: moyennerPoints(lectures, dureeS) });
    }, 1000);
  }
  return { annuler: () => terminer({ ok: false, annule: true }) };
}
