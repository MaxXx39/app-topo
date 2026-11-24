// Application Plateformes (0.300.0, Expert, site PC et Topo Bureau ; décisions du 24.11, maquette validée) :
// dessiner des plateformes (surfaces 3D) avec une altitude à chaque angle, des pentes, des lignes de rupture, des points
// intérieurs, des talus (déblai / remblai, berme) jusqu'à une surface de référence, et les volumes. Chaque plateforme
// devient une surface du projet (« Surf-Plateforme A ») : volumes, Implanter › Surface, exports LandXML / DXF, Drive.
// Calculs : topo/plateforme.js. Page plein écran (comme Plans de chantier) : ruban en haut, bandeau de la plateforme
// choisie, plan, tableau unique (points puis côtés), panneau à droite (liste, talus, Δ Z, volumes).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { demanderChoix, demanderTexte, demanderChamps } from '../outils/choix.js';
import { dessinerPlansDxf } from '../plan/dxf-canvas.js';
import { cadrerSurPoints, versEcran, versTerrain, deplacer, zoomer } from '../plan/vue.js';
import { accrocher, sourcesDesPlans } from '../topo/accroche.js';
import { trianglerAvecContraintes, volumeEntreSurfaces, altitudeSurTriangle } from '../topo/volume.js';
import { nouvelIdentifiant, avecPrefixe, PREFIXE_SURFACE } from '../topo/surface.js';
import {
  nouvellePlateforme, prochainNom, sommetsResolus, changerAltitude, penteCote, altitudeParPente, interpolerContour,
  ajouterPointMilieu, appliquerDeltaZ, cotePartage, trianglesPlateforme, talusPlateforme, trianglesTalus, reglageDuCote,
  pointsEtFaces, TALUS_DEFAUT, lireHV, retirerPoint,
  unitesPlateformes, ordreDesEtapes, profilLeLong, volumeTerrainAFin, COULEURS_PLATEFORMES,
  altitudesAuto, empriseOuvrage, hautOuvrage, contreUnOuvrage, traverseesOuvrage,
} from '../topo/plateforme.js';

const COULEUR_APPLI = '#6d28d9';
const MAX_ANNULER = 50;
const f3 = (v) => (v == null || !Number.isFinite(v) ? '' : (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3));
const f2 = (v) => (v == null || !Number.isFinite(v) ? '' : (Math.abs(v) < 0.005 ? 0 : v).toFixed(2));
const nombre = (texte) => {
  const v = Number(String(texte ?? '').replace(',', '.').trim());
  return String(texte ?? '').trim() !== '' && Number.isFinite(v) ? v : null;
};
const ico = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

/**
 * Ouvre la page. projet() ; modifie() : enregistrer (et Drive) ; plans() : plans du projet (recalés) ; points() : points
 * levés { nom, est, nord, altitude } ; surfaces() : surfaces de référence possibles [{ id, nom }] ;
 * trianglesDeSurface(id) ; lectureSeule() ; quandRetour() ; message(texte, durée).
 */
export function ouvrirPlateformes({
  projet: leProjet, modifie, plans = () => [], points = () => [], surfaces = () => [], trianglesDeSurface = () => [],
  lectureSeule = () => false, quandRetour = null, message = () => {},
}) {
  const page = document.createElement('dialog');
  page.className = 'page-plateformes';
  document.body.append(page);
  page.showModal();

  const projet = () => leProjet();
  const liste = () => {
    const pr = projet();
    pr.plateformes ??= [];
    pr.constructionsPlateformes ??= [];
    return pr.plateformes;
  };
  // 0.302.0 : groupes de plateformes (une seule surface) et coupes (2 au plus) de la page.
  const groupes = () => (projet().groupesPlateformes ??= []);
  const coupes = () => (projet().coupesPlateformes ??= []);
  // 0.303.0 : murs, radiers, dalles (limites : pas de talus contre leur face extérieure).
  const ouvrages = () => (projet().ouvragesPlateformes ??= []);
  const groupeDe = (pf) => (pf?.groupeId ? groupes().find((g) => g.id === pf.groupeId) ?? null : null);
  const choisie = () => liste().find((p) => p.id === etat.choisiId) ?? null;

  const etat = {
    choisiId: liste()[0]?.id ?? null,
    outil: 'choisir', // choisir | plateforme | rupture | interieur | construction
    saisie: null, // dessin en cours : { points: [{ est, nord, alt, lien }] } (plateforme) ou { debut } (rupture, construction)
    accroches: new Set(['point', 'sommet']),
    voir: { noms: true, alt: true, pentes: true, tri: true, talus: true },
    selPoint: null, selCote: null, // point / côté surlignés dans le tableau
    curseur: null,
    // 0.302.0 : étape choisie (id d'une plateforme seule ou d'un groupe), « l'étape seule » sur le plan, onglet du bas
    // ('tableau', 'c1', 'c2').
    etape: null, etapeSeule: true, onglet: 'tableau',
  };
  let pile = [];
  let vue = null;
  let fond = null;
  let dessus = null;
  let toile = null;
  let geste = null;
  const pointeurs = new Map();

  // --- Annuler, enregistrer ---

  const instantane = () => JSON.stringify({ p: projet().plateformes ?? [], c: projet().constructionsPlateformes ?? [], g: projet().groupesPlateformes ?? [], k: projet().coupesPlateformes ?? [], o: projet().ouvragesPlateformes ?? [] });
  function avantChangement() {
    if (lectureSeule()) {
      message('Projet ouvert en lecture seule ici : rien n\'est modifié.', 4000);
      return false;
    }
    pile.push(instantane());
    if (pile.length > MAX_ANNULER) pile.shift();
    return true;
  }
  function annuler() {
    if (!pile.length) return message('Rien à annuler.', 2000);
    const { p, c, g, k, o } = JSON.parse(pile.pop());
    projet().ouvragesPlateformes = o ?? [];
    projet().plateformes = p;
    projet().constructionsPlateformes = c;
    projet().groupesPlateformes = g ?? [];
    projet().coupesPlateformes = k ?? [];
    if (!choisie()) etat.choisiId = p[0]?.id ?? null;
    enregistrer();
  }

  // Calculs gardés tant que les plateformes et les surfaces de référence ne changent pas.
  // 0.302.0 : calcul par ÉTAPE (plateforme seule ou groupe), dans l'ordre où elles se posent les unes sur les autres ;
  // une étape posée sur une autre prend ses triangles (talus compris) comme surface de référence.
  let memo = { cle: '', resultats: new Map(), etapes: null };
  const surfaceDeUnite = (id) => projet().surfaces.find((x) => x.type === 'plateforme' && (x.groupeId === id || (!x.groupeId && x.plateformeId === id)))?.id ?? null;
  function calculerTout() {
    const cle = instantane() + JSON.stringify(projet().surfaces.filter((x) => x.type !== 'plateforme').map((x) => [x.id, trianglesDeSurface(x.id)?.length ?? 0]));
    if (memo.cle === cle) return memo;
    const tous = liste();
    const r = new Map();
    for (const pf of tous) {
      // Altitudes automatiques (0.303.0) : calculées plus bas, quand la surface de dessous est connue.
      const t = pf.auto?.mode ? { triangles: [], erreur: null } : trianglesPlateforme(pf, tous, trianglerAvecContraintes);
      r.set(pf.id, { sommets: sommetsResolus(pf, tous), triangles: t.triangles ?? [], erreur: t.erreur ?? null, talus: null, trianglesTalus: [], erreursTalus: [], volume: null, unite: null });
    }
    const unites = unitesPlateformes(tous, groupes());
    const { ordre, cycle } = ordreDesEtapes(unites, surfaceDeUnite);
    const parUnite = new Map(); // id → { triangles (avec talus), volume, erreur, refId, altitude }
    const trianglesDeSurf = new Map(); // surface d'une étape déjà calculée → ses triangles
    for (const u of ordre) {
      const refTri = !u.terrainId || cycle.includes(u.nom) ? [] : trianglesDeSurf.get(u.terrainId) ?? trianglesDeSurface(u.terrainId) ?? [];
      const altRef = refTri.length ? chercheurAltitude(refTri) : null;
      const tri = [];
      let erreur = null;
      for (const pf of u.membres) {
        const res = r.get(pf.id);
        res.unite = u.id;
        if (pf.auto?.mode) {
          // Altitudes : fixe, surface de dessous ± valeur, ou une autre surface ; triangles refaits avec elles.
          const triSurf = pf.auto.mode === 'surface' && pf.auto.surfaceId ? trianglesDeSurf.get(pf.auto.surfaceId) ?? trianglesDeSurface(pf.auto.surfaceId) ?? [] : [];
          const altSurf = triSurf.length ? chercheurAltitude(triSurf) : null;
          const simples = (liste) => liste.map(({ nom, est, nord, alt, calc }) => ({ nom, est, nord, alt, calc }));
          const sommetsAuto = altitudesAuto(simples(res.sommets), pf.auto, altRef, altSurf);
          const interieursAuto = altitudesAuto(simples(pf.interieurs), pf.auto, altRef, altSurf);
          res.sommets = sommetsAuto.map((x, i) => ({ ...res.sommets[i], alt: x.alt, calc: true }));
          const t = trianglesPlateforme({ ...pf, sommets: sommetsAuto, interieurs: interieursAuto }, [], trianglerAvecContraintes);
          res.triangles = t.triangles ?? [];
          res.erreur = t.erreur ? (pf.auto.mode === 'decalage' && !altRef ? 'choisissez sur quoi elle est posée (altitudes calculées d\'après elle)' : pf.auto.mode === 'surface' && !altSurf ? 'surface des altitudes à choisir' : `${t.erreur} (hors de la surface ?)`) : null;
          res.altitudesAuto = new Map([...sommetsAuto, ...interieursAuto].map((x) => [x.nom, x.alt]));
        }
        if (res.erreur) {
          erreur ??= `${pf.nom} : ${res.erreur}`;
          continue;
        }
        if (altRef) {
          // 0.303.0 : contre la face extérieure d'un mur / radier / dalle, pas de talus.
          const n = res.sommets.length;
          // 0.304.0 : berme retirée pour l'instant (décision de l'utilisateur) : aucune, même si un ancien réglage existe.
          const sansBerme = (x) => (x ? { pentes: x.pentes, berme: null } : null);
          res.talus = talusPlateforme(res.sommets, (i) => (contreUnOuvrage(res.sommets[i], res.sommets[(i + 1) % n], ouvrages()) ? null : sansBerme(reglageDuCote(tous, pf, i))), null, altRef, { pas: 1 });
          res.erreursTalus = res.talus.erreurs;
          res.trianglesTalus = trianglesTalus(res.talus);
        }
        tri.push(...res.triangles, ...res.trianglesTalus);
      }
      let volume = null;
      if (refTri.length && tri.length && !erreur) {
        const v = volumeEntreSurfaces(tri, refTri);
        volume = { remblai: v.remblai, deblai: v.deblai, surface: v.surfacePlan, horsTerrain: v.surfaceNonCouverte };
      }
      for (const pf of u.membres) r.get(pf.id).volume = volume;
      const id = surfaceDeUnite(u.id);
      if (id && tri.length) trianglesDeSurf.set(id, tri);
      parUnite.set(u.id, { unite: u, triangles: tri, volume, erreur, altitude: tri.length ? chercheurAltitude(tri) : null });
    }
    memo = { cle, resultats: r, etapes: { ordre, cycle, parUnite, totaux: null } };
    return memo;
  }
  const resultats = () => calculerTout().resultats;
  const etapesCalculees = () => calculerTout().etapes;

  /** Totaux : somme des étapes, et « terrain → fin » d'un coup (seulement si toutes les étapes partent d'un même terrain). */
  function totauxEtapes() {
    const e = etapesCalculees();
    if (e.totaux) return e.totaux;
    const somme = { deblai: 0, remblai: 0 };
    for (const u of e.ordre) {
      const v = e.parUnite.get(u.id)?.volume;
      if (v) {
        somme.deblai += v.deblai;
        somme.remblai += v.remblai;
      }
    }
    // Terrains de départ : références qui ne sont pas des étapes.
    const surfacesEtapes = new Set(e.ordre.map((u) => surfaceDeUnite(u.id)).filter(Boolean));
    const racines = [...new Set(e.ordre.map((u) => u.terrainId).filter((id) => id && !surfacesEtapes.has(id)))];
    let fin = null;
    let raison = '';
    if (racines.length === 1 && e.ordre.some((u) => e.parUnite.get(u.id)?.altitude)) {
      const terrain = trianglesDeSurface(racines[0]);
      const toutTri = e.ordre.flatMap((u) => e.parUnite.get(u.id)?.triangles ?? []);
      const b = { estMin: Infinity, estMax: -Infinity, nordMin: Infinity, nordMax: -Infinity };
      for (const t of toutTri) for (const q of t) {
        b.estMin = Math.min(b.estMin, q.est); b.estMax = Math.max(b.estMax, q.est);
        b.nordMin = Math.min(b.nordMin, q.nord); b.nordMax = Math.max(b.nordMax, q.nord);
      }
      const aire = (b.estMax - b.estMin) * (b.nordMax - b.nordMin);
      const pas = Math.max(0.5, Math.sqrt(aire / 160000)); // 160 000 cases au plus
      if (terrain.length && aire > 0) {
        fin = volumeTerrainAFin(e.ordre.map((u) => e.parUnite.get(u.id)?.altitude).filter(Boolean), chercheurAltitude(terrain), b, pas);
        fin.pas = pas;
      }
    } else if (racines.length > 1) raison = 'plusieurs terrains de départ';
    e.totaux = { somme, fin, raison };
    return e.totaux;
  }

  /** Altitude d'une surface (triangles) en un point, ou null : recherche par une grille de 10 m. */
  function chercheurAltitude(triangles) {
    const grille = new Map();
    const T = 10;
    triangles.forEach((t, i) => {
      const es = t.map((p) => p.est);
      const ns = t.map((p) => p.nord);
      for (let x = Math.floor(Math.min(...es) / T); x <= Math.floor(Math.max(...es) / T); x += 1) {
        for (let y = Math.floor(Math.min(...ns) / T); y <= Math.floor(Math.max(...ns) / T); y += 1) {
          const k = `${x},${y}`;
          if (!grille.has(k)) grille.set(k, []);
          grille.get(k).push(i);
        }
      }
    });
    return (est, nord) => {
      for (const i of grille.get(`${Math.floor(est / T)},${Math.floor(nord / T)}`) ?? []) {
        const [a, b, c] = triangles[i];
        const d = (b.nord - c.nord) * (a.est - c.est) + (c.est - b.est) * (a.nord - c.nord);
        if (Math.abs(d) < 1e-12) continue;
        const l1 = ((b.nord - c.nord) * (est - c.est) + (c.est - b.est) * (nord - c.nord)) / d;
        const l2 = ((c.nord - a.nord) * (est - c.est) + (a.est - c.est) * (nord - c.nord)) / d;
        if (l1 >= -1e-9 && l2 >= -1e-9 && 1 - l1 - l2 >= -1e-9) return altitudeSurTriangle(triangles[i], est, nord);
      }
      return null;
    };
  }

  /**
   * Surfaces du projet (type 'plateforme') refaites d'après les étapes : une par plateforme seule (« Surf-<nom> »,
   * plateformeId) et une par groupe (groupeId) ; celles des plateformes effacées ou entrées dans un groupe partent.
   */
  function synchroniserSurfaces() {
    const pr = projet();
    // Groupes vides retirés.
    pr.groupesPlateformes = groupes().filter((g) => liste().some((p) => p.groupeId === g.id));
    for (const p of liste()) if (p.groupeId && !pr.groupesPlateformes.some((g) => g.id === p.groupeId)) delete p.groupeId;
    const unites = unitesPlateformes(liste(), pr.groupesPlateformes);
    const garde = (x) => (x.groupeId ? unites.some((u) => u.type === 'groupe' && u.id === x.groupeId) : unites.some((u) => u.type === 'plateforme' && u.id === x.plateformeId));
    const parties = new Set(pr.surfaces.filter((x) => x.type === 'plateforme' && !garde(x)).map((x) => x.id));
    pr.surfaces = pr.surfaces.filter((x) => !parties.has(x.id));
    if (parties.size) {
      pr.calculs = (pr.calculs ?? []).filter((c) => !parties.has(c.surface1Id) && !parties.has(c.surface2Id));
      for (const u of [...liste(), ...pr.groupesPlateformes]) if (parties.has(u.terrainId)) u.terrainId = null;
    }
    // Deux passes : une étape posée sur une autre a besoin que la surface de celle-ci existe (son id).
    for (let passe = 0; passe < 2; passe += 1) {
      // 0.303.0 : une sur-profondeur / sur-hauteur est toujours posée sur sa parente (son groupe s'il y en a un).
      for (const p of liste()) {
        const parent = p.surprof ? liste().find((q) => q.id === p.surprof.parentId) : null;
        if (parent) p.terrainId = surfaceDeUnite(uniteDe(parent).id) ?? p.terrainId;
      }
      memo.cle = '';
      const e = etapesCalculees();
      for (const u of unites) {
        const res = e.parUnite.get(u.id);
        let x = pr.surfaces.find((y) => y.type === 'plateforme' && (u.type === 'groupe' ? y.groupeId === u.id : !y.groupeId && y.plateformeId === u.id));
        if (!res || res.erreur || !res.triangles.length) {
          if (x) x.erreurPlateforme = res?.erreur ?? 'vide';
          continue;
        }
        const { points: pts, faces } = pointsEtFaces(res.triangles, `${u.type === 'groupe' ? 'G' : u.membres[0].lettre}-`);
        if (!x) {
          x = { id: nouvelIdentifiant(), type: 'plateforme', ...(u.type === 'groupe' ? { groupeId: u.id } : { plateformeId: u.id }) };
          pr.surfaces.push(x);
        }
        Object.assign(x, { nom: avecPrefixe(u.nom, PREFIXE_SURFACE), nomFichier: u.nom, points: pts, faces });
        delete x.erreurPlateforme;
      }
    }
  }

  function enregistrer() {
    synchroniserSurfaces();
    modifie();
    majTout();
  }

  function fermer() {
    observateur?.disconnect();
    page.close();
    page.remove();
    quandRetour?.();
  }
  // 0.304.0 : Échap ne ferme jamais la page (seul « ← » la ferme) : il annule l'action en cours (voir echap()).
  page.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    echap();
  });
  /** Échap : bulle ouverte, dessin en cours, outil, point choisi, l'un après l'autre. */
  function echap() {
    if (bulleOuverte) return fermerBulle(false);
    if (etat.saisie) {
      etat.saisie = null;
      return majTout();
    }
    if (etat.outil !== 'choisir') {
      etat.outil = 'choisir';
      return majTout();
    }
    if (etat.selPoint || etat.selCote != null) {
      etat.selPoint = null;
      etat.selCote = null;
      return majTout();
    }
  }

  // --- Page ---

  const OUTILS = [
    ['choisir', '<path d="M5 3l14 8-6 2-2 6z"/>', 'Choisir', 'Choisir une plateforme, glisser un angle'],
    ['plateforme', '<path d="M4 18l3-12 12 2 1 10z"/>', 'Plateforme', 'Nouvelle plateforme : cliquer les angles (accroches), finir sur le 1er angle ou Entrée'],
    ['rupture', '<path d="M4 18L20 6" stroke-width="2.6"/>', 'Rupture', 'Ligne de rupture : cliquer deux points existants de la plateforme'],
    ['interieur', '<rect x="4" y="4" width="16" height="16" rx="1"/><circle cx="12" cy="12" r="2.2"/>', 'Pt intér.', 'Point intérieur isolé : cliquer dans la plateforme'],
    ['construction', '<path d="M3 20L21 4" stroke-dasharray="3 3"/>', 'Constr.', 'Ligne de construction (2D, pour l\'accroche) : 2 clics'],
    ['surprof', '<path d="M3 8h5l2 6h4l2-6h5"/>', 'Sur-prof.', 'Sur-profondeur ou sur-hauteur dans la plateforme choisie : cliquer son contour'],
    ['ouvrage', '<path d="M4 20V8h4v12M8 14h12"/><path d="M4 8h4"/>', 'Ouvrage', 'Mur (la ligne = face extérieure), radier ou dalle : pas de talus contre eux'],
  ];
  const ACCROCHES = [['point', '<circle cx="12" cy="12" r="4"/>', 'Point', 'points levés'], ['sommet', '<rect x="8" y="8" width="8" height="8"/>', 'Sommet', 'plans et plateformes'], ['milieu', '<path d="M4 12h16M12 8l-4 8h8z"/>', 'Milieu', ''], ['ligne', '<path d="M4 18L20 6"/><path d="M10 10l4 4"/>', 'Sur ligne', ''], ['croisement', '<path d="M5 5L19 19M19 5L5 19"/>', 'Croisem.', '']];
  const VOIR = [['noms', '<path d="M5 18V6h5a3 3 0 010 6H5"/>', 'Noms'], ['alt', '<path d="M4 20l6-10 4 6 2-3 4 7z"/>', 'Altitudes'], ['pentes', '<path d="M4 18L20 8M15 8h5v5"/>', 'Pentes'], ['tri', '<path d="M3 20h18L12 4z M12 4v16"/>', 'Triangles'], ['talus', '<path d="M3 8h18M6 8v6M12 8v6M18 8v6"/>', 'Talus']];

  function dessiner() {
    page.innerHTML = `
      <header class="entete-calage entete-plateformes">
        <button type="button" class="retour-reglages" data-action="retour" aria-label="Retour aux applications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        <h2>Plateformes ${bulle('plateformes')}</h2>
        <span class="nom-plan-chantier puce-plateformes">${echapper(projet().nom ?? '')}</span>
      </header>
      <main class="contenu-calage en-calage contenu-plateformes">
        <div class="ruban-calage ruban-plateformes" role="toolbar" aria-label="Outils des plateformes">
          <div class="groupe-ruban"><div class="boutons-groupe">${OUTILS.map(([c, i, t, aide]) => `<button type="button" class="outil-ruban" data-outil="${c}" title="${echapper(aide)}">${ico(i)}<span>${t}</span></button>`).join('')}
            <button type="button" class="outil-ruban" data-action="annuler" title="Annuler (Ctrl+Z)">${ico('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>')}<span>Annuler</span></button>
            <button type="button" class="outil-ruban" data-action="effacer" title="Effacer la plateforme choisie">${ico('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')}<span>Effacer</span></button></div></div>
          <div class="groupe-ruban"><div class="boutons-groupe">${ACCROCHES.map(([c, i, t, aide]) => `<button type="button" class="outil-ruban" data-accroche="${c}" title="Accroche : ${t}${aide ? ` (${aide})` : ''}">${ico(i)}<span>${t}</span></button>`).join('')}</div></div>
          <div class="groupe-ruban"><div class="boutons-groupe">${VOIR.map(([c, i, t]) => `<button type="button" class="outil-ruban" data-voir="${c}" title="Montrer / cacher : ${t}">${ico(i)}<span>${t}</span></button>`).join('')}
            <button type="button" class="outil-ruban" data-action="tout-voir" title="Tout voir">${ico('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>')}<span>Tout</span></button></div></div>
        </div>
        <div class="bandeau-plateforme" data-zone="bandeau"></div>
        <p class="consigne-calage" data-zone="consigne"></p>
        <div class="travail-plateformes">
          <div class="gauche-plateformes">
            <div class="vue-calage vue-plateformes"><div class="toile-plateformes" data-toile></div><div class="pied-vue etat-chantier" data-zone="etat"></div></div>
            <section class="carte-calage tableau-plateforme">
              <div class="onglets-plateforme" role="tablist"><button type="button" data-onglet="tableau" role="tab"><span data-zone="titre-tableau">Tableau</span></button><button type="button" data-onglet="c1" role="tab">Coupe 1</button><button type="button" data-onglet="c2" role="tab">Coupe 2</button></div>
              <div data-zone="partie-tableau" class="partie-tableau"><div class="cadre-tableau-plateforme" data-zone="tableau"></div>
              <div class="barre-calage"><button type="button" class="bouton-secondaire petit" data-action="interpoler">Interpoler les vides</button><button type="button" class="bouton-secondaire petit" data-action="effacer-calculees">Effacer les calculées</button></div></div>
              <div data-zone="partie-coupe" class="partie-coupe" hidden></div></section>
          </div>
          <aside class="carte-calage panneau-plateformes" data-zone="panneau"></aside>
        </div>
      </main>`;
    monterVue();
    majTout();
  }

  function majTout() {
    if (!page.isConnected) return;
    page.querySelectorAll('[data-outil]').forEach((b) => b.classList.toggle('actif', b.dataset.outil === etat.outil));
    page.querySelectorAll('[data-accroche]').forEach((b) => b.classList.toggle('actif', etat.accroches.has(b.dataset.accroche)));
    page.querySelectorAll('[data-voir]').forEach((b) => b.classList.toggle('actif', etat.voir[b.dataset.voir]));
    page.querySelector('[data-action="annuler"]').disabled = pile.length === 0;
    majBandeau();
    majTableau();
    majPanneau();
    majOnglets();
    majConsigne();
    majEtat();
    redessiner();
  }

  function majConsigne() {
    const c = page.querySelector('[data-zone="consigne"]');
    const s = etat.saisie;
    c.textContent = {
      choisir: choisie() ? 'Glisser un carré = déplacer l\'angle ; « + » au milieu d\'un côté = ajouter un point ; toucher un angle ou une pente = la changer (✕ = retirer le point).' : 'Choisissez une plateforme (clic dedans) ou dessinez-en une (outil « Plateforme »).',
      plateforme: s?.points?.length ? `${s.points.length} angle(s) : cliquez le suivant (altitude dans la bulle) ; 1er angle, double-clic ou Entrée pour finir ; Échap abandonne.` : 'Cliquez les angles de la plateforme : l\'altitude se tape dans la bulle (accroche sur un angle d\'une autre plateforme = angle partagé).',
      rupture: s?.debut ? `Ligne de rupture depuis ${s.debut} : cliquez le 2e point.` : 'Ligne de rupture : cliquez un point existant de la plateforme choisie, puis un autre.',
      interieur: 'Cliquez dans la plateforme choisie : point intérieur (altitude dans la bulle ; vide = celle de la surface).',
      construction: s?.debut ? 'Cliquez le 2e point de la ligne de construction.' : 'Ligne de construction : 2 clics (elle sert seulement à l\'accroche).',
      surprof: s?.points?.length ? `${s.points.length} point(s) du contour (dans la plateforme parente) ; 1er point ou Entrée pour finir.` : 'Sur-profondeur / sur-hauteur : cliquez son contour DANS la plateforme choisie (sa parente).',
      ouvrage: s?.points?.length ? `${s.points.length} point(s) ; Entrée = mur ouvert ; 1er point = contour fermé (bâtiment, radier, dalle).` : 'Ouvrage : cliquez la FACE EXTÉRIEURE du mur (ou le contour du radier / de la dalle), accroches sur les plans DXF.',
      coupe: s?.a ? 'Cliquez la fin de la coupe (accroches actives) ; Échap abandonne.' : 'Coupe : cliquez son début (accroches actives). Ses bouts se glissent ensuite avec « Choisir ».',
    }[etat.outil];
  }

  function majBandeau() {
    const z = page.querySelector('[data-zone="bandeau"]');
    const pf = choisie();
    if (!pf) {
      z.innerHTML = '<span class="aide-calage">Aucune plateforme choisie.</span>';
      return;
    }
    const r = resultats().get(pf.id);
    const n = r ? r.triangles.length + r.trianglesTalus.length : 0;
    z.innerHTML = `<b style="color:${echapper(pf.couleur)}">${echapper(pf.nom)}</b>
      <label>Nom <input type="text" data-pf="nom" value="${echapper(pf.nom)}" maxlength="40"></label>
      <label>Couleur <input type="color" data-pf="couleur" value="${echapper(pf.couleur)}"></label>
      <label>Groupe <select data-pf="groupeId"><option value="">— aucun —</option>${groupes().map((g) => `<option value="${echapper(g.id)}" ${g.id === pf.groupeId ? 'selected' : ''}>${echapper(g.nom)}</option>`).join('')}<option value="__nouveau">＋ Nouveau groupe…</option></select></label>
      ${groupeDe(pf) ? `<label>Nom du groupe <input type="text" data-groupe-nom value="${echapper(groupeDe(pf).nom)}" maxlength="40"></label>` : ''}
      <span class="aide-calage">${pf.sommets.length} angles · ${pf.interieurs.length} pt intérieur · ${pf.ruptures.length} rupture · ${n} triangles${r?.erreur ? ` · <b class="alerte">⚠ ${echapper(r.erreur)}</b>` : ''}</span>
      ${pf.ruptures.length ? `<button type="button" class="bouton-secondaire petit" data-action="retirer-rupture">✕ Dernière rupture</button>` : ''}`;
  }

  // --- Tableau unique : une ligne par point (altitude, lien), puis une ligne par côté (pente, talus) ---

  function majTableau() {
    const z = page.querySelector('[data-zone="tableau"]');
    const pf = choisie();
    page.querySelector('[data-zone="titre-tableau"]').textContent = pf ? `Tableau de ${pf.nom}` : 'Tableau';
    if (!pf) {
      z.innerHTML = '<p class="aide-calage">Choisissez une plateforme.</p>';
      return;
    }
    const tous = liste();
    const s = sommetsResolus(pf, tous);
    const lignes = [];
    s.forEach((p, i) => {
      const src = pf.sommets[i];
      const partage = Boolean(src.lien) || tous.some((q) => q !== pf && q.sommets.some((x) => x.lien?.id === pf.id && x.nom === p.nom));
      lignes.push(`<tr class="ligne-point ${etat.selPoint === p.nom ? 'choisi' : ''}">
        <td>${echapper(p.nom)}</td>
        <td><input type="text" inputmode="text" class="${p.calc || pf.auto?.mode ? 'calc' : ''}" value="${f3(pf.auto?.mode ? resultats().get(pf.id)?.altitudesAuto?.get(p.nom) : p.alt)}" data-alt="${echapper(p.nom)}" ${pf.auto?.mode ? 'readonly title="Altitude calculée (voir « Altitudes » à droite)"' : ''} aria-label="Altitude ${echapper(p.nom)}"></td>
        <td class="centre">${src.lien ? `<button type="button" class="bouton-lien ${src.detache ? 'detache' : ''}" data-lien="${i}" title="${src.detache ? 'Détaché : altitude propre (marche). Toucher = relier' : 'Lié : même altitude que l\'autre plateforme. Toucher = détacher'}">${src.detache ? '✂' : '🔗'}</button>` : partage ? '<span title="Angle partagé par une plateforme accrochée">🔗</span>' : ''}</td>
        <td class="sep" colspan="4"></td>
        <td class="centre">${pf.sommets.length > 3 ? `<button type="button" class="bouton-lien" data-retirer-point="${echapper(p.nom)}" title="Retirer l'angle ${echapper(p.nom)}">✕</button>` : ''}</td></tr>`);
      const j = (i + 1) % s.length;
      if (s.length < 2 || (s.length === 2 && i === 1)) return;
      const pente = penteCote(s, i);
      const t = pf.talus[src.nom] ?? TALUS_DEFAUT;
      const coteP = cotePartage(tous, pf, i);
      lignes.push(`<tr class="ligne-cote ${etat.selCote === i ? 'choisi' : ''}">
        <td>↳ ${echapper(p.nom)} → ${echapper(s[j].nom)}</td><td></td><td></td>
        <td class="sep"><input type="text" inputmode="text" class="calc" value="${f2(pente)}" data-pente="${i}" aria-label="Pente de ${echapper(p.nom)} à ${echapper(s[j].nom)}"></td>
        ${coteP ? '<td colspan="3" class="centre"><small>côté partagé : pas de talus</small></td>'
    : `<td class="centre"><input type="checkbox" data-talus-on="${echapper(src.nom)}" ${t.on ? 'checked' : ''} aria-label="Talus de ${echapper(p.nom)} à ${echapper(s[j].nom)}"></td>
        <td><input type="text" class="hv" value="${echapper(t.deb)}" data-talus-deb="${echapper(src.nom)}" ${t.on ? '' : 'disabled'} aria-label="Talus en déblai (H:V)"></td>
        <td><input type="text" class="hv" value="${echapper(t.rem)}" data-talus-rem="${echapper(src.nom)}" ${t.on ? '' : 'disabled'} aria-label="Talus en remblai (H:V)"></td>`}
        <td></td></tr>`);
    });
    for (const p of pf.interieurs) {
      lignes.push(`<tr class="ligne-point interieur ${etat.selPoint === p.nom ? 'choisi' : ''}"><td>${echapper(p.nom)} <small>intérieur</small></td>
        <td><input type="text" inputmode="text" class="${p.calc ? 'calc' : ''}" value="${f3(p.alt)}" data-alt="${echapper(p.nom)}" aria-label="Altitude ${echapper(p.nom)}"></td>
        <td></td><td class="sep" colspan="4"></td><td class="centre"><button type="button" class="bouton-lien" data-retirer-point="${echapper(p.nom)}" title="Retirer ce point intérieur">✕</button></td></tr>`);
    }
    z.innerHTML = `<table class="table-plateforme"><thead>
      <tr><th colspan="3">Point (1 point)</th><th colspan="4" class="groupe-cote sep">Côté (entre 2 points)</th><th></th></tr>
      <tr><th>Point / côté</th><th>Altitude</th><th class="centre">Lien</th><th class="sep">Pente %</th><th class="centre">Talus</th><th>Déblai H:V</th><th>Remblai H:V</th><th class="centre" title="Retirer le point">✕</th></tr>
      </thead><tbody>${lignes.join('') || '<tr><td colspan="8" class="aide-calage">Aucun point.</td></tr>'}</tbody></table>`;
  }

  // --- Panneau : liste, talus, Δ Z, volumes ---

  /** Étape (unité) d'une plateforme : son groupe, ou elle-même. */
  const uniteDe = (pf) => (pf ? (groupeDe(pf) ? { id: pf.groupeId, source: groupeDe(pf), nom: groupeDe(pf).nom, type: 'groupe' } : { id: pf.id, source: pf, nom: pf.nom, type: 'plateforme' }) : null);

  /** Liste « posée sur » : surfaces du projet (terrains…) puis les autres étapes (pas elle-même). */
  function optionsReference(idUnite, choisi) {
    const autres = etapesCalculees().ordre.filter((u) => u.id !== idUnite).map((u) => ({ id: surfaceDeUnite(u.id), nom: `Étape : ${u.nom}` })).filter((x) => x.id);
    return `<option value="">— rien (pas de talus) —</option>${surfaces().map((x) => `<option value="${echapper(x.id)}" ${x.id === choisi ? 'selected' : ''}>${echapper(x.nom)}</option>`).join('')}${autres.length ? `<optgroup label="Autres étapes">${autres.map((x) => `<option value="${echapper(x.id)}" ${x.id === choisi ? 'selected' : ''}>${echapper(x.nom)}</option>`).join('')}</optgroup>` : ''}`;
  }

  const m3 = (v) => `${Math.round(v).toLocaleString('fr-CH').replace(/\u202f|\s/g, ' ')} m³`;

  function majPanneau() {
    const z = page.querySelector('[data-zone="panneau"]');
    const pf = choisie();
    const u = uniteDe(pf);
    const r = pf ? resultats().get(pf.id) : null;
    const e = etapesCalculees();
    const tot = totauxEtapes();
    const etapeChoisie = etat.etape ?? u?.id ?? null;
    const ligneEtape = (x, k) => {
      const res = e.parUnite.get(x.id);
      const v = res?.volume;
      const dessous = x.terrainId ? (e.ordre.find((y) => surfaceDeUnite(y.id) === x.terrainId)?.nom ?? surfaces().find((y) => y.id === x.terrainId)?.nom ?? '?') : null;
      return `<li class="etape-pf ${x.id === etapeChoisie ? 'choisie' : ''}" data-etape="${echapper(x.id)}"><span class="rond-etape" style="background:${echapper(x.couleur ?? COULEUR_APPLI)}">${k + 1}</span>
        <div><div class="titre-etape">${echapper(x.nom)} <span class="puce-type">${x.type === 'groupe' ? `groupe · ${x.membres.length}` : 'plateforme'}</span></div>
        <div class="aide-calage">${dessous ? `posée sur ${echapper(dessous)}` : 'pas de surface dessous'}${e.cycle.includes(x.nom) ? ' · ⚠ boucle' : ''}</div>
        ${v ? `<div class="vols-etape"><span class="deblai">D ${m3(v.deblai)}</span><span class="remblai">R ${m3(v.remblai)}</span></div>` : res?.erreur ? `<div class="aide-calage alerte">⚠ ${echapper(res.erreur)}</div>` : ''}</div></li>`;
    };
    z.innerHTML = `
      <h3>Plateformes</h3>
      <div class="liste-plateformes">${liste().map((p) => `<button type="button" data-choisir="${echapper(p.id)}" class="${p.id === etat.choisiId ? 'actif' : ''}"><i style="background:${echapper(p.couleur)}"></i>${echapper(p.nom)}<small>${groupeDe(p) ? echapper(groupeDe(p).nom) : p.sommets.some((s) => s.lien) ? 'accrochée' : ''}</small></button>`).join('') || '<p class="aide-calage">Aucune : outil « Plateforme ».</p>'}</div>
      ${e.ordre.length ? `<h3>Étapes</h3>
      <div class="choix-etape"><button type="button" data-action="etape-seule" class="${etat.etapeSeule ? 'actif' : ''}">L'étape seule</button><button type="button" data-action="etape-toutes" class="${etat.etapeSeule ? '' : 'actif'}">Toutes</button></div>
      <ol class="chaine-etapes">${e.ordre.map(ligneEtape).join('')}</ol>
      <div class="totaux-etapes"><span>Somme des étapes</span><span class="deblai">D ${m3(tot.somme.deblai)}</span><span class="remblai">R ${m3(tot.somme.remblai)}</span>
        <span>Terrain → fin (d'un coup)</span>${tot.fin ? `<span class="deblai">D ${m3(tot.fin.deblai)}</span><span class="remblai">R ${m3(tot.fin.remblai)}</span>` : `<span class="aide-calage" style="grid-column:span 2">${tot.raison || '—'}</span>`}</div>` : ''}
      ${pf ? `
      <h3>Altitudes de ${echapper(pf.nom)}</h3>
      ${pf.surprof ? `<p class="aide-calage">${pf.surprof.genre === 'bosse' ? 'Sur-hauteur' : 'Sur-profondeur'} de ${echapper(liste().find((q) => q.id === pf.surprof.parentId)?.nom ?? '?')}</p>` : ''}
      <label class="champ-calage"><span>Les altitudes viennent</span><select data-auto="mode">
        ${[['', 'du tableau (tapées)'], ['altitude', 'd\'une altitude fixe'], ['decalage', 'de ce qui est dessous ± une épaisseur'], ['surface', 'd\'une surface (jusqu\'à un terrain)']].map(([v, t]) => `<option value="${v}" ${(pf.auto?.mode ?? '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      ${pf.auto?.mode === 'altitude' || pf.auto?.mode === 'decalage' ? `<label class="champ-calage"><span>${pf.auto.mode === 'altitude' ? 'Altitude (m)' : 'Épaisseur (m ; − = profondeur)'}</span><input type="text" inputmode="text" class="hv" data-auto="valeur" value="${f3(pf.auto.valeur)}"></label>` : ''}
      ${pf.auto?.mode === 'surface' ? `<label class="champ-calage"><span>Surface</span><select data-auto="surfaceId"><option value="">— choisir —</option>${surfaces().map((x) => `<option value="${echapper(x.id)}" ${x.id === pf.auto.surfaceId ? 'selected' : ''}>${echapper(x.nom)}</option>`).join('')}</select></label>` : ''}
      <h3>Talus de ${echapper(u.nom)}</h3>
      <label class="champ-calage"><span>Posée sur (surface de référence)</span><select data-unite-ref="${echapper(u.id)}">${optionsReference(u.id, u.source.terrainId ?? null)}</select></label>
      ${r?.erreursTalus?.length ? `<p class="note-calage alerte">⚠ ${r.erreursTalus.map(echapper).join('<br>')}</p>` : ''}
      <h3>Volumes de l'étape (avec talus)</h3>
      ${r?.volume ? `<p class="resume-volume"><span class="chiffre deblai">Déblai ${r.volume.deblai.toFixed(1)} m³</span> · <span class="chiffre remblai">Remblai ${r.volume.remblai.toFixed(1)} m³</span><br><span class="aide-calage">Emprise ${r.volume.surface.toFixed(1)} m²${r.volume.horsTerrain > 0.01 ? ` · ⚠ ${r.volume.horsTerrain.toFixed(1)} m² hors de la surface de référence` : ''}</span></p>`
    : `<p class="aide-calage">${r?.erreur ? 'Plateforme incomplète.' : 'Choisissez sur quoi elle est posée.'}</p>`}
      ${ouvrages().length ? `<h3>Ouvrages</h3><div class="liste-ouvrages">${ouvrages().map((o) => `<div class="ouvrage-ligne"><b>${echapper(o.nom)}</b>
        <label>ép. <input type="text" class="hv" data-ouvrage="${echapper(o.id)}" data-champ-ouvrage="epaisseur" value="${f2(o.epaisseur)}"></label>
        <label>bas <input type="text" class="hv-large" data-ouvrage="${echapper(o.id)}" data-champ-ouvrage="altBas" value="${f3(o.altBas)}"></label>
        ${o.type === 'mur' ? `<label>haut. <input type="text" class="hv" data-ouvrage="${echapper(o.id)}" data-champ-ouvrage="hauteur" value="${f2(o.hauteur)}"></label>${o.ferme ? '' : `<button type="button" class="bouton-secondaire petit" data-inverser-mur="${echapper(o.id)}" title="Changer le côté du bâtiment">⇄</button>`}` : ''}
        <button type="button" class="bouton-lien" data-effacer-ouvrage="${echapper(o.id)}" title="Effacer cet ouvrage">✕</button></div>`).join('')}</div>` : ''}
      <h3>Delta Z</h3>
      <div class="ligne-dz"><input type="text" inputmode="text" class="hv" data-champ="dz" value="0.000" aria-label="Delta Z en m"> m
        <select data-champ="dzQui" aria-label="À quoi appliquer"><option value="seule">Cette plateforme seule</option><option value="toutes">Avec les accrochées</option></select>
        <button type="button" class="bouton-secondaire petit" data-action="dz">Appliquer</button></div>` : ''}`;
  }

  // --- Coupes (0.302.0) : 2 au plus, tracées à la main (accroches), bouts déplaçables ---

  function majOnglets() {
    page.querySelectorAll('[data-onglet]').forEach((b) => {
      b.classList.toggle('actif', b.dataset.onglet === etat.onglet);
      b.setAttribute('aria-selected', String(b.dataset.onglet === etat.onglet));
    });
    const tableau = page.querySelector('[data-zone="partie-tableau"]');
    const zc = page.querySelector('[data-zone="partie-coupe"]');
    tableau.hidden = etat.onglet !== 'tableau';
    zc.hidden = etat.onglet === 'tableau';
    if (etat.onglet !== 'tableau') majCoupe(zc, etat.onglet);
  }

  /** Surfaces montrées sur la coupe : le terrain de départ, puis chaque étape de la chaîne de l'étape choisie. */
  function chaineDeLEtape(idUnite) {
    const e = etapesCalculees();
    const chaine = [];
    let u = e.ordre.find((x) => x.id === idUnite);
    const vus = new Set();
    while (u && !vus.has(u.id)) {
      vus.add(u.id);
      chaine.unshift(u);
      const ref = u.terrainId;
      u = ref ? e.ordre.find((x) => surfaceDeUnite(x.id) === ref) : null;
      if (!u && ref) chaine.unshift({ id: ref, terrain: true, nom: surfaces().find((x) => x.id === ref)?.nom ?? 'Terrain' });
    }
    return chaine;
  }

  function majCoupe(zone, id) {
    const k = coupes().find((x) => x.id === id);
    const n = id === 'c1' ? 1 : 2;
    if (!k) {
      zone.innerHTML = `<p class="aide-calage">Coupe ${n} pas encore tracée.</p><button type="button" class="bouton-secondaire" data-action="tracer-coupe" data-coupe="${id}">Tracer la coupe ${n} (2 clics sur le plan)</button>`;
      return;
    }
    const idEtape = etat.etape ?? uniteDe(choisie())?.id;
    const chaine = idEtape ? chaineDeLEtape(idEtape) : [];
    const e = etapesCalculees();
    const altDe = (x) => (x.terrain ? (trianglesDeSurface(x.id).length ? chercheurAltitude(trianglesDeSurface(x.id)) : null) : e.parUnite.get(x.id)?.altitude);
    const profils = chaine.map((x) => ({ x, p: altDe(x) ? profilLeLong(altDe(x), k.a, k.b, 0.5) : [] })).filter((y) => y.p.length);
    const L = Math.hypot(k.b[0] - k.a[0], k.b[1] - k.a[1]);
    // 0.303.0 : ouvrages coupés (rectangles gris du bas au haut)
    const coupesOuvrages = ouvrages().flatMap((o) => traverseesOuvrage(o, k.a, k.b).map(([d1, d2]) => ({ o, d1, d2, bas: Number(o.altBas) || 0, haut: hautOuvrage(o) })));
    const zs = [...profils.flatMap((y) => y.p.map((q) => q.z)).filter((z) => z != null), ...coupesOuvrages.flatMap((x) => [x.bas, x.haut])];
    const W = 640;
    const H = 220;
    const g = 46;
    const d = 26;
    if (!zs.length) {
      zone.innerHTML = `<p class="aide-calage">Rien à montrer sur la coupe ${n} : choisissez une étape posée sur une surface, ou tracez la coupe sur elle.</p>${boutonsCoupe(id, n)}`;
      return;
    }
    let zmin = Math.min(...zs);
    let zmax = Math.max(...zs);
    if (zmax - zmin < 0.5) [zmin, zmax] = [zmin - 0.25, zmax + 0.25];
    const marge = (zmax - zmin) * 0.12;
    zmin -= marge;
    zmax += marge;
    // Facteur des hauteurs : pixels par mètre en hauteur ÷ pixels par mètre en longueur.
    const exag = Math.max(1, Math.round((((H - 46) / (zmax - zmin)) / ((W - g - d) / L)) * 10) / 10);
    const px = (x) => g + (x / L) * (W - g - d);
    const py = (z) => 18 + ((zmax - z) / (zmax - zmin)) * (H - 46);
    const pas = Math.pow(10, Math.floor(Math.log10(zmax - zmin))) * ((zmax - zmin) / Math.pow(10, Math.floor(Math.log10(zmax - zmin))) > 5 ? 1 : 0.5);
    let svg = '';
    for (let z = Math.ceil(zmin / pas) * pas; z <= zmax; z += pas) svg += `<line x1="${g}" y1="${py(z)}" x2="${W - d}" y2="${py(z)}" class="grille-coupe"/><text x="4" y="${py(z) + 4}" class="axe-coupe">${z.toFixed(pas < 1 ? 1 : 0)}</text>`;
    const pasL = L > 200 ? 50 : L > 80 ? 20 : L > 30 ? 10 : 5;
    for (let x = 0; x <= L + 1e-6; x += pasL) svg += `<text x="${px(x)}" y="${H - 8}" class="axe-coupe" text-anchor="middle">${Math.round(x)} m</text>`;
    // Déblai / remblai de l'étape choisie (dernière de la chaîne) par rapport à celle d'en dessous.
    const haut = profils.at(-1);
    const bas = profils.at(-2);
    if (haut && bas && !haut.x.terrain) {
      for (let i = 0; i + 1 < haut.p.length; i += 1) {
        const [a, b] = [haut.p[i], haut.p[i + 1]];
        const [c, dd] = [bas.p[i], bas.p[i + 1]];
        if ([a.z, b.z, c?.z, dd?.z].some((v) => v == null)) continue;
        const classe = (a.z + b.z) / 2 >= (c.z + dd.z) / 2 ? 'remblai-coupe' : 'deblai-coupe';
        svg += `<polygon points="${px(a.d)},${py(c.z)} ${px(b.d)},${py(dd.z)} ${px(b.d)},${py(b.z)} ${px(a.d)},${py(a.z)}" class="${classe}"/>`;
      }
    }
    for (const x of coupesOuvrages) svg += `<rect x="${px(x.d1)}" y="${py(x.haut)}" width="${Math.max(1, px(x.d2) - px(x.d1))}" height="${py(x.bas) - py(x.haut)}" class="ouvrage-coupe"><title>${echapper(x.o.nom)}</title></rect>`;
    profils.forEach((y, i) => {
      const morceaux = [];
      let cur = [];
      for (const q of y.p) {
        if (q.z == null) {
          if (cur.length > 1) morceaux.push(cur);
          cur = [];
        } else cur.push(`${px(q.d).toFixed(1)},${py(q.z).toFixed(1)}`);
      }
      if (cur.length > 1) morceaux.push(cur);
      const derniere = i === profils.length - 1;
      const dessous = i === profils.length - 2;
      const classe = y.x.terrain ? 'terrain-coupe' : derniere ? 'etape-coupe' : dessous ? 'dessous-coupe' : 'autre-coupe';
      for (const m of morceaux) svg += `<polyline points="${m.join(' ')}" class="${classe}"/>`;
      const fin = morceaux.at(-1)?.at(-1)?.split(',');
      if (fin) svg += `<text x="${+fin[0] + 3}" y="${+fin[1] - 4}" class="nom-coupe">${echapper(y.x.terrain ? 'TN' : y.x.nom)}</text>`;
    });
    zone.innerHTML = `<div class="tete-coupe"><b>Coupe ${n}</b><span class="aide-calage">${L.toFixed(1)} m · hauteurs ×${exag} · épais = ${echapper(haut?.x.nom ?? '')}, tirets = ce sur quoi elle est posée</span>${boutonsCoupe(id, n)}</div>
      <svg class="svg-coupe" viewBox="0 0 ${W} ${H}" role="img" aria-label="Coupe ${n}">${svg}</svg>`;
  }
  const boutonsCoupe = (id, n) => `<span class="boutons-coupe"><button type="button" class="bouton-secondaire petit" data-action="tracer-coupe" data-coupe="${id}">Retracer</button><button type="button" class="bouton-secondaire petit" data-action="effacer-coupe" data-coupe="${id}">Effacer la coupe ${n}</button></span>`;

  // --- Vue (plan) ---

  let observateur = null;
  function monterVue() {
    toile = page.querySelector('[data-toile]');
    fond = document.createElement('canvas');
    dessus = document.createElement('canvas');
    toile.append(fond, dessus);
    vue = null;
    observateur?.disconnect();
    // 0.304.0 : quand un bandeau apparaît au-dessus (le haut du plan descend, le bas ne bouge pas), le dessin reste
    // à sa place à l'écran : on décale la vue de la moitié de la différence de hauteur.
    let cadreAvant = null;
    observateur = new ResizeObserver(() => {
      if (!toile.clientWidth) return;
      const r = toile.getBoundingClientRect();
      if (vue && cadreAvant && Math.abs(r.bottom - cadreAvant.bottom) < 1 && Math.abs(r.width - cadreAvant.width) < 1 && Math.abs(r.top - cadreAvant.top) >= 1) {
        vue = deplacer(vue, 0, (toile.clientHeight - cadreAvant.hauteur) / 2);
      }
      cadreAvant = { top: r.top, bottom: r.bottom, width: r.width, hauteur: toile.clientHeight };
      if (!vue) cadrer();
      else redessiner();
    });
    observateur.observe(toile);
    toile.addEventListener('wheel', (ev) => {
      if (!vue) return;
      ev.preventDefault();
      const { x, y } = position(ev);
      vue = zoomer(vue, ev.deltaY < 0 ? 1.2 : 1 / 1.2, x, y);
      redessiner();
    }, { passive: false });
    toile.addEventListener('pointerdown', pointerDown);
    toile.addEventListener('pointermove', pointerMove);
    toile.addEventListener('pointerup', pointerUp);
    toile.addEventListener('pointercancel', pointerUp);
    // Double-clic = finir (le 2e clic, au même endroit, a déjà fini : voir clic()).
    toile.addEventListener('dblclick', () => {
      if (['plateforme', 'surprof', 'ouvrage'].includes(etat.outil) && etat.saisie?.points?.length) finirPlateforme();
    });
    toile.vuePlateformes = () => vue;
    toile.tabIndex = 0; // le plan prend le clavier quand on le touche (Entrée, Échap, Ctrl+Z)
  }

  const densite = () => window.devicePixelRatio || 1;
  const taille = () => ({ largeur: toile.clientWidth || 300, hauteur: toile.clientHeight || 200 });
  const pxTol = () => (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 18 : 10);
  const tolerance = () => (vue ? pxTol() / vue.echelle : 1);
  const ecran = (p) => versEcran(p.est, p.nord, vue);
  const position = (ev) => {
    const r = toile.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };

  function cadrer() {
    const { largeur, hauteur } = taille();
    const coins = [];
    for (const pf of liste()) for (const s of sommetsResolus(pf, liste())) coins.push(s);
    if (!coins.length) for (const p of points()) coins.push(p);
    if (!coins.length) for (const pl of plans()) if (pl.bornes && pl.visible !== false) coins.push({ est: pl.bornes.estMin, nord: pl.bornes.nordMin }, { est: pl.bornes.estMax, nord: pl.bornes.nordMax });
    if (coins.length === 1) coins.push({ est: coins[0].est + 30, nord: coins[0].nord + 20 }, { est: coins[0].est - 30, nord: coins[0].nord - 20 });
    if (!coins.length) coins.push({ est: 2500000, nord: 1118000 }, { est: 2500080, nord: 1118050 });
    vue = cadrerSurPoints(coins, largeur, hauteur, 50);
    redessiner();
  }

  function redessiner() {
    if (!vue || !fond) return;
    const { largeur, hauteur } = taille();
    vue = { ...vue, largeur, hauteur };
    dessinerPlansDxf(fond, plans().filter((p) => p.visible !== false), vue, densite());
    const ctx = fond.getContext('2d');
    ctx.setTransform(densite(), 0, 0, densite(), 0, 0);
    ctx.fillStyle = '#64748b';
    for (const p of points()) {
      const q = ecran(p);
      if (q.x < -5 || q.y < -5 || q.x > largeur + 5 || q.y > hauteur + 5) continue;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2.2, 0, 2 * Math.PI);
      ctx.fill();
    }
    redessinerDessus();
  }

  /** Flèches de pente et « + » de la plateforme choisie, pour le toucher : [{ type, i, x, y, pf }]. */
  let zonesToucher = [];
  let alphaBase = 1; // 0.302.0 : les autres étapes pâlies quand « l'étape seule » est choisie
  /** Opacité d'une plateforme : pâle si une étape est choisie (liste des étapes) et que celle-ci n'en fait pas partie. */
  const alphaDe = (pf) => (etat.etape && etat.etapeSeule && uniteDe(pf)?.id !== etat.etape ? 0.18 : 1);

  function redessinerDessus() {
    if (!vue || !dessus) return;
    const d = densite();
    const { largeur, hauteur } = vue;
    dessus.width = Math.round(largeur * d);
    dessus.height = Math.round(hauteur * d);
    const ctx = dessus.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    zonesToucher = [];
    const r = resultats();
    // Lignes de construction (cyan, tirets)
    ctx.strokeStyle = '#06b6d4';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1;
    for (const [e1, n1, e2, n2] of projet().constructionsPlateformes ?? []) {
      const a = versEcran(e1, n1, vue);
      const b = versEcran(e2, n2, vue);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Talus (sous les plateformes)
    // 0.303.0 : ouvrages (murs, radiers, dalles) : emprise grise, face extérieure en trait épais.
    for (const o of ouvrages()) {
      const { anneaux, faces } = empriseOuvrage(o);
      ctx.beginPath();
      for (const an of anneaux) an.forEach(([e, n], i) => { const q = versEcran(e, n, vue); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }), ctx.closePath();
      ctx.fillStyle = 'rgba(71,85,105,0.38)';
      ctx.fill('evenodd');
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      faces.forEach(([e, n], i) => { const q = versEcran(e, n, vue); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
      if (o.ferme) ctx.closePath();
      ctx.stroke();
      // Étiquette au milieu du 1er côté, du côté du bâtiment (loin des altitudes des plateformes collées dehors).
      const anneauInt = anneaux[anneaux.length - 1];
      const ci = anneauInt.reduce((c, q) => [c[0] + q[0] / anneauInt.length, c[1] + q[1] / anneauInt.length], [0, 0]);
      const qc = versEcran(ci[0], ci[1], vue);
      ctx.textAlign = 'center';
      texte(ctx, o.nom, qc.x, qc.y - 2, '#334155', 11, true);
      texte(ctx, `${f2(o.altBas)} → ${f2(hautOuvrage(o))}`, qc.x, qc.y + 12, '#334155', 10);
      ctx.textAlign = 'start';
    }
    if (etat.voir.talus) for (const pf of liste()) {
      alphaBase = alphaDe(pf);
      dessinerTalus(ctx, r.get(pf.id), pf);
    }
    for (const pf of liste()) {
      alphaBase = alphaDe(pf);
      dessinerPlateforme(ctx, pf, r.get(pf.id), pf.id === etat.choisiId);
    }
    alphaBase = 1;
    ctx.globalAlpha = 1;
    // 0.302.0 : coupes (rouge, tirets), bouts déplaçables ; aperçu pendant le tracé.
    const traitCoupe = (a, b, nom, attente) => {
      const qa = versEcran(a[0], a[1], vue);
      const qb = versEcran(b[0], b[1], vue);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.8;
      ctx.setLineDash(attente ? [3, 3] : [8, 5]);
      ctx.beginPath();
      ctx.moveTo(qa.x, qa.y);
      ctx.lineTo(qb.x, qb.y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const q of [qa, qb]) carre(ctx, q, '#ffffff', '#dc2626', 4);
      texte(ctx, nom, qa.x + 7, qa.y - 7, '#dc2626', 12, true);
      texte(ctx, `${nom}'`, qb.x + 7, qb.y - 7, '#dc2626', 12, true);
    };
    for (const k of coupes()) traitCoupe(k.a, k.b, k.id === 'c1' ? 'C1' : 'C2', false);
    if (etat.outil === 'coupe' && etat.saisie?.a && etat.curseur) traitCoupe(etat.saisie.a, [etat.curseur.est, etat.curseur.nord], etat.saisie.coupe === 'c1' ? 'C1' : 'C2', true);
    // Dessin en cours
    const s = etat.saisie;
    if (s?.points?.length) {
      ctx.strokeStyle = COULEUR_APPLI;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      [...s.points, ...(etat.curseur ? [etat.curseur] : [])].forEach((p, i) => {
        const q = ecran(p);
        if (i) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of s.points) carre(ctx, ecran(p), '#ffffff', COULEUR_APPLI);
    }
    if ((etat.outil === 'construction' && s?.debut) && etat.curseur) {
      const a = ecran(s.debut);
      const b = ecran(etat.curseur);
      ctx.strokeStyle = '#06b6d4';
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Accroche au survol
    if (etat.accrocheVue) {
      const q = ecran(etat.accrocheVue);
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 2;
      ctx.strokeRect(q.x - 6, q.y - 6, 12, 12);
    }
  }

  function carre(ctx, q, fondCouleur, trait, rayon = 5) {
    ctx.fillStyle = fondCouleur;
    ctx.strokeStyle = trait;
    ctx.lineWidth = 1.5;
    ctx.fillRect(q.x - rayon, q.y - rayon, 2 * rayon, 2 * rayon);
    ctx.strokeRect(q.x - rayon, q.y - rayon, 2 * rayon, 2 * rayon);
  }

  function texte(ctx, t, x, y, couleur = '#1b2b36', taillePx = 11, gras = false, italique = false) {
    ctx.font = `${italique ? 'italic ' : ''}${gras ? '700 ' : ''}${taillePx}px system-ui, sans-serif`;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeText(t, x, y);
    ctx.fillStyle = couleur;
    ctx.fillText(t, x, y);
  }

  /**
   * Talus (0.304.0) : barbules de topo (une longue, une courte) qui partent de la CRÊTE (le haut du talus : le bord de
   * la plateforme en remblai, l'entrée en terre en déblai) vers le pied, espacées de ~9 px à l'écran ; pied en tirets ;
   * pente H:V écrite en petit au milieu du talus de chaque côté.
   */
  function dessinerTalus(ctx, res, pf) {
    ctx.globalAlpha = alphaBase;
    if (!res?.talus) return;
    const cols = res.talus.colonnes;
    const ESPACE = 9;
    let base = null;
    let alterne = 0;
    cols.forEach((c, i) => {
      const haut = c.nature === 'remblai' ? c.points[0] : c.points.at(-1);
      const bas = c.nature === 'remblai' ? c.points.at(-1) : c.points[0];
      const a = ecran(haut);
      const b = ecran(bas);
      const coin = c.sommet != null;
      const suite = i > 0 && cols[i - 1].chaine === c.chaine;
      if (!coin && suite && base && Math.hypot(a.x - base.x, a.y - base.y) < ESPACE) return;
      base = a;
      alterne = coin ? 0 : alterne + 1;
      const k = coin || alterne % 2 === 0 ? 1 : 0.5;
      ctx.strokeStyle = c.nature === 'deblai' ? '#b45309' : '#15803d';
      ctx.lineWidth = coin ? 1.2 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
      ctx.stroke();
    });
    // Pied du talus (entrée en terre) en tirets, suite par suite.
    ctx.strokeStyle = '#475569';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    let avant = null;
    for (const c of cols) {
      const q = ecran(c.points.at(-1));
      if (avant && avant.chaine === c.chaine) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
      avant = c;
    }
    if (res.talus.ferme && cols.length > 2 && avant) {
      const q = ecran(cols[0].points.at(-1));
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Pente de chaque côté (H:V du déblai ou du remblai, selon ce que prend le milieu du côté).
    if (pf && etat.voir.pentes) {
      const parCote = new Map();
      for (const c of cols) if (c.sommet == null && c.cote != null) (parCote.get(c.cote) ?? parCote.set(c.cote, []).get(c.cote)).push(c);
      ctx.textAlign = 'center';
      for (const [k, liste] of parCote) {
        // Au tiers du côté (le milieu a déjà le « + » et la flèche de pente) ; talus étroit à l'écran : juste dehors.
        const c = liste[Math.floor(liste.length / 3)];
        const a = ecran(c.points[0]);
        const b = ecran(c.points.at(-1));
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        if (l < 2) continue;
        const t = pf.talus[pf.sommets[k]?.nom] ?? TALUS_DEFAUT;
        const hv = c.nature === 'deblai' ? t.deb : t.rem;
        const [x, y] = l >= 26 ? [(a.x + b.x) / 2, (a.y + b.y) / 2] : [b.x + ((b.x - a.x) / l) * 9, b.y + ((b.y - a.y) / l) * 9];
        texte(ctx, String(hv), x, y + 3, c.nature === 'deblai' ? '#92400e' : '#166534', 9);
      }
      ctx.textAlign = 'start';
    }
    ctx.globalAlpha = 1;
  }

  function dessinerPlateforme(ctx, pf, res, estChoisie) {
    ctx.globalAlpha = alphaBase;
    const s = res?.sommets ?? sommetsResolus(pf, liste());
    if (!s.length) return;
    const pts = s.map(ecran);
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.globalAlpha = alphaBase * (estChoisie ? 0.22 : 0.1);
    ctx.fillStyle = pf.couleur;
    ctx.fill();
    ctx.globalAlpha = alphaBase * (1);
    ctx.strokeStyle = pf.couleur;
    ctx.lineWidth = estChoisie ? 2.5 : 1.5;
    ctx.stroke();
    if (etat.voir.tri && res?.triangles?.length) {
      ctx.globalAlpha = alphaBase * (0.45);
      ctx.lineWidth = 0.8;
      for (const t of res.triangles) {
        const q = t.map(ecran);
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        ctx.lineTo(q[1].x, q[1].y);
        ctx.lineTo(q[2].x, q[2].y);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.globalAlpha = alphaBase * (1);
    }
    // Ruptures (rouge)
    const parNom = new Map([...s, ...pf.interieurs].map((p) => [p.nom, p]));
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    for (const [a, b] of pf.ruptures) {
      if (!parNom.has(a) || !parNom.has(b)) continue;
      const qa = ecran(parNom.get(a));
      const qb = ecran(parNom.get(b));
      ctx.beginPath();
      ctx.moveTo(qa.x, qa.y);
      ctx.lineTo(qb.x, qb.y);
      ctx.stroke();
    }
    // Côtés partagés : tirets foncés ; pentes ; « + »
    const n = s.length;
    for (let i = 0; i < (n >= 3 ? n : n - 1); i += 1) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const partage = n >= 3 && cotePartage(liste(), pf, i);
      if (partage) {
        ctx.strokeStyle = '#1b2b36';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const pente = penteCote(s, i);
      if (etat.voir.pentes && pente != null && Math.hypot(b.x - a.x, b.y - a.y) > 40 && (estChoisie || !partage)) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const dir = pente <= 0 ? ang : ang + Math.PI; // la flèche montre le sens qui descend
        // 0.302.0 : au milieu du côté, à l'intérieur de la plateforme, sous le petit « + ».
        const lg = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        let [nx, ny] = [-(b.y - a.y) / lg, (b.x - a.x) / lg];
        const centre = pts.reduce((c, q) => [c[0] + q.x / pts.length, c[1] + q.y / pts.length], [0, 0]);
        if ((centre[0] - (a.x + b.x) / 2) * nx + (centre[1] - (a.y + b.y) / 2) * ny < 0) [nx, ny] = [-nx, -ny];
        const cx = (a.x + b.x) / 2 + nx * 16;
        const cy = (a.y + b.y) / 2 + ny * 16;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(dir);
        ctx.strokeStyle = '#1b2b36';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(9, 0);
        ctx.moveTo(3, -4);
        ctx.lineTo(9, 0);
        ctx.lineTo(3, 4);
        ctx.stroke();
        const retourne = Math.cos(dir) < 0;
        if (retourne) ctx.rotate(Math.PI);
        // Le texte va encore plus à l'intérieur (côté opposé au bord).
        const interieurEnBas = (-Math.sin(retourne ? dir + Math.PI : dir)) * nx + Math.cos(retourne ? dir + Math.PI : dir) * ny > 0;
        ctx.textAlign = 'center';
        texte(ctx, `${Math.abs(pente).toFixed(2)} %`, 0, interieurEnBas ? 14 : -6, '#1b2b36', 10);
        ctx.textAlign = 'start';
        ctx.restore();
        if (estChoisie) zonesToucher.push({ type: 'pente', i, x: cx, y: cy });
      }
      if (estChoisie && n >= 2) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = COULEUR_APPLI;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(mx, my, 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mx - 3, my);
        ctx.lineTo(mx + 3, my);
        ctx.moveTo(mx, my - 3);
        ctx.lineTo(mx, my + 3);
        ctx.stroke();
        zonesToucher.push({ type: 'plus', i, x: mx, y: my });
      }
    }
    // Angles (carrés) et points intérieurs (ronds), avec noms et altitudes
    s.forEach((p, i) => {
      const q = pts[i];
      carre(ctx, q, etat.selPoint === p.nom && estChoisie ? COULEUR_APPLI : '#ffffff', '#1b2b36');
      etiquette(ctx, p, q);
      if (p.detache && estChoisie) texte(ctx, 'détaché', q.x + 8, q.y + 12, '#dc2626', 10);
    });
    for (const p of pf.interieurs) {
      const q = ecran(p);
      ctx.fillStyle = etat.selPoint === p.nom && estChoisie ? COULEUR_APPLI : '#ffffff';
      ctx.strokeStyle = '#1b2b36';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      etiquette(ctx, p, q);
    }
    ctx.globalAlpha = 1;
  }

  /** Nom du point et son altitude l'un sur l'autre (0.304.0), en haut à droite du point. */
  function etiquette(ctx, p, q) {
    if (!etat.voir.noms && !etat.voir.alt) return;
    const x = q.x + 8;
    const deux = etat.voir.noms && etat.voir.alt;
    if (etat.voir.noms) texte(ctx, p.nom, x, deux ? q.y - 18 : q.y - 7, '#1b2b36', 11, true);
    if (etat.voir.alt) texte(ctx, p.alt == null ? '—' : f3(p.alt), x, q.y - 6, p.calc ? '#5f6d77' : '#1b2b36', 11, false, Boolean(p.calc));
  }

  // --- Accroche ---

  function sources(pos, tol) {
    const src = sourcesDesPlans(plans(), pos, tol);
    const lignes = [...src.lignes];
    const sommetsPf = [];
    for (const pf of liste()) {
      const s = sommetsResolus(pf, liste());
      if (s.length >= 2) lignes.push({ points: s.map((p) => ({ est: p.est, nord: p.nord, altitude: p.alt })), ferme: s.length >= 3 });
      for (const p of s) sommetsPf.push({ est: p.est, nord: p.nord, altitude: p.alt, nom: p.nom, pf: pf.id });
    }
    for (const o of ouvrages()) for (const an of empriseOuvrage(o).anneaux) lignes.push({ points: an.map(([est, nord]) => ({ est, nord, altitude: null })), ferme: o.ferme || an !== empriseOuvrage(o).anneaux[0] || o.type !== 'mur' });
    for (const [e1, n1, e2, n2] of projet().constructionsPlateformes ?? []) lignes.push({ points: [{ est: e1, nord: n1, altitude: null }, { est: e2, nord: n2, altitude: null }], ferme: false });
    return { lignes, cercles: src.cercles, points: src.points, sommetsPf };
  }

  /**
   * Point accroché sous la souris (ordre : angle d'une plateforme, puis les accroches choisies), ou le point lui-même :
   * { est, nord, altitude, lien { id, nom } }.
   */
  function pointAccroche(pos) {
    const tol = tolerance();
    const src = sources(pos, tol);
    if (etat.accroches.has('sommet')) {
      let meilleur = null;
      for (const p of src.sommetsPf) {
        const d = Math.hypot(p.est - pos.est, p.nord - pos.nord);
        if (d <= tol && (!meilleur || d < meilleur.d)) meilleur = { d, p };
      }
      if (meilleur) return { est: meilleur.p.est, nord: meilleur.p.nord, altitude: meilleur.p.altitude, lien: { id: meilleur.p.pf, nom: meilleur.p.nom } };
    }
    for (const mode of ['point', 'sommet', 'croisement', 'milieu', 'ligne']) {
      if (!etat.accroches.has(mode)) continue;
      const a = accrocher(mode, pos, tol, mode === 'point' ? { points: points().map((p) => ({ est: p.est, nord: p.nord, altitude: p.altitude ?? null, nom: p.nom })) } : src);
      if (a) return { est: a.est, nord: a.nord, altitude: a.altitude ?? null };
    }
    return { est: pos.est, nord: pos.nord, altitude: null, libre: true };
  }

  // --- Gestes ---

  function sousLaSouris(x, y) {
    const pf = choisie();
    const t = pxTol();
    for (const k of coupes()) {
      for (const [bout, p] of [['a', k.a], ['b', k.b]]) {
        const q = versEcran(p[0], p[1], vue);
        if (Math.hypot(q.x - x, q.y - y) <= t) return { type: 'bout-coupe', id: k.id, bout };
      }
    }
    if (!pf) return null;
    for (const z of zonesToucher) if (Math.hypot(z.x - x, z.y - y) <= t) return z;
    const s = sommetsResolus(pf, liste());
    for (let i = 0; i < s.length; i += 1) {
      const q = ecran(s[i]);
      if (Math.hypot(q.x - x, q.y - y) <= t) return { type: 'sommet', i, nom: s[i].nom };
    }
    for (const p of pf.interieurs) {
      const q = ecran(p);
      if (Math.hypot(q.x - x, q.y - y) <= t) return { type: 'interieur', nom: p.nom };
    }
    return null;
  }

  function pointerDown(ev) {
    if (!vue) return;
    // Toucher le plan valide la bulle ouverte et quitte le champ en cours (sinon Entrée / Ctrl+Z restent dans le champ).
    if (bulleOuverte && !ev.target.closest?.('.bulle-plateforme')) fermerBulle(true);
    toile.focus({ preventScroll: true });
    toile.setPointerCapture(ev.pointerId);
    pointeurs.set(ev.pointerId, position(ev));
    const pts = [...pointeurs.values()];
    if (pts.length === 2) {
      geste = { vue, glisse: true, distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), milieu: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } };
      return;
    }
    const { x, y } = pts[0];
    const cible = etat.outil === 'choisir' ? sousLaSouris(x, y) : null;
    geste = { x, y, vue, glisse: false, cible };
  }

  function pointerMove(ev) {
    if (!vue) return;
    const p = position(ev);
    const terrain = versTerrain(p.x, p.y, vue);
    if (!pointeurs.has(ev.pointerId)) {
      // Survol : accroche montrée pendant un dessin, coordonnées en bas.
      etat.curseur = etat.outil !== 'choisir' ? pointAccroche(terrain) : terrain;
      etat.accrocheVue = etat.outil !== 'choisir' && !etat.curseur.libre ? etat.curseur : null;
      majEtat();
      redessinerDessus();
      return;
    }
    pointeurs.set(ev.pointerId, p);
    const pts = [...pointeurs.values()];
    if (pts.length === 2 && geste?.distance) {
      vue = zoomer(geste.vue, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / geste.distance, geste.milieu.x, geste.milieu.y);
      return redessiner();
    }
    if (!geste) return;
    if (!geste.glisse && Math.hypot(p.x - geste.x, p.y - geste.y) > 5) {
      geste.glisse = true;
      // Glisser un angle, un point intérieur ou un « + » (= nouveau point qui suit la souris).
      if (geste.cible && ['sommet', 'interieur', 'plus', 'bout-coupe'].includes(geste.cible.type)) {
        if (!avantChangement()) {
          geste.cible = null;
        } else if (geste.cible.type === 'plus') {
          const nom = ajouterPointMilieu(liste(), choisie(), geste.cible.i);
          geste.cible = { type: 'sommet', i: geste.cible.i + 1, nom, insere: true };
        }
        if (geste.cible) geste.deplace = true;
      }
    }
    if (!geste.glisse) return;
    if (geste.deplace) {
      const a = pointAccroche(terrain);
      deplacerPoint(geste.cible, a);
      memo.cle = '';
      etat.accrocheVue = a.libre ? null : a;
      return redessinerDessus();
    }
    vue = deplacer(geste.vue, p.x - geste.x, p.y - geste.y);
    redessiner();
  }

  function pointerUp(ev) {
    if (!pointeurs.has(ev.pointerId)) return;
    const p = position(ev);
    pointeurs.delete(ev.pointerId);
    if (pointeurs.size) {
      const reste = [...pointeurs.values()][0];
      geste = { ...reste, vue, glisse: true };
      return;
    }
    const g = geste;
    geste = null;
    if (!g) return;
    if (g.deplace) {
      etat.accrocheVue = null;
      return enregistrer();
    }
    if (!g.glisse && ev.type === 'pointerup') clic(versTerrain(p.x, p.y, vue), g.cible);
  }

  /** Déplace un angle (sommet propre ; un angle lié bouge sa source) ou un point intérieur. */
  function deplacerPoint(cible, a) {
    const pf = choisie();
    const m = (v) => Math.round(v * 1000) / 1000;
    if (cible.type === 'bout-coupe') {
      const k = coupes().find((x) => x.id === cible.id);
      if (k) k[cible.bout] = [m(a.est), m(a.nord)];
      majOnglets();
      return;
    }
    if (cible.type === 'interieur') {
      const p = pf.interieurs.find((x) => x.nom === cible.nom);
      if (p) Object.assign(p, { est: m(a.est), nord: m(a.nord) });
      return;
    }
    const s = pf.sommets[cible.i];
    if (!s) return;
    let src = s;
    for (let k = 0; src.lien && k < 5; k += 1) src = liste().find((q) => q.id === src.lien.id)?.sommets.find((x) => x.nom === src.lien.nom) ?? src;
    Object.assign(src, { est: m(a.est), nord: m(a.nord) });
  }

  function clic(pos, cible) {
    const pf = choisie();
    if (etat.outil === 'choisir') {
      if (cible?.type === 'plus') {
        if (!avantChangement()) return;
        const nom = ajouterPointMilieu(liste(), pf, cible.i);
        etat.selPoint = nom;
        message(`Point ${nom} ajouté au milieu du côté (altitude interpolée) : glissez son carré pour le placer.`, 3000);
        return enregistrer();
      }
      // 0.304.0 : toucher une pente ou un point = sa bulle (taper la valeur sur le plan, ✕ = retirer le point).
      if (cible?.type === 'pente') {
        etat.selCote = cible.i;
        etat.selPoint = null;
        majTout();
        return bulleDePente(cible.i);
      }
      if (cible?.type === 'sommet' || cible?.type === 'interieur') {
        etat.selPoint = cible.nom;
        etat.selCote = null;
        majTout();
        surligner(`[data-alt="${CSS.escape(cible.nom)}"]`);
        return bulleDePoint(cible.nom);
      }
      // Clic dans une plateforme = la choisir.
      const dedans = liste().filter((q) => {
        const s = sommetsResolus(q, liste());
        return s.length >= 3 && dansPolygone(pos, s);
      });
      const nouvelle = dedans.find((q) => q.id !== etat.choisiId) ?? dedans[0];
      if (nouvelle) {
        etat.choisiId = nouvelle.id;
        etat.etape = null;
        etat.selPoint = null;
        etat.selCote = null;
        majTout();
      }
      return;
    }
    const a = pointAccroche(pos);
    if (etat.outil === 'coupe') {
      const sc = etat.saisie ?? (etat.saisie = { coupe: coupes().some((k) => k.id === 'c1') ? 'c2' : 'c1' });
      const m = (v) => Math.round(v * 1000) / 1000;
      if (!sc.a) {
        sc.a = [m(a.est), m(a.nord)];
        return majTout();
      }
      if (Math.hypot(a.est - sc.a[0], a.nord - sc.a[1]) < 0.01) return;
      if (!avantChangement()) return;
      projet().coupesPlateformes = [...coupes().filter((k) => k.id !== sc.coupe), { id: sc.coupe, a: sc.a, b: [m(a.est), m(a.nord)] }].sort((x, y) => x.id.localeCompare(y.id));
      etat.onglet = sc.coupe;
      etat.saisie = null;
      etat.outil = 'choisir';
      return enregistrer();
    }
    if (['plateforme', 'surprof', 'ouvrage'].includes(etat.outil)) {
      if (etat.outil === 'surprof' && !etat.saisie && !choisie()) return message('Choisissez d\'abord la plateforme parente (outil « Choisir »), puis dessinez la sur-profondeur dedans.', 4000);
      const s = etat.saisie ?? (etat.saisie = { points: [], parentId: etat.outil === 'surprof' ? choisie()?.id : null });
      const premier = s.points[0];
      const dernier = s.points.at(-1);
      const pres = (p) => Math.hypot(ecran(p).x - ecran(a).x, ecran(p).y - ecran(a).y) <= pxTol();
      if (premier && s.points.length >= 3 && pres(premier)) {
        s.ferme = true;
        return finirPlateforme();
      }
      // 0.304.0 : un 2e clic au même endroit (double-clic) finit, sans créer un 2e point au même endroit.
      if (dernier && pres(dernier)) {
        if (s.points.length >= (etat.outil === 'ouvrage' ? 2 : 3)) return finirPlateforme();
        return;
      }
      // Altitude : celle du point accroché, sinon celle du point d'avant ; changée dans la bulle (plateforme seulement).
      const point = { est: a.est, nord: a.nord, alt: a.altitude ?? dernier?.alt ?? null, lien: a.lien ?? null };
      s.points.push(point);
      majTout();
      if (etat.outil === 'plateforme' && !(a.lien && a.altitude != null)) {
        ouvrirBulle({
          x: ecran(point).x, y: ecran(point).y, titre: `Angle ${s.points.length} : altitude (m)`, valeur: f3(point.alt),
          valider: (texte) => {
            const v = texte.trim() === '' ? null : nombre(texte);
            if (v === null && texte.trim() !== '') return message('Altitude illisible (exemple : 412.350).', 3000);
            point.alt = v;
            majTout();
          },
        });
      }
      return;
    }
    if (etat.outil === 'construction') {
      if (!etat.saisie?.debut) {
        etat.saisie = { debut: a };
        return majTout();
      }
      if (!avantChangement()) return;
      const d = etat.saisie.debut;
      projet().constructionsPlateformes.push([d.est, d.nord, a.est, a.nord].map((v) => Math.round(v * 1000) / 1000));
      etat.saisie = null;
      return enregistrer();
    }
    if (!pf) return message('Choisissez d\'abord une plateforme (outil « Choisir », clic dedans).', 3500);
    if (etat.outil === 'rupture') {
      const z = sousLaSouris(ecran(pos).x, ecran(pos).y);
      const nom = z?.nom;
      if (!nom) return message('Cliquez un angle ou un point intérieur de la plateforme choisie.', 3000);
      if (!etat.saisie?.debut) {
        etat.saisie = { debut: nom };
        return majTout();
      }
      if (nom === etat.saisie.debut) return;
      if (!avantChangement()) return;
      pf.ruptures.push([etat.saisie.debut, nom]);
      etat.saisie = null;
      return enregistrer();
    }
    if (etat.outil === 'interieur') {
      const s = sommetsResolus(pf, liste());
      if (s.length < 3 || !dansPolygone(a, s)) return message('Le point intérieur doit être dans la plateforme choisie.', 3000);
      if (!avantChangement()) return;
      // Altitude : celle de l'accroche, sinon celle de la surface actuelle (calculée) ; puis la bulle pour la taper.
      let alt = a.altitude ?? null;
      let calc = false;
      if (alt == null) {
        const tri = resultats().get(pf.id)?.triangles ?? [];
        const z = tri.length ? chercheurAltitude(tri)(a.est, a.nord) : null;
        if (z != null) [alt, calc] = [z, true];
      }
      const nom = prochainNom(pf);
      pf.interieurs.push({ nom, est: Math.round(a.est * 1000) / 1000, nord: Math.round(a.nord * 1000) / 1000, alt: alt == null ? null : Math.round(alt * 1000) / 1000, calc });
      etat.selPoint = nom;
      enregistrer();
      return bulleDePoint(nom);
    }
  }

  function dansPolygone(p, poly) {
    let r = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const a = poly[i];
      const b = poly[j];
      if ((a.nord > p.nord) !== (b.nord > p.nord) && p.est < ((b.est - a.est) * (p.nord - a.nord)) / (b.nord - a.nord) + a.est) r = !r;
    }
    return r;
  }

  async function finirPlateforme() {
    const s = etat.saisie;
    if (etat.outil === 'ouvrage') return finirOuvrage();
    if (!s?.points || s.points.length < 3) return message('Une plateforme a au moins 3 angles.', 3000);
    if (etat.outil === 'surprof') return finirSurprof();
    if (!avantChangement()) return;
    const pf = nouvellePlateforme(liste(), nouvelIdentifiant());
    const m = (v) => Math.round(v * 1000) / 1000;
    for (const p of s.points) {
      // Angle accroché sur un angle d'une autre plateforme : angle partagé (même nom, lié).
      if (p.lien && p.lien.id !== pf.id && !pf.sommets.some((x) => x.nom === p.lien.nom)) pf.sommets.push({ nom: p.lien.nom, est: m(p.est), nord: m(p.nord), alt: null, calc: false, lien: { ...p.lien } });
      else pf.sommets.push({ nom: prochainNom(pf), est: m(p.est), nord: m(p.nord), alt: p.alt == null ? null : m(p.alt), calc: false });
    }
    for (const x of pf.sommets) pf.talus[x.nom] = { ...TALUS_DEFAUT };
    // Surface de référence : celle de la dernière plateforme, sinon la première proposée.
    pf.terrainId = liste().at(-1)?.terrainId ?? null;
    liste().push(pf);
    etat.choisiId = pf.id;
    etat.saisie = null;
    etat.outil = 'choisir';
    message(`${pf.nom} créée : complétez les altitudes dans le tableau.`, 3000);
    enregistrer();
  }

  /**
   * 0.303.0 : sur-profondeur (creux) ou sur-hauteur (bosse) dessinée dans la plateforme parente : une plateforme posée
   * sur elle, altitudes calculées (fond / dessus à une altitude, ou à une profondeur / hauteur de la parente), talus
   * de même pente partout jusqu'à la parente.
   */
  async function finirSurprof() {
    const s = etat.saisie;
    const parent = liste().find((p) => p.id === s.parentId);
    if (!parent) return message('Plateforme parente introuvable.', 3000);
    const v = await demanderChamps({
      titre: `Dans ${parent.nom}`,
      champs: [
        { cle: 'genre', titre: 'Genre', choix: [['creux', 'Sur-profondeur (creux)'], ['bosse', 'Sur-hauteur (bosse)']], valeur: 'creux' },
        { cle: 'mode', titre: 'Donné par', choix: [['profondeur', 'Une profondeur / hauteur (m) par rapport à la plateforme'], ['altitude', 'Une altitude (m)']], valeur: 'profondeur' },
        { cle: 'valeur', titre: 'Valeur (m)', exemple: '0.80 ou 98.50' },
        { cle: 'talus', titre: 'Talus des bords (H:V)', valeur: '1:1' },
      ],
    });
    if (!v) return;
    const valeur = nombre(v.valeur);
    if (valeur === null) return message('Valeur illisible (exemple : 0.80).', 3500);
    if (!lireHV(v.talus)) return message('Talus illisible : écrivez H:V, par exemple 1:1.', 3500);
    if (!avantChangement()) return;
    const pf = nouvellePlateforme(liste(), nouvelIdentifiant());
    pf.nom = `${v.genre === 'bosse' ? 'Sur-hauteur' : 'Sur-profondeur'} ${pf.lettre}`;
    const m = (x) => Math.round(x * 1000) / 1000;
    for (const p of s.points) pf.sommets.push({ nom: prochainNom(pf), est: m(p.est), nord: m(p.nord), alt: null, calc: true });
    for (const x of pf.sommets) pf.talus[x.nom] = { on: true, deb: v.talus.trim(), rem: v.talus.trim() };
    pf.surprof = { parentId: parent.id, genre: v.genre };
    pf.auto = v.mode === 'altitude' ? { mode: 'altitude', valeur } : { mode: 'decalage', valeur: v.genre === 'bosse' ? Math.abs(valeur) : -Math.abs(valeur) };
    pf.terrainId = surfaceDeUnite(uniteDe(parent).id);
    liste().push(pf);
    etat.choisiId = pf.id;
    etat.saisie = null;
    etat.outil = 'choisir';
    message(`${pf.nom} créée dans ${parent.nom} (une étape posée sur elle).`, 3500);
    enregistrer();
  }

  /** 0.303.0 : mur (face extérieure + épaisseur vers le bâtiment), radier ou dalle (contour + épaisseur). */
  async function finirOuvrage() {
    const s = etat.saisie;
    if (!s?.points || s.points.length < 2) return message('Un ouvrage a au moins 2 points.', 3000);
    const v = await demanderChamps({
      titre: 'Ouvrage',
      champs: [
        { cle: 'type', titre: 'Genre', choix: [['mur', 'Mur (la ligne = face EXTÉRIEURE)'], ['radier', 'Radier'], ['dalle', 'Dalle']], valeur: 'mur' },
        { cle: 'epaisseur', titre: 'Épaisseur (m)', valeur: '0.30' },
        { cle: 'altBas', titre: 'Altitude du bas (m)', exemple: '412.50' },
        { cle: 'hauteur', titre: 'Hauteur du mur (m)', valeur: '3.00', visibleSi: { cle: 'type', valeur: 'mur' } },
        ...(s.ferme ? [] : [{ cle: 'cote', titre: 'Côté du bâtiment (en suivant la ligne)', choix: [['gauche', 'À gauche'], ['droite', 'À droite']], valeur: 'gauche', visibleSi: { cle: 'type', valeur: 'mur' } }]),
      ],
    });
    if (!v) return;
    const epaisseur = nombre(v.epaisseur);
    const altBas = nombre(v.altBas);
    const hauteur = nombre(v.hauteur);
    if (!(epaisseur > 0) || altBas === null || (v.type === 'mur' && !(hauteur > 0))) return message('Épaisseur, altitude du bas et hauteur : des nombres (exemple 0.30, 412.50, 3.00).', 4000);
    if (v.type !== 'mur' && s.points.length < 3) return message('Un radier ou une dalle a au moins 3 points.', 3500);
    if (!avantChangement()) return;
    const m = (x) => Math.round(x * 1000) / 1000;
    const nb = ouvrages().filter((o) => o.type === v.type).length + 1;
    ouvrages().push({
      id: nouvelIdentifiant(), nom: `${{ mur: 'Mur', radier: 'Radier', dalle: 'Dalle' }[v.type]} ${nb}`, type: v.type,
      points: s.points.map((p) => [m(p.est), m(p.nord)]), ferme: v.type !== 'mur' || Boolean(s.ferme),
      epaisseur, altBas, ...(v.type === 'mur' ? { hauteur, cote: v.cote ?? 'gauche' } : {}),
    });
    etat.saisie = null;
    etat.outil = 'choisir';
    message('Ouvrage ajouté : un côté de plateforme posé sur sa face extérieure n\'a pas de talus.', 3500);
    enregistrer();
  }

  /** Fait défiler le tableau jusqu'à la ligne d'un champ (sans y mettre le curseur : la bulle le prend). */
  function surligner(selecteur) {
    const e = page.querySelector(`[data-zone="tableau"] ${selecteur}`);
    const cadre = page.querySelector('[data-zone="tableau"]');
    const tr = e?.closest('tr');
    if (!tr || !cadre) return;
    const h = cadre.querySelector('thead')?.offsetHeight ?? 0;
    if (tr.offsetTop - h < cadre.scrollTop || tr.offsetTop + tr.offsetHeight > cadre.scrollTop + cadre.clientHeight) cadre.scrollTop = Math.max(0, tr.offsetTop - h - 4);
  }

  // --- Bulles (0.304.0) : taper une altitude ou une pente sur le plan, à côté du point ---

  let bulleOuverte = null; // { el, valider, input }
  /** Ouvre une bulle sur le plan en (x, y) (px de la toile) : titre, valeur, valider(texte) ; supprimer() facultatif. */
  function ouvrirBulle({ x, y, titre, valeur = '', valider, supprimer = null }) {
    fermerBulle(false);
    const el = document.createElement('div');
    el.className = 'bulle-plateforme';
    el.innerHTML = `<label>${echapper(titre)}<input type="text" inputmode="text" value="${echapper(valeur)}"></label>
      <button type="button" class="bouton-principal petit" data-bulle="ok" title="Valider (Entrée)">✓</button>
      ${supprimer ? '<button type="button" class="bouton-secondaire petit" data-bulle="retirer" title="Retirer ce point (Suppr)">✕</button>' : ''}`;
    toile.append(el);
    const { largeur, hauteur } = taille();
    const l = el.offsetWidth || 220;
    const h = el.offsetHeight || 40;
    el.style.left = `${Math.max(4, Math.min(largeur - l - 4, x + 12))}px`;
    el.style.top = `${Math.max(4, Math.min(hauteur - h - 4, y - h - 12))}px`;
    const input = el.querySelector('input');
    bulleOuverte = { el, valider, input };
    el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-bulle]');
      if (!b) return;
      if (b.dataset.bulle === 'ok') fermerBulle(true);
      else {
        fermerBulle(false);
        supprimer();
      }
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        ev.stopPropagation();
        fermerBulle(true);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        fermerBulle(false);
      }
    });
    input.focus({ preventScroll: true });
    input.select();
  }
  /** Ferme la bulle ; avec « valider », la valeur tapée est prise. */
  function fermerBulle(valider) {
    const b = bulleOuverte;
    if (!b) return;
    bulleOuverte = null;
    const texte = b.input.value;
    b.el.remove();
    toile?.focus({ preventScroll: true });
    if (valider) b.valider(texte);
  }

  /** Bulle de l'altitude d'un point (angle ou intérieur) de la plateforme choisie, avec ✕ pour le retirer. */
  function bulleDePoint(nom) {
    const pf = choisie();
    if (!pf) return;
    const p = sommetsResolus(pf, liste()).find((x) => x.nom === nom) ?? pf.interieurs.find((x) => x.nom === nom);
    if (!p) return;
    const q = ecran(p);
    const auto = Boolean(pf.auto?.mode) && pf.sommets.some((x) => x.nom === nom);
    ouvrirBulle({
      x: q.x, y: q.y, titre: `${nom} : altitude (m)${auto ? ' (calculée)' : ''}`, valeur: f3(auto ? resultats().get(pf.id)?.altitudesAuto?.get(nom) : p.alt),
      valider: (texte) => {
        if (auto) return message('Altitudes calculées : voir « Les altitudes viennent » à droite.', 3000);
        const v = texte.trim() === '' ? null : nombre(texte);
        if (v === null && texte.trim() !== '') return message('Altitude illisible (exemple : 412.350).', 3000);
        if ((v ?? null) === (p.alt ?? null)) return;
        if (!avantChangement()) return;
        changerAltitude(liste(), pf, nom, v, false);
        enregistrer();
      },
      supprimer: () => retirer(nom),
    });
  }

  /** Bulle de la pente (%) du côté i : l'altitude du point suivant est recalculée. */
  function bulleDePente(i) {
    const pf = choisie();
    const s = sommetsResolus(pf, liste());
    const z = zonesToucher.find((x) => x.type === 'pente' && x.i === i);
    if (!pf || !z) return;
    ouvrirBulle({
      x: z.x, y: z.y, titre: `Pente ${s[i].nom} → ${s[(i + 1) % s.length].nom} (%)`, valeur: f2(penteCote(s, i)),
      valider: (texte) => appliquerPente(pf, i, texte),
    });
  }

  /** Pente tapée (tableau ou bulle) : altitude du sommet suivant = altitude + pente × longueur. */
  function appliquerPente(pf, i, texte) {
    const v = nombre(String(texte).replace('%', ''));
    const s = sommetsResolus(pf, liste());
    const z = altitudeParPente(s, i, v);
    if (z == null) {
      majTableau();
      return message(s[i]?.alt == null ? `Il faut d'abord l'altitude de ${s[i]?.nom}.` : 'Pente illisible (exemple : -2).', 3000);
    }
    if (!avantChangement()) return;
    const suivant = s[(i + 1) % s.length].nom;
    changerAltitude(liste(), pf, suivant, z, true);
    message(`Altitude de ${suivant} calculée par la pente (${v} %).`, 2500);
    return enregistrer();
  }

  /** Retire un point de la plateforme choisie (angle : 3 au moins ; ↶ le remet). */
  function retirer(nom) {
    const pf = choisie();
    if (!pf) return;
    if (pf.sommets.some((x) => x.nom === nom) && pf.sommets.length <= 3) return message('Une plateforme garde au moins 3 angles.', 3000);
    if (!avantChangement()) return;
    const err = retirerPoint(liste(), pf, nom);
    if (err) {
      pile.pop();
      return message(err, 3000);
    }
    if (etat.selPoint === nom) etat.selPoint = null;
    message(`Point ${nom} retiré (↶ Annuler le remet).`, 2500);
    enregistrer();
  }

  function majEtat() {
    const z = page.querySelector('[data-zone="etat"]');
    const c = etat.curseur;
    const pf = choisie();
    const r = pf ? resultats().get(pf.id) : null;
    let zPf = '';
    if (c && r?.triangles?.length) {
      const zz = chercheurAltitude([...r.triangles, ...r.trianglesTalus])(c.est, c.nord);
      if (zz != null) zPf = `<span class="chiffre">Z plateforme ${zz.toFixed(3)}</span>`;
    }
    const vol = r?.volume ? `<span>Déblai ${r.volume.deblai.toFixed(1)} m³ · Remblai ${r.volume.remblai.toFixed(1)} m³</span>` : '';
    z.innerHTML = `${c ? `<span class="chiffre">E ${c.est.toFixed(2)}</span><span class="chiffre">N ${c.nord.toFixed(2)}</span>` : ''}${zPf}${vol}`;
  }

  // --- Événements ---

  page.addEventListener('click', async (ev) => {
    // 0.302.0 : toucher une étape de la liste = la choisir (elle ressort sur le plan et la coupe).
    const li = ev.target.closest('[data-etape]');
    if (li && !ev.target.closest('select, input')) {
      const u = etapesCalculees().ordre.find((x) => x.id === li.dataset.etape);
      if (u) {
        etat.etape = u.id;
        etat.choisiId = u.membres[0].id;
        return majTout();
      }
    }
    const b = ev.target.closest('button');
    if (!b) return;
    const pf = choisie();
    if (b.dataset.action === 'etape-seule' || b.dataset.action === 'etape-toutes') {
      etat.etapeSeule = b.dataset.action === 'etape-seule';
      return majTout();
    }
    if (b.dataset.onglet) {
      etat.onglet = b.dataset.onglet;
      return majTout();
    }
    if (b.dataset.action === 'tracer-coupe') {
      etat.outil = 'coupe';
      etat.saisie = { coupe: b.dataset.coupe };
      return majTout();
    }
    if (b.dataset.action === 'effacer-coupe') {
      if (!avantChangement()) return;
      projet().coupesPlateformes = coupes().filter((k) => k.id !== b.dataset.coupe);
      return enregistrer();
    }
    if (b.dataset.effacerOuvrage || b.dataset.inverserMur) {
      const o = ouvrages().find((x) => x.id === (b.dataset.effacerOuvrage || b.dataset.inverserMur));
      if (!o || !avantChangement()) return;
      if (b.dataset.effacerOuvrage) projet().ouvragesPlateformes = ouvrages().filter((x) => x !== o);
      else o.cote = o.cote === 'droite' ? 'gauche' : 'droite';
      return enregistrer();
    }
    if (b.dataset.action === 'retour') return fermer();
    if (b.dataset.outil) {
      etat.outil = b.dataset.outil;
      etat.saisie = null;
      return majTout();
    }
    if (b.dataset.accroche) {
      const c = b.dataset.accroche;
      if (etat.accroches.has(c)) etat.accroches.delete(c);
      else etat.accroches.add(c);
      return majTout();
    }
    if (b.dataset.voir) {
      etat.voir[b.dataset.voir] = !etat.voir[b.dataset.voir];
      return majTout();
    }
    if (b.dataset.action === 'tout-voir') return cadrer();
    if (b.dataset.action === 'annuler') return annuler();
    if (b.dataset.choisir) {
      etat.choisiId = b.dataset.choisir;
      etat.etape = null;
      etat.selPoint = null;
      etat.selCote = null;
      return majTout();
    }
    if (!pf) return;
    if (b.dataset.action === 'effacer') {
      const ok = await demanderChoix({ titre: `Effacer « ${pf.nom} » ?`, texte: 'Sa surface du projet part aussi. ↶ Annuler la remet.', boutons: [{ cle: 'oui', texte: 'Effacer', principal: true }, { cle: '', texte: 'Garder' }] });
      if (ok !== 'oui' || !avantChangement()) return;
      // Les angles des autres plateformes liés à elle gardent leur position et leur altitude (deviennent propres).
      for (const q of liste()) {
        for (const s of q.sommets) {
          if (s.lien?.id !== pf.id) continue;
          const r = sommetsResolus(q, liste()).find((x) => x.nom === s.nom);
          Object.assign(s, { est: r.est, nord: r.nord, alt: r.alt, calc: r.calc });
          delete s.lien;
          delete s.detache;
        }
      }
      projet().plateformes = liste().filter((q) => q.id !== pf.id);
      etat.choisiId = liste()[0]?.id ?? null;
      return enregistrer();
    }
    if (b.dataset.action === 'retirer-rupture') {
      if (!avantChangement()) return;
      pf.ruptures.pop();
      return enregistrer();
    }
    if (b.dataset.retirerPoint) return retirer(b.dataset.retirerPoint);
    if (b.dataset.lien !== undefined) {
      const s = pf.sommets[Number(b.dataset.lien)];
      if (!s?.lien || !avantChangement()) return;
      if (s.detache) {
        delete s.detache;
        message(`${s.nom} relié : même altitude que l'autre plateforme.`, 2500);
      } else {
        const r = sommetsResolus(pf, liste()).find((x) => x.nom === s.nom);
        s.detache = true;
        s.alt = r.alt;
        s.calc = false;
        message(`${s.nom} détaché : même position, altitude propre (une marche).`, 3000);
      }
      return enregistrer();
    }
    if (b.dataset.action === 'interpoler') {
      const r = interpolerContour(sommetsResolus(pf, liste()));
      if (!r.length) return message('Rien à interpoler : il faut des altitudes connues autour des vides.', 3000);
      if (!avantChangement()) return;
      for (const { nom, alt } of r) changerAltitude(liste(), pf, nom, alt, true);
      message(`${r.length} altitude(s) interpolée(s) le long du contour.`, 2500);
      return enregistrer();
    }
    if (b.dataset.action === 'effacer-calculees') {
      if (!avantChangement()) return;
      for (const p of sommetsResolus(pf, liste())) if (p.calc) changerAltitude(liste(), pf, p.nom, null);
      for (const p of pf.interieurs) if (p.calc) Object.assign(p, { alt: null, calc: false });
      return enregistrer();
    }
    if (b.dataset.action === 'dz') {
      const v = nombre(page.querySelector('[data-champ="dz"]').value);
      if (v === null || v === 0) return message('Tapez un Δ Z (m), par exemple -0.25.', 3000);
      if (!avantChangement()) return;
      const avec = page.querySelector('[data-champ="dzQui"]').value === 'toutes';
      appliquerDeltaZ(liste(), pf.id, v, avec);
      message(`Δ Z ${v > 0 ? '+' : ''}${v.toFixed(3)} m : ${avec ? 'plateformes accrochées comprises' : `${pf.nom} seule (les angles partagés non détachés bougent aussi)`}.`, 3500);
      return enregistrer();
    }
  });

  // Le tableau est redessiné après un changement : on attend la fin de l'événement (un champ qui perd la main pendant
  // qu'on le remplace provoque une erreur du navigateur).
  page.addEventListener('change', (ev) => setTimeout(() => changement(ev.target), 0));
  async function changement(c) {
    if (!c.isConnected && !c.dataset) return;
    const pf = choisie();
    if (!pf) return;
    if (c.dataset.alt !== undefined && pf.auto?.mode) return majTableau();
    if (c.dataset.alt !== undefined) {
      const v = c.value.trim() === '' ? null : nombre(c.value);
      if (v === null && c.value.trim() !== '') return message('Altitude illisible (exemple : 412.350).', 3000);
      if (!avantChangement()) return;
      changerAltitude(liste(), pf, c.dataset.alt, v, false);
      return enregistrer();
    }
    if (c.dataset.pente !== undefined) return appliquerPente(pf, Number(c.dataset.pente), c.value);
    if (c.dataset.talusOn || c.dataset.talusDeb || c.dataset.talusRem) {
      const nom = c.dataset.talusOn ?? c.dataset.talusDeb ?? c.dataset.talusRem;
      if ((c.dataset.talusDeb || c.dataset.talusRem) && !lireHV(c.value)) {
        majTableau();
        return message('Pente du talus illisible : écrivez H:V, par exemple 3:2.', 3500);
      }
      if (!avantChangement()) return;
      const t = { ...TALUS_DEFAUT, ...(pf.talus[nom] ?? {}) };
      if (c.dataset.talusOn) t.on = c.checked;
      if (c.dataset.talusDeb) t.deb = c.value.trim();
      if (c.dataset.talusRem) t.rem = c.value.trim();
      pf.talus[nom] = t;
      return enregistrer();
    }
    // 0.303.0 : altitudes automatiques, ouvrages
    if (c.dataset.auto) {
      const cle = c.dataset.auto;
      if (cle === 'mode') {
        if (!avantChangement()) return;
        if (!c.value) delete pf.auto;
        else pf.auto = { ...(pf.auto ?? {}), mode: c.value, valeur: pf.auto?.valeur ?? (c.value === 'altitude' ? (sommetsResolus(pf, liste()).find((x) => x.alt != null)?.alt ?? 0) : 0.5) };
        return enregistrer();
      }
      const v = cle === 'valeur' ? nombre(c.value) : c.value || null;
      if (cle === 'valeur' && v === null) return message('Nombre illisible.', 2500);
      if (!avantChangement()) return;
      pf.auto = { ...pf.auto, [cle]: v };
      return enregistrer();
    }
    if (c.dataset.champOuvrage) {
      const o = ouvrages().find((x) => x.id === c.dataset.ouvrage);
      const v = nombre(c.value);
      if (!o || v === null || (c.dataset.champOuvrage !== 'altBas' && !(v > 0))) return message('Nombre illisible.', 2500);
      if (!avantChangement()) return;
      o[c.dataset.champOuvrage] = v;
      return enregistrer();
    }
    // 0.302.0 : sur quoi l'étape est posée ; groupe
    if (c.dataset.uniteRef) {
      if (!avantChangement()) return;
      const u = uniteDe(pf);
      u.source.terrainId = c.value || null;
      return enregistrer();
    }
    if (c.dataset.pf === 'groupeId') {
      let id = c.value || null;
      if (id === '__nouveau') {
        const nom = await demanderTexte({ titre: 'Nom du groupe', valeur: `Groupe ${groupes().length + 1}` });
        if (!nom?.trim()) return majTout();
        if (!avantChangement()) return;
        id = nouvelIdentifiant();
        groupes().push({ id, nom: nom.trim(), couleur: COULEURS_PLATEFORMES[(groupes().length + 3) % COULEURS_PLATEFORMES.length], terrainId: pf.terrainId ?? null });
      } else if (!avantChangement()) return;
      if (id) pf.groupeId = id;
      else delete pf.groupeId;
      etat.etape = null;
      return enregistrer();
    }
    if (c.dataset.groupeNom !== undefined) {
      const g = groupeDe(pf);
      if (!g || !c.value.trim() || !avantChangement()) return majTout();
      g.nom = c.value.trim();
      return enregistrer();
    }
    if (c.dataset.pf) {
      if (!avantChangement()) return;
      const cle = c.dataset.pf;
      if (cle === 'nom') {
        const nom = c.value.trim();
        if (!nom) return majTout();
        pf.nom = nom;
      } else if (cle === 'couleur') pf.couleur = c.value;
      else if (cle === 'terrainId') pf.terrainId = c.value || null;
      return enregistrer();
    }
  }

  page.addEventListener('keydown', (ev) => {
    const dansChamp = ev.target.matches?.('input, select, textarea');
    if (ev.key.toLowerCase() === 'z' && (ev.ctrlKey || ev.metaKey) && !dansChamp) {
      ev.preventDefault();
      return annuler();
    }
    if (ev.key === 'Enter' && ['plateforme', 'surprof', 'ouvrage'].includes(etat.outil) && etat.saisie && !dansChamp) {
      ev.preventDefault();
      return finirPlateforme();
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      echap();
    }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && !dansChamp && etat.selPoint && etat.outil === 'choisir') {
      ev.preventDefault();
      retirer(etat.selPoint);
    }
  });

  dessiner();
  return { fermer };
}
