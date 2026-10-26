// Dessins (Calculs › Dessin) sur le plan : traits violets, sommets en petits carrés ; pour le dessin
// en cours, les numéros des sommets et la longueur de chaque côté (comme Leica iCON), puis le pilote :
// le dernier sommet entouré et la direction en pointillés jusqu'au prochain sommet (ou une flèche).
// Les autres dessins ont le nom de leurs sommets (« D1-1 », « PF1-1 »…), pour les implanter.
import { estFerme, longueursCotes, pointSelonGisement } from '../topo/dessin.js';
import { formaterNombre } from '../topo/format.js';

/**
 * Dessine dans "groupe" (SVG). donnees : { dessins, actifId, pilote: { direction (gon) ou null,
 * distance (m) ou null } ou null } ; versEcran(est, nord) → { x, y } ; creer(type, attributs) :
 * élément SVG ; metresParPixel : taille d'un pixel sur le terrain (m) ; avecNoms : écrire le nom
 * des sommets (dessin.noms) des dessins qui ne sont pas en cours (calque « Noms des points »).
 */
export function dessinerDessins(groupe, { dessins = [], actifId = null, pilote = null }, versEcran, creer, metresParPixel, avecNoms = true) {
  for (const dessin of dessins) {
    const actif = dessin.id === actifId;
    const ecran = dessin.sommets.map((s) => versEcran(s.est, s.nord));
    const ferme = estFerme(dessin) && ecran.length >= 3;
    if (dessin.type !== 'points' && ecran.length >= 2) {
      const d = `M${ecran.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}${ferme ? 'Z' : ''}`;
      const trait = creer('path', { d, class: `trait-dessin type-${dessin.type} ${ferme ? 'ferme' : ''} ${actif ? 'actif' : ''}` });
      if (dessin.couleur) trait.style.stroke = dessin.couleur; // couleur choisie pour sa liste
      groupe.append(trait);
    }
    ecran.forEach((p, i) => {
      const carre = creer('rect', { x: p.x - 4, y: p.y - 4, width: 8, height: 8, class: `sommet-dessin ${actif ? 'actif' : ''}` });
      if (dessin.couleur) carre.style.stroke = dessin.couleur;
      groupe.append(carre);
      if (!actif) {
        if (!avecNoms || !dessin.noms?.[i]) return;
        const nom = creer('text', { x: p.x + 7, y: p.y - 7, class: 'nom-sommet-dessin' });
        if (dessin.couleur) nom.style.fill = dessin.couleur;
        nom.textContent = dessin.noms[i];
        groupe.append(nom);
        return;
      }
      // Point de départ bien visible : rond violet plein et « Départ ».
      if (i === 0) groupe.append(creer('circle', { cx: p.x, cy: p.y, r: 7, class: 'depart-dessin' }));
      const numero = creer('text', { x: p.x + 9, y: p.y - 9, class: `numero-dessin ${i === 0 ? 'texte-depart' : ''}` });
      numero.textContent = i === 0 ? 'Départ' : String(i + 1);
      groupe.append(numero);
    });
    if (actif && dessin.type !== 'points') {
      // Longueur de chaque côté, écrite au milieu, le long du côté (jamais à l'envers).
      longueursCotes(dessin.sommets, ferme).forEach((longueur, i) => {
        const a = ecran[i];
        const b = ecran[(i + 1) % ecran.length];
        let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        const texte = creer('text', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 4, class: 'cote-dessin', transform: `rotate(${angle.toFixed(1)} ${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2).toFixed(1)})` });
        texte.textContent = formaterNombre(longueur);
        groupe.append(texte);
      });
    }
    if (actif && pilote && dessin.sommets.length > 0) {
      const dernier = dessin.sommets.at(-1);
      const p = ecran.at(-1);
      groupe.append(creer('circle', { cx: p.x, cy: p.y, r: 11, class: 'pilote-dessin-point' }));
      if (pilote.direction != null && dessin.type !== 'points') {
        // Jusqu'au prochain sommet si la distance est donnée, sinon une flèche de 80 pixels.
        const longueur = pilote.distance > 0 ? pilote.distance : 80 * metresParPixel;
        const bout = pointSelonGisement(dernier, pilote.direction, longueur);
        const q = versEcran(bout.est, bout.nord);
        groupe.append(creer('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'pilote-dessin-direction' }));
        if (pilote.distance > 0) groupe.append(creer('path', { d: `M${q.x - 7} ${q.y}H${q.x + 7}M${q.x} ${q.y - 7}V${q.y + 7}`, class: 'pilote-dessin-prochain' }));
        else {
          const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
          groupe.append(creer('path', { d: 'M-9 -6 0 0-9 6', class: 'pilote-dessin-direction', transform: `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)}) rotate(${angle.toFixed(1)})` }));
        }
      }
    }
  }
}
