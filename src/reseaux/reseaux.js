// Application Réseaux (0.235.0, Expert, test) : l'état, les actions de l'écran (clics, champs), les touchers du plan et
// les données envoyées au plan. main.js lui donne ce dont elle a besoin (projet, surfaces, touchers…) : voir creerReseaux.
import { htmlReseaux } from './ecran.js';
import { svgCoupeEnTravers, svgCoupeAxe } from './coupe-svg.js';
import { nouveauReseau, erreurReseau, coupeEnTravers, croisementsSurAxe, longueurReseau, ligneAImplanterDuReseau, TYPES_RESEAU, fesDuTrace, nomProposeReseau, lireNomCalque, tronconsDeLignes } from '../topo/reseau.js';
import { tableauPoints } from './ecran.js';
import { profilSurface } from '../topo/coupe.js';

const nombreTape = (texte) => {
  const t = String(texte ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const mm = (v) => Math.round(v * 1000) / 1000;
// « Par calque » : au-delà, le calque touché n'est pas un calque de tuyaux (0.266.0).
const TRONCONS_MAX = 50;
// 0.266.0 : accroche du mode « Point par point » (Sommet au départ) ; troncons : mode « Par calque » ([{ sommets }], un réseau chacun).
const brouillonVide = () => ({
  // nomTouche (0.267.0) : le nom a été tapé (sinon il suit le type : EU-1, EU-2…).
  mode: 'dxf', type: TYPES_RESEAU[1].cle, nom: '', nomTouche: false, diametre: '', sommets: [], troncons: [], calque: '', accroche: 'sommet', surfaceId: '', message: '',
  tranchee: { actif: false, hauteur: '', largeur: '', talus: '', droit: false },
});

/**
 * deps : {
 *   conteneur (élément), projet() → le projet, modifie(), majPlan() (redessine le plan), message(texte, ms), vibrer(),
 *   surfaces() → [{ id, nom }] (avec triangles), trianglesDe(id), altitudeDe(id) → (est, nord) → z ou null,
 *   ligneSousLeDoigt(position, tolerance) → [{ est, nord, altitude }] ou null, pointSousLeDoigt(position, tolerance) → { est, nord } ou null,
 *   accrocherSous(accroche, position, tolerance) → { est, nord, altitude } ou null (0.266.0, barre d'accroches),
 *   lignesDuCalqueSous(position, tolerance) → { calque (nom), lignes: [[{ est, nord, altitude }]] } ou null (0.266.0, « Par calque »),
 *   ifcSurCoupe(debut, fin), ifcLeLong(sommets) → objets des maquettes IFC coupés (0.262.0, facultatifs),
 * }
 */
export function creerReseaux(deps) {
  const { conteneur } = deps;
  const etat = { vue: 'creer', brouillon: brouillonVide(), selectionId: null, abscisse: 0, coupe: 'perp', cible: 'axe', altitude: 'fe', afficher: { tranchees: true, bords: false } };
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
      const { svg, exageration } = svgCoupeAxe({ reseau: r, terrain: morceaux, croisements: croisementsSurAxe(liste(), r.id), ifc: deps.ifcLeLong?.(r.sommets) ?? [] });
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
      coupeSvg: svgCoupeEnTravers({ coupe, terrain: profilTerrain(r.surfaceId, coupe.debut, coupe.fin), terrainEn, ifc: deps.ifcSurCoupe?.(coupe.debut, coupe.fin) ?? [] }),
      exageration: 1,
      ligne: { debut: coupe.debut, fin: coupe.fin },
    };
  }

  /** Redessine l'écran et le plan. */
  function afficher() {
    proposerNom();
    const { coupeSvg, exageration } = etat.vue === 'voir' ? construireCoupe() : { coupeSvg: '', exageration: 1 };
    conteneur.innerHTML = htmlReseaux({
      vue: etat.vue, brouillon: etat.brouillon, surfaces: deps.surfaces(), reseaux: liste(), selectionId: choisi()?.id ?? null,
      abscisse: etat.abscisse, coupe: etat.coupe, cible: etat.cible, altitude: etat.altitude, afficher: etat.afficher, coupeSvg, exageration,
    });
    deps.majPlan();
    deps.apresAffichage?.(); // 0.242.0 : la bande du bas (« Enregistrer le réseau ») suit la page
  }

  /** Ce que le plan dessine : voir plan/reseaux.js. */
  function donneesPlan() {
    const voir = etat.vue === 'voir';
    return {
      reseaux: liste(),
      selectionId: etat.vue !== 'creer' ? choisi()?.id ?? null : null,
      afficher: etat.afficher,
      coupe: voir && etat.coupe === 'perp' ? construireCoupe().ligne : null,
      brouillon: etat.vue === 'creer' ? (etat.brouillon.mode === 'calque' ? etat.brouillon.troncons.flatMap((t) => t.sommets) : etat.brouillon.sommets) : null,
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
      b.sommets = sommets.map((s) => ({ est: mm(s.est), nord: mm(s.nord), fe: manque(s) ? '' : mm(s.altitude).toFixed(3), pente: '' }));
      const nbManque = sommets.filter(manque).length;
      b.message = nbManque === 0
        ? `✓ Polyligne : ${sommets.length} sommets, fil d'eau = Z de la polyligne`
        : `La polyligne n'a pas toutes ses altitudes (Z à 0) : tape le fil d'eau des ${nbManque} point${nbManque > 1 ? 's' : ''} vides`;
      if (nbManque > 0) deps.vibrer(60);
    } else if (b.mode === 'calque') {
      // 0.266.0 : toutes les lignes du calque touché ; un réseau par tronçon ; diamètre et type lus dans le nom du calque ;
      // FE = Z du DXF 3D (sinon à taper, interpolé entre deux FE).
      const trouve = deps.lignesDuCalqueSous?.(position, tolerance);
      if (!trouve || trouve.lignes.length === 0) {
        deps.message('Aucune ligne sous le doigt', 3000);
        return;
      }
      const troncons = tronconsDeLignes(trouve.lignes);
      // Calque de dessin (hachures, détails…) touché par erreur : des milliers de morceaux, pas des réseaux.
      if (troncons.length > TRONCONS_MAX) {
        deps.message(`Calque « ${trouve.calque} » : ${troncons.length} tronçons, trop pour des réseaux (${TRONCONS_MAX} au plus) : touche une ligne du calque des tuyaux`, 6000);
        return;
      }
      b.calque = trouve.calque;
      b.troncons = troncons.map((points) => ({
        sommets: points.map((q) => ({ est: mm(q.est), nord: mm(q.nord), fe: q.altitude == null ? '' : mm(q.altitude).toFixed(3), pente: '' })),
      }));
      const lu = lireNomCalque(trouve.calque);
      if (lu.diametre != null) b.diametre = String(lu.diametre);
      if (lu.type) b.type = lu.type;
      const sansZ = b.troncons.reduce((n, t) => n + t.sommets.filter((q) => q.fe === '').length, 0);
      b.message = `✓ Calque « ${trouve.calque} » : ${b.troncons.length} tronçon${b.troncons.length > 1 ? 's' : ''}${lu.diametre != null ? `, Ø ${lu.diametre}` : ''}${lu.type ? `, ${lu.type}` : ''}${sansZ > 0 ? ` — ${sansZ} point${sansZ > 1 ? 's' : ''} sans Z : FE à taper (interpolé entre deux FE)` : ', FE = Z du DXF'}`;
    } else {
      // 0.266.0 : barre d'accroches (Point, Sommet, Milieu, Sur ligne, Croisement, Centre) comme dans Implanter.
      const point = deps.accrocherSous ? deps.accrocherSous(b.accroche, position, tolerance) : deps.pointSousLeDoigt(position, tolerance);
      if (!point) {
        deps.message('Rien à accrocher sous le doigt', 3000);
        return;
      }
      const dernier = b.sommets.at(-1);
      if (dernier && Math.hypot(dernier.est - point.est, dernier.nord - point.nord) < 0.001) {
        deps.message('Même point que le précédent : pas ajouté', 2500);
        return;
      }
      // 0.248.0 : le FE est pré-rempli avec l'altitude du point s'il en a une (0 = pas d'altitude).
      const aAltitude = typeof point.altitude === 'number' && Number.isFinite(point.altitude) && Math.abs(point.altitude) > 1e-9;
      b.sommets.push({ est: mm(point.est), nord: mm(point.nord), fe: aAltitude ? mm(point.altitude).toFixed(3) : '', pente: '' });
      b.message = aAltitude ? '✓ FE pré-rempli avec l\'altitude du point (modifiable)' : '';
    }
    afficher();
  }

  /** Sommets avec leur FE : tapé, calculé par la pente tapée (0.267.0), sinon interpolé entre deux FE (0.266.0, marqué « interpole »). */
  function sommetsAvecFe(sommets) {
    const calcules = fesDuTrace(sommets.map((s) => ({ est: s.est, nord: s.nord, fe: nombreTape(s.fe), pente: nombreTape(s.pente) })));
    return sommets.map((s, k) => ({ est: s.est, nord: s.nord, fe: calcules[k].fe, ...(calcules[k].source === 'interpole' ? { interpole: true } : {}) }));
  }

  /** Nom proposé (0.267.0) tant que le nom n'a pas été tapé : « type-n », premier numéro libre. */
  function proposerNom() {
    const b = etat.brouillon;
    if (!b.nomTouche) b.nom = nomProposeReseau(b.type, liste().map((r) => r.nom));
  }

  function lireBrouillon(sommets = etat.brouillon.sommets, nom = etat.brouillon.nom.trim()) {
    const b = etat.brouillon;
    const t = b.tranchee;
    return nouveauReseau({
      type: b.type,
      nom,
      diametre: nombreTape(b.diametre) == null ? null : nombreTape(b.diametre) / 1000,
      sommets: sommetsAvecFe(sommets),
      tranchee: t.actif ? { hauteur: nombreTape(t.hauteur), largeur: nombreTape(t.largeur), talus: t.droit ? 0 : nombreTape(t.talus) } : null,
      surfaceId: b.surfaceId || null,
      source: b.mode,
    });
  }

  function enregistrer() {
    const b = etat.brouillon;
    // « Par calque » (0.266.0) : un réseau par tronçon, nommés « nom-1 », « nom-2 »… s'il y en a plusieurs.
    const listes = b.mode === 'calque' ? b.troncons.map((t) => t.sommets) : [b.sommets];
    if (listes.length === 0) {
      alert('Réseau non enregistré : touche d\'abord une ligne du calque.');
      return;
    }
    const base = b.nom.trim();
    // Plusieurs tronçons : nom tapé → « nom-1 », « nom-2 »… ; nom proposé → numéros libres à la suite (EU-3, EU-4…).
    const nomsPris = liste().map((r) => r.nom);
    const nomDe = (k) => (listes.length === 1 ? base : b.nomTouche ? `${base}-${k + 1}` : nomProposeReseau(b.type, nomsPris, k));
    const reseaux = listes.map((sommets, k) => lireBrouillon(sommets, nomDe(k)));
    for (const [k, reseau] of reseaux.entries()) {
      const erreur = erreurReseau(reseau);
      if (erreur) {
        alert(`Réseau non enregistré${listes.length > 1 ? ` (tronçon ${k + 1})` : ''} : ${erreur}`);
        return;
      }
      if (liste().some((r) => r.nom === reseau.nom)) {
        alert(`Réseau non enregistré : le nom « ${reseau.nom} » existe déjà.`);
        return;
      }
    }
    liste().push(...reseaux);
    const reseau = reseaux[0];
    etat.selectionId = reseau.id;
    etat.abscisse = longueurReseau(reseau) / 2;
    etat.brouillon = { ...brouillonVide(), type: etat.brouillon.type, mode: etat.brouillon.mode };
    etat.vue = 'voir';
    deps.modifie();
    deps.message(reseaux.length > 1 ? `${reseaux.length} réseaux enregistrés (${reseaux[0].nom} … ${reseaux.at(-1).nom})` : `Réseau « ${reseau.nom} » enregistré`, 2500);
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
      case 'mode-reseau': b.mode = valeur; b.sommets = []; b.troncons = []; b.message = ''; break;
      case 'accroche-reseau': b.accroche = valeur; break;
      case 'meme-pente': {
        // 0.267.0 : la même pente que le segment d'avant (tapée ou calculée).
        const t = bouton.dataset.troncon;
        const sommets = t != null ? b.troncons[Number(t)].sommets : b.sommets;
        const k = Number(bouton.dataset.index);
        const calcules = fesDuTrace(sommets.map((q) => ({ est: q.est, nord: q.nord, fe: nombreTape(q.fe), pente: nombreTape(q.pente) })));
        const avant = calcules[k - 1]?.pente;
        if (avant == null) {
          deps.message('Pas de pente connue sur le segment d\'avant', 2500);
          return;
        }
        sommets[k].pente = String(avant);
        sommets[k].fe = '';
        break;
      }
      case 'type-reseau': b.type = valeur; break;
      case 'tranchee-reseau': b.tranchee.actif = !b.tranchee.actif; break;
      case 'bords-droits-reseau': b.tranchee.droit = !b.tranchee.droit; break;
      case 'enlever-point-reseau': b.sommets.pop(); break;
      case 'recommencer-reseau': b.sommets = []; b.troncons = []; b.message = ''; break;
      case 'enregistrer-reseau': enregistrer(); return;
      case 'choisir-reseau': etat.selectionId = id; etat.abscisse = longueurReseau(liste().find((r) => r.id === id)) / 2; break;
      case 'coupe-reseau': etat.coupe = valeur; break;
      case 'afficher-reseau': etat.afficher[valeur] = !etat.afficher[valeur]; break;
      case 'cible-reseau':
        etat.cible = valeur;
        if (valeur !== 'axe' && etat.altitude === 'fe') etat.altitude = 'fond'; // un bord de fond de tranchée : par défaut l'altitude du fond
        break;
      case 'altitude-reseau': etat.altitude = valeur; break;
      case 'implanter-reseau': {
        const r = choisi();
        const ligne = r ? ligneAImplanterDuReseau(r, etat.cible, etat.altitude) : null;
        if (!ligne) {
          deps.message('Ce choix demande une tranchée', 3500);
          return;
        }
        deps.implanter({ ...ligne, reseauId: r.id });
        return;
      }
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

  /**
   * FE interpolés mis à jour sur place pendant la frappe (0.266.0) : sans redessiner l'écran (le clavier reste ouvert).
   * Le FE interpolé est écrit en gris italique dans le champ vide (texte d'exemple) avec « interpolé » à côté.
   */
  function majInterpoles(sommets, troncon) {
    // Les textes d'exemple (FE et pentes calculés) du tableau refait, recopiés dans les champs en place (le champ tapé garde la main).
    const modele = document.createElement('div');
    modele.innerHTML = tableauPoints(sommets, troncon);
    const filtre = troncon != null ? `[data-troncon="${troncon}"]` : ':not([data-troncon])';
    for (const champ of conteneur.querySelectorAll(`:is([data-champ="fe-point-reseau"], [data-champ="pente-point-reseau"])${filtre}`)) {
      const neuf = modele.querySelector(`[data-champ="${champ.dataset.champ}"][data-index="${champ.dataset.index}"]`);
      if (!neuf) continue;
      champ.placeholder = neuf.placeholder;
      champ.className = neuf.className;
      const note = champ.parentElement.querySelector('.note-interpole');
      const noteNeuve = neuf.parentElement.querySelector('.note-interpole');
      if (note && noteNeuve) {
        note.hidden = noteNeuve.hidden;
        note.textContent = noteNeuve.textContent;
      }
    }
  }

  // Champs : on retient ce qui est tapé sans redessiner (le clavier reste ouvert).
  conteneur.addEventListener('input', (evenement) => {
    const champ = evenement.target.dataset?.champ;
    const b = etat.brouillon;
    const v = evenement.target.value;
    if (champ === 'nom-reseau') {
      b.nom = v;
      b.nomTouche = v.trim() !== ''; // effacé : le nom proposé revient au prochain affichage
    } else if (champ === 'diametre-reseau') b.diametre = v;
    else if (champ === 'hauteur-tranchee') b.tranchee.hauteur = v;
    else if (champ === 'largeur-tranchee') b.tranchee.largeur = v;
    else if (champ === 'talus-tranchee') b.tranchee.talus = v;
    else if (champ === 'fe-point-reseau' || champ === 'pente-point-reseau') {
      // 0.267.0 : FE OU pente pour un point : taper l'un vide l'autre.
      const t = evenement.target.dataset.troncon;
      const k = Number(evenement.target.dataset.index);
      const sommets = t != null ? b.troncons[Number(t)].sommets : b.sommets;
      const autre = champ === 'fe-point-reseau' ? 'pente' : 'fe';
      sommets[k][champ === 'fe-point-reseau' ? 'fe' : 'pente'] = v;
      if (v.trim() !== '') {
        sommets[k][autre] = '';
        const champAutre = evenement.target.closest('tr')?.querySelector(`[data-champ="${autre === 'pente' ? 'pente' : 'fe'}-point-reseau"]`);
        if (champAutre) champAutre.value = '';
      }
      majInterpoles(sommets, t);
    }
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
    else if (champ === 'diametre-liste-reseau' && evenement.target.value) {
      // 0.267.0 : diamètre choisi dans la liste (celle du Levé chantier) ; on peut toujours le taper.
      etat.brouillon.diametre = evenement.target.value;
      afficher();
    }
    else if (champ === 'reseau-implanter') {
      etat.selectionId = evenement.target.value;
      if (!choisi()?.tranchee) { etat.cible = 'axe'; if (etat.altitude === 'fond') etat.altitude = 'fe'; }
      afficher();
    }
    else if (champ === 'abscisse-reseau') afficher(); // le curseur est lâché : le texte à côté se met à jour
  });

  return { afficher, toucher, donneesPlan };
}
