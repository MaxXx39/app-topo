// Application Réseaux (0.235.0, Expert, test) : l'état, les actions de l'écran (clics, champs), les touchers du plan et
// les données envoyées au plan. main.js lui donne ce dont elle a besoin (projet, surfaces, touchers…) : voir creerReseaux.
import { htmlReseaux } from './ecran.js';
import { svgCoupeEnTravers, svgCoupeAxe } from './coupe-svg.js';
import { nouveauReseau, erreurReseau, coupeEnTravers, croisementsSurAxe, longueurReseau, TYPES_RESEAU } from '../topo/reseau.js';
import { profilSurface } from '../topo/coupe.js';

const nombreTape = (texte) => {
  const t = String(texte ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const mm = (v) => Math.round(v * 1000) / 1000;
const brouillonVide = () => ({
  mode: 'dxf', type: TYPES_RESEAU[1].cle, nom: '', diametre: '', sommets: [], surfaceId: '', message: '',
  tranchee: { actif: false, hauteur: '', largeur: '', talus: '', droit: false },
});

/**
 * deps : {
 *   conteneur (élément), projet() → le projet, modifie(), majPlan() (redessine le plan), message(texte, ms), vibrer(),
 *   surfaces() → [{ id, nom }] (avec triangles), trianglesDe(id), altitudeDe(id) → (est, nord) → z ou null,
 *   ligneSousLeDoigt(position, tolerance) → [{ est, nord, altitude }] ou null, pointSousLeDoigt(position, tolerance) → { est, nord } ou null,
 * }
 */
export function creerReseaux(deps) {
  const { conteneur } = deps;
  const etat = { vue: 'creer', brouillon: brouillonVide(), selectionId: null, abscisse: 0, coupe: 'perp', afficher: { tranchees: true, bords: false } };
  const liste = () => {
    const projet = deps.projet();
    projet.canalisations ??= [];
    return projet.canalisations;
  };
  const choisi = () => liste().find((r) => r.id === etat.selectionId) ?? liste()[0] ?? null;

  /** Profil du terrain le long d'une droite debut → fin : [{ x, z }] (morceaux mis bout à bout). */
  function profilTerrain(surfaceId, debut, fin) {
    if (!surfaceId) return [];
    return profilSurface(deps.trianglesDe(surfaceId), debut, fin).flat().map((p) => ({ x: p.distance, z: p.altitude }));
  }

  /** Coupe de la page « Voir » : { coupeSvg, exageration, ligne (pour le plan) }. */
  function construireCoupe() {
    const r = choisi();
    if (!r) return { coupeSvg: '', exageration: 1, ligne: null };
    const L = longueurReseau(r);
    if (etat.coupe === 'axe') {
      // Terrain le long du réseau : chaque segment à la suite (distance cumulée).
      const morceaux = [];
      let cumul = 0;
      for (let i = 0; i + 1 < r.sommets.length; i++) {
        const [a, b] = [r.sommets[i], r.sommets[i + 1]];
        if (r.surfaceId) for (const m of profilSurface(deps.trianglesDe(r.surfaceId), a, b)) morceaux.push(m.map((p) => ({ d: cumul + p.distance, z: p.altitude })));
        cumul += Math.hypot(b.est - a.est, b.nord - a.nord);
      }
      const { svg, exageration } = svgCoupeAxe({ reseau: r, terrain: morceaux, croisements: croisementsSurAxe(liste(), r.id) });
      return { coupeSvg: svg, exageration, ligne: null };
    }
    const abscisse = Math.min(Math.max(etat.abscisse, 0), L);
    const coupe = coupeEnTravers(liste(), r.id, abscisse, 4);
    if (!coupe) return { coupeSvg: '', exageration: 1, ligne: null };
    const terrainEn = r.surfaceId ? ((x) => {
      const t = x / (2 * coupe.demiLargeur);
      return deps.altitudeDe(r.surfaceId)?.(coupe.debut.est + (coupe.fin.est - coupe.debut.est) * t, coupe.debut.nord + (coupe.fin.nord - coupe.debut.nord) * t) ?? null;
    }) : null;
    return {
      coupeSvg: svgCoupeEnTravers({ coupe, terrain: profilTerrain(r.surfaceId, coupe.debut, coupe.fin), terrainEn }),
      exageration: 1,
      ligne: { debut: coupe.debut, fin: coupe.fin },
    };
  }

  /** Redessine l'écran et le plan. */
  function afficher() {
    const { coupeSvg, exageration } = etat.vue === 'voir' ? construireCoupe() : { coupeSvg: '', exageration: 1 };
    conteneur.innerHTML = htmlReseaux({
      vue: etat.vue, brouillon: etat.brouillon, surfaces: deps.surfaces(), reseaux: liste(), selectionId: choisi()?.id ?? null,
      abscisse: etat.abscisse, coupe: etat.coupe, afficher: etat.afficher, coupeSvg, exageration,
    });
    deps.majPlan();
  }

  /** Ce que le plan dessine : voir plan/reseaux.js. */
  function donneesPlan() {
    const voir = etat.vue === 'voir';
    return {
      reseaux: liste(),
      selectionId: voir ? choisi()?.id ?? null : null,
      afficher: etat.afficher,
      coupe: voir && etat.coupe === 'perp' ? construireCoupe().ligne : null,
      brouillon: etat.vue === 'creer' ? etat.brouillon.sommets : null,
    };
  }

  // --- Toucher du plan (page « Créer ») ---
  function toucher(position, tolerance) {
    if (etat.vue !== 'creer') return;
    const b = etat.brouillon;
    if (b.mode === 'dxf') {
      const sommets = deps.ligneSousLeDoigt(position, tolerance);
      if (!sommets) {
        deps.message('Aucune polyligne sous le doigt', 3000);
        return;
      }
      const manque = (s) => s.altitude == null || Math.abs(s.altitude) < 1e-9;
      b.sommets = sommets.map((s) => ({ est: mm(s.est), nord: mm(s.nord), fe: manque(s) ? '' : mm(s.altitude).toFixed(3) }));
      const nbManque = sommets.filter(manque).length;
      b.message = nbManque === 0
        ? `✓ Polyligne : ${sommets.length} sommets, fil d'eau = Z de la polyligne`
        : `La polyligne n'a pas toutes ses altitudes (Z à 0) : tape le fil d'eau des ${nbManque} point${nbManque > 1 ? 's' : ''} vides`;
      if (nbManque > 0) deps.vibrer(60);
    } else {
      const point = deps.pointSousLeDoigt(position, tolerance);
      if (!point) {
        deps.message('Aucun point sous le doigt', 3000);
        return;
      }
      const dernier = b.sommets.at(-1);
      if (dernier && Math.hypot(dernier.est - point.est, dernier.nord - point.nord) < 0.001) {
        deps.message('Même point que le précédent : pas ajouté', 2500);
        return;
      }
      b.sommets.push({ est: mm(point.est), nord: mm(point.nord), fe: '' });
      b.message = '';
    }
    afficher();
  }

  function lireBrouillon() {
    const b = etat.brouillon;
    const t = b.tranchee;
    return nouveauReseau({
      type: b.type,
      nom: b.nom.trim(),
      diametre: nombreTape(b.diametre) == null ? null : nombreTape(b.diametre) / 1000,
      sommets: b.sommets.map((s) => ({ est: s.est, nord: s.nord, fe: nombreTape(s.fe) })),
      tranchee: t.actif ? { hauteur: nombreTape(t.hauteur), largeur: nombreTape(t.largeur), talus: t.droit ? 0 : nombreTape(t.talus) } : null,
      surfaceId: b.surfaceId || null,
      source: b.mode,
    });
  }

  function enregistrer() {
    const reseau = lireBrouillon();
    const erreur = erreurReseau(reseau);
    if (erreur) {
      alert(`Réseau non enregistré : ${erreur}`);
      return;
    }
    if (liste().some((r) => r.nom === reseau.nom)) {
      alert(`Réseau non enregistré : le nom « ${reseau.nom} » existe déjà.`);
      return;
    }
    liste().push(reseau);
    etat.selectionId = reseau.id;
    etat.abscisse = longueurReseau(reseau) / 2;
    etat.brouillon = { ...brouillonVide(), type: etat.brouillon.type, mode: etat.brouillon.mode };
    etat.vue = 'voir';
    deps.modifie();
    deps.message(`Réseau « ${reseau.nom} » enregistré`, 2500);
    afficher();
  }

  // --- Clics et champs de l'écran ---
  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('[data-action]');
    if (!bouton) return;
    const { action, valeur, id } = bouton.dataset;
    const b = etat.brouillon;
    switch (action) {
      case 'vue-reseaux': etat.vue = valeur; break;
      case 'mode-reseau': b.mode = valeur; b.sommets = []; b.message = ''; break;
      case 'type-reseau': b.type = valeur; break;
      case 'tranchee-reseau': b.tranchee.actif = !b.tranchee.actif; break;
      case 'bords-droits-reseau': b.tranchee.droit = !b.tranchee.droit; break;
      case 'enlever-point-reseau': b.sommets.pop(); break;
      case 'recommencer-reseau': b.sommets = []; b.message = ''; break;
      case 'enregistrer-reseau': enregistrer(); return;
      case 'choisir-reseau': etat.selectionId = id; etat.abscisse = longueurReseau(liste().find((r) => r.id === id)) / 2; break;
      case 'coupe-reseau': etat.coupe = valeur; break;
      case 'afficher-reseau': etat.afficher[valeur] = !etat.afficher[valeur]; break;
      case 'abscisse-reseau': etat.abscisse = Math.max(0, etat.abscisse + Number(valeur)); break;
      case 'supprimer-reseau': {
        const r = liste().find((x) => x.id === id);
        if (!r || !confirm(`Supprimer le réseau « ${r.nom} » ?`)) return;
        liste().splice(liste().indexOf(r), 1);
        etat.selectionId = null;
        deps.modifie();
        break;
      }
      default: return;
    }
    afficher();
  });

  // Champs : on retient ce qui est tapé sans redessiner (le clavier reste ouvert).
  conteneur.addEventListener('input', (evenement) => {
    const champ = evenement.target.dataset?.champ;
    const b = etat.brouillon;
    const v = evenement.target.value;
    if (champ === 'nom-reseau') b.nom = v;
    else if (champ === 'diametre-reseau') b.diametre = v;
    else if (champ === 'hauteur-tranchee') b.tranchee.hauteur = v;
    else if (champ === 'largeur-tranchee') b.tranchee.largeur = v;
    else if (champ === 'talus-tranchee') b.tranchee.talus = v;
    else if (champ === 'fe-point-reseau') b.sommets[Number(evenement.target.dataset.index)].fe = v;
    else if (champ === 'abscisse-reseau') {
      etat.abscisse = Number(v);
      const { coupeSvg } = construireCoupe();
      const zone = conteneur.querySelector('.svg-coupe-reseau')?.parentElement;
      if (zone) zone.innerHTML = coupeSvg;
      deps.majPlan();
    }
  });
  conteneur.addEventListener('change', (evenement) => {
    const champ = evenement.target.dataset?.champ;
    if (champ === 'surface-reseau') etat.brouillon.surfaceId = evenement.target.value;
    else if (champ === 'abscisse-reseau') afficher(); // le curseur est lâché : le texte à côté se met à jour
  });

  return { afficher, toucher, donneesPlan };
}
