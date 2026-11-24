// Application Plateformes (0.300.0, Expert, site PC et Topo Bureau ; décisions du 24.11, maquette validée) :
// dessiner des plateformes (surfaces 3D) avec une altitude à chaque angle, des pentes, des lignes de rupture, des points
// intérieurs, des talus (déblai / remblai, berme) jusqu'à une surface de référence, et les volumes. Chaque plateforme
// devient une surface du projet (« Surf-Plateforme A ») : volumes, Implanter › Surface, exports LandXML / DXF, Drive.
// Calculs : topo/plateforme.js. Page plein écran (comme Plans de chantier) : ruban en haut, bandeau de la plateforme
// choisie, plan, tableau unique (points puis côtés), panneau à droite (liste, talus, Δ Z, volumes).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { demanderChoix } from '../outils/choix.js';
import { dessinerPlansDxf } from '../plan/dxf-canvas.js';
import { cadrerSurPoints, versEcran, versTerrain, deplacer, zoomer } from '../plan/vue.js';
import { accrocher, sourcesDesPlans } from '../topo/accroche.js';
import { trianglerAvecContraintes, volumeEntreSurfaces, altitudeSurTriangle } from '../topo/volume.js';
import { nouvelIdentifiant, avecPrefixe, PREFIXE_SURFACE } from '../topo/surface.js';
import {
  nouvellePlateforme, prochainNom, sommetsResolus, changerAltitude, penteCote, altitudeParPente, interpolerContour,
  ajouterPointMilieu, appliquerDeltaZ, cotePartage, trianglesPlateforme, talusPlateforme, trianglesTalus, reglageDuCote,
  bermeDe, pointsEtFaces, TALUS_DEFAUT, BERME_DEFAUT, lireHV,
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
  const choisie = () => liste().find((p) => p.id === etat.choisiId) ?? null;

  const etat = {
    choisiId: liste()[0]?.id ?? null,
    outil: 'choisir', // choisir | plateforme | rupture | interieur | construction
    saisie: null, // dessin en cours : { points: [{ est, nord, alt, lien }] } (plateforme) ou { debut } (rupture, construction)
    accroches: new Set(['point', 'sommet']),
    voir: { noms: true, alt: true, pentes: true, tri: true, talus: true },
    altSuivante: '', // altitude donnée au prochain point cliqué (vide = celle de l'accroche, sinon aucune)
    selPoint: null, selCote: null, // point / côté surlignés dans le tableau
    curseur: null,
  };
  let pile = [];
  let vue = null;
  let fond = null;
  let dessus = null;
  let toile = null;
  let geste = null;
  const pointeurs = new Map();

  // --- Annuler, enregistrer ---

  const instantane = () => JSON.stringify({ p: projet().plateformes ?? [], c: projet().constructionsPlateformes ?? [] });
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
    const { p, c } = JSON.parse(pile.pop());
    projet().plateformes = p;
    projet().constructionsPlateformes = c;
    if (!choisie()) etat.choisiId = p[0]?.id ?? null;
    enregistrer();
  }

  // Calculs gardés tant que les plateformes et la surface de référence ne changent pas.
  let memo = { cle: '', resultats: new Map() };
  function resultats() {
    const cle = instantane() + JSON.stringify(liste().map((p) => [p.terrainId, trianglesDeSurface(p.terrainId)?.length ?? 0]));
    if (memo.cle === cle) return memo.resultats;
    const r = new Map();
    for (const pf of liste()) r.set(pf.id, calculer(pf));
    memo = { cle, resultats: r };
    return r;
  }

  /** Triangles, talus et volumes d'une plateforme : { sommets, triangles, erreur, talus, trianglesTalus, volume, erreursTalus }. */
  function calculer(pf) {
    const tous = liste();
    const sommets = sommetsResolus(pf, tous);
    const t = trianglesPlateforme(pf, tous, trianglerAvecContraintes);
    const res = { sommets, triangles: t.triangles ?? [], erreur: t.erreur ?? null, talus: null, trianglesTalus: [], volume: null, erreursTalus: [] };
    const terrain = pf.terrainId ? trianglesDeSurface(pf.terrainId) : [];
    if (!t.erreur && terrain.length) {
      const altitudeTerrain = chercheurAltitude(terrain);
      res.talus = talusPlateforme(sommets, (i) => reglageDuCote(tous, pf, i), bermeDe(pf), altitudeTerrain, { pas: 1 });
      res.erreursTalus = res.talus.erreurs;
      res.trianglesTalus = trianglesTalus(res.talus);
      const v = volumeEntreSurfaces([...res.triangles, ...res.trianglesTalus], terrain);
      res.volume = { remblai: v.remblai, deblai: v.deblai, surface: v.surfacePlan, horsTerrain: v.surfaceNonCouverte };
    }
    return res;
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

  /** Surfaces du projet « Surf-<nom> » (type 'plateforme') refaites d'après les plateformes ; celles des plateformes effacées partent. */
  function synchroniserSurfaces() {
    const pr = projet();
    const ids = new Set(liste().map((p) => p.id));
    const parties = new Set(pr.surfaces.filter((s) => s.type === 'plateforme' && !ids.has(s.plateformeId)).map((s) => s.id));
    pr.surfaces = pr.surfaces.filter((s) => !parties.has(s.id));
    if (parties.size) pr.calculs = (pr.calculs ?? []).filter((c) => !parties.has(c.surface1Id) && !parties.has(c.surface2Id));
    const r = resultats();
    for (const pf of liste()) {
      const res = r.get(pf.id);
      let s = pr.surfaces.find((x) => x.type === 'plateforme' && x.plateformeId === pf.id);
      if (res.erreur || !res.triangles.length) {
        if (s) s.erreurPlateforme = res.erreur ?? 'vide';
        continue;
      }
      const { points: pts, faces } = pointsEtFaces([...res.triangles, ...res.trianglesTalus], `${pf.lettre}-`);
      if (!s) {
        s = { id: nouvelIdentifiant(), type: 'plateforme', plateformeId: pf.id };
        pr.surfaces.push(s);
      }
      Object.assign(s, { nom: avecPrefixe(pf.nom, PREFIXE_SURFACE), nomFichier: pf.nom, points: pts, faces });
      delete s.erreurPlateforme;
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
  page.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    if (etat.saisie) {
      etat.saisie = null;
      return majTout();
    }
    fermer();
  });

  // --- Page ---

  const OUTILS = [
    ['choisir', '<path d="M5 3l14 8-6 2-2 6z"/>', 'Choisir', 'Choisir une plateforme, glisser un angle'],
    ['plateforme', '<path d="M4 18l3-12 12 2 1 10z"/>', 'Plateforme', 'Nouvelle plateforme : cliquer les angles (accroches), finir sur le 1er angle ou Entrée'],
    ['rupture', '<path d="M4 18L20 6" stroke-width="2.6"/>', 'Rupture', 'Ligne de rupture : cliquer deux points existants de la plateforme'],
    ['interieur', '<rect x="4" y="4" width="16" height="16" rx="1"/><circle cx="12" cy="12" r="2.2"/>', 'Pt intér.', 'Point intérieur isolé : cliquer dans la plateforme'],
    ['construction', '<path d="M3 20L21 4" stroke-dasharray="3 3"/>', 'Constr.', 'Ligne de construction (2D, pour l\'accroche) : 2 clics'],
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
          <label class="champ-alt-suivante" title="Altitude donnée au prochain point cliqué (vide : altitude du point accroché s'il en a une)">Alt. du clic <input type="text" inputmode="text" data-champ="altSuivante" value="${echapper(etat.altSuivante)}" placeholder="m"></label>
        </div>
        <div class="bandeau-plateforme" data-zone="bandeau"></div>
        <p class="consigne-calage" data-zone="consigne"></p>
        <div class="travail-plateformes">
          <div class="gauche-plateformes">
            <div class="vue-calage vue-plateformes"><div class="toile-plateformes" data-toile></div><div class="pied-vue etat-chantier" data-zone="etat"></div></div>
            <section class="carte-calage tableau-plateforme"><h3 data-zone="titre-tableau">Tableau</h3><div class="cadre-tableau-plateforme" data-zone="tableau"></div>
              <div class="barre-calage"><button type="button" class="bouton-secondaire petit" data-action="interpoler">Interpoler les vides</button><button type="button" class="bouton-secondaire petit" data-action="effacer-calculees">Effacer les calculées</button></div></section>
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
    majConsigne();
    majEtat();
    redessiner();
  }

  function majConsigne() {
    const c = page.querySelector('[data-zone="consigne"]');
    const s = etat.saisie;
    c.textContent = {
      choisir: choisie() ? 'Glisser un carré = déplacer l\'angle ; « + » au milieu d\'un côté = ajouter un point ; flèche de pente = taper la pente ; toucher un angle = son altitude.' : 'Choisissez une plateforme (clic dedans) ou dessinez-en une (outil « Plateforme »).',
      plateforme: s?.points?.length ? `${s.points.length} angle(s) : cliquez le suivant ; cliquez le 1er angle (ou Entrée) pour finir ; Échap abandonne.` : 'Cliquez les angles de la plateforme (accroche sur un angle d\'une autre plateforme = angle partagé). « Alt. du clic » donne l\'altitude.',
      rupture: s?.debut ? `Ligne de rupture depuis ${s.debut} : cliquez le 2e point.` : 'Ligne de rupture : cliquez un point existant de la plateforme choisie, puis un autre.',
      interieur: 'Cliquez dans la plateforme choisie : point intérieur (altitude : « Alt. du clic », sinon celle de la surface).',
      construction: s?.debut ? 'Cliquez le 2e point de la ligne de construction.' : 'Ligne de construction : 2 clics (elle sert seulement à l\'accroche).',
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
        <td><input type="text" inputmode="text" class="${p.calc ? 'calc' : ''}" value="${f3(p.alt)}" data-alt="${echapper(p.nom)}" aria-label="Altitude ${echapper(p.nom)}"></td>
        <td class="centre">${src.lien ? `<button type="button" class="bouton-lien ${src.detache ? 'detache' : ''}" data-lien="${i}" title="${src.detache ? 'Détaché : altitude propre (marche). Toucher = relier' : 'Lié : même altitude que l\'autre plateforme. Toucher = détacher'}">${src.detache ? '✂' : '🔗'}</button>` : partage ? '<span title="Angle partagé par une plateforme accrochée">🔗</span>' : ''}</td>
        <td class="sep" colspan="4"></td></tr>`);
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
        <td><input type="text" class="hv" value="${echapper(t.rem)}" data-talus-rem="${echapper(src.nom)}" ${t.on ? '' : 'disabled'} aria-label="Talus en remblai (H:V)"></td>`}</tr>`);
    });
    for (const p of pf.interieurs) {
      lignes.push(`<tr class="ligne-point interieur ${etat.selPoint === p.nom ? 'choisi' : ''}"><td>${echapper(p.nom)} <small>intérieur</small></td>
        <td><input type="text" inputmode="text" class="${p.calc ? 'calc' : ''}" value="${f3(p.alt)}" data-alt="${echapper(p.nom)}" aria-label="Altitude ${echapper(p.nom)}"></td>
        <td class="centre"><button type="button" class="bouton-lien" data-retirer-interieur="${echapper(p.nom)}" title="Retirer ce point intérieur">✕</button></td><td class="sep" colspan="4"></td></tr>`);
    }
    z.innerHTML = `<table class="table-plateforme"><thead>
      <tr><th colspan="3">Point (1 point)</th><th colspan="4" class="groupe-cote sep">Côté (entre 2 points)</th></tr>
      <tr><th>Point / côté</th><th>Altitude</th><th class="centre">Lien</th><th class="sep">Pente %</th><th class="centre">Talus</th><th>Déblai H:V</th><th>Remblai H:V</th></tr>
      </thead><tbody>${lignes.join('') || '<tr><td colspan="7" class="aide-calage">Aucun point.</td></tr>'}</tbody></table>`;
  }

  // --- Panneau : liste, talus, Δ Z, volumes ---

  function majPanneau() {
    const z = page.querySelector('[data-zone="panneau"]');
    const pf = choisie();
    const r = pf ? resultats().get(pf.id) : null;
    const b = { ...BERME_DEFAUT, ...(pf?.berme ?? {}) };
    const refs = surfaces().filter((s) => !liste().some((p) => projet().surfaces.find((x) => x.id === s.id)?.plateformeId === p.id));
    z.innerHTML = `
      <h3>Plateformes</h3>
      <div class="liste-plateformes">${liste().map((p) => `<button type="button" data-choisir="${echapper(p.id)}" class="${p.id === etat.choisiId ? 'actif' : ''}"><i style="background:${echapper(p.couleur)}"></i>${echapper(p.nom)}<small>${p.sommets.some((s) => s.lien) ? 'accrochée' : ''}</small></button>`).join('') || '<p class="aide-calage">Aucune : outil « Plateforme ».</p>'}</div>
      ${pf ? `
      <h3>Talus</h3>
      <label class="champ-calage"><span>Surface de référence</span><select data-pf="terrainId"><option value="">— aucune (pas de talus) —</option>${refs.map((s) => `<option value="${echapper(s.id)}" ${s.id === pf.terrainId ? 'selected' : ''}>${echapper(s.nom)}</option>`).join('')}</select></label>
      <label class="case-chantier"><input type="checkbox" data-berme="on" ${b.on ? 'checked' : ''}> Berme (plate)</label>
      ${b.on ? `<div class="grille-berme">
        <span>① Hauteur plateforme → berme</span><span><input type="text" class="hv" data-berme="hauteur" value="${f2(b.hauteur)}"> m</span>
        <span>② Largeur de la berme</span><span><input type="text" class="hv" data-berme="largeur" value="${f2(b.largeur)}"> m</span>
        <span>③ Talus après la berme</span><span>D <input type="text" class="hv" data-berme="deb" value="${echapper(b.deb)}"> R <input type="text" class="hv" data-berme="rem" value="${echapper(b.rem)}"></span>
      </div><p class="aide-calage">① = pentes du tableau, côté par côté.</p>` : ''}
      ${r?.erreursTalus?.length ? `<p class="note-calage alerte">⚠ ${r.erreursTalus.map(echapper).join('<br>')}</p>` : ''}
      <h3>Volumes (avec talus)</h3>
      ${r?.volume ? `<p class="resume-volume"><span class="chiffre deblai">Déblai ${r.volume.deblai.toFixed(1)} m³</span> · <span class="chiffre remblai">Remblai ${r.volume.remblai.toFixed(1)} m³</span><br><span class="aide-calage">Emprise ${r.volume.surface.toFixed(1)} m²${r.volume.horsTerrain > 0.01 ? ` · ⚠ ${r.volume.horsTerrain.toFixed(1)} m² hors de la surface de référence` : ''}</span></p>`
    : `<p class="aide-calage">${r?.erreur ? 'Plateforme incomplète.' : 'Choisissez une surface de référence.'}</p>`}
      <h3>Delta Z</h3>
      <div class="ligne-dz"><input type="text" inputmode="text" class="hv" data-champ="dz" value="0.000" aria-label="Delta Z en m"> m
        <select data-champ="dzQui" aria-label="À quoi appliquer"><option value="seule">Cette plateforme seule</option><option value="toutes">Avec les accrochées</option></select>
        <button type="button" class="bouton-secondaire petit" data-action="dz">Appliquer</button></div>` : ''}`;
  }

  // --- Vue (plan) ---

  let observateur = null;
  function monterVue() {
    toile = page.querySelector('[data-toile]');
    fond = document.createElement('canvas');
    dessus = document.createElement('canvas');
    toile.append(fond, dessus);
    vue = null;
    observateur?.disconnect();
    observateur = new ResizeObserver(() => {
      if (!toile.clientWidth) return;
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
    toile.addEventListener('dblclick', () => {
      if (etat.outil === 'plateforme') finirPlateforme();
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
    if (etat.voir.talus) for (const pf of liste()) dessinerTalus(ctx, r.get(pf.id));
    for (const pf of liste()) dessinerPlateforme(ctx, pf, r.get(pf.id), pf.id === etat.choisiId);
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

  function dessinerTalus(ctx, res) {
    if (!res?.talus) return;
    const cols = res.talus.colonnes;
    // Barbules (une sur deux plus courte) du bord à l'entrée en terre, et pied du talus en tirets.
    cols.forEach((c, i) => {
      const couleur = c.nature === 'deblai' ? '#b45309' : '#15803d';
      ctx.strokeStyle = couleur;
      ctx.lineWidth = 1;
      const a = ecran(c.points[0]);
      const b = ecran(c.points.at(-1));
      const k = c.sommet != null ? 1 : i % 2 ? 0.5 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
      ctx.stroke();
    });
    const suite = (indice, couleur, tirets, epaisseur) => {
      ctx.strokeStyle = couleur;
      ctx.setLineDash(tirets);
      ctx.lineWidth = epaisseur;
      ctx.beginPath();
      let avant = null;
      for (const c of cols) {
        const p = indice === -1 ? c.points.at(-1) : c.points.length === 4 ? c.points[indice] : null;
        if (!p) {
          avant = null;
          continue;
        }
        const q = ecran(p);
        if (avant && avant.chaine === c.chaine) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
        avant = c;
      }
      if (res.talus.ferme && cols.length > 2) {
        const p = indice === -1 ? cols[0].points.at(-1) : cols[0].points.length === 4 ? cols[0].points[indice] : null;
        if (p && avant) {
          const q = ecran(p);
          ctx.lineTo(q.x, q.y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    suite(-1, '#475569', [4, 3], 1);
    // Berme : ses deux bords en brun épais pâle
    suite(1, 'rgba(146,64,14,0.45)', [], 3);
    suite(2, 'rgba(146,64,14,0.45)', [], 3);
  }

  function dessinerPlateforme(ctx, pf, res, estChoisie) {
    const s = res?.sommets ?? sommetsResolus(pf, liste());
    if (!s.length) return;
    const pts = s.map(ecran);
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.globalAlpha = estChoisie ? 0.22 : 0.1;
    ctx.fillStyle = pf.couleur;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pf.couleur;
    ctx.lineWidth = estChoisie ? 2.5 : 1.5;
    ctx.stroke();
    if (etat.voir.tri && res?.triangles?.length) {
      ctx.globalAlpha = 0.45;
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
      ctx.globalAlpha = 1;
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
        const u = 0.7;
        const cx = a.x + (b.x - a.x) * u;
        const cy = a.y + (b.y - a.y) * u;
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
        ctx.textAlign = 'center';
        texte(ctx, `${Math.abs(pente).toFixed(2)} %`, 0, retourne ? 14 : -6, '#1b2b36', 10);
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
      etiquette(ctx, p, q, estChoisie);
      if (p.detache && estChoisie) texte(ctx, 'détaché', q.x + 8, q.y + 16, '#dc2626', 10);
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
      etiquette(ctx, p, q, estChoisie);
    }
  }

  function etiquette(ctx, p, q, estChoisie) {
    if (!etat.voir.noms && !etat.voir.alt) return;
    let x = q.x + 8;
    const y = q.y - 8;
    if (etat.voir.noms) {
      texte(ctx, `${p.nom} `, x, y, '#1b2b36', 11, true);
      ctx.font = '700 11px system-ui, sans-serif';
      x += ctx.measureText(`${p.nom} `).width;
    }
    if (etat.voir.alt) texte(ctx, p.alt == null ? '—' : f3(p.alt), x, y, p.calc ? '#5f6d77' : '#1b2b36', 11, false, Boolean(p.calc));
    if (!estChoisie) return;
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
    if (!pf) return null;
    const t = pxTol();
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
    // Toucher le plan quitte le champ en cours (sinon Entrée / Ctrl+Z restent dans le champ).
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
      if (geste.cible && ['sommet', 'interieur', 'plus'].includes(geste.cible.type)) {
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
      if (cible?.type === 'pente') return viser(`[data-pente="${cible.i}"]`, () => { etat.selCote = cible.i; etat.selPoint = null; });
      if (cible?.type === 'sommet' || cible?.type === 'interieur') return viser(`[data-alt="${CSS.escape(cible.nom)}"]`, () => { etat.selPoint = cible.nom; etat.selCote = null; });
      // Clic dans une plateforme = la choisir.
      const dedans = liste().filter((q) => {
        const s = sommetsResolus(q, liste());
        return s.length >= 3 && dansPolygone(pos, s);
      });
      const nouvelle = dedans.find((q) => q.id !== etat.choisiId) ?? dedans[0];
      if (nouvelle) {
        etat.choisiId = nouvelle.id;
        etat.selPoint = null;
        etat.selCote = null;
        majTout();
      }
      return;
    }
    const a = pointAccroche(pos);
    const altTapee = nombre(etat.altSuivante);
    if (etat.outil === 'plateforme') {
      const s = etat.saisie ?? (etat.saisie = { points: [] });
      const premier = s.points[0];
      if (premier && s.points.length >= 3 && Math.hypot(ecran(premier).x - ecran(a).x, ecran(premier).y - ecran(a).y) <= pxTol()) return finirPlateforme();
      s.points.push({ est: a.est, nord: a.nord, alt: altTapee ?? a.altitude ?? null, lien: a.lien ?? null });
      return majTout();
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
      // Altitude : tapée, sinon celle de l'accroche, sinon celle de la surface actuelle (calculée).
      let alt = altTapee ?? a.altitude ?? null;
      let calc = false;
      if (alt == null) {
        const tri = resultats().get(pf.id)?.triangles ?? [];
        const z = tri.length ? chercheurAltitude(tri)(a.est, a.nord) : null;
        if (z != null) [alt, calc] = [z, true];
      }
      const nom = prochainNom(pf);
      pf.interieurs.push({ nom, est: Math.round(a.est * 1000) / 1000, nord: Math.round(a.nord * 1000) / 1000, alt: alt == null ? null : Math.round(alt * 1000) / 1000, calc });
      etat.selPoint = nom;
      return enregistrer();
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

  function finirPlateforme() {
    const s = etat.saisie;
    if (!s?.points || s.points.length < 3) return message('Une plateforme a au moins 3 angles.', 3000);
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

  /** Met le curseur dans un champ du tableau (après avoir surligné sa ligne). */
  function viser(selecteur, avant) {
    avant?.();
    majTout();
    const e = page.querySelector(`[data-zone="tableau"] ${selecteur}`);
    if (!e) return;
    e.closest('tr')?.scrollIntoView({ block: 'nearest' });
    e.focus({ preventScroll: true });
    e.select?.();
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
    const b = ev.target.closest('button');
    if (!b) return;
    const pf = choisie();
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
    if (b.dataset.retirerInterieur) {
      if (!avantChangement()) return;
      pf.interieurs = pf.interieurs.filter((p) => p.nom !== b.dataset.retirerInterieur);
      pf.ruptures = pf.ruptures.filter(([x, y]) => x !== b.dataset.retirerInterieur && y !== b.dataset.retirerInterieur);
      return enregistrer();
    }
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
  function changement(c) {
    if (!c.isConnected && !c.dataset) return;
    const pf = choisie();
    if (c.dataset.champ === 'altSuivante') {
      etat.altSuivante = c.value;
      return;
    }
    if (!pf) return;
    if (c.dataset.alt !== undefined) {
      const v = c.value.trim() === '' ? null : nombre(c.value);
      if (v === null && c.value.trim() !== '') return message('Altitude illisible (exemple : 412.350).', 3000);
      if (!avantChangement()) return;
      changerAltitude(liste(), pf, c.dataset.alt, v, false);
      return enregistrer();
    }
    if (c.dataset.pente !== undefined) {
      const i = Number(c.dataset.pente);
      const v = nombre(c.value.replace('%', ''));
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
    if (c.dataset.berme) {
      const cle = c.dataset.berme;
      const b = { ...BERME_DEFAUT, ...(pf.berme ?? {}) };
      if (cle === 'on') b.on = c.checked;
      else if (cle === 'deb' || cle === 'rem') {
        if (!lireHV(c.value)) return message('Pente illisible : écrivez H:V, par exemple 3:2.', 3500);
        b[cle] = c.value.trim();
      } else {
        const v = nombre(c.value);
        if (v === null || v < 0) return message('Nombre illisible.', 2500);
        b[cle] = v;
      }
      if (!avantChangement()) return;
      pf.berme = b;
      return enregistrer();
    }
  }

  page.addEventListener('keydown', (ev) => {
    const dansChamp = ev.target.matches?.('input, select, textarea');
    if (ev.key.toLowerCase() === 'z' && (ev.ctrlKey || ev.metaKey) && !dansChamp) {
      ev.preventDefault();
      return annuler();
    }
    if (ev.key === 'Enter' && etat.outil === 'plateforme' && etat.saisie && !dansChamp) {
      ev.preventDefault();
      return finirPlateforme();
    }
    if (ev.key === 'Escape' && etat.saisie) {
      ev.preventDefault();
      ev.stopPropagation();
      etat.saisie = null;
      majTout();
    }
  });

  dessiner();
  return { fermer };
}
