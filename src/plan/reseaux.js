// Réseaux (canalisations) sur le plan (0.235.0, Expert, test) : le trait de chaque réseau à la couleur de son type, la tranchée
// (bande du fond, et ses bords gauche / droit à la manière de L1 / L2 du Guidage), le nom, le fil d'eau des sommets et la pente de
// chaque segment du réseau choisi, la ligne de la coupe en travers, et le brouillon en cours de création.
import { couleurDuType, bordsFondTranchee, pentesDesSegments } from '../topo/reseau.js';

const COULEUR_BORD_G = '#7c3aed'; // comme L1 du Guidage
const COULEUR_BORD_D = '#ea580c'; // comme L2 du Guidage

/**
 * Dessine dans "groupe" (SVG). donnees : { reseaux, selectionId, afficher: { tranchees, bords }, coupe: { debut, fin } ou null,
 * brouillon: [{ est, nord, fe? }] ou null } ; versEcran(est, nord) → { x, y } ; creer(type, attributs) : élément SVG.
 */
export function dessinerReseaux(groupe, donnees, versEcran, creer) {
  if (!donnees) return;
  const { reseaux = [], selectionId = null, afficher = {}, coupe = null, brouillon = null } = donnees;
  const chemin = (liste) => `M${liste.map((p) => { const e = versEcran(p.est, p.nord); return `${e.x.toFixed(1)} ${e.y.toFixed(1)}`; }).join('L')}`;
  for (const r of reseaux) {
    const choisi = r.id === selectionId;
    // Tranchée : la bande entre les deux bords du fond, et ses bords en pointillés colorés (G violet, D orange).
    const bords = r.tranchee ? bordsFondTranchee(r) : null;
    if (bords && afficher.tranchees !== false) {
      groupe.append(creer('path', { d: `${chemin(bords.gauche)}L${[...bords.droit].reverse().map((p) => { const e = versEcran(p.est, p.nord); return `${e.x.toFixed(1)} ${e.y.toFixed(1)}`; }).join('L')}Z`, class: 'tranchee-plan' }));
    }
    if (bords && afficher.bords) {
      groupe.append(creer('path', { d: chemin(bords.gauche), class: 'bord-tranchee-plan', style: `stroke:${COULEUR_BORD_G}` }));
      groupe.append(creer('path', { d: chemin(bords.droit), class: 'bord-tranchee-plan', style: `stroke:${COULEUR_BORD_D}` }));
    }
    const trait = creer('path', { d: chemin(r.sommets), class: `reseau-plan ${choisi ? 'choisi' : ''}` });
    trait.style.stroke = couleurDuType(r.type);
    groupe.append(trait);
    // Nom et diamètre au milieu du premier segment.
    const [a, b] = [versEcran(r.sommets[0].est, r.sommets[0].nord), versEcran(r.sommets[1].est, r.sommets[1].nord)];
    const nom = creer('text', { x: ((a.x + b.x) / 2).toFixed(1), y: ((a.y + b.y) / 2 - 8).toFixed(1), class: 'nom-reseau-plan' });
    nom.style.fill = couleurDuType(r.type);
    nom.textContent = `${r.nom} · Ø${Math.round(r.diametre * 1000)}`;
    groupe.append(nom);
    if (choisi) {
      r.sommets.forEach((s) => {
        const e = versEcran(s.est, s.nord);
        groupe.append(creer('circle', { cx: e.x.toFixed(1), cy: e.y.toFixed(1), r: 5, class: 'sommet-reseau-plan' }));
        const fe = creer('text', { x: (e.x + 8).toFixed(1), y: (e.y + 14).toFixed(1), class: 'fe-reseau-plan' });
        fe.textContent = `FE ${s.fe.toFixed(3)}`;
        groupe.append(fe);
      });
      pentesDesSegments(r).forEach((pente, i) => {
        if (pente == null) return;
        const [p, q] = [versEcran(r.sommets[i].est, r.sommets[i].nord), versEcran(r.sommets[i + 1].est, r.sommets[i + 1].nord)];
        const texte = creer('text', { x: ((p.x + q.x) / 2).toFixed(1), y: ((p.y + q.y) / 2 + 18).toFixed(1), class: 'pente-reseau-plan' });
        texte.textContent = `${pente >= 0 ? '↗ +' : '↘ −'}${Math.abs(pente).toFixed(2)} %`;
        groupe.append(texte);
      });
    }
  }
  // Ligne de la coupe en travers du réseau choisi.
  if (coupe) {
    const [p, q] = [versEcran(coupe.debut.est, coupe.debut.nord), versEcran(coupe.fin.est, coupe.fin.nord)];
    groupe.append(creer('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'coupe-reseau-plan' }));
  }
  // Brouillon : les points touchés, numérotés, reliés en pointillés.
  if (brouillon && brouillon.length > 0) {
    if (brouillon.length > 1) groupe.append(creer('path', { d: chemin(brouillon), class: 'brouillon-reseau-plan' }));
    brouillon.forEach((s, i) => {
      const e = versEcran(s.est, s.nord);
      groupe.append(creer('circle', { cx: e.x.toFixed(1), cy: e.y.toFixed(1), r: 6, class: 'sommet-brouillon-plan' }));
      const t = creer('text', { x: (e.x + 9).toFixed(1), y: (e.y - 8).toFixed(1), class: 'numero-brouillon-plan' });
      t.textContent = String(i + 1);
      groupe.append(t);
    });
  }
}
