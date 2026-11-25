// Application « Comparer des PDF » (0.282.0, Expert, site PC et Topo Bureau ; décisions du 22.11, maquette validée) :
// comparer deux indices d'un plan PDF (ou deux dossiers de plans), comme « PlanDiff Pro », rangé dans le projet.
// Page plein écran à part (comme Calage de plans) : Comparaisons (liste, nouvelle) · Comparer (outils en haut, plan au
// centre, modifications / annotations à droite) · Rapport (PDF avec pdf-lib, image PNG).
// Calculs : topo/comparaison-pdf.js ; lecture des PDF : lecture.js ; détection en arrière-plan : calculs.js ;
// calage automatique : celui du calage de plans (calage/calcul-auto.js) ; rapport : rapport.js.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { demanderChoix, demanderTexte } from '../outils/choix.js';
import { nomFichierExport } from '../outils/nom-fichier.js';
import {
  ALIGNEMENT_NEUTRE, MM_PAR_POINT, appliquerAlignement, matriceAlignement, composer, masqueEncre, superposer, teinter,
  differencesTextes, listerModifications, titreModification, apparierPages, motsDeLaPage, nomSansIndice, apparierFichiers,
  mesurerLongueur, mesurerSurface, etalonner, arcsDeNuage, alignementDepuisSimilitude, seTouchent,
  dilater, inverserAlignement, alignementSurAxes, alignementLeLongDeLAxe, accrocherSegments, morceauxDifferents,
} from '../topo/comparaison-pdf.js';
import { documentDe, fermerDocuments, taillePage, rendrePage, segmentsDeLaPage, textesDeLaPage, base64DesOctets, octetsDeBase64 } from './lecture.js';
import { detecterEnArrierePlan } from './calculs.js';
import { calculerAuto } from '../calage/calcul-auto.js';

const COULEURS_DEPART = { a: '#dc2626', b: '#2563eb' }; // A = rouge, B = bleu (réponse du 22.11) ; au choix depuis la 0.316.0
const GRIS_IDENTIQUE = [150, 158, 166];
const LETTRES_PLANS = ['A', 'B', 'C', 'D', 'E']; // jusqu'à 5 plans à comparer, deux à la fois (0.316.0)
const rgbDeCss = (css) => [1, 3, 5].map((i) => parseInt(String(css).slice(i, i + 2), 16) || 0);
const ETATS = [['toutes', 'Toutes'], ['traiter', 'À traiter'], ['validee', 'Validées'], ['ignoree', 'Ignorées']];
const MODES = [['superpose', '◩', 'Superposition'], ['rideau', '◫', 'Rideau'], ['clignote', '◐', 'Clignotement'], ['cote', '▥', 'Côte à côte']];
const ANNOTATIONS = [['nuage', '☁', 'Nuage'], ['fleche', '↗', 'Flèche'], ['note', '✎', 'Note'], ['distance', '↔', 'Distance'], ['surface', '▱', 'Surface'], ['etalonner', '📏', 'Étalonner']];
const PX_DETECTION = 3600; // grand côté de l'image comparée (pixels)
const nouvelId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const dateCourte = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-CH') : '');
const fixe = (x, d) => (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d);

/**
 * Ouvre la page. projet (projet.comparaisons) ; modifie() : enregistrer (et Drive) ; qui() : nom de la personne
 * (validations) ; enregistrer(blob, nom) ; quandRetour() ; message(texte, durée, options).
 */
export function ouvrirComparateur({ projet, modifie, qui = () => '', enregistrer, quandRetour = null, message = () => {} }) {
  projet.comparaisons ??= [];
  const page = document.createElement('dialog');
  page.className = 'page-comparateur';
  document.body.append(page);
  page.showModal();

  const etat = {
    ecran: 'liste', comparaison: null, planche: 0, mode: 'superpose', outil: null, saisie: [], filtre: 'toutes',
    panneau: 'modifs', choisie: null, verrouEchelle: true, rideau: 0.5, occupe: '', nouvelle: null,
    rapport: { planches: true, ignorees: false, commentaires: true, fond: 'b', vectoriel: false },
  };
  let vue = null; // { zoom (px CSS par point), cx, cy (point au centre) }
  let minuterieRendu = 0;
  let clignotement = 0;
  let images = null; // dernier rendu : { vue, A (ImageData teinté), B, superpose, w, h, dpr }

  const comp = () => etat.comparaison;
  /** Couleurs de A et de B (au choix, gardées dans la comparaison) : CSS et [r, g, b]. */
  const couleursCss = () => ({ ...COULEURS_DEPART, ...(comp()?.couleurs ?? {}) });
  const couleursRgb = () => ({ a: rgbDeCss(couleursCss().a), b: rgbDeCss(couleursCss().b), identique: GRIS_IDENTIQUE });
  const planche = () => comp()?.planches[etat.planche] ?? null;
  const fichier = (id) => comp().fichiers.find((f) => f.id === id);
  const enregistrerProjet = () => {
    comp().modifieLe = new Date().toISOString();
    modifie();
  };

  function fermer() {
    clearInterval(clignotement);
    fermerDocuments();
    page.close();
    page.remove();
    quandRetour?.();
  }
  page.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    if (etat.outil || etat.saisie.length) {
      const ancien = etat.outil;
      etat.outil = null;
      etat.saisie = [];
      etat.axe = null;
      passerEnRecalage(ancien).then(() => {
        majOutils();
        dessinerDessus();
      });
      return;
    }
    fermer();
  });

  // ================================================================ Page

  function dessiner() {
    clearInterval(clignotement);
    const onglets = [['liste', 'Comparaisons'], ['comparer', 'Comparer'], ['rapport', 'Rapport']];
    page.innerHTML = `
      <header class="entete-calage entete-comparateur">
        <button type="button" class="retour-reglages" data-action="retour" aria-label="Retour aux applications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        <h2>Comparer des PDF ${bulle('comparateur')}</h2>
        <nav class="etapes-calage" aria-label="Parties">
          ${onglets.map(([cle, titre]) => `<button type="button" data-ecran="${cle}" class="${etat.ecran === cle ? 'actif' : ''}" ${cle !== 'liste' && !comp() ? 'disabled' : ''}>${titre}</button>`).join('')}
        </nav>
        ${etat.occupe ? `<span class="occupe-comparateur">${echapper(etat.occupe)}</span>` : ''}
      </header>
      <main class="contenu-calage ${etat.ecran === 'comparer' ? 'en-calage' : ''}">${{ liste: htmlListe, comparer: htmlComparer, rapport: htmlRapport }[etat.ecran]()}</main>`;
    if (etat.ecran === 'comparer') monterVue();
  }

  function occuper(texte) {
    etat.occupe = texte;
    const zone = page.querySelector('.occupe-comparateur');
    if (zone) zone.textContent = texte;
    else if (texte) page.querySelector('.entete-comparateur')?.insertAdjacentHTML('beforeend', `<span class="occupe-comparateur">${echapper(texte)}</span>`);
    if (!texte) zone?.remove();
  }

  // ---------------------------------------------------------------- Comparaisons

  function htmlListe() {
    const liste = [...projet.comparaisons].sort((p, q) => String(q.modifieLe).localeCompare(String(p.modifieLe)));
    const n = etat.nouvelle;
    return `
      <div class="barre-calage"><button type="button" class="bouton" data-action="nouvelle">＋ Nouvelle comparaison</button></div>
      ${n ? `<section class="carte-calage nouvelle-comparaison">
        <h3>Nouvelle comparaison</h3>
        <div class="choix-ab">
          <label class="bouton-secondaire bouton-fichier cote-a">Plan(s) A · ancien indice…<input type="file" accept=".pdf,application/pdf" multiple data-fichiers="A" hidden></label>
          <span class="aide-calage">${n.A.length ? n.A.map((f) => echapper(f.nom)).join(', ') : 'aucun fichier'}</span>
          <label class="bouton-secondaire bouton-fichier cote-b">Plan(s) B · nouvel indice…<input type="file" accept=".pdf,application/pdf" multiple data-fichiers="B" hidden></label>
          <span class="aide-calage">${n.B.length ? n.B.map((f) => echapper(f.nom)).join(', ') : 'aucun fichier'}</span>
          ${n.A.length === 1 && n.B.length === 1 ? `<label class="bouton-secondaire bouton-fichier">＋ Autres plans (C, D, E : 3 au plus)…<input type="file" accept=".pdf,application/pdf" multiple data-fichiers="X" hidden></label>
          <span class="aide-calage">${n.X.length ? n.X.map((f, i) => `${LETTRES_PLANS[2 + i]} · ${echapper(f.nom)}`).join(', ') : 'jusqu\'à 5 plans en tout : on en compare deux à la fois à l\'écran'}</span>` : ''}
        </div>
        <label class="champ-calage"><span>Nom</span><input type="text" data-champ="nom-comparaison" value="${echapper(n.nom)}"></label>
        <div class="barre-calage"><button type="button" class="bouton" data-action="creer" ${n.A.length && n.B.length ? '' : 'aria-disabled="true"'}>Comparer →</button><button type="button" class="lien-calage" data-action="annuler-nouvelle">abandonner</button></div>
      </section>` : ''}
      ${liste.length ? `<div class="liste-comparaisons">${liste.map((c) => {
        const mods = c.planches.flatMap((p) => p.modifications ?? []);
        const aTraiter = mods.filter((m) => m.etat === 'traiter').length;
        const nomsA = c.fichiers.filter((f) => f.cote === 'A').map((f) => f.nom);
        const nomsB = c.fichiers.filter((f) => f.cote === 'B').map((f) => f.nom);
        const autres = c.fichiers.filter((f) => ['C', 'D', 'E'].includes(f.cote));
        return `<article class="carte-calage fiche-comparaison">
          <div class="ligne-titre"><strong>${echapper(c.nom)}</strong><span class="aide-calage">${dateCourte(c.modifieLe)}</span></div>
          <div class="aide-calage"><span class="indice-a">A</span> ${echapper(nomsA.join(', '))}<br><span class="indice-b">B</span> ${echapper(nomsB.join(', '))}${autres.map((f) => `<br><b>${f.cote}</b> ${echapper(f.nom)}`).join('')}</div>
          <div class="barre-calage"><span>${c.planches.length} planche(s) · <b class="chiffre">${mods.length}</b> modification(s)</span>
            ${aTraiter ? `<span class="pastille-calage p-revoir">${aTraiter} à traiter</span>` : mods.length ? '<span class="pastille-calage p-juste">toutes vues</span>' : ''}</div>
          <div class="barre-calage"><button type="button" class="bouton-secondaire petit" data-ouvrir="${echapper(c.id)}">Ouvrir</button><button type="button" class="bouton-secondaire petit" data-rapport="${echapper(c.id)}">Rapport</button><button type="button" class="lien-calage" data-supprimer="${echapper(c.id)}">supprimer</button></div>
        </article>`;
      }).join('')}</div>` : '<p class="vide">Aucune comparaison dans ce projet.</p>'}`;
  }

  async function lireFichiersChoisis(cote, liste) {
    const fichiers = await Promise.all([...liste].map(async (f) => ({ nom: f.name, donnees: base64DesOctets(new Uint8Array(await f.arrayBuffer())) })));
    etat.nouvelle[cote] = cote === 'X' ? fichiers.slice(0, 3) : fichiers;
    if (cote === 'X' && fichiers.length > 3) message('Seuls les 3 premiers sont gardés : 5 plans au plus (A à E).', 4000);
    if (cote !== 'X' && (etat.nouvelle.A.length !== 1 || etat.nouvelle.B.length !== 1)) etat.nouvelle.X = [];
    if (cote === 'A' && !etat.nouvelle.nomTouche) etat.nouvelle.nom = fichiers.length === 1 ? nomSansIndice(fichiers[0].nom) : `${fichiers.length} plans`;
    dessiner();
  }

  /** Planches (pages appariées par leurs mots) entre deux PDF : { planches, seuls } ; titre avec les lettres si plus de 2 plans. */
  async function planchesDeLaPaire(fa, fb, nomA = fa.nom, nomB = fb.nom, avecLettres = false) {
    const [docA, docB] = await Promise.all([documentDe(fa), documentDe(fb)]);
    const mots = async (doc) => Promise.all(Array.from({ length: doc.numPages }, (_, i) => textesDeLaPage(doc, i + 1).then(motsDeLaPage)));
    const pages = docA.numPages === 1 && docB.numPages === 1 ? [{ a: 1, b: 1 }] : apparierPages(await mots(docA), await mots(docB));
    const planches = [];
    const seuls = [];
    for (const p of pages) {
      if (!p.a || !p.b) {
        seuls.push(`${p.a ? nomA : nomB} page ${p.a ?? p.b}`);
        continue;
      }
      const lettres = avecLettres ? ` · ${fa.cote} ↔ ${fb.cote}` : '';
      planches.push({ id: nouvelId(), a: { fichier: fa.id, page: p.a }, b: { fichier: fb.id, page: p.b }, titre: `${nomSansIndice(nomA)}${lettres}${docA.numPages > 1 || docB.numPages > 1 ? ` · page A ${p.a} ↔ B ${p.b}` : ''}`, alignement: { ...ALIGNEMENT_NEUTRE }, modifications: [], annotations: [] });
    }
    return { planches, seuls };
  }

  /** Choix de la paire de plans montrée (plans C, D, E…) : retrouve la planche de cette paire ou la crée. */
  async function choisirPaire(idA, idB) {
    const c = comp();
    if (idA === idB) {
      message('Choisissez deux plans différents.', 3000);
      dessiner();
      return;
    }
    let i = c.planches.findIndex((p) => p.a.fichier === idA && p.b.fichier === idB);
    if (i < 0) {
      occuper('Appariement des pages…');
      try {
        const fa = fichier(idA);
        const fb = fichier(idB);
        const r = await planchesDeLaPaire(fa, fb, fa.nom, fb.nom, true);
        if (!r.planches.length) throw new Error('aucune page en commun entre ces deux plans');
        i = c.planches.length;
        c.planches.push(...r.planches);
        enregistrerProjet();
        if (r.seuls.length) message(`Sans correspondance : ${r.seuls.join(', ')}`, 6000);
      } catch (erreur) {
        message(`Paire impossible : ${erreur.message}`, 6000);
        occuper('');
        dessiner();
        return;
      }
      occuper('');
    }
    await changerPlanche(i);
  }

  /** Crée la comparaison : fichiers appariés par leur nom, planches par leurs mots, zones à ignorer reprises. */
  async function creerComparaison() {
    const n = etat.nouvelle;
    if (!n.A.length || !n.B.length) {
      message('Choisissez au moins un PDF pour A (ancien indice) et un pour B (nouvel indice).', 4000);
      return;
    }
    occuper('Lecture des PDF…');
    try {
      const fichiers = [...n.A.map((f) => ({ ...f, cote: 'A' })), ...n.B.map((f) => ({ ...f, cote: 'B' })), ...n.X.map((f, i) => ({ ...f, cote: LETTRES_PLANS[2 + i] }))].map((f) => ({ id: nouvelId(), ...f }));
      const parNom = (cote, nom) => fichiers.find((f) => f.cote === cote && f.nom === nom);
      const paires = n.A.length === 1 && n.B.length === 1 ? [{ a: n.A[0].nom, b: n.B[0].nom }] : apparierFichiers(n.A.map((f) => f.nom), n.B.map((f) => f.nom));
      const planches = [];
      const seuls = [];
      for (const { a, b } of paires) {
        if (!a || !b) {
          seuls.push(a ?? b);
          continue;
        }
        const fa = parNom('A', a);
        const fb = parNom('B', b);
        const r = await planchesDeLaPaire(fa, fb, a, b);
        planches.push(...r.planches);
        seuls.push(...r.seuls);
      }
      if (!planches.length) throw new Error('aucune paire de plans trouvée (noms ou pages trop différents)');
      // Zones à ignorer (cartouche…) reprises d'une comparaison précédente du même plan.
      const precedente = [...projet.comparaisons].reverse().find((c) => nomSansIndice(c.nom) === nomSansIndice(n.nom) && c.masques?.length);
      const c = {
        id: nouvelId(), nom: n.nom.trim() || 'Comparaison', creeLe: new Date().toISOString(), modifieLe: new Date().toISOString(), creePar: qui(),
        fichiers, planches, masques: precedente ? precedente.masques.map((m) => ({ ...m })) : [], tolerance: 0.2, regroupement: 5, textes: true,
      };
      projet.comparaisons.push(c);
      etat.nouvelle = null;
      etat.comparaison = c;
      etat.planche = 0;
      etat.ecran = 'comparer';
      enregistrerProjet();
      occuper('');
      if (seuls.length) message(`Sans correspondance (pas comparés) : ${seuls.join(', ')}`, 8000);
      if (precedente) message(`Zones à ignorer reprises de « ${precedente.nom} ».`, 4000);
      dessiner();
      await preparerPlanche({ auto: true });
    } catch (erreur) {
      occuper('');
      message(`Comparaison impossible : ${erreur.message}`, 7000);
    }
  }

  async function supprimerComparaison(id) {
    const c = projet.comparaisons.find((x) => x.id === id);
    if (!c) return;
    const choix = await demanderChoix({ titre: `Supprimer « ${c.nom} » ?`, texte: 'La comparaison, ses PDF, ses validations et ses annotations sont retirés du projet.', boutons: [{ cle: 'non', texte: 'Garder', principal: true }, { cle: 'oui', texte: 'Supprimer' }] });
    if (choix !== 'oui') return;
    projet.comparaisons.splice(projet.comparaisons.indexOf(c), 1);
    if (etat.comparaison === c) etat.comparaison = null;
    modifie();
    dessiner();
  }

  // ---------------------------------------------------------------- Comparer

  function htmlComparer() {
    const c = comp();
    const p = planche();
    const groupe = (titre, html) => `<div class="groupe-ruban"><span class="titre-groupe">${titre}</span><div class="boutons-groupe">${html}</div></div>`;
    const outil = (cle, icone, texte, attr = 'data-outil') => `<button type="button" class="outil-ruban" ${attr}="${cle}">${icone}<span>${texte}</span></button>`;
    return `
      <div class="ruban-calage" role="toolbar" aria-label="Outils de comparaison">
        ${groupe('Zoom', '<button type="button" class="outil-ruban" data-zoom="1.5" aria-label="Zoom avant">＋</button><button type="button" class="outil-ruban" data-zoom="0.667" aria-label="Zoom arrière">−</button><button type="button" class="outil-ruban" data-zoom="tout" aria-label="Tout voir">⤢<span>Tout</span></button>')}
        ${groupe('Planche', `<button type="button" class="outil-ruban" data-planche="-1" aria-label="Planche précédente">◀</button>
          <select data-champ="planche" class="choix-planche">${c.planches.map((x, i) => `<option value="${i}" ${i === etat.planche ? 'selected' : ''}>${i + 1}. ${echapper(x.titre)}</option>`).join('')}</select>
          <button type="button" class="outil-ruban" data-planche="1" aria-label="Planche suivante">▶</button>`)}
        ${(comp().fichiers ?? []).some((f) => ['C', 'D', 'E'].includes(f.cote)) ? groupe('Plans', `<select data-champ="plan-a" aria-label="Plan ancien (couleur A)">${plansDeLaComparaison().map((f) => `<option value="${echapper(f.id)}" ${f.id === p?.a.fichier ? 'selected' : ''}>${f.cote} · ${echapper(f.nom)}</option>`).join('')}</select><span class="aide-calage">↔</span><select data-champ="plan-b" aria-label="Plan nouveau (couleur B)">${plansDeLaComparaison().map((f) => `<option value="${echapper(f.id)}" ${f.id === p?.b.fichier ? 'selected' : ''}>${f.cote} · ${echapper(f.nom)}</option>`).join('')}</select>`) : ''}
        ${groupe('Affichage', MODES.map(([cle, i, t]) => outil(cle, i, t, 'data-mode')).join(''))}
        ${groupe('Recalage de B', `${outil('auto', '⚡', 'Auto', 'data-action')}${outil('deux-points', '⊡', '2 points')}${outil('axe', '⟂', 'Sur axe')}<span class="choix-axe" data-zone="choix-axe" hidden><button type="button" class="outil-ruban petit" data-axe-mode="trait" title="Cliquer un trait du plan">╱<span>Trait</span></button><button type="button" class="outil-ruban petit" data-axe-mode="points" title="Deux points avec accroche">⁚<span>2 points</span></button></span>${outil('main', '✥', 'À la main')}
          <label class="case-ruban"><input type="checkbox" data-champ="verrou" ${etat.verrouEchelle ? 'checked' : ''}> échelle 100 %</label>
          ${outil('reinitialiser', '↺', 'Remettre', 'data-action')}`)}
        ${groupe('Détection', `<label class="reglage-ruban">Tolérance <input type="range" min="0" max="2" step="0.1" value="${c.tolerance}" data-champ="tolerance"><span class="chiffre" data-zone="tolerance">${fixe(c.tolerance, 1)} mm</span></label>
          <label class="reglage-ruban">Regrouper <input type="range" min="0" max="30" step="1" value="${c.regroupement}" data-champ="regroupement"><span class="chiffre" data-zone="regroupement">${c.regroupement} mm</span></label>
          ${outil('zone', '⬚', 'Zone à ignorer')}<button type="button" class="outil-ruban ${c.textes ? 'actif' : ''}" data-action="textes">T<span>Textes / cotes</span></button>
          ${outil('detecter', '⟳', 'Détecter', 'data-action')}`)}
        ${groupe('Annoter', ANNOTATIONS.map(([cle, i, t]) => outil(cle, i, t)).join(''))}
      </div>
      <p class="consigne-calage" data-zone="consigne"></p>
      <div class="travail-comparateur">
        <div class="vue-calage vue-comparateur">
          <div class="tete-vue"><strong>${echapper(p?.titre ?? '')}</strong>
            <span class="legende-comparateur" data-zone="legende"></span></div>
          <div class="toile-comparateur" data-toile>
            <canvas class="fond-comparateur"></canvas><canvas class="fond-comparateur deuxieme" hidden></canvas><canvas class="dessus-comparateur"></canvas>
            <div class="poignee-rideau" hidden><span>⇔</span></div>
          </div>
          <div class="pied-vue" data-zone="pied"></div>
        </div>
        <aside class="carte-calage panneau-comparateur">
          <div class="onglets-panneau" role="tablist">
            <button type="button" data-panneau="modifs" class="${etat.panneau === 'modifs' ? 'actif' : ''}">Modifications</button>
            <button type="button" data-panneau="annotations" class="${etat.panneau === 'annotations' ? 'actif' : ''}">Annotations</button>
          </div>
          <div data-zone="panneau"></div>
        </aside>
      </div>`;
  }

  /** Les plans (PDF) de la comparaison, dans l'ordre A, B, C, D, E (une seule « paire » de dossiers : A et B seulement). */
  const plansDeLaComparaison = () => (comp()?.fichiers ?? []).filter((f) => LETTRES_PLANS.includes(f.cote)).sort((u, v) => u.cote.localeCompare(v.cote));

  function majLegende() {
    const z = page.querySelector('[data-zone="legende"]');
    if (!z) return;
    const c = couleursCss();
    z.innerHTML = `<label><input type="color" data-couleur="a" value="${c.a}" aria-label="Couleur de A"> Supprimé (A)</label><label><input type="color" data-couleur="b" value="${c.b}" aria-label="Couleur de B"> Ajouté (B)</label><span><i style="background:rgb(${GRIS_IDENTIQUE})"></i>Identique</span>`;
  }

  function majOutils() {
    if (etat.ecran !== 'comparer') return;
    majLegende();
    const choixAxe = page.querySelector('[data-zone="choix-axe"]');
    if (choixAxe) {
      choixAxe.hidden = etat.outil !== 'axe';
      choixAxe.querySelectorAll('[data-axe-mode]').forEach((b) => b.classList.toggle('actif', b.dataset.axeMode === (etat.axeMode ?? 'trait')));
    }
    page.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('actif', b.dataset.mode === etat.mode));
    page.querySelectorAll('[data-outil]').forEach((b) => b.classList.toggle('actif', b.dataset.outil === etat.outil));
    page.querySelector('[data-action="textes"]')?.classList.toggle('actif', Boolean(comp().textes));
    const consignes = {
      'deux-points': ['Point 1 : cliquez-le sur A (à gauche, accroche sur sommet ou trait)…', '… puis le même point 1 sur B (à droite).', 'Point 2 : cliquez-le sur A…', '… puis le même point 2 sur B.'][etat.saisie.length] ?? '',
      axe: !etat.axe?.a ? ((etat.axeMode ?? 'trait') === 'points' ? `Axe de A : cliquez le point ${(etat.axePts?.length ?? 0) + 1} sur A (à gauche, avec accroche).` : 'Cliquez un trait de A (à gauche).')
        : !etat.axe.b ? ((etat.axeMode ?? 'trait') === 'points' ? `Axe de B : cliquez le point ${(etat.axePts?.length ?? 0) + 1} sur B (à droite, avec accroche).` : 'Cliquez le trait de B qui correspond (à droite).') : etat.saisie.length ? 'Cliquez le même point sur B (à droite).' : 'Facultatif : un point de A (à gauche) puis le même sur B, pour caler le long du trait. Échap pour finir.',
      main: 'Glissez pour déplacer B ; flèches du clavier = 0,1 mm (Maj = 1 mm).',
      zone: 'Tracez un rectangle (cartouche, date…) : ce qui est dedans n\'est plus détecté.',
      nuage: 'Tracez le rectangle du nuage.',
      fleche: etat.saisie.length ? 'Cliquez la pointe de la flèche.' : 'Cliquez le départ de la flèche.',
      note: 'Cliquez où écrire la note.',
      distance: etat.saisie.length ? 'Cliquez le 2e point.' : 'Cliquez le 1er point.',
      surface: 'Cliquez les sommets ; cliquez le premier pour fermer.',
      etalonner: etat.saisie.length ? 'Cliquez la fin de la longueur connue.' : 'Cliquez le début d\'une longueur connue (cote du plan).',
    };
    const consigne = page.querySelector('[data-zone="consigne"]');
    if (consigne) consigne.textContent = etat.outil ? `${consignes[etat.outil]} (Échap = arrêter)` : 'Molette = zoom, glisser = déplacer. Touchez une modification à droite pour y aller.';
    const toile = page.querySelector('[data-toile]');
    if (toile) toile.dataset.outil = etat.outil ?? '';
  }

  function majPanneau() {
    const zone = page.querySelector('[data-zone="panneau"]');
    if (!zone) return;
    page.querySelectorAll('[data-panneau]').forEach((b) => b.classList.toggle('actif', b.dataset.panneau === etat.panneau));
    const p = planche();
    if (etat.panneau === 'annotations') {
      const liste = p.annotations ?? [];
      zone.innerHTML = `${p.metresParPoint ? `<p class="aide-calage">Étalonné : 1 mm sur le papier = ${fixe(p.metresParPoint / MM_PAR_POINT, 3)} m</p>` : '<p class="aide-calage">Pas étalonné : distances en mm du papier.</p>'}
        <ul class="liste-modifs">${liste.map((a, i) => `<li class="modif"><span class="num annot">${i + 1}</span><div><div class="quoi">${echapper(ANNOTATIONS.find(([c]) => c === a.genre)?.[2] ?? a.genre)}</div>${a.texte ? `<div class="detail">${echapper(a.texte)}</div>` : ''}</div><div class="actions-modif"><button type="button" data-retirer-annotation="${i}" aria-label="Retirer">✕</button></div></li>`).join('') || '<li class="aide-calage">Aucune annotation : outils « Annoter » en haut.</li>'}</ul>`;
      return;
    }
    const mods = p.modifications ?? [];
    const compte = (e) => mods.filter((m) => m.etat === e).length;
    const montrees = mods.filter((m) => etat.filtre === 'toutes' || m.etat === etat.filtre);
    zone.innerHTML = `
      <div class="ligne-titre"><h3>Modifications (${mods.length})</h3>${comp().planches.length > 1 ? '<button type="button" class="lien-calage" data-action="tout-detecter">toutes les planches</button>' : ''}</div>
      <div class="choix-hachures filtres-modifs" role="group">${ETATS.map(([cle, t]) => `<button type="button" data-filtre="${cle}" class="${etat.filtre === cle ? 'actif' : ''}">${t}${cle === 'toutes' ? '' : ` (${compte(cle)})`}</button>`).join('')}</div>
      ${p.detecteLe ? '' : '<p class="aide-calage">Pas encore détecté : « ⟳ Détecter ».</p>'}
      <ul class="liste-modifs">${montrees.map((m) => `
        <li class="modif etat-${m.etat} ${etat.choisie === m.n ? 'choisie' : ''}" data-modif="${m.n}">
          <span class="num">${m.n}</span>
          <div><div class="quoi">${echapper(titreModification(m))}</div>
            ${(m.textes ?? []).map((t) => `<div class="avant-apres">${t.avant ? `<del>${echapper(t.avant)}</del>` : ''}${t.avant && t.apres ? ' → ' : ''}${t.apres ? `<ins>${echapper(t.apres)}</ins>` : ''}</div>`).join('')}
            ${m.commentaire ? `<div class="detail">💬 ${echapper(m.commentaire)}</div>` : ''}
            ${m.par && m.etat !== 'traiter' ? `<div class="detail">${m.etat === 'validee' ? 'validée' : 'ignorée'} par ${echapper(m.par)} · ${dateCourte(m.le)}</div>` : ''}</div>
          <div class="actions-modif">${m.etat === 'traiter' ? `<button type="button" data-etat="validee" data-n="${m.n}" title="Vue, à reporter">✓</button><button type="button" data-etat="ignoree" data-n="${m.n}">Ignorer</button>` : `<button type="button" data-etat="traiter" data-n="${m.n}" title="Remettre à traiter">↶</button>`}<button type="button" data-commenter="${m.n}" title="Commentaire">💬</button></div>
        </li>`).join('') || `<li class="aide-calage">${mods.length ? 'Rien dans ce filtre.' : p.detecteLe ? 'Aucune modification : les deux plans sont identiques (à la tolérance près).' : ''}</li>`}</ul>`;
  }

  function majPied() {
    const pied = page.querySelector('[data-zone="pied"]');
    const p = planche();
    if (!pied || !p) return;
    const al = p.alignement;
    pied.innerHTML = `<span class="aide-calage">B posé sur A : décalage ${fixe(al.x * MM_PAR_POINT, 1)} / ${fixe(al.y * MM_PAR_POINT, 1)} mm, rotation ${fixe(al.r, 3)}°, échelle ${fixe(al.s * 100, 2)} %${p.alignePar ? ` (${p.alignePar})` : ''}</span>
      <span class="aide-calage">${(comp().masques ?? []).length} zone(s) à ignorer${(comp().masques ?? []).length ? ' · <button type="button" class="lien-calage" data-action="effacer-zones">effacer</button>' : ''}</span>`;
  }

  // ---------------------------------------------------------------- Vue (rendu des deux PDF)

  const toile = () => page.querySelector('[data-toile]');
  const canvasFond = () => page.querySelector('.fond-comparateur');
  const canvasDeux = () => page.querySelector('.fond-comparateur.deuxieme');
  const canvasDessus = () => page.querySelector('.dessus-comparateur');

  function monterVue() {
    majOutils();
    majPanneau();
    majPied();
    const t = toile();
    new ResizeObserver(() => {
      if (!t.isConnected || !t.clientWidth) return;
      if (!vue) cadrer();
      else rendreBientot(0);
    }).observe(t);
    brancherGestes(t);
  }

  /** Vue qui montre toute la page A. */
  async function cadrer() {
    const p = planche();
    const t = toile();
    if (!p || !t) return;
    try {
      const taille = await taillePage(await documentDe(fichier(p.a.fichier)), p.a.page);
      const w = etat.mode === 'cote' ? t.clientWidth / 2 : t.clientWidth;
      const zoom = Math.min(w / taille.largeur, t.clientHeight / taille.hauteur) * 0.95;
      vue = { zoom, cx: taille.largeur / 2, cy: taille.hauteur / 2 };
      rendreBientot(0);
    } catch (erreur) {
      message(erreur.message, 6000);
    }
  }

  /** Matrice repère de A (points) → pixels du canvas (densité de l'écran comprise). */
  function matriceVue(w, h, dpr) {
    return [vue.zoom * dpr, 0, 0, vue.zoom * dpr, (w / 2 - vue.zoom * vue.cx) * dpr, (h / 2 - vue.zoom * vue.cy) * dpr];
  }
  const versPage = (px, py, w, h) => [vue.cx + (px - w / 2) / vue.zoom, vue.cy + (py - h / 2) / vue.zoom];
  const versEcran = ([x, y], w, h) => [w / 2 + (x - vue.cx) * vue.zoom, h / 2 + (y - vue.cy) * vue.zoom];

  function rendreBientot(delai = 180) {
    clearTimeout(minuterieRendu);
    minuterieRendu = setTimeout(rendre, delai);
  }

  /** Rend A et B à la taille de la vue, puis les compose selon l'affichage choisi. */
  async function rendre() {
    const p = planche();
    const t = toile();
    if (!p || !t || !vue || !t.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const cote = etat.mode === 'cote';
    const w = cote ? Math.floor(t.clientWidth / 2) - 2 : t.clientWidth;
    const h = t.clientHeight;
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    const M = matriceVue(w, h, dpr);
    try {
      const [docA, docB] = await Promise.all([documentDe(fichier(p.a.fichier)), documentDe(fichier(p.b.fichier))]);
      const cA = document.createElement('canvas');
      const cB = document.createElement('canvas');
      const vueRendue = { ...vue };
      const [okA, okB] = await Promise.all([rendrePage(docA, p.a.page, cA, M, W, H), rendrePage(docB, p.b.page, cB, composer(M, matriceAlignement(p.alignement)), W, H)]);
      if (!okA || !okB || planche() !== p) return;
      const encreA = masqueEncre(cA.getContext('2d').getImageData(0, 0, W, H).data);
      const encreB = masqueEncre(cB.getContext('2d').getImageData(0, 0, W, H).data);
      const r = Math.round((comp().tolerance / MM_PAR_POINT) * vue.zoom * dpr);
      images = {
        vue: vueRendue, w, h, W, H, dpr,
        superpose: superposer(encreA, encreB, W, H, r, couleursRgb()),
        A: teinter(encreA, couleursRgb().a),
        B: teinter(encreB, couleursRgb().b),
      };
      afficher();
    } catch (erreur) {
      message(`Affichage impossible : ${erreur.message}`, 6000);
    }
  }

  /** Pose le dernier rendu dans le(s) canvas selon l'affichage (sans refaire le rendu des PDF). */
  function afficher() {
    clearInterval(clignotement);
    const t = toile();
    if (!images || !t) return;
    const { W, H, w, h } = images;
    const [c1, c2] = [canvasFond(), canvasDeux()];
    c2.hidden = etat.mode !== 'cote';
    for (const c of [c1, c2]) {
      c.width = W;
      c.height = H;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    finApercu();
    const poser = (c, donnees) => c.getContext('2d').putImageData(new ImageData(donnees, W, H), 0, 0);
    const poignee = t.querySelector('.poignee-rideau');
    poignee.hidden = etat.mode !== 'rideau';
    if (etat.mode === 'superpose') poser(c1, images.superpose);
    else if (etat.mode === 'cote') {
      poser(c1, images.A);
      poser(c2, images.B);
    } else if (etat.mode === 'clignote') {
      let tour = false;
      poser(c1, images.A);
      clignotement = setInterval(() => {
        tour = !tour;
        poser(c1, tour ? images.B : images.A);
      }, 600);
    } else {
      // Rideau : A à gauche de la poignée, B à droite.
      const melange = new Uint8ClampedArray(images.A);
      const limite = Math.round(W * etat.rideau);
      for (let y = 0; y < H; y += 1) melange.set(images.B.subarray((y * W + limite) * 4, (y + 1) * W * 4), (y * W + limite) * 4);
      poser(c1, melange);
      poignee.style.left = `${w * etat.rideau}px`;
    }
    dessinerDessus();
  }

  /** Pendant un geste : l'ancien rendu déplacé / agrandi, sans attendre pdf.js. */
  function apercu() {
    if (!images) return;
    const c = canvasFond();
    const k = vue.zoom / images.vue.zoom;
    const dx = (images.w / 2 - vue.zoom * vue.cx) - (images.w / 2 - images.vue.zoom * images.vue.cx) * k;
    const dy = (images.h / 2 - vue.zoom * vue.cy) - (images.h / 2 - images.vue.zoom * images.vue.cy) * k;
    c.style.transformOrigin = '0 0';
    c.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`;
    canvasDeux().style.transformOrigin = '0 0';
    canvasDeux().style.transform = c.style.transform;
    dessinerDessus();
  }
  const finApercu = () => {
    canvasFond().style.transform = '';
    canvasDeux().style.transform = '';
  };

  /** Nuages des modifications, zones à ignorer, annotations, saisie en cours (au-dessus du plan). */
  function dessinerDessus() {
    const t = toile();
    const c = canvasDessus();
    const p = planche();
    if (!t || !c || !vue || !p) return;
    const dpr = window.devicePixelRatio || 1;
    const w = etat.mode === 'cote' ? Math.floor(t.clientWidth / 2) - 2 : t.clientWidth;
    const h = t.clientHeight;
    c.width = Math.round(t.clientWidth * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = `${t.clientWidth}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext('2d');
    const copies = etat.mode === 'cote' ? [0, w + 4] : [0];
    const recale = OUTILS_RECALAGE.includes(etat.outil);
    for (const decalage of copies) {
      ctx.setTransform(dpr, 0, 0, dpr, decalage * dpr, 0);
      const E = (pt) => versEcran(pt, w, h);
      // Zones à ignorer.
      ctx.fillStyle = 'rgba(100, 116, 139, 0.18)';
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
      ctx.setLineDash([5, 4]);
      for (const m of comp().masques ?? []) {
        const [x, y] = E([m.x, m.y]);
        ctx.fillRect(x, y, m.w * vue.zoom, m.h * vue.zoom);
        ctx.strokeRect(x, y, m.w * vue.zoom, m.h * vue.zoom);
      }
      ctx.setLineDash([]);
      // Nuages numérotés.
      for (const m of p.modifications ?? []) {
        if (etat.filtre !== 'toutes' && m.etat !== etat.filtre) continue;
        const couleur = m.etat === 'validee' ? '#15803d' : m.etat === 'ignoree' ? '#94a3b8' : '#d97706';
        const [x, y] = E([m.x, m.y]);
        const rect = { x, y, w: m.w * vue.zoom, h: m.h * vue.zoom };
        ctx.strokeStyle = couleur;
        ctx.lineWidth = etat.choisie === m.n ? 3 : 1.6;
        ctx.beginPath();
        for (const [cx, cy, r, a0, a1] of arcsDeNuage(rect, Math.max(5, Math.min(14, Math.min(rect.w, rect.h) / 3)))) {
          ctx.moveTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
          ctx.arc(cx, cy, r, a0, a1);
        }
        ctx.stroke();
        ctx.fillStyle = couleur;
        ctx.beginPath();
        ctx.arc(x - 2, y - 2, 9, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(m.n), x - 2, y - 1.5);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      // Annotations.
      for (const a of p.annotations ?? []) dessinerAnnotation(ctx, a, E, '#7c3aed');
      if (recale) dessinerRecalage(ctx, decalage === 0 ? 'a' : 'b', E);
      // Saisie en cours.
      if (!recale && etat.saisie.length) dessinerAnnotation(ctx, { genre: etat.outil === 'surface' ? 'surface-ouverte' : etat.outil, points: etat.saisie }, E, '#ea580c');
    }
  }

  function dessinerAnnotation(ctx, a, E, couleur) {
    const pts = (a.points ?? []).map(E);
    ctx.strokeStyle = couleur;
    ctx.fillStyle = couleur;
    ctx.lineWidth = 2;
    ctx.font = '12px system-ui, sans-serif';
    if ((a.genre === 'nuage' || a.genre === 'zone') && pts.length === 2) {
      const rect = { x: Math.min(pts[0][0], pts[1][0]), y: Math.min(pts[0][1], pts[1][1]), w: Math.abs(pts[1][0] - pts[0][0]), h: Math.abs(pts[1][1] - pts[0][1]) };
      ctx.beginPath();
      if (a.genre === 'zone') ctx.rect(rect.x, rect.y, rect.w, rect.h);
      else for (const [cx, cy, r, a0, a1] of arcsDeNuage(rect, 10)) {
        ctx.moveTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
        ctx.arc(cx, cy, r, a0, a1);
      }
      ctx.stroke();
    } else if (pts.length >= 2 && ['fleche', 'distance', 'etalonner', 'deux-points'].includes(a.genre)) {
      ctx.beginPath();
      ctx.moveTo(...pts[0]);
      ctx.lineTo(...pts[1]);
      ctx.stroke();
      if (a.genre === 'fleche') {
        const [p, q] = pts;
        const t = Math.atan2(q[1] - p[1], q[0] - p[0]);
        ctx.beginPath();
        for (const d of [-0.4, 0.4]) {
          ctx.moveTo(...q);
          ctx.lineTo(q[0] - 12 * Math.cos(t + d), q[1] - 12 * Math.sin(t + d));
        }
        ctx.stroke();
      }
    } else if (a.genre === 'surface' || a.genre === 'surface-ouverte') {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(...q) : ctx.moveTo(...q)));
      if (a.genre === 'surface') {
        ctx.closePath();
        ctx.globalAlpha = 0.12;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.stroke();
    }
    for (const q of pts) ctx.fillRect(q[0] - 2.5, q[1] - 2.5, 5, 5);
    if (a.texte && pts.length) {
      const q = pts[pts.length - 1];
      const largeur = ctx.measureText(a.texte).width + 8;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(q[0] + 6, q[1] - 18, largeur, 18);
      ctx.fillStyle = couleur;
      ctx.fillText(a.texte, q[0] + 10, q[1] - 5);
    }
  }

  // ---------------------------------------------------------------- Gestes

  function brancherGestes(t) {
    let geste = null;
    const position = (ev) => {
      const r = t.getBoundingClientRect();
      const w = etat.mode === 'cote' ? Math.floor(t.clientWidth / 2) - 2 : t.clientWidth;
      let x = ev.clientX - r.left;
      let cote = 'a';
      if (etat.mode === 'cote' && x > w + 2) {
        x -= w + 4;
        cote = 'b';
      }
      return { x, y: ev.clientY - r.top, w, h: t.clientHeight, cote };
    };
    t.addEventListener('wheel', (ev) => {
      if (!vue) return;
      ev.preventDefault();
      const { x, y, w, h } = position(ev);
      const avant = versPage(x, y, w, h);
      vue.zoom *= ev.deltaY < 0 ? 1.2 : 1 / 1.2;
      const apres = versPage(x, y, w, h);
      vue.cx += avant[0] - apres[0];
      vue.cy += avant[1] - apres[1];
      apercu();
      rendreBientot();
    }, { passive: false });
    t.addEventListener('pointerdown', (ev) => {
      if (!vue) return;
      if (ev.target.closest('.poignee-rideau')) {
        geste = { rideau: true };
        t.setPointerCapture(ev.pointerId);
        return;
      }
      t.setPointerCapture(ev.pointerId);
      const pos = position(ev);
      geste = { ...pos, depart: versPage(pos.x, pos.y, pos.w, pos.h), vue: { ...vue }, glisse: false, alignement: { ...planche().alignement } };
    });
    t.addEventListener('pointermove', (ev) => {
      if (!geste) {
        if (etat.outil === 'deux-points' || etat.outil === 'axe') survolerRecalage(position(ev));
        return;
      }
      if (geste.rideau) {
        const r = t.getBoundingClientRect();
        etat.rideau = Math.min(0.98, Math.max(0.02, (ev.clientX - r.left) / r.width));
        afficher();
        return;
      }
      const pos = position(ev);
      if (!geste.glisse && Math.hypot(pos.x - geste.x, pos.y - geste.y) > 4) geste.glisse = true;
      if (!geste.glisse) return;
      const ici = versPage(pos.x, pos.y, pos.w, pos.h);
      if (etat.outil === 'zone' || etat.outil === 'nuage') {
        etat.saisie = [geste.depart, ici];
        dessinerDessus();
      } else if (etat.outil === 'main') {
        const p = planche();
        p.alignement = { ...geste.alignement, x: geste.alignement.x + (pos.x - geste.x) / vue.zoom, y: geste.alignement.y + (pos.y - geste.y) / vue.zoom };
        majPied();
        rendreBientot(60);
      } else {
        vue.cx = geste.vue.cx - (pos.x - geste.x) / vue.zoom;
        vue.cy = geste.vue.cy - (pos.y - geste.y) / vue.zoom;
        apercu();
      }
    });
    const fin = (ev) => {
      if (!geste) return;
      const g = geste;
      geste = null;
      if (g.rideau) return;
      const pos = position(ev);
      const ici = versPage(pos.x, pos.y, pos.w, pos.h);
      if (g.glisse) {
        if (etat.outil === 'zone' || etat.outil === 'nuage') finirRectangle(g.depart, ici);
        else if (etat.outil === 'main') {
          planche().alignePar = 'à la main';
          enregistrerProjet();
          majPied();
        } else rendreBientot(0);
        return;
      }
      cliquer(ici, pos);
    };
    t.addEventListener('pointerup', fin);
    t.addEventListener('pointercancel', () => {
      geste = null;
    });
  }

  function finirRectangle(p, q) {
    const rect = { x: Math.min(p[0], q[0]), y: Math.min(p[1], q[1]), w: Math.abs(q[0] - p[0]), h: Math.abs(q[1] - p[1]) };
    etat.saisie = [];
    if (rect.w < 2 || rect.h < 2) return;
    if (etat.outil === 'zone') {
      etat.outil = null; // une zone à la fois (elle relance la détection)
      majOutils();
      comp().masques = [...(comp().masques ?? []), rect];
      enregistrerProjet();
      majPied();
      detecter();
    } else {
      ajouterAnnotation({ genre: 'nuage', points: [[rect.x, rect.y], [rect.x + rect.w, rect.y + rect.h]] });
    }
    dessinerDessus();
  }

  /** Clic (sans glisser) dans la vue, selon l'outil. */
  async function cliquer(ici, pos = { cote: 'a' }) {
    const p = planche();
    const o = etat.outil;
    if (!o) {
      // Clic sur un nuage = choisir la modification.
      const m = (p.modifications ?? []).find((x) => ici[0] >= x.x && ici[0] <= x.x + x.w && ici[1] >= x.y && ici[1] <= x.y + x.h);
      if (m) {
        etat.choisie = m.n;
        etat.panneau = 'modifs';
        majPanneau();
        dessinerDessus();
        page.querySelector('.modif.choisie')?.scrollIntoView({ block: 'nearest' });
      }
      return;
    }
    if (o === 'deux-points' || o === 'axe') {
      await clicRecalage(ici, pos);
      return;
    }
    if (o === 'note') {
      const texte = await demanderTexte({ titre: 'Note' });
      if (texte) ajouterAnnotation({ genre: 'note', points: [ici], texte });
      return;
    }
    if (['fleche', 'distance', 'etalonner'].includes(o)) {
      etat.saisie.push(ici);
      if (etat.saisie.length === 2) {
        const [a, b] = etat.saisie;
        etat.saisie = [];
        if (o === 'fleche') ajouterAnnotation({ genre: 'fleche', points: [a, b] });
        else if (o === 'distance') {
          const d = mesurerLongueur(a, b, p.metresParPoint);
          ajouterAnnotation({ genre: 'distance', points: [a, b], texte: d.reelleM !== null ? `${fixe(d.reelleM, 3)} m` : `${fixe(d.papierMm, 1)} mm (papier)` });
        } else {
          const texte = await demanderTexte({ titre: 'Vraie longueur (m) de ce que vous avez cliqué', valeur: '' });
          const L = Number(String(texte ?? '').replace(',', '.'));
          const k = etalonner(a, b, L);
          if (!k) message('Longueur non comprise : tapez un nombre en mètres (ex. 5.40).', 4000);
          else {
            p.metresParPoint = k;
            etat.outil = null;
            enregistrerProjet();
            message(`Planche étalonnée : 1 mm sur le papier = ${fixe(k / MM_PAR_POINT, 3)} m.`, 4000, { ok: true });
            majPanneau();
          }
        }
      }
      dessinerDessus();
      majOutils();
      return;
    }
    if (o === 'surface') {
      const premier = etat.saisie[0];
      if (etat.saisie.length >= 3 && Math.hypot(ici[0] - premier[0], ici[1] - premier[1]) * vue.zoom < 10) {
        const pts = etat.saisie;
        etat.saisie = [];
        const s = mesurerSurface(pts, p.metresParPoint);
        ajouterAnnotation({ genre: 'surface', points: pts, texte: s.reelleM2 !== null ? `${fixe(s.reelleM2, 2)} m²` : `${fixe(s.papierMm2 / 100, 1)} cm² (papier)` });
      } else etat.saisie.push(ici);
      dessinerDessus();
    }
  }

  function ajouterAnnotation(a) {
    const p = planche();
    p.annotations = [...(p.annotations ?? []), { id: nouvelId(), ...a, par: qui(), le: new Date().toISOString() }];
    enregistrerProjet();
    etat.panneau = 'annotations';
    majPanneau();
    dessinerDessus();
  }

  // ---------------------------------------------------------------- Recalage de B

  // 0.316.0 : « 2 points » et « Sur axe » comme dans Caler plan : A à gauche, B à droite, accroche sur les sommets et
  // les traits du PDF (point 1 sur A puis sur B, point 2 sur A puis sur B ; ou un trait de A puis un trait de B).
  const OUTILS_RECALAGE = ['deux-points', 'axe'];

  /** Entrée / sortie d'un outil de recalage : plan côte à côte pendant l'outil, l'affichage d'avant ensuite. */
  async function passerEnRecalage(ancien) {
    const veut = OUTILS_RECALAGE.includes(etat.outil);
    const avait = OUTILS_RECALAGE.includes(ancien);
    etat.survol = null;
    if (veut && !avait) {
      etat.modeAvantRecalage = etat.mode;
      if (etat.mode !== 'cote') {
        etat.mode = 'cote';
        vue = null;
        majOutils();
        await cadrer();
      }
      await chargerSegments();
    } else if (!veut && avait && etat.modeAvantRecalage && etat.modeAvantRecalage !== 'cote') {
      etat.mode = etat.modeAvantRecalage;
      etat.modeAvantRecalage = null;
      vue = null;
      majOutils();
      await cadrer();
    }
  }

  /** Traits des deux PDF (en points, y vers le bas) pour l'accroche ; B dans son repère d'origine. */
  async function chargerSegments() {
    const p = planche();
    const cle = `${p.a.fichier}:${p.a.page}|${p.b.fichier}:${p.b.page}`;
    if (etat.segments?.cle === cle) return;
    occuper('Lecture des traits pour l\'accroche…');
    try {
      const [docA, docB] = await Promise.all([documentDe(fichier(p.a.fichier)), documentDe(fichier(p.b.fichier))]);
      const [sa, sb] = await Promise.all([segmentsDeLaPage(docA, p.a.page), segmentsDeLaPage(docB, p.b.page)]);
      const enPoints = (liste) => liste.map((q) => q.map((v) => v / MM_PAR_POINT));
      etat.segments = { cle, a: enPoints(sa), b: enPoints(sb) };
      if (!sa.length || !sb.length) message('Peu de traits dans un des PDF (plan scanné ?) : pas d\'accroche, le point cliqué est pris tel quel.', 6000);
    } catch (erreur) {
      etat.segments = { cle, a: [], b: [] };
      message(`Accroche indisponible : ${erreur.message}`, 5000);
    }
    occuper('');
  }

  /** Accroche sous la souris : { cote, type, point (repère de la vue : A, ou B posé), segment (repère d'origine du plan) }. */
  function accrocheSous(pos) {
    if (!etat.segments || !vue) return null;
    const ici = versPage(pos.x, pos.y, pos.w, pos.h);
    const tol = 12 / vue.zoom;
    if (pos.cote === 'a') {
      const r = accrocherSegments(etat.segments.a, ici, tol);
      return r ? { cote: 'a', ...r } : null;
    }
    const al = planche().alignement;
    const r = accrocherSegments(etat.segments.b, inverserAlignement(al, ici), tol / al.s);
    return r ? { cote: 'b', ...r, point: appliquerAlignement(al, r.point) } : null;
  }

  function survolerRecalage(pos) {
    cancelAnimationFrame(etat.imageSurvol);
    etat.imageSurvol = requestAnimationFrame(() => {
      etat.survol = accrocheSous(pos);
      etat.pointeur = { cote: pos.cote };
      dessinerDessus();
    });
  }

  /** Marques du recalage (accroche sous la souris, points déjà posés) pour la copie « a » ou « b » de la vue. */
  function dessinerRecalage(ctx, cote, E) {
    const marque = (pt, texte, couleur) => {
      const [x, y] = E(pt);
      ctx.strokeStyle = couleur;
      ctx.fillStyle = couleur;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, 2 * Math.PI);
      ctx.moveTo(x - 11, y);
      ctx.lineTo(x + 11, y);
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x, y + 11);
      ctx.stroke();
      if (texte) {
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText(texte, x + 10, y - 9);
      }
    };
    etat.saisie.forEach((pt, i) => {
      if ((i % 2 === 0 ? 'a' : 'b') === cote) marque(pt, `P${Math.floor(i / 2) + 1}`, '#ea580c');
    });
    const axe = (seg, couleur, enB) => {
      const [p, q] = enB ? [appliquerAlignement(planche().alignement, [seg[0], seg[1]]), appliquerAlignement(planche().alignement, [seg[2], seg[3]])] : [[seg[0], seg[1]], [seg[2], seg[3]]];
      const [x1, y1] = E(p);
      const [x2, y2] = E(q);
      ctx.strokeStyle = couleur;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    (etat.axePts ?? []).forEach((pt, i) => {
      if ((!etat.axe?.a ? 'a' : 'b') === cote) marque(pt, `P${i + 1}`, '#ea580c');
    });
    if (etat.axe?.a && cote === 'a') axe(etat.axe.a, '#ea580c', false);
    if (etat.axe?.b && cote === 'b') axe(etat.axe.b, '#ea580c', true);
    const s = etat.survol;
    if (s && s.cote === cote) {
      if (etat.outil === 'axe' && (etat.axeMode ?? 'trait') === 'trait' && s.segment && ((cote === 'a' && !etat.axe?.a) || (cote === 'b' && etat.axe?.a && !etat.axe?.b))) axe(s.segment, '#0ea5e9', cote === 'b');
      else {
        const [x, y] = E(s.point);
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 2;
        if (s.type === 'sommet') ctx.strokeRect(x - 6, y - 6, 12, 12);
        else {
          ctx.beginPath();
          ctx.moveTo(x - 6, y - 6);
          ctx.lineTo(x + 6, y + 6);
          ctx.moveTo(x + 6, y - 6);
          ctx.lineTo(x - 6, y + 6);
          ctx.stroke();
        }
      }
    }
  }

  /** Clic d'un outil de recalage : le point accroché (ou le point cliqué), du bon côté. */
  async function clicRecalage(ici, pos) {
    const accroche = accrocheSous(pos);
    const point = accroche?.point ?? ici;
    const p = planche();
    if (etat.outil === 'deux-points') {
      const attendu = etat.saisie.length % 2 === 0 ? 'a' : 'b';
      if (pos.cote !== attendu) {
        message(attendu === 'a' ? 'Cliquez le point sur A (à gauche).' : 'Cliquez le même point sur B (à droite).', 3000);
        return;
      }
      etat.saisie.push(point);
      if (etat.saisie.length === 4) {
        const [a1, b1, a2, b2] = etat.saisie;
        etat.saisie = [];
        recalerParDeuxPoints(a1, b1, a2, b2);
        await passerEnRecalage('deux-points');
      }
      majOutils();
      dessinerDessus();
      return;
    }
    // Sur axe : un trait de A, un trait de B, puis (facultatif) un point de chaque pour caler le long du trait.
    etat.axe ??= { a: null, b: null };
    const ax = etat.axe;
    if (!ax.a || !ax.b) {
      const cote = ax.a ? 'b' : 'a';
      if (pos.cote !== cote) {
        message(cote === 'a' ? 'Cliquez l\'axe sur A (à gauche).' : 'Cliquez l\'axe correspondant sur B (à droite).', 3000);
        return;
      }
      if ((etat.axeMode ?? 'trait') === 'points') {
        // Axe défini par 2 points accrochés (sur A, puis sur B).
        etat.axePts = [...(etat.axePts ?? []), point];
        if (etat.axePts.length < 2) {
          majOutils();
          dessinerDessus();
          return;
        }
        const [u, v] = etat.axePts;
        etat.axePts = [];
        if (Math.hypot(v[0] - u[0], v[1] - u[1]) < 1e-6) {
          message('Les deux points sont confondus : recommencez.', 3000);
          return;
        }
        // Sur B, les points sont ramenés dans le repère d'origine de B (comme un trait du PDF).
        ax[cote] = cote === 'a' ? [u[0], u[1], v[0], v[1]] : [...inverserAlignement(p.alignement, u), ...inverserAlignement(p.alignement, v)];
      } else {
        if (!accroche?.segment) {
          message('Aucun trait ici : cliquez sur un trait du plan.', 3000);
          return;
        }
        ax[cote] = accroche.segment;
      }
      if (ax.a && ax.b) {
        const al = alignementSurAxes(p.alignement, ax.a, ax.b);
        if (!al) {
          message('Trait trop court : choisissez-en un autre.', 3000);
          ax.b = null;
          return;
        }
        p.alignement = al;
        p.alignePar = 'sur axe';
        enregistrerProjet();
        majPied();
        rendreBientot(0);
        message('Traits alignés. Pour caler le long du trait : cliquez un point de A puis le même sur B (ou Échap pour finir).', 7000, { ok: true });
      }
      majOutils();
      dessinerDessus();
      return;
    }
    const attendu = etat.saisie.length % 2 === 0 ? 'a' : 'b';
    if (pos.cote !== attendu) {
      message(attendu === 'a' ? 'Cliquez le point sur A (à gauche).' : 'Cliquez le même point sur B (à droite).', 3000);
      return;
    }
    etat.saisie.push(point);
    if (etat.saisie.length === 2) {
      const [a, bVu] = etat.saisie;
      etat.saisie = [];
      const b = inverserAlignement(p.alignement, bVu);
      p.alignement = alignementLeLongDeLAxe(p.alignement, ax.a, a, b) ?? p.alignement;
      p.alignePar = 'sur axe + point';
      etat.outil = null;
      etat.axe = null;
      enregistrerProjet();
      majPied();
      rendreBientot(0);
      detecter();
      await passerEnRecalage('axe');
    }
    majOutils();
    dessinerDessus();
  }

  /** Similitude B → A par 2 paires de points (cliqués dans le repère de A ; B ramené par l'alignement actuel). */
  function recalerParDeuxPoints(a1, b1Vu, a2, b2Vu) {
    const p = planche();
    const inverse = (q) => {
      const { x, y, s, r } = p.alignement;
      const t = (-r * Math.PI) / 180;
      const dx = (q[0] - x) / s;
      const dy = (q[1] - y) / s;
      return [Math.cos(t) * dx - Math.sin(t) * dy, Math.sin(t) * dx + Math.cos(t) * dy];
    };
    const b1 = inverse(b1Vu);
    const b2 = inverse(b2Vu);
    // a = (A2 − A1) / (B2 − B1) en nombres complexes.
    const [ux, uy] = [a2[0] - a1[0], a2[1] - a1[1]];
    const [vx, vy] = [b2[0] - b1[0], b2[1] - b1[1]];
    const n = vx * vx + vy * vy;
    if (n === 0) {
      message('Les deux points de B sont confondus : recommencez.', 4000);
      return;
    }
    let ar = (ux * vx + uy * vy) / n;
    let ai = (uy * vx - ux * vy) / n;
    if (etat.verrouEchelle) {
      const m = Math.hypot(ar, ai);
      ar /= m;
      ai /= m;
    }
    const x = a1[0] - (ar * b1[0] - ai * b1[1]);
    const y = a1[1] - (ai * b1[0] + ar * b1[1]);
    p.alignement = { x, y, s: Math.hypot(ar, ai), r: (Math.atan2(ai, ar) * 180) / Math.PI };
    p.alignePar = 'par 2 points';
    etat.outil = null;
    enregistrerProjet();
    majOutils();
    majPied();
    rendreBientot(0);
    detecter();
  }

  /** Recalage automatique de B sur A (calage de plans : vote + ajustement, à la même échelle si coché). */
  async function recalerAuto(p = planche(), { silencieux = false } = {}) {
    occuper('Recalage automatique…');
    try {
      const [docA, docB] = await Promise.all([documentDe(fichier(p.a.fichier)), documentDe(fichier(p.b.fichier))]);
      const [segsA, segsB] = await Promise.all([segmentsDeLaPage(docA, p.a.page), segmentsDeLaPage(docB, p.b.page)]);
      if (segsA.length < 20 || segsB.length < 20) throw new Error('pas assez de traits (plan scanné ?) : recalez par 2 points');
      const r = await calculerAuto(segsB, segsA, { echelles: etat.verrouEchelle ? [1] : [0.5, 1, 2], echelleFixe: etat.verrouEchelle ? 1 : null });
      if (!r || r.niveau === 'faible') throw new Error('recalage incertain : recalez par 2 points (ou à la main)');
      p.alignement = alignementDepuisSimilitude(r.similitude, MM_PAR_POINT);
      p.alignePar = `auto, confiance ${r.niveau}`;
      enregistrerProjet();
      if (!silencieux) message(`B recalé automatiquement (confiance ${r.niveau}).`, 3000, { ok: true });
      return true;
    } catch (erreur) {
      if (!silencieux) message(`Recalage automatique : ${erreur.message}`, 6000);
      return false;
    } finally {
      occuper('');
      majPied();
    }
  }

  // ---------------------------------------------------------------- Détection

  /**
   * Détecte les modifications d'une planche : les deux pages rendues à ~3600 px de grand côté, comparées à la
   * tolérance, regroupées ; textes avant → après ; les états (validée / ignorée, commentaire) d'une zone déjà vue
   * qui retombe au même endroit sont gardés.
   */
  async function detecter(p = planche(), { silencieux = false } = {}) {
    const c = comp();
    occuper('Détection des modifications…');
    try {
      const [docA, docB] = await Promise.all([documentDe(fichier(p.a.fichier)), documentDe(fichier(p.b.fichier))]);
      const taille = await taillePage(docA, p.a.page);
      const k = Math.min(4, PX_DETECTION / Math.max(taille.largeur, taille.hauteur));
      const W = Math.round(taille.largeur * k);
      const H = Math.round(taille.hauteur * k);
      const M = [k, 0, 0, k, 0, 0];
      const cA = document.createElement('canvas');
      const cB = document.createElement('canvas');
      await Promise.all([rendrePage(docA, p.a.page, cA, M, W, H), rendrePage(docB, p.b.page, cB, composer(M, matriceAlignement(p.alignement)), W, H)]);
      const encreA = masqueEncre(cA.getContext('2d').getImageData(0, 0, W, H).data);
      const encreB = masqueEncre(cB.getContext('2d').getImageData(0, 0, W, H).data);
      cA.width = 0;
      cB.width = 0;
      const pxmm = k / MM_PAR_POINT;
      const cellule = Math.max(2, Math.round(pxmm * 0.8));
      const zones = await detecterEnArrierePlan(encreA, encreB, W, H, {
        r: Math.max(1, Math.round(c.tolerance * pxmm)), cellule,
        ecart: Math.max(1, Math.round((c.regroupement * pxmm) / cellule)), minPixels: Math.max(6, Math.round(pxmm * pxmm * 0.6)),
        masques: (c.masques ?? []).map((m) => ({ x: m.x * k, y: m.y * k, w: m.w * k, h: m.h * k })),
        cadre: { bord: 20 * pxmm, fin: 8 * pxmm, long: 80 * pxmm },
      });
      const marge = 1.5 / MM_PAR_POINT;
      const zonesPt = zones.map((z) => ({ ...z, x: z.x / k - marge, y: z.y / k - marge, w: z.w / k + 2 * marge, h: z.h / k + 2 * marge }));
      let textes = [];
      if (c.textes) {
        const [tA, tB] = await Promise.all([textesDeLaPage(docA, p.a.page), textesDeLaPage(docB, p.b.page)]);
        const tBA = tB.map((t) => {
          const [x, y] = appliquerAlignement(p.alignement, [t.x, t.y]);
          return { ...t, x, y, w: t.w * p.alignement.s, h: t.h * p.alignement.s };
        });
        const dansMasque = (x, y) => (c.masques ?? []).some((m) => x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h);
        textes = differencesTextes(tA, tBA, dansMasque);
      }
      const anciennes = p.modifications ?? [];
      p.modifications = listerModifications(zonesPt, textes).map((m) => {
        const avant = anciennes.find((a) => a.etat !== 'traiter' && seTouchent(a, m) && a.genre === m.genre);
        return { id: nouvelId(), ...m, etat: avant?.etat ?? 'traiter', commentaire: avant?.commentaire ?? '', par: avant?.par ?? '', le: avant?.le ?? '' };
      });
      p.detecteLe = new Date().toISOString();
      enregistrerProjet();
      if (!silencieux) message(`${p.modifications.length} modification(s) trouvée(s).`, 2500, { ok: true });
    } catch (erreur) {
      message(`Détection impossible : ${erreur.message}`, 6000);
    } finally {
      occuper('');
      if (planche() === p) {
        majPanneau();
        dessinerDessus();
      }
    }
  }

  /** À l'ouverture d'une planche : recalage auto puis détection si elle n'a jamais été faite. */
  async function preparerPlanche({ auto = false } = {}) {
    const p = planche();
    if (!p) return;
    vue = null;
    images = null;
    await cadrer();
    if (auto && !p.alignePar) {
      await recalerAuto(p, { silencieux: true });
      rendreBientot(0);
    }
    if (!p.detecteLe) await detecter(p, { silencieux: true });
  }

  async function detecterTout() {
    const c = comp();
    for (let i = 0; i < c.planches.length; i += 1) {
      occuper(`Planche ${i + 1} / ${c.planches.length}…`);
      const p = c.planches[i];
      if (!p.alignePar) await recalerAuto(p, { silencieux: true });
      await detecter(p, { silencieux: true });
    }
    const total = c.planches.reduce((n, p) => n + (p.modifications?.length ?? 0), 0);
    message(`${c.planches.length} planches analysées : ${total} modification(s).`, 4000, { ok: true });
    majPanneau();
  }

  /** Zoom sur une modification. */
  function allerA(m) {
    const t = toile();
    if (!t || !vue) return;
    const w = etat.mode === 'cote' ? t.clientWidth / 2 : t.clientWidth;
    vue = { zoom: Math.min(w / (m.w * 3), t.clientHeight / (m.h * 3), vue.zoom * 8), cx: m.x + m.w / 2, cy: m.y + m.h / 2 };
    rendreBientot(0);
    dessinerDessus();
  }

  // ---------------------------------------------------------------- Rapport

  function htmlRapport() {
    const c = comp();
    const r = etat.rapport;
    const mods = c.planches.flatMap((p) => p.modifications ?? []);
    return `
      <div class="rapport-comparateur">
        <section class="carte-calage">
          <h3>Rapport « ${echapper(c.nom)} »</h3>
          <p class="aide-calage">${c.planches.length} planche(s) · ${mods.length} modification(s) · ${mods.filter((m) => m.etat === 'traiter').length} à traiter</p>
          <label><input type="checkbox" data-rapport-option="planches" ${r.planches ? 'checked' : ''}> Planches avec les nuages numérotés</label>
          <fieldset class="choix-fond-rapport" ${r.planches ? '' : 'disabled'}>
            <legend>Plan de chaque planche</legend>
            <label><input type="radio" name="fond-rapport" data-fond="b" ${r.fond === 'b' ? 'checked' : ''}> Plan B (nouvel indice) en vectoriel + les différences en couleur</label>
            <label><input type="radio" name="fond-rapport" data-fond="a" ${r.fond === 'a' ? 'checked' : ''}> Plan A (ancien indice) en vectoriel + les différences en couleur</label>
            <label><input type="radio" name="fond-rapport" data-fond="gris" ${r.fond === 'gris' ? 'checked' : ''}> Superposition comme à l'écran : identique en gris, A et B dans leur couleur (image)</label>
            <label class="${r.fond === 'gris' ? 'grise' : ''}"><input type="checkbox" data-rapport-option="vectoriel" ${r.vectoriel && r.fond !== 'gris' ? 'checked' : ''} ${r.fond === 'gris' ? 'disabled' : ''}> Différences en traits vectoriels (nets) au lieu d'une image ; les textes et aplats modifiés sont alors seulement dans les nuages</label>
          </fieldset>
          <label><input type="checkbox" data-rapport-option="ignorees" ${r.ignorees ? 'checked' : ''}> Modifications ignorées aussi</label>
          <label><input type="checkbox" data-rapport-option="commentaires" ${r.commentaires ? 'checked' : ''}> Commentaires</label>
          <p class="aide-calage">Nom : <span class="chiffre">${echapper(nomRapport('pdf'))}</span></p>
          <div class="barre-calage"><button type="button" class="bouton" data-action="rapport-pdf">Enregistrer le rapport PDF</button><button type="button" class="bouton-secondaire" data-action="image-png">Image PNG de la planche ${etat.planche + 1}</button></div>
        </section>
      </div>`;
  }

  const nomRapport = (ext) => `${nomFichierExport(projet.cartouche?.affaire ?? '', `comparaison_${comp().nom}`)}.${ext}`;

  /** Encre de A et de B (B posé par l'alignement) à k pixels par point : { encreA, encreB, W, H, taille }. */
  async function masquesPlanche(p, k) {
    const [docA, docB] = await Promise.all([documentDe(fichier(p.a.fichier)), documentDe(fichier(p.b.fichier))]);
    const taille = await taillePage(docA, p.a.page);
    const W = Math.round(taille.largeur * k);
    const H = Math.round(taille.hauteur * k);
    const M = [k, 0, 0, k, 0, 0];
    const cA = document.createElement('canvas');
    const cB = document.createElement('canvas');
    await Promise.all([rendrePage(docA, p.a.page, cA, M, W, H), rendrePage(docB, p.b.page, cB, composer(M, matriceAlignement(p.alignement)), W, H)]);
    const encreA = masqueEncre(cA.getContext('2d').getImageData(0, 0, W, H).data);
    const encreB = masqueEncre(cB.getContext('2d').getImageData(0, 0, W, H).data);
    cA.width = 0;
    cB.width = 0;
    return { encreA, encreB, W, H, taille };
  }

  /** Image d'une planche (repère de A, k px par point) : superposition complète, ou seulement les différences (transparent ailleurs). */
  async function imagePlanche(p, k, { differencesSeules = false } = {}) {
    const { encreA, encreB, W, H, taille } = await masquesPlanche(p, k);
    const r = Math.round((comp().tolerance / MM_PAR_POINT) * k);
    const rgba = superposer(encreA, encreB, W, H, r, couleursRgb(), { sansIdentiques: differencesSeules });
    if (differencesSeules) for (let i = 0; i < W * H; i += 1) if (rgba[4 * i] === 255 && rgba[4 * i + 1] === 255 && rgba[4 * i + 2] === 255) rgba[4 * i + 3] = 0;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.getContext('2d').putImageData(new ImageData(rgba, W, H), 0, 0);
    const blob = await new Promise((tenir) => c.toBlob(tenir, 'image/png'));
    c.width = 0;
    return { blob, taille };
  }

  /** Différences en TRAITS : morceaux des traits de A absents de B (et inversement), en points de A, y vers le bas. */
  async function traitsDifferents(p, k) {
    const { encreA, encreB, W, H } = await masquesPlanche(p, k);
    const r = Math.round((comp().tolerance / MM_PAR_POINT) * k);
    const [docA, docB] = await Promise.all([documentDe(fichier(p.a.fichier)), documentDe(fichier(p.b.fichier))]);
    const [sa, sb] = await Promise.all([segmentsDeLaPage(docA, p.a.page), segmentsDeLaPage(docB, p.b.page)]);
    const enPoints = (liste) => liste.map((q) => q.map((v) => v / MM_PAR_POINT));
    const segsA = enPoints(sa);
    const segsB = enPoints(sb).map((q) => [...appliquerAlignement(p.alignement, [q[0], q[1]]), ...appliquerAlignement(p.alignement, [q[2], q[3]])]);
    return {
      traitsA: morceauxDifferents(segsA, dilater(encreB, W, H, r), W, H, k),
      traitsB: morceauxDifferents(segsB, dilater(encreA, W, H, r), W, H, k),
    };
  }

  async function exporterRapport() {
    const c = comp();
    occuper('Rapport PDF…');
    try {
      const planches = [];
      for (let i = 0; i < c.planches.length; i += 1) {
        const p = c.planches[i];
        occuper(`Rapport : planche ${i + 1} / ${c.planches.length}…`);
        const fA = fichier(p.a.fichier);
        const fB = fichier(p.b.fichier);
        const tailleB = await taillePage(await documentDe(fB), p.b.page);
        const fond = etat.rapport.fond;
        let imageDifferences = null;
        let traits = {};
        let tailleA = null;
        if (etat.rapport.planches) {
          const docA = await documentDe(fA);
          tailleA = await taillePage(docA, p.a.page);
          const k = Math.min(3, 3600 / Math.max(tailleA.largeur, tailleA.hauteur));
          if (fond !== 'gris' && etat.rapport.vectoriel) traits = await traitsDifferents(p, k);
          else {
            const { blob } = await imagePlanche(p, k, { differencesSeules: fond !== 'gris' });
            imageDifferences = new Uint8Array(await blob.arrayBuffer());
          }
        }
        planches.push({ planche: p, titre: `${i + 1}. ${p.titre}`, fond, fichierA: fA.id, docAOctets: octetsDeBase64(fA.donnees), pageA: p.a.page, fichierB: fB.id, docBOctets: octetsDeBase64(fB.donnees), pageB: p.b.page, tailleA, tailleB, imageDifferences, ...traits });
      }
      const { creerRapport } = await import('./rapport.js');
      const octets = await creerRapport({
        comparaison: c, planches,
        options: { avecPlanches: etat.rapport.planches, avecIgnorees: etat.rapport.ignorees, avecCommentaires: etat.rapport.commentaires },
        cartouche: { affaire: projet.cartouche?.affaire ?? '', projet: projet.cartouche?.designation ?? projet.nom ?? '', date: new Date().toLocaleDateString('fr-CH') },
      });
      enregistrer(new Blob([octets], { type: 'application/pdf' }), nomRapport('pdf'));
      message('Rapport PDF prêt.', 3000, { ok: true });
    } catch (erreur) {
      message(`Rapport impossible : ${erreur.message}`, 7000);
    } finally {
      occuper('');
    }
  }

  async function exporterImage() {
    const p = planche();
    occuper('Image PNG…');
    try {
      const taille = await taillePage(await documentDe(fichier(p.a.fichier)), p.a.page);
      const { blob } = await imagePlanche(p, Math.min(4, 4000 / Math.max(taille.largeur, taille.hauteur)));
      enregistrer(blob, nomRapport('png'));
    } catch (erreur) {
      message(`Image impossible : ${erreur.message}`, 6000);
    } finally {
      occuper('');
    }
  }

  // ================================================================ Événements

  async function ouvrirComparaison(id, ecran = 'comparer') {
    etat.comparaison = projet.comparaisons.find((c) => c.id === id) ?? null;
    if (!etat.comparaison) return;
    etat.planche = 0;
    etat.choisie = null;
    etat.ecran = ecran;
    dessiner();
    if (ecran === 'comparer') await preparerPlanche({ auto: true });
  }

  async function changerPlanche(i) {
    const n = comp().planches.length;
    etat.planche = ((i % n) + n) % n;
    etat.choisie = null;
    etat.saisie = [];
    dessiner();
    await preparerPlanche({ auto: true });
  }

  page.addEventListener('click', async (ev) => {
    const modif = ev.target.closest('[data-modif]');
    const b = ev.target.closest('button');
    if (modif && !b) {
      const m = planche().modifications.find((x) => x.n === Number(modif.dataset.modif));
      etat.choisie = m.n;
      majPanneau();
      allerA(m);
      return;
    }
    if (!b) return;
    const d = b.dataset;
    if (d.action === 'retour') fermer();
    else if (d.ecran) {
      if (d.ecran !== 'liste' && !comp()) return;
      etat.ecran = d.ecran;
      etat.outil = null;
      dessiner();
      if (d.ecran === 'comparer') await preparerPlanche();
    } else if (d.action === 'nouvelle') {
      etat.nouvelle = { A: [], B: [], X: [], nom: '', nomTouche: false };
      dessiner();
    } else if (d.action === 'annuler-nouvelle') {
      etat.nouvelle = null;
      dessiner();
    } else if (d.action === 'creer') creerComparaison();
    else if (d.ouvrir) ouvrirComparaison(d.ouvrir);
    else if (d.rapport) ouvrirComparaison(d.rapport, 'rapport');
    else if (d.supprimer) supprimerComparaison(d.supprimer);
    else if (d.planche) changerPlanche(etat.planche + Number(d.planche));
    else if (d.mode) {
      const avant = etat.mode;
      etat.mode = d.mode;
      majOutils();
      if ((avant === 'cote') !== (d.mode === 'cote')) {
        vue = null;
        cadrer();
      } else afficher();
    } else if (d.axeMode) {
      etat.axeMode = d.axeMode;
      etat.axe = null;
      etat.axePts = [];
      etat.saisie = [];
      majOutils();
      dessinerDessus();
    } else if (d.outil) {
      const ancien = etat.outil;
      etat.outil = etat.outil === d.outil ? null : d.outil;
      etat.saisie = [];
      etat.axe = null;
      etat.axePts = [];
      await passerEnRecalage(ancien);
      majOutils();
      dessinerDessus();
    } else if (d.action === 'auto') {
      if (await recalerAuto()) {
        rendreBientot(0);
        detecter();
      }
    } else if (d.action === 'reinitialiser') {
      planche().alignement = { ...ALIGNEMENT_NEUTRE };
      planche().alignePar = 'remis à zéro';
      enregistrerProjet();
      majPied();
      rendreBientot(0);
      detecter();
    } else if (d.action === 'textes') {
      comp().textes = !comp().textes;
      enregistrerProjet();
      majOutils();
      detecter();
    } else if (d.action === 'detecter') detecter();
    else if (d.action === 'tout-detecter') detecterTout();
    else if (d.action === 'effacer-zones') {
      comp().masques = [];
      enregistrerProjet();
      majPied();
      dessinerDessus();
      detecter();
    } else if (d.zoom) {
      if (d.zoom === 'tout') cadrer();
      else if (vue) {
        vue.zoom *= Number(d.zoom);
        apercu();
        rendreBientot();
      }
    } else if (d.panneau) {
      etat.panneau = d.panneau;
      majPanneau();
    } else if (d.filtre) {
      etat.filtre = d.filtre;
      majPanneau();
      dessinerDessus();
    } else if (d.etat) {
      const m = planche().modifications.find((x) => x.n === Number(d.n));
      m.etat = d.etat;
      m.par = d.etat === 'traiter' ? '' : qui();
      m.le = d.etat === 'traiter' ? '' : new Date().toISOString();
      enregistrerProjet();
      majPanneau();
      dessinerDessus();
    } else if (d.commenter) {
      const m = planche().modifications.find((x) => x.n === Number(d.commenter));
      const texte = await demanderTexte({ titre: `Commentaire de la modification ${m.n}`, valeur: m.commentaire ?? '' });
      if (texte === null) return;
      m.commentaire = texte;
      enregistrerProjet();
      majPanneau();
    } else if (d.retirerAnnotation !== undefined) {
      planche().annotations.splice(Number(d.retirerAnnotation), 1);
      enregistrerProjet();
      majPanneau();
      dessinerDessus();
    } else if (d.action === 'rapport-pdf') exporterRapport();
    else if (d.action === 'image-png') exporterImage();
  });

  page.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (t.dataset.fichiers && t.files?.length) lireFichiersChoisis(t.dataset.fichiers, t.files);
    else if (t.dataset.champ === 'planche') changerPlanche(Number(t.value));
    else if (t.dataset.champ === 'plan-a' || t.dataset.champ === 'plan-b') {
      choisirPaire(page.querySelector('[data-champ="plan-a"]').value, page.querySelector('[data-champ="plan-b"]').value);
    } else if (t.dataset.couleur) {
      comp().couleurs = { ...couleursCss(), [t.dataset.couleur]: t.value };
      enregistrerProjet();
      rendreBientot(0);
    } else if (t.dataset.champ === 'verrou') etat.verrouEchelle = t.checked;
    else if (t.dataset.champ === 'tolerance' || t.dataset.champ === 'regroupement') {
      comp()[t.dataset.champ] = Number(t.value);
      enregistrerProjet();
      if (t.dataset.champ === 'tolerance') rendreBientot(0);
      detecter();
    } else if (t.dataset.fond) {
      etat.rapport.fond = t.dataset.fond;
      dessiner();
    } else if (t.dataset.rapportOption) {
      etat.rapport[t.dataset.rapportOption] = t.checked;
      if (t.dataset.rapportOption === 'planches') dessiner();
    }
  });
  page.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset.champ === 'nom-comparaison') {
      etat.nouvelle.nom = t.value;
      etat.nouvelle.nomTouche = true;
    } else if (t.dataset.champ === 'tolerance') page.querySelector('[data-zone="tolerance"]').textContent = `${fixe(Number(t.value), 1)} mm`;
    else if (t.dataset.champ === 'regroupement') page.querySelector('[data-zone="regroupement"]').textContent = `${t.value} mm`;
  });
  // Flèches du clavier : déplacer B (outil « À la main ») de 0,1 mm (Maj : 1 mm).
  page.addEventListener('keydown', (ev) => {
    if (etat.ecran !== 'comparer' || etat.outil !== 'main' || ev.target.matches('input, select')) return;
    const pas = (ev.shiftKey ? 1 : 0.1) / MM_PAR_POINT;
    const d = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    const p = planche();
    p.alignement = { ...p.alignement, x: p.alignement.x + d[0], y: p.alignement.y + d[1] };
    p.alignePar = 'à la main';
    majPied();
    rendreBientot(150);
    clearTimeout(page.minuterieClavier);
    page.minuterieClavier = setTimeout(() => {
      enregistrerProjet();
      detecter();
    }, 800);
  });

  dessiner();
  return { fermer };
}
