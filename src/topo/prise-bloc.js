// Points par lesquels on peut PRENDRE un bloc posé pour le déplacer (0.320.2, demande du 25.11) : seulement ses points
// d'accroche, pour être sûr de l'accrocher au bon endroit. Ce sont aussi les petits ronds dessinés sur le bloc choisi.
//  - grue : les 4 coins de son châssis, les milieux des côtés et l'axe de la tour ;
//  - bloc qui donne ses propres points (symbole.prises : repère du bloc, m) : ceux-là (portail : poteaux…) ;
//  - autre bloc : les 4 coins et les 4 milieux de sa boîte.
import { coinsSymbole, versTerrainSymbole } from './symboles.js';
import { lignesChassisGrue } from './grue-accroches.js';

const milieu = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Points de prise [[est, nord], …] d'un bloc posé (o) dont le symbole est « symbole » (peut être null pour une grue). */
export function pointsDePrise(o, symbole) {
  if (o.type === 'grue') {
    const l = lignesChassisGrue(o);
    if (l.length) {
      const c = l[0].points.map((q) => [q.est, q.nord]);
      return [...c, ...c.map((q, i) => milieu(q, c[(i + 1) % c.length])), [l[3].points[0].est, l[3].points[0].nord]];
    }
  }
  if (symbole?.prises?.length) {
    const f = versTerrainSymbole(o);
    return symbole.prises.map(([x, y]) => f(x, y));
  }
  if (!symbole) return [];
  const coins = coinsSymbole(o, symbole);
  return [...coins, ...coins.map((q, i) => milieu(q, coins[(i + 1) % 4]))];
}

/** Le point de prise le plus proche de p à « tolerance » près, ou null (alors le bloc ne se déplace pas). */
export function prisePresDe(o, symbole, p, tolerance) {
  let meilleur = null;
  let dMin = tolerance;
  for (const q of pointsDePrise(o, symbole)) {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d <= dMin) [dMin, meilleur] = [d, q];
  }
  return meilleur;
}
