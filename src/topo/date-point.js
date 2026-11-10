// Date de prise d'un point (0.187.0) : un point pris au GNSS garde son heure (gnss.prisLe), un point
// d'Annotation aussi (annotation.le). Un point importé ou tapé n'en a pas : jamais de date inventée (null).

/** Date de prise d'un point (texte ISO) ou null. */
export function dateDuPoint(point) {
  return point?.gnss?.prisLe ?? point?.annotation?.le ?? null;
}

/** Jour local d'un point « AAAA-MM-JJ » (celui d'un champ date), ou null s'il n'a pas de date. */
export function jourDuPoint(point) {
  const date = dateDuPoint(point);
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const deuxChiffres = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
}

/** Date et heure lisibles (« 10.11.2026 14:32 ») ou « — ». */
export function dateHeureDuPoint(point) {
  const date = dateDuPoint(point);
  if (!date || Number.isNaN(new Date(date).getTime())) return '—';
  const d = new Date(date);
  return `${d.toLocaleDateString('fr-CH')} ${d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Points triés par date : ordre 'recent' (le plus récent d'abord) ou 'ancien' ; les points sans date
 * restent toujours à la fin, dans leur ordre. Autre ordre : liste inchangée. Renvoie une nouvelle liste.
 */
export function trierParDate(points, ordre) {
  if (ordre !== 'recent' && ordre !== 'ancien') return [...points];
  const avec = points.filter((p) => dateDuPoint(p));
  const sans = points.filter((p) => !dateDuPoint(p));
  const sens = ordre === 'recent' ? -1 : 1;
  avec.sort((a, b) => sens * (new Date(dateDuPoint(a)) - new Date(dateDuPoint(b))));
  return [...avec, ...sans];
}
