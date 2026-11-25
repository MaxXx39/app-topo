// Application « Calage de plans » (0.278.0, Expert, site PC et Topo Bureau ; décisions du 22.11) : caler un plan
// reçu (architecte, ingénieur : ses unités, sa rotation, son origine) sur un plan MN95 du projet ouvert, en cliquant
// des éléments homologues sur les deux plans. Page plein écran à part (comme Matériel) :
//  Liste (plans calés du projet) → 1 Le plan (fichier reçu, référence) → 2 Caler (outils en haut, deux vues de même
//  taille, éléments et résultat en bas) → 3 Nettoyer (0.279.0 : calques, couleurs, types, hachures, zone, préfixe)
//  → Terminé (le plan calé et nettoyé est un plan du projet, avec sa recette).
// 0.281.0 : calage automatique (topo/calage-auto.js, en arrière-plan), nouvel indice qui a bougé recalé tout seul,
// « Ce qui a changé » entre deux indices (topo/differences-plan.js), cotations et lignes de repère lues.
// Calculs : topo/calage-plan.js (caler), topo/nettoyage-plan.js (nettoyer) ; rangement : calage/plans.js.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { demanderChoix, demanderChamps } from '../outils/choix.js';
import { peutConvertirDwg, choisirDwgBureau } from '../android/pont.js';
import { indiceSuivant, reperesDuPlan, controlerIndice, partRetrouvee, TOLERANCE_REPERE_M, PART_MEME_ORIGINE, nomPlanCale, baseDuNomCale, typeDuFichier } from '../topo/indice-plan.js';
import { lirePlanDxf, texteDuDxf, estEnMn95, nomXref } from '../topo/dxf-plan.js';
import { groupePrincipal } from '../topo/cadrage-plan.js';
import { planRecale } from '../topo/recalage.js';
import { accrocher, accrocherTrait, sourcesDesPlans } from '../topo/accroche.js';
import { caler, droiteParPoints, ErreurCalage, appliquerSimilitude, inverserSimilitude, versHelmert, resultatAutomatique, SEUIL_JUSTE_M, SEUIL_A_REVOIR_M } from '../topo/calage-plan.js';
import { segmentsDuPlan } from '../topo/calage-auto.js';
import { differencesPlans, sousPlan } from '../topo/differences-plan.js';
import { archiver, restaurer } from '../projet/archives.js';
import { calculerAuto } from './calcul-auto.js';
import { recetteDeDepart, nettoyerPlan, compterParCalque, calqueSousLePoint, TYPES_RETIRABLES, CHOIX_HACHURES, planVisible, planDesEnleves, objetSousLePoint, objetsDansZone, objetsEnleves, libelleObjet, exploserTextes } from '../topo/nettoyage-plan.js';
import { plansDeReference, plansCales, indicesDuGroupe, etiquettes, planCale, planReference, planDesPoints, planEnMn95, REF_POINTS, resultatDejaCale, estDejaCale, referencesPourVerifier } from './plans.js';
import { resumeControlePlan } from '../topo/controle-plan.js';
import { creerVueCalage } from './vue-calage.js';
import { lirePdfPourCalage, estPdf } from './pdf-calage.js';

const COULEUR_CALAGE = '#2563eb';
const COULEUR_VERIF = '#16a34a';
const COULEUR_REF_CALE = '#9ca3af';
const COULEUR_SELECTION = '#e11d48'; // calques choisis au nettoyage
const COULEUR_ENLEVE = '#dc2626'; // objets enlevés à la main, montrés pour être restaurés (0.298.0)
const IDENTITE = { echelle: 1, rotationDeg: 0, tx: 0, ty: 0 }; // plan de référence : déjà en MN95
const ACCROCHES = [['sommet', '□', 'Sommet'], ['centre', '○', 'Centre'], ['croisement', '×', 'Intersection'], ['ligne', '—', 'Sur ligne']];
const AFFICHAGES = [['deux', '▥', 'Côte à côte'], ['plan', '◧', 'Plan reçu'], ['ref', '◨', 'Référence'], ['cale', '⧉', 'Calé']];
const VERDICTS = { juste: ['Juste', 'p-juste'], 'a-revoir': ['À revoir', 'p-revoir'], faux: ['Faux', 'p-faux'], 'sans-verification': ['Sans vérification', 'p-sans'] };

const nombre = (x, d) => (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d); // point décimal, comme partout dans Topo
const mm = (m) => `${nombre(m * 1000, 1)} mm`;
const couleurEcart = (m) => (m <= SEUIL_JUSTE_M ? 'var(--vert, #16a34a)' : m <= SEUIL_A_REVOIR_M ? 'var(--orange, #ea580c)' : 'var(--rouge, #dc2626)');
const dateCourte = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-CH') : '');

/** Copie « vue » d'un plan avec une seule couleur (sans toucher le plan). */
const enCouleur = (plan, couleur) => Object.assign(Object.create(plan), { couleur, visible: true });

/**
 * Ouvre la page. projet : projet ouvert (projet.plansDxf) ; ajouterPlan(plan) : range le plan calé dans le projet
 * (identifiant, dossier, enregistrement, Drive) et renvoie le plan rangé ; quandRetour() ; message().
 */
export function ouvrirCalage({ projet, simple = false, depart = null, controlerPlan = null, points = () => [], ajouterPlan, modifier = () => false, dossiers = () => [], dossierDepart = () => '', quandRetour = null, message = () => {} }) {
  const page = document.createElement('dialog');
  page.className = 'page-calage';
  document.body.append(page);
  page.showModal();

  let etape = 'liste';
  const etat = {
    lu: null, fichier: '', nom: '', referenceId: '', lecture: '', indice: 'A',
    // Nouvel indice (0.280.0) : { planId, ancien (plan calé), controle } ; null pour un nouveau plan.
    nouvelIndice: null,
    elements: [], enCours: null,
    type: 'point', axeMode: 'trait', role: 'calage', accroche: 'sommet', affichage: 'deux',
    resultat: null, erreur: '', enregistre: null,
    // Nettoyage : recette en cours, retours en arrière (↶), calque choisi, filtre, zone en cours de dessin.
    // 0.283.0 : calques choisis (clic sur le plan ou dans la liste), puis « Écarter la sélection » ; référence cachée au nettoyage.
    recette: null, avant: [], selection: [], filtre: '', voirEcartes: false, refVisible: false, dessinZone: null,
    // Écran de chargement (lecture, ODA) ; vérification après coup { planId } ; plan de référence en cours d'ajout ; comparaison { groupe, avantId, apresId } ; dossier choisi.
    occupe: '', verif: null, modeReference: false, comparaison: null, baseId: '', dossier: '',
    // Calage automatique trouvé (retour de calerAutomatiquement + sources) ; calcul en cours ; vue « Ce qui a changé ».
    auto: null, calculAuto: false, voirChangements: false,
    // 0.298.0 : enlever des objets à la main (clic ou rectangle) ; montrer les objets enlevés (en rouge, clic = restaurer).
    enleverMain: false, voirEnleves: false, choisirCalques: false, curseurZone: null,
    // 0.298.0 : plan reçu lu dans un PDF { page, mode ('traits' | 'image'), avertissements }, ou null.
    lecturePdf: null,
    // 0.309.0 : plan importé « déjà calé » (MN95, sans référence ni calage) : 1 Le plan → 2 Nettoyer → 3 Terminé.
    dejaCale: false,
  };
  let vues = [];
  let reserve = null; // état gardé pendant l'ajout d'une référence

  // Référence : un plan du projet (en MN95 ou local), ou « Points du projet » (levés, à implanter, contrôle ; 0.284.0).
  let memoPoints = { n: -1, plan: null };
  const planPoints = () => {
    const liste = points();
    if (memoPoints.n !== liste.length) memoPoints = { n: liste.length, plan: planDesPoints(liste) };
    return memoPoints.plan;
  };
  // Indices d'un plan calé : le dernier est dans le projet, les anciens sont dans les Archives (0.284.1).
  const tousPlans = () => [...projet.plansDxf, ...(projet.archives ?? []).flatMap((a) => a.contenu?.plansDxf ?? [])];
  const planParId = (id) => tousPlans().find((p) => p.id === id) ?? null;
  const archiveDu = (id) => (projet.archives ?? []).find((a) => a.contenu?.plansDxf?.some((p) => p.id === id)) ?? null;
  const referencePoints = () => etat.referenceId === REF_POINTS;
  const reference = () => (referencePoints() ? (points().length ? planPoints() : null) : projet.plansDxf.find((p) => p.id === etat.referenceId) ?? null);
  const referenceAffichee = () => (reference() ? planRecale(reference()) : null);
  let grise = { source: null, plan: null };
  const refGrise = () => {
    const r = referenceAffichee();
    if (grise.source !== r) grise = { source: r, plan: enCouleur(r, COULEUR_REF_CALE) };
    return grise.plan;
  };

  function remettreAZero() {
    Object.assign(etat, {
      lu: null, fichier: '', nom: '', lecture: '', indice: 'A', nouvelIndice: null, elements: [], enCours: null, resultat: null,
      erreur: '', enregistre: null, recette: null, avant: [], dessinZone: null, selection: [], type: 'point', role: 'calage',
      auto: null, calculAuto: false, voirChangements: false, occupe: '', verif: null, modeReference: false, comparaison: null, baseId: '', refVisible: false,
      enleverMain: false, voirEnleves: false, choisirCalques: false, curseurZone: null, lecturePdf: null, dejaCale: false,
    });
  }

  function fermer({ sansRetour = false } = {}) {
    vues.forEach((v) => v.detruire());
    page.close();
    page.remove();
    if (!sansRetour) quandRetour?.();
  }
  page.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    fermer();
  });

  // --- Dessin de la page ---

  // 0.316.0 : si le dessin d'une étape plante, l'écran de chargement ne reste plus bloqué : message clair + retour à la liste.
  function dessiner() {
    try {
      dessinerEtape();
    } catch (erreur) {
      console.error(erreur);
      etat.occupe = '';
      if (etat.modeReference && reserve) sortirReference();
      etape = 'liste';
      try {
        dessinerEtape();
      } catch (encore) {
        page.innerHTML = `<p class="message-erreur">Le calage ne peut pas s'afficher : ${echapper(encore.message)}</p>`;
      }
      message(`Affichage impossible (${erreur.message}). Retour à la liste ; rien n'a été perdu.`, 8000);
    }
  }

  function dessinerEtape() {
    vues.forEach((v) => v.detruire());
    vues = [];
    const etapes = etat.dejaCale ? [['plan', '1 Le plan'], ['nettoyer', '2 Nettoyer'], ['fin', '3 Terminé']] : simple ? [['plan', '1 Le plan'], ['caler', '2 Caler'], ['fin', '3 Terminé']] : [['plan', '1 Le plan'], ['caler', '2 Caler'], ['nettoyer', '3 Nettoyer'], ['fin', '4 Terminé']];
    page.innerHTML = `
      <header class="entete-calage">
        <button type="button" class="retour-reglages" data-action="retour" aria-label="Retour aux applications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        <h2>Calage de plans ${bulle('calage')}</h2>
        <nav class="etapes-calage" aria-label="Étapes">
          <button type="button" data-aller="liste" class="${etape === 'liste' ? 'actif' : ''}">Plans calés</button>
          ${etapes.map(([cle, titre]) => `<button type="button" data-aller="${cle}" class="${etape === cle ? 'actif' : ''}" ${accessible(cle) ? '' : 'disabled'}>${titre}</button>`).join('')}
        </nav>
      </header>
      <main class="contenu-calage ${etape === 'caler' || etape === 'nettoyer' || etape === 'comparer' ? 'en-calage' : ''}">${{ liste: htmlListe, plan: htmlPlan, caler: htmlCaler, nettoyer: htmlNettoyer, fin: htmlFin, comparer: htmlComparer }[etape]()}</main>
      ${etat.occupe ? `<div class="chargement-calage" role="status"><div class="rond-chargement"></div><p>${echapper(etat.occupe)}</p><button type="button" class="lien-calage" data-action="masquer-chargement">Ça dure trop : masquer</button></div>` : ''}`;
    if (etape === 'caler') monterVues();
    if (etape === 'nettoyer') monterNettoyer();
    if (etape === 'comparer') monterComparer();
  }

  function accessible(cle) {
    if (etat.modeReference) return cle === 'nettoyer';
    if (etat.verif) return cle === 'caler';
    if (cle === 'plan') return etat.enregistre === null;
    if (cle === 'caler') return Boolean(etat.lu && reference()) && etat.enregistre === null;
    if (cle === 'nettoyer' && etat.dejaCale) return Boolean(etat.lu) && etat.enregistre === null;
    if (cle === 'nettoyer') return Boolean(etat.resultat && etat.resultat.verdict !== 'faux') && etat.enregistre === null;
    return etat.enregistre !== null;
  }

  function htmlListe() {
    const cales = plansCales(projet.plansDxf);
    const ligneIndice = (p) => {
      const c = p.calage;
      const ch = c.indices?.at(-1)?.changements;
      const archive = archiveDu(p.id);
      return `<tr class="ligne-indice">
        <td colspan="2"><span class="aide-calage">Indice <strong>${echapper(c.indice ?? '?')}</strong> · ${echapper(c.fichier ?? '')} · ${dateCourte(c.le)}${ch ? ` · +${ch.ajoutes} / −${ch.supprimes}` : ''}</span></td>
        <td colspan="6">${archive ? '<span class="pastille-calage p-sans">Archivé</span> <button type="button" class="bouton-secondaire petit" data-afficher-indice="' + echapper(p.id) + '">Afficher cet indice</button>'
    : p.visible === false ? `<span class="aide-calage">Dans le projet (caché)</span> <button type="button" class="bouton-secondaire petit" data-afficher-indice="${echapper(p.id)}">Afficher</button>`
      : '<span class="pastille-calage p-juste">Affiché dans le projet</span>'}
          <button type="button" class="bouton-secondaire petit" data-comparer-avec="${echapper(p.id)}">Comparer…</button></td>
      </tr>`;
    };
    const lignes = cales.map((p) => {
      const c = p.calage;
      const [texte, classe] = VERDICTS[c.verdict] ?? ['?', 'p-sans'];
      const indices = indicesDuGroupe(tousPlans(), p);
      return `<tr>
        <td><strong>${echapper(p.nom)}</strong><br><span class="aide-calage">${echapper(c.fichier ?? '')}</span></td>
        <td>${estDejaCale(p) ? `<span class="aide-calage">déjà calé (sans référence)</span>${c.verifieAvec ? `<br><span class="aide-calage">vérifié sur ${echapper(c.verifieAvec)}</span>` : ''}` : echapper(c.referenceNom ?? '')}</td>
        <td class="chiffre">${c.similitude.echelle.toPrecision(6).replace(/\.?0+$/, '')}</td>
        <td class="chiffre">${nombre(c.similitude.rotationDeg, 4)}°</td>
        <td><span class="pastille-calage ${classe}">${texte}</span> ${c.verdict === 'sans-verification' ? '' : `<span class="chiffre">${mm(c.ecartVerificationM)}</span>`}${c.verifieLe ? `<br><span class="aide-calage">vérifié le ${dateCourte(c.verifieLe)}</span>` : ''}${p.controle ? `<br><span class="aide-calage">Points : ${echapper(resumeControlePlan(p.controle))}</span>` : ''}</td>
        <td><strong>${echapper(c.indice ?? '')}</strong>${indices.length > 1 ? ` <span class="aide-calage">(${indices.length} indices)</span>` : ''}${c.indices?.at(-1)?.changements ? ` <span class="aide-calage" title="Objets ajoutés / supprimés depuis l'indice d'avant">+${c.indices.at(-1).changements.ajoutes} / −${c.indices.at(-1).changements.supprimes}</span>` : ''}${c.methode === 'automatique' ? ' <span class="aide-calage">· auto</span>' : ''}</td>
        <td>${dateCourte(c.le)}</td>
        <td class="actions-ligne-calage"><button type="button" class="bouton-secondaire petit" data-modifier-plan="${echapper(p.id)}" title="Nom, indice, dossier">Modifier…</button>${simple ? '' : `<button type="button" class="bouton-secondaire petit" data-indice-de="${echapper(p.id)}">Nouvel indice…</button>`}
          <button type="button" class="bouton-secondaire petit" data-verifier="${echapper(p.id)}" title="Contre un autre plan du projet">Vérifier</button>${controlerPlan ? `<button type="button" class="bouton-secondaire petit" data-controler="${echapper(p.id)}" title="Un point du plan contre un point levé (vert ≤ 2 mm, orange ≤ 15 mm)">Contrôler (points)</button>` : ''}</td>
      </tr>${indices.length > 1 && !simple ? indices.map((q) => ligneIndice(q)).join('') : ''}`;
    }).join('');
    // 0.316.0 : les plans de référence du projet (MN95 ou locaux, pas calés par Topo) sont listés aussi.
    const refs = plansDeReference(projet.plansDxf).filter((p) => !p.calage && (p.reference || p.dejaCale || p.local));
    const lignesRefs = refs.map((p) => `<tr>
        <td><strong>${echapper(p.nom)}</strong><br><span class="aide-calage">${echapper(p.reference?.fichier ?? '')}</span></td>
        <td>${p.local ? 'locale (pas en MN95)' : 'MN95'}</td>
        <td>${(p.sousDossiers ?? []).map(echapper).join(', ') || '<span class="aide-calage">sans dossier</span>'}</td>
        <td>${dateCourte(p.reference?.le ?? p.importeLe)}</td>
        <td class="actions-ligne-calage"><button type="button" class="bouton-secondaire petit" data-modifier-plan="${echapper(p.id)}">Modifier…</button></td>
      </tr>`).join('');
    const tableRefs = refs.length ? `<h3 class="titre-section-calage">Références (${refs.length})</h3><div class="cadre-tableau-calage"><table class="tableau-calage">
        <thead><tr><th>Référence</th><th>Repère</th><th>Dossier</th><th>Ajoutée le</th><th></th></tr></thead><tbody>${lignesRefs}</tbody></table></div>` : '';
    return `
      <div class="barre-calage"><button type="button" class="bouton" data-action="nouveau">＋ Caler un nouveau plan</button>${simple ? '' : '<button type="button" class="bouton-secondaire" data-action="deja-cale">＋ Importer un plan déjà calé (DXF / DWG)</button>'}</div>
      ${cales.length ? `<div class="cadre-tableau-calage"><table class="tableau-calage">
        <thead><tr><th>Plan</th><th>Référence</th><th>Échelle</th><th>Rotation</th><th>Vérification</th><th>Indice</th><th>Calé le</th><th></th></tr></thead>
        <tbody>${lignes}</tbody></table></div>` : '<p class="vide">Aucun plan calé dans ce projet.</p>'}
      ${tableRefs}`;
  }

  /** « Modifier… » : nom, indice (plans calés) et dossier d'un plan calé ou d'une référence. */
  async function modifierPlanListe(id) {
    const p = planParId(id);
    if (!p) return;
    const cale = Boolean(p.calage);
    const champs = [{ cle: 'nom', titre: 'Nom', valeur: p.nom }];
    if (cale) champs.push({ cle: 'indice', titre: 'Indice', valeur: p.calage.indice ?? '' });
    const r = await demanderChamps({ titre: cale ? 'Modifier le plan calé' : 'Modifier la référence', champs });
    if (!r) return;
    const nom = r.nom.trim();
    if (!nom) {
      message('Le nom ne peut pas être vide.', 3000);
      return;
    }
    let dossier;
    if (dossiers().length) {
      const cle = await demanderChoix({
        titre: 'Dossier du projet',
        boutons: [{ cle: '', texte: 'Sans dossier' }, ...dossiers().map((d) => ({ cle: d, texte: d, principal: (p.sousDossiers ?? [])[0] === d }))],
      });
      if (cle !== null && cle !== undefined) dossier = cle;
    }
    modifier(() => {
      const indice = cale ? r.indice.trim() : null;
      // Indice changé et nom de la forme « DXF-Nom_ind-A » : le nom suit le nouvel indice.
      const suit = cale && indice !== (p.calage.indice ?? '') && nom === p.nom && /_ind-/i.test(nom);
      p.nom = suit ? nomPlanCale(typeDuFichier(p.calage.fichier), nom, indice) : nom;
      if (cale) p.calage = { ...p.calage, indice };
      if (dossier !== undefined) p.sousDossiers = dossier ? [dossier] : [];
    });
    dessiner();
  }

  function htmlPlan() {
    const refs = plansDeReference(projet.plansDxf);
    const lu = etat.lu;
    const ni = etat.nouvelIndice;
    let resume = '';
    if (lu) {
      const b = lu.bornes;
      const xrefs = lu.compte.xrefs ?? [];
      const geles = lu.calques.filter((c) => c.visible === false).length;
      const ETATS = { present: '✓ dans le plan', lu: '✓ lu depuis son fichier', introuvable: '⚠ INTROUVABLE (fichier pas fourni)' };
      resume = `<p class="resume-plan-recu"><strong>${echapper(etat.fichier)}</strong> : ${lu.compte.objets} objets, ${lu.calques.length} calques, étendue ${nombre(b.estMax - b.estMin, 1)} × ${nombre(b.nordMax - b.nordMin, 1)} (unités du plan).</p>
        ${xrefs.length ? `<ul class="xrefs-calage">${xrefs.map((x) => `<li class="${x.etat === 'introuvable' ? 'alerte' : ''}">Xref « ${echapper(x.nom)} » : ${ETATS[x.etat]}${x.etat === 'introuvable' ? ` <span class="aide-calage">${echapper(x.chemin)}</span>` : ''}</li>`).join('')}</ul>` : ''}
        ${xrefs.some((x) => x.etat === 'introuvable') ? '<p class="note-calage alerte">⚠ Un xref manque : rechoisissez le plan avec ses xrefs (Ctrl + clic), sinon son contenu ne sera pas sur le plan calé.</p>' : ''}
        ${(() => { const g = groupePrincipal(lu); return g ? `<p class="note-calage alerte">⚠ ${g.ecartes} objet(s) très éloigné(s) du reste (ex. dessinés près de 0,0) : l'écran cadre sur le plan principal. Pour les enlever : Nettoyer › zone à garder.</p>` : ''; })()}
        ${geles ? `<p class="aide-calage">${geles} calque(s) gelé(s) ou éteint(s) : écartés d'office au nettoyage.</p>` : ''}
        ${etat.lecturePdf ? `<p class="aide-calage">PDF, page ${etat.lecturePdf.page}, lu ${etat.lecturePdf.mode === 'traits' ? 'en traits' : 'en image'} (taille de la feuille : le calage trouve l'échelle).</p>${etat.lecturePdf.avertissements.map((a) => `<p class="aide-calage">⚠ ${echapper(a)}</p>`).join('')}` : ''}
        ${etat.dejaCale ? (estEnMn95(b) ? '<p class="note-calage ok">✓ En MN95 : importé tel quel, sans calage.</p>'
    : '<p class="note-calage alerte">⚠ Ce plan n\'est PAS en MN95 (coordonnées locales ou autres unités) : il faut le caler sur une référence. <button type="button" class="bouton-secondaire petit" data-action="vers-calage">Le caler sur une référence →</button></p>')
    : estEnMn95(b) && !ni ? '<p class="note-calage ok">✓ Ce plan semble déjà en MN95 : le caler n\'est peut-être pas utile. <button type="button" class="bouton-secondaire petit" data-action="passer-deja-cale">L\'importer déjà calé →</button></p>' : ''}`;
    }
    // Tablette (0.285.0) : le plan reçu est un plan DXF déjà dans le projet, ou un fichier DXF choisi sur la tablette.
    const plansRecus = simple ? projet.plansDxf.filter((p) => !p.ifc && !p.calage && p.contenu && (p.contenu.traits?.length || p.contenu.cercles?.length || p.contenu.points?.length)) : [];
    const choixProjet = simple && plansRecus.length ? `<label class="champ-calage"><span>Un plan DXF du projet</span><select data-champ="plan-projet"><option value="">— choisir —</option>${plansRecus.map((p) => `<option value="${echapper(p.id)}" ${p.nom === etat.fichier ? 'selected' : ''}>${echapper(p.nom)}</option>`).join('')}</select></label><span class="aide-calage">ou un fichier DXF de la tablette :</span>` : '';
    // 0.298.0 : un PDF aussi (vectoriel = traits accrochables, scanné = image).
    const boutonPdf = '<label class="bouton-secondaire bouton-fichier">Choisir un PDF…<input type="file" accept=".pdf,application/pdf" data-action="fichier" hidden></label>';
    const choix = `<div class="barre-calage">${peutConvertirDwg()
      ? '<button type="button" class="bouton-secondaire bouton-fichier" data-action="choisir-dwg">Choisir le plan DWG / DXF (et ses xrefs)…</button>'
      : '<label class="bouton-secondaire bouton-fichier">Choisir le DXF (et ses xrefs)…<input type="file" accept=".dxf" multiple data-action="fichier" hidden></label>'}${etat.dejaCale ? '' : boutonPdf}</div>`;
    const controle = ni?.controle;
    let piedIndice = '';
    if (ni && lu && controle?.enCours) piedIndice = '<button type="button" class="bouton" aria-disabled="true" disabled>Contrôle en cours…</button>';
    else if (ni && lu && controle?.memeOrigine) piedIndice = '<button type="button" class="bouton" data-action="rejouer">Rejouer la recette →</button>';
    else if (ni && lu && controle?.recale) piedIndice = '<button type="button" class="bouton-secondaire" data-action="caler-a-la-main">Caler à la main</button><button type="button" class="bouton" data-action="rejouer-recale">Rejouer avec ce recalage →</button>';
    else if (ni && lu) piedIndice = '<button type="button" class="bouton" data-action="caler-a-la-main">Caler à la main →</button>';
    // Plan déjà calé : pas de calage, on passe au nettoyage (recette de l'indice d'avant reprise pour un nouvel indice).
    if (etat.dejaCale && lu) piedIndice = `<button type="button" class="bouton" data-action="nettoyer-deja-cale">${ni && controle?.memeOrigine ? 'Rejouer la recette →' : ni ? 'Continuer quand même (déjà calé) →' : 'Nettoyer →'}</button>`;
    return `
      ${etat.dejaCale && !ni ? '<section class="carte-calage"><h3>Importer un plan déjà calé (MN95)</h3><p class="aide-calage">Sans référence ni calage : le plan est lu, nettoyé, puis rangé dans le projet. À contrôler ensuite : « Vérifier » (un autre plan) ou « Contrôler (points) ».</p></section>' : ''}
      ${ni ? `<section class="carte-calage"><h3>Nouvel indice de « ${echapper(ni.ancien.nom)} »</h3>
        <p class="aide-calage">Indice actuel : ${echapper(ni.ancien.calage.indice ?? '?')} · ${echapper(ni.ancien.calage.fichier ?? '')} · calé le ${dateCourte(ni.ancien.calage.le)}</p></section>` : ''}
      <section class="carte-calage">
        <h3>Plan reçu</h3>
        ${choixProjet}
        ${choix}
        ${etat.lecture ? `<p class="aide-calage">${echapper(etat.lecture)}</p>` : ''}
        ${resume}
        ${controle ? `<p class="note-calage ${controle.memeOrigine ? 'ok' : controle.recale ? 'orange' : 'alerte'}">${controle.memeOrigine ? '✓' : '⚠'} ${echapper(controle.message)}</p>` : ''}
        ${lu ? `<div class="champs-calage">
          ${ni ? '' : `<label class="champ-calage"><span>Nom du plan${etat.dejaCale ? '' : ' calé'} <small class="aide-calage">(→ ${echapper(nomPlanCale(typeDuFichier(etat.fichier), etat.nom || 'nom', etat.indice))})</small></span><span class="champ-prefixe"><span class="prefixe-nom">${typeDuFichier(etat.fichier)}-</span><input type="text" data-champ="nom" value="${echapper(baseDuNomCale(etat.nom))}"></span></label>`}
          <label class="champ-calage court"><span>Indice</span><input type="text" data-champ="indice" value="${echapper(etat.indice)}" maxlength="8"></label>
          ${ni ? '' : `<label class="champ-calage"><span>Dossier du projet</span><select data-champ="dossier"><option value="">Sans dossier</option>${dossiers().map((d) => `<option value="${echapper(d)}" ${d === etat.dossier ? 'selected' : ''}>${echapper(d)}</option>`).join('')}</select></label>`}
        </div>` : ''}
      </section>
      ${ni || simple || etat.dejaCale ? '' : `<section class="carte-calage">
        <h3>Référence : un plan du projet (MN95 ou local) ou des points du projet</h3>
        ${true ? `<select data-champ="reference"><option value="">— choisir —</option><option value="${REF_POINTS}" ${REF_POINTS === etat.referenceId ? 'selected' : ''} ${points().length ? '' : 'disabled'}>Points du projet (${points().length ? `${points().length} points : levés, à implanter, contrôle` : 'aucun point dans le projet'})</option>${refs.map((p) => `<option value="${echapper(p.id)}" ${p.id === etat.referenceId ? 'selected' : ''}>${echapper(p.nom)}${planEnMn95(p) ? '' : ' (local)'}</option>`).join('')}</select>`
          : '<p class="note-calage alerte">⚠ Aucun plan ni point dans ce projet : ajoutez une référence ci-dessous ou levez des points.</p>'}
        ${referencePoints() ? '<p class="aide-calage">Caler sur des points du projet : cliquez un point du plan reçu puis le point levé ; pour un axe, cliquez l\'axe du plan reçu puis 2 points levés ou plus sur cet axe, et « Terminer l\'axe ».</p>' : ''}
        ${peutConvertirDwg()
    ? '<button type="button" class="bouton-secondaire bouton-fichier" data-action="choisir-dwg-ref">＋ Ajouter une référence (DWG / DXF)…</button>'
    : '<label class="bouton-secondaire bouton-fichier">＋ Ajouter une référence (DXF)…<input type="file" accept=".dxf" multiple data-action="fichier-ref" hidden></label>'}
      </section>`}
      ${simple ? `<section class="carte-calage"><h3>Caler sur les points du projet (levés, à implanter, contrôle)</h3><p class="aide-calage">${points().length} point(s) dans le projet.${points().length < 2 ? ' ⚠ Il en faut au moins 2 : levez d\'abord des points sur place.' : ''}</p></section>` : ''}
      <div class="pied-calage"><button type="button" class="bouton-secondaire" data-aller="liste">← Plans calés</button>${ni || etat.dejaCale ? piedIndice : `<button type="button" class="bouton" data-aller="caler" ${accessible('caler') ? '' : 'aria-disabled="true"'}>Caler →</button>`}</div>`;
  }

  function htmlCaler() {
    const groupe = (titre, boutons) => `<div class="groupe-ruban"><span class="titre-groupe">${titre}</span><div class="boutons-groupe">${boutons}</div></div>`;
    const outil = (champ, valeur, icone, texte, extra = '') => `<button type="button" class="outil-ruban ${etat[champ] === valeur ? 'actif' : ''}" data-outil="${champ}" data-valeur="${valeur}" ${extra}>${icone}<span>${texte}</span></button>`;
    return `
      <div class="ruban-calage" role="toolbar" aria-label="Outils du calage">
        ${groupe('Élément', outil('type', 'point', '⊡', 'Point') + outil('type', 'axe', '╱', 'Axe'))}
        <div class="groupe-ruban" data-zone="mode-axe" ${etat.type === 'axe' ? '' : 'hidden'}><span class="titre-groupe">Axe par</span><div class="boutons-groupe">${outil('axeMode', 'trait', '╱', 'Un trait')}${outil('axeMode', 'points', '⁚', '2 points')}</div></div>
        ${groupe('Rôle', outil('role', 'calage', `<i class="rond-role" style="background:${COULEUR_CALAGE}"></i>`, 'Calage') + outil('role', 'verification', `<i class="rond-role" style="background:${COULEUR_VERIF}"></i>`, 'Vérification'))}
        ${groupe('Accroche', ACCROCHES.map(([v, i, t]) => outil('accroche', v, i, t)).join(''))}
        ${groupe('Affichage', AFFICHAGES.map(([v, i, t]) => outil('affichage', v, i, t)).join(''))}
        ${groupe('Zoom', '<button type="button" class="outil-ruban" data-zoom="1.5">＋</button><button type="button" class="outil-ruban" data-zoom="0.667">−</button><button type="button" class="outil-ruban" data-zoom="tout">⤢<span>Tout</span></button>')}
        ${simple ? '' : groupe('Automatique', '<button type="button" class="outil-ruban" data-action="caler-auto">⚡<span>Caler auto</span></button>')}
        ${groupe('Modifier', `${referencePoints() ? '<button type="button" class="outil-ruban" data-action="finir-axe" data-zone="finir-axe">✓<span>Terminer l\'axe</span></button>' : ''}<button type="button" class="outil-ruban" data-action="retirer-dernier">↶<span>Retirer le dernier</span></button><button type="button" class="outil-ruban" data-action="tout-effacer">✕<span>Tout effacer</span></button>`)}
      </div>
      <p class="consigne-calage" data-zone="consigne"></p>
      <div class="vues-calage" data-mode="${etat.affichage}">
        <div class="vue-calage" data-cote="plan"><div class="tete-vue"><strong>Plan reçu${etat.nouvelIndice ? ' (nouvel indice)' : ''} · ${echapper(etat.fichier)}</strong><span class="aide-calage">clic 1</span></div><div class="toile-calage" data-toile="plan"></div></div>
        <div class="vue-calage" data-cote="ref"><div class="tete-vue"><strong>Référence (base) · ${echapper(reference()?.nom ?? '')}</strong><span class="aide-calage">clic 2</span></div><div class="toile-calage" data-toile="ref"></div></div>
        <div class="vue-calage" data-cote="cale"><div class="tete-vue"><strong>Plan calé sur la référence</strong><span class="aide-calage">bleu = plan calé · gris = référence</span></div><div class="toile-calage" data-toile="cale"></div></div>
      </div>
      <div class="bas-calage">
        <section class="carte-calage"><h3 data-zone="titre-elements"></h3><ul class="elements-calage" data-zone="elements"></ul></section>
        <section class="carte-calage resultat-calage" data-zone="resultat"></section>
      </div>
      <div class="pied-calage">${etat.verif
    ? '<button type="button" class="bouton-secondaire" data-aller="liste">← Plans calés</button><button type="button" class="bouton" data-action="enregistrer-verif">Enregistrer la vérification</button>'
    : `<button type="button" class="bouton-secondaire" data-aller="plan">← Le plan</button><button type="button" class="bouton" data-action="vers-nettoyer">${simple ? 'Enregistrer le plan calé' : 'Nettoyer →'}</button>`}</div>`;
  }

  function htmlFin() {
    const p = etat.enregistre;
    const c = p.calage;
    return `
      <section class="carte-calage">
        <h3>✓ Plan « ${echapper(p.nom)} » (indice ${echapper(c.indice ?? '')}) ${estDejaCale(p) ? 'importé (déjà calé)' : 'calé'} et rangé dans le projet</h3>
        ${estDejaCale(p) ? `<p>${echapper(c.message)}</p>
        <div class="barre-calage"><button type="button" class="bouton-secondaire" data-verifier="${echapper(p.id)}">Vérifier (un autre plan)</button>${controlerPlan ? `<button type="button" class="bouton-secondaire" data-controler="${echapper(p.id)}">Contrôler (points levés)</button>` : ''}</div>` : `<p>Échelle ${c.similitude.echelle.toPrecision(6).replace(/\.?0+$/, '')} · rotation ${nombre(c.similitude.rotationDeg, 4)}° · ${echapper(c.message)}</p>`}
        <p class="aide-calage">Il est dans la page Plans du projet : l'afficher, y accrocher, implanter, l'exporter en DXF (Exporter › Plan), comme les autres plans. Copié sur Drive avec le projet.</p>
      </section>
      <div class="pied-calage"><button type="button" class="bouton-secondaire" data-aller="liste">Plans calés</button>${estDejaCale(p) ? '<button type="button" class="bouton" data-action="deja-cale">＋ Importer un autre plan déjà calé</button>' : '<button type="button" class="bouton" data-action="nouveau">＋ Caler un autre plan</button>'}</div>`;
  }

  // --- Écran Nettoyer (0.279.0, maquette validée le 22.11) ---

  function htmlNettoyer() {
    const ignores = Object.entries(etat.lu.compte.ignores ?? {});
    const ni = etat.nouvelIndice;
    const groupe = ni ? indicesDuGroupe(tousPlans(), ni.ancien) : [];
    const groupeRuban = (titre, boutons, attributs = '') => `<div class="groupe-ruban" ${attributs}><span class="titre-groupe">${titre}</span><div class="boutons-groupe">${boutons}</div></div>`;
    const bouton = (action, icone, texte, extra = '') => `<button type="button" class="outil-ruban" data-action="${action}" ${extra}>${icone}<span>${texte}</span></button>`;
    return `
      <div class="ruban-calage" role="toolbar" aria-label="Outils du nettoyage">
        ${groupeRuban('Calques choisis', `${bouton('choisir-calques', '☝', 'Choisir des calques', 'data-zone="bouton-choisir"')}${bouton('ecarter-selection', '✕', 'Écarter la sélection', 'data-zone="bouton-ecarter"')}${bouton('vider-selection', '◌', 'Tout désélectionner')}${bouton('annuler-nettoyage', '↶', 'Annuler')}`)}
        ${groupeRuban('Zone à garder', '', 'data-zone="boutons-zone"')}
        ${groupeRuban('À la main', `${bouton('enlever-main', '✂', 'Enlever des objets', 'data-zone="bouton-enlever"')}${bouton('voir-enleves', '◍', 'Voir les enlevés', 'data-zone="bouton-voir-enleves"')}${bouton('restaurer-tout', '↺', 'Tout restaurer', 'data-zone="bouton-restaurer"')}`)}
        ${groupeRuban('Affichage', `${etat.modeReference || etat.dejaCale ? '' : bouton('voir-reference', '▥', 'Référence', `data-zone="bouton-reference" aria-pressed="${etat.refVisible}"`)}${ni ? bouton('voir-changements', '±', 'Ce qui a changé') : ''}`)}
        ${ni && groupe.length > 1 ? groupeRuban('Comparer avec', `<select class="choix-base" data-champ="base" aria-label="Indice de comparaison">${groupe.map((q) => `<option value="${echapper(q.id)}" ${q.id === (etat.baseId || ni.ancien.id) ? 'selected' : ''}>Indice ${echapper(q.calage.indice ?? '?')}</option>`).join('')}</select>`) : ''}
        ${groupeRuban('Zoom', '<button type="button" class="outil-ruban" data-zoom="1.5">＋</button><button type="button" class="outil-ruban" data-zoom="0.667">−</button><button type="button" class="outil-ruban" data-zoom="tout">⤢<span>Tout</span></button>')}
      </div>
      <p class="consigne-calage" data-zone="consigne"></p>
      <div class="nettoyer-calage">
        <div class="colonne-nettoyer">
          ${etat.modeReference ? `<section class="carte-calage"><label class="champ-calage"><span>Nom de la référence</span><input type="text" data-champ="nom" value="${echapper(etat.nom)}"></label></section>` : ''}
          <section class="carte-calage">
            <h3 data-zone="titre-calques"></h3>
            <input type="search" class="filtre-calques" data-champ="filtre" placeholder="Filtrer les calques" value="${echapper(etat.filtre)}">
            <div class="barre-calage">
              <button type="button" class="bouton-secondaire petit" data-action="tout-garder">Tout garder</button>
              <button type="button" class="bouton-secondaire petit" data-action="tout-ecarter">Tout écarter</button>
            </div>
            <div class="liste-calques" data-zone="calques"></div>
            <button type="button" class="lien-calage" data-action="voir-ecartes" data-zone="voir-ecartes"></button>
          </section>
          <section class="carte-calage">
            <h3 data-zone="titre-enleves"></h3>
            <ul class="liste-enleves" data-zone="enleves"></ul>
          </section>
          <section class="carte-calage">
            <h3>Types d'objets à supprimer</h3>
            <div class="types-calage">${TYPES_RETIRABLES.map(([cle, titre]) => `<label><input type="checkbox" data-type="${cle}" ${etat.recette.types[cle] ? 'checked' : ''}> ${titre}</label>`).join('')}</div>
            ${(etat.lu?.contenu?.textes ?? []).some((x) => x.lignes?.length > 1) ? `<label class="case-calage"><input type="checkbox" data-exploser-textes ${etat.recette.exploserTextes ? 'checked' : ''}> Exploser les textes multi-lignes (${etat.lu.contenu.textes.filter((x) => x.lignes?.length > 1).length}) : une ligne = un texte</label>` : ''}
            ${ignores.length ? `<p class="aide-calage">Jamais lus par Topo : ${ignores.map(([t, n]) => `${n} ${echapper(t)}`).join(', ')}</p>` : ''}
          </section>
          <section class="carte-calage">
            <h3>Hachures</h3>
            <div class="choix-hachures" role="group" aria-label="Hachures">${CHOIX_HACHURES.map(([cle, titre]) => `<button type="button" data-hachures="${cle}" class="${etat.recette.hachures === cle ? 'actif' : ''}">${titre}</button>`).join('')}</div>
          </section>
          <section class="carte-calage">
            <label class="champ-calage"><span>Préfixe des calques</span><input type="text" data-champ="prefixe" value="${echapper(etat.recette.prefixe)}"></label>
          </section>
        </div>
        <div class="vue-calage vue-nettoyer">
          <div class="tete-vue"><strong>${etat.modeReference ? 'Plan de référence' : etat.dejaCale ? 'Plan nettoyé (MN95)' : 'Plan calé nettoyé'}</strong><span class="aide-calage">${etat.modeReference ? '' : 'survolez un objet : le nom de son calque s\'affiche'}</span></div>
          <div class="toile-calage" data-toile="nettoyer"></div>
          <div class="pied-vue" data-zone="compteur"></div>
        </div>
      </div>
      <div class="pied-calage">${etat.modeReference
    ? '<button type="button" class="bouton-secondaire" data-action="annuler-reference">← Annuler</button><button type="button" class="bouton" data-action="enregistrer-reference">Ajouter la référence au projet →</button>'
    : '<button type="button" class="bouton-secondaire" data-aller="caler">← Caler</button><button type="button" class="bouton" data-action="enregistrer">Enregistrer dans le projet →</button>'}</div>`;
  }

  // --- Comparer deux indices (0.283.0) ---

  function htmlComparer() {
    const c = etat.comparaison;
    const options = (choisi) => c.plans.map((q) => `<option value="${echapper(q.id)}" ${q.id === choisi ? 'selected' : ''}>Indice ${echapper(q.calage.indice ?? '?')} · ${dateCourte(q.calage.le)}</option>`).join('');
    return `
      <div class="ruban-calage" role="toolbar" aria-label="Comparer deux indices">
        <div class="groupe-ruban"><span class="titre-groupe">Ancien indice (rouge = supprimé)</span><div class="boutons-groupe"><select data-champ="cmp-avant">${options(c.avantId)}</select></div></div>
        <div class="groupe-ruban"><span class="titre-groupe">Nouvel indice (vert = ajouté)</span><div class="boutons-groupe"><select data-champ="cmp-apres">${options(c.apresId)}</select></div></div>
        <div class="groupe-ruban"><span class="titre-groupe">Affichage</span><div class="boutons-groupe"><button type="button" class="outil-ruban ${etat.refVisible ? 'actif' : ''}" data-action="voir-reference-cmp">▥<span>Référence</span></button></div></div>
        <div class="groupe-ruban"><span class="titre-groupe">Zoom</span><div class="boutons-groupe"><button type="button" class="outil-ruban" data-zoom="1.5">＋</button><button type="button" class="outil-ruban" data-zoom="0.667">−</button><button type="button" class="outil-ruban" data-zoom="tout">⤢<span>Tout</span></button></div></div>
      </div>
      <p class="consigne-calage">Vert = ajouté dans le nouvel indice · rouge = supprimé · gris = inchangé.</p>
      <div class="vue-calage vue-nettoyer"><div class="tete-vue"><strong>${echapper(c.plans[0].nom)}</strong></div><div class="toile-calage" data-toile="comparer"></div><div class="pied-vue" data-zone="compteur"></div></div>
      <div class="pied-calage"><button type="button" class="bouton-secondaire" data-aller="liste">← Plans calés</button></div>`;
  }

  let compare = { cle: '', d: null, plans: [] };
  function calculComparaison() {
    const c = etat.comparaison;
    if (c.avantId === c.apresId) return null;
    const cle = `${c.avantId}|${c.apresId}`;
    if (compare.cle !== cle) {
      const avant = planRecale(planParId(c.avantId));
      const apres = planRecale(planParId(c.apresId));
      const d = differencesPlans(avant, apres);
      compare = { cle, d, plans: [sousPlan(apres, d.inchanges, '#9ca3af'), sousPlan(avant, d.supprimes, '#dc2626'), sousPlan(apres, d.ajoutes, '#16a34a')] };
    }
    return compare;
  }

  function monterComparer() {
    const c = etat.comparaison;
    const plan = () => planRecale(planParId(c.apresId));
    vues = [creerVueCalage(page.querySelector('[data-toile="comparer"]'), {
      plans: () => [...(etat.refVisible && reference() ? [refGrise()] : []), ...(calculComparaison()?.plans ?? [plan()])],
      cadrage: () => [plan()],
    })];
    majComparer();
  }

  function majComparer() {
    const r = calculComparaison();
    page.querySelector('[data-zone="compteur"]').innerHTML = r
      ? `<span style="color:#16a34a;font-weight:700">+${r.d.compte.ajoutes} ajoutés</span> · <span style="color:#dc2626;font-weight:700">−${r.d.compte.supprimes} supprimés</span> · ${r.d.compte.inchanges} inchangés${r.d.parCalque.length ? ` · surtout : ${r.d.parCalque.slice(0, 4).map((x) => `${echapper(x.nom)} (+${x.ajoutes} / −${x.supprimes})`).join(', ')}` : ''}`
      : 'Choisissez deux indices différents.';
    vues.forEach((v) => v.redessiner());
  }

  // Plan nettoyé (plan reçu) et sa version calée, refaits seulement quand la recette change.
  // Une référence est déjà en MN95 : pas de recalage.
  const enMn95 = (plan) => (etat.modeReference ? Object.assign(Object.create(plan), { visible: true })
    : planRecale(Object.assign(Object.create(plan), { recalage: { applique: true, parametres: versHelmert(etat.resultat.similitude) }, visible: true })));
  let nettoye = { cle: '', plan: null, cale: null };
  function planNettoye() {
    const cle = JSON.stringify([etat.recette, etat.resultat.similitude]);
    if (nettoye.cle !== cle) {
      const plan = nettoyerPlan(etat.lu, etat.recette);
      nettoye = { cle, plan, cale: plan.compte.objets ? enMn95(plan) : null };
    }
    return nettoye;
  }

  // Calques choisis : seulement leurs objets, en rose vif (même ceux d'un calque écarté, pour voir ce que c'est).
  let choisis = { cle: '', plan: null };
  function planChoisis() {
    if (!etat.selection.length) return null;
    const cle = JSON.stringify([etat.selection, etat.recette, etat.resultat.similitude]);
    if (choisis.cle !== cle) {
      const noms = new Set(etat.selection.map((i) => etat.lu.calques[i]?.nom));
      const ecartes = etat.lu.calques.map((c) => c.nom).filter((n) => !noms.has(n));
      const seul = nettoyerPlan(etat.lu, { ...etat.recette, ecartes, couleurs: {}, prefixe: '' });
      choisis = { cle, plan: seul.compte.objets ? enCouleur(enMn95(seul), COULEUR_SELECTION) : null };
    }
    return choisis.plan;
  }

  /** Plans dessinés au nettoyage : référence (si demandée), plan nettoyé (pâli si des calques sont choisis), calques choisis, objets enlevés (rouge). */
  function plansNettoyer() {
    const n = planNettoye().cale;
    const selection = planChoisis();
    const enleves = etat.voirEnleves ? planEnlevesRouge() : null;
    return [
      ...(etat.refVisible && !etat.modeReference && reference() ? [refGrise()] : []),
      // Objets enlevés montrés : le plan gardé est pâli pour qu'ils ressortent.
      ...(n ? [selection || enleves ? Object.assign(Object.create(n), { transparence: 70 }) : n] : []),
      ...(selection ? [selection] : []),
      ...(enleves ? [enleves] : []),
    ];
  }

  // 0.298.0 : objets montrés (mêmes objets que le plan reçu, pour retrouver leur clé) et objets enlevés à la main.
  let visible = { cle: '', plan: null };
  function planMontre() {
    const cle = JSON.stringify(etat.recette);
    if (visible.cle !== cle) visible = { cle, plan: planVisible(etat.lu, etat.recette) };
    return visible.plan;
  }
  let rouges = { cle: '', plan: null };
  function planEnlevesRouge() {
    const liste = etat.recette.enleves ?? [];
    if (!liste.length) return null;
    const cle = JSON.stringify([liste, etat.resultat.similitude]);
    if (rouges.cle !== cle) rouges = { cle, plan: enCouleur(enMn95(planDesEnleves(luExplose(), liste)), COULEUR_ENLEVE) };
    return rouges.plan;
  }

  /** Enlève à la main les objets de clés « cles » (un seul ↶ Annuler les remet). */
  function enleverObjets(cles) {
    if (!cles.length) return;
    changerRecette((r) => { r.enleves = [...(r.enleves ?? []), ...cles]; });
    message(`${cles.length} objet(s) enlevé(s) à la main`, 2000);
  }

  /** Remet des objets enlevés à la main (« null » = tous). */
  function restaurerObjets(cles) {
    const avant = etat.recette.enleves ?? [];
    if (!avant.length) return;
    const retires = cles ? new Set(cles) : null;
    changerRecette((r) => { r.enleves = retires ? avant.filter((c) => !retires.has(c)) : []; });
    message(retires ? `${retires.size} objet(s) restauré(s)` : `${avant.length} objet(s) restauré(s)`, 2000);
  }

  /** Rectangle tracé en mode « Enlever » (coins MN95) : objets entièrement dedans ou qui le touchent. */
  function rectangleNettoyer(a, b, mode) {
    const coins = [[a.est, a.nord], [b.est, a.nord], [b.est, b.nord], [a.est, b.nord]].map(versPlanRecu);
    const cles = objetsDansZone(planMontre(), coins, mode, new Set(etat.recette.enleves ?? []));
    if (!cles.length) {
      message(mode === 'dedans' ? 'Aucun objet entièrement dans le rectangle (tirez de droite à gauche pour prendre ceux qui le touchent).' : 'Aucun objet ne touche le rectangle.', 3500);
      return;
    }
    enleverObjets(cles);
  }

  /** Point du plan reçu (coordonnées du fichier) ↔ point MN95. */
  const versMn95 = (xy) => appliquerSimilitude(etat.resultat.similitude, xy);
  const versPlanRecu = (xy) => appliquerSimilitude(inverserSimilitude(etat.resultat.similitude), xy);

  function marquesNettoyer() {
    const zone = etat.dessinZone ?? etat.recette.zone;
    if (!zone?.length) return [];
    // 0.316.0 : pendant le dessin, le trait en cours suit la souris (comme une zone de Plans de chantier).
    const pts = etat.dessinZone && etat.curseurZone ? [...zone, etat.curseurZone] : zone;
    return [{ type: 'zone', xy: pts.flatMap((p) => versMn95(p)), couleur: '#ea580c', attente: Boolean(etat.dessinZone), sommets: zone.length }];
  }

  // Ce qui a changé depuis un indice du projet (celui d'avant, ou un autre au choix) : refait quand le plan nettoyé ou la base change.
  let changements = { cle: '', d: null, plans: [] };
  function changementsDepuisAncien() {
    const n = planNettoye();
    if (!etat.nouvelIndice || !n.cale) return null;
    const base = planParId(etat.baseId) ?? etat.nouvelIndice.ancien;
    const cle = `${n.cle}|${base.id}`;
    if (changements.cle !== cle) {
      const ancien = planRecale(base);
      const d = differencesPlans(ancien, n.cale);
      changements = {
        cle,
        d,
        plans: [sousPlan(n.cale, d.inchanges, '#9ca3af'), sousPlan(ancien, d.supprimes, '#dc2626'), sousPlan(n.cale, d.ajoutes, '#16a34a')],
      };
    }
    return changements;
  }

  function monterNettoyer() {
    vues = [creerVueCalage(page.querySelector('[data-toile="nettoyer"]'), {
      plans: () => (etat.voirChangements && changementsDepuisAncien() ? [...(etat.refVisible && reference() ? [refGrise()] : []), ...changementsDepuisAncien().plans] : plansNettoyer()),
      // « Ce qui a changé » : cadré sur le plan lui-même ; sinon sur le plan nettoyé (la référence n'est plus montrée d'office).
      cadrage: () => (planNettoye().cale ? [planNettoye().cale] : reference() && !etat.modeReference ? [refGrise()] : []),
      marques: marquesNettoyer,
      survol: (position) => {
        etat.curseurZone = etat.dessinZone?.length ? versPlanRecu([position.est, position.nord]) : null;
        return null;
      },
      infobulle: (position, toleranceM) => {
        if (etat.dessinZone) return null;
        if (etat.enleverMain) {
          const o = objetAuPoint(position, toleranceM);
          return o ? libelleObjet(etat.lu, o.genre, etat.lu.contenu[o.genre][o.index]).texte : null;
        }
        if (!etat.choisirCalques) return null;
        const c = calqueAuPoint(position, toleranceM);
        return c < 0 ? null : etat.lu.calques[c]?.nom ?? null;
      },
      clic: clicNettoyer,
      rectangle: { actif: () => etat.enleverMain && !etat.dessinZone, fin: rectangleNettoyer },
    })];
    majNettoyer();
  }

  /** Garde l'état de la recette pour « ↶ Annuler », puis applique le changement. */
  function changerRecette(changement) {
    etat.avant.push(JSON.stringify(etat.recette));
    if (etat.avant.length > 50) etat.avant.shift();
    changement(etat.recette);
    majNettoyer();
  }

  /** Calque (index dans le plan reçu) de l'objet gardé sous le point MN95, ou -1. */
  function calqueAuPoint(position, toleranceM) {
    const xy = versPlanRecu([position.est, position.nord]);
    const ecartes = new Set(etat.recette.ecartes);
    const visibles = { ...etat.lu, contenu: Object.fromEntries(Object.entries(etat.lu.contenu).map(([k, l]) => [k, Array.isArray(l) ? l.filter((o) => !ecartes.has(etat.lu.calques[o.c]?.nom)) : l])) };
    return calqueSousLePoint(visibles, xy[0], xy[1], toleranceM / etat.resultat.similitude.echelle);
  }

  /** Objet montré (pas enlevé) sous le point MN95 : { genre, index, cle } ou null. */
  function objetAuPoint(position, toleranceM) {
    const xy = versPlanRecu([position.est, position.nord]);
    return objetSousLePoint(planMontre(), xy[0], xy[1], toleranceM / etat.resultat.similitude.echelle);
  }

  function clicNettoyer(position, toleranceM) {
    const xy = versPlanRecu([position.est, position.nord]);
    // 0.298.0 : objets enlevés montrés en rouge : un clic dessus le restaure ; mode « Enlever » : un clic enlève l'objet.
    if (!etat.dessinZone && etat.voirEnleves && etat.recette.enleves?.length) {
      const rouge = objetSousLePoint(planDesEnleves(luExplose(), etat.recette.enleves), xy[0], xy[1], toleranceM / etat.resultat.similitude.echelle);
      if (rouge) {
        restaurerObjets([rouge.cle]);
        return;
      }
    }
    if (!etat.dessinZone && etat.enleverMain) {
      const o = objetAuPoint(position, toleranceM);
      if (o) enleverObjets([o.cle]);
      return;
    }
    if (etat.dessinZone) {
      const premier = etat.dessinZone[0];
      const tolPlan = toleranceM / etat.resultat.similitude.echelle;
      // Clic sur le premier sommet : la zone est fermée.
      const dernier = etat.dessinZone.at(-1);
      if (etat.dessinZone.length >= 3 && Math.hypot(xy[0] - premier[0], xy[1] - premier[1]) <= tolPlan) finirZone();
      // 0.307.0 : double-clic (2e clic au même endroit que le dernier sommet) = fermer la zone, sans sommet en double.
      else if (dernier && Math.hypot(xy[0] - dernier[0], xy[1] - dernier[1]) <= tolPlan) {
        if (etat.dessinZone.length >= 3) finirZone();
      } else {
        etat.dessinZone.push(xy);
        majNettoyer();
      }
      return;
    }
    // 0.316.0 : on ne choisit un calque au clic que si le bouton « Choisir des calques » est actif.
    if (!etat.choisirCalques) return;
    const c = calqueAuPoint(position, toleranceM);
    if (c < 0) return;
    basculerSelection(c);
    page.querySelector('.calque-calage.choisi')?.scrollIntoView({ block: 'nearest' });
  }

  /** Choisir / ne plus choisir un calque (il passe en rose sur le plan). */
  function basculerSelection(c) {
    etat.selection = etat.selection.includes(c) ? etat.selection.filter((i) => i !== c) : [...etat.selection, c];
    majNettoyer();
  }

  /** Écarte tous les calques choisis (un seul « Annuler » les remet). */
  function ecarterSelection() {
    const noms = etat.selection.map((i) => etat.lu.calques[i]?.nom).filter((n) => n !== undefined && !etat.recette.ecartes.includes(n));
    if (!noms.length) {
      message('Aucun calque choisi : cliquez un calque sur le plan ou dans la liste.', 3000);
      return;
    }
    etat.selection = [];
    changerRecette((r) => { r.ecartes.push(...noms); });
    message(`${noms.length} calque(s) écarté(s)`, 2500);
  }

  function finirZone() {
    const zone = etat.dessinZone;
    etat.dessinZone = null;
    if (zone.length < 3) {
      message('Zone abandonnée : il faut au moins 3 sommets.', 3000);
      majNettoyer();
      return;
    }
    changerRecette((r) => { r.zone = zone; });
  }

  function majNettoyer() {
    if (etape !== 'nettoyer') return;
    const r = etat.recette;
    const comptes = compterParCalque(etat.lu);
    const ecartes = new Set(r.ecartes);
    const filtre = etat.filtre.trim().toLowerCase();
    // Nouvel indice : calques absents de l'indice d'avant (gardés, signalés « nouveau »).
    const vus = etat.nouvelIndice?.ancien.calage.calquesVus?.length ? new Set(etat.nouvelIndice.ancien.calage.calquesVus) : null;
    const lignes = etat.lu.calques.map((c, i) => ({ c, i }))
      .filter(({ c }) => (!filtre || c.nom.toLowerCase().includes(filtre)) && (!etat.voirEcartes || ecartes.has(c.nom)));
    page.querySelector('[data-zone="titre-calques"]').textContent = `Calques (${etat.lu.calques.length})`;
    page.querySelector('[data-zone="calques"]').innerHTML = lignes.map(({ c, i }) => `
      <div class="calque-calage ${ecartes.has(c.nom) ? 'ecarte' : ''} ${etat.selection.includes(i) ? 'choisi' : ''}" data-calque="${i}">
        <input type="checkbox" data-garder="${i}" ${ecartes.has(c.nom) ? '' : 'checked'} title="Garder ce calque" aria-label="Garder le calque ${echapper(c.nom)}">
        <input type="color" class="couleur-calque" data-couleur="${i}" value="${echapper(r.couleurs[c.nom] ?? c.couleur ?? '#000000')}" title="Couleur du calque" aria-label="Couleur du calque ${echapper(c.nom)}">
        <span class="nom-calque">${echapper(c.nom)}${c.visible === false ? ' <span class="badge-calque">gelé / éteint</span>' : ''}${vus && !vus.has(c.nom) ? ' <span class="badge-calque nouveau">nouveau</span>' : ''}</span>
        <span class="aide-calage chiffre">${comptes[i]}</span>
      </div>`).join('') || '<p class="aide-calage">Aucun calque.</p>';
    // 0.298.0 : objets enlevés à la main (liste, restaurer un par un ou tous)
    const enleves = objetsEnleves(luExplose(), r.enleves ?? []);
    page.querySelector('[data-zone="titre-enleves"]').textContent = `Enlevés à la main (${enleves.length})`;
    page.querySelector('[data-zone="enleves"]').innerHTML = enleves.length
      ? `${enleves.slice(-200).reverse().map((o) => `<li><span>${echapper(o.texte)}</span><button type="button" class="bouton-secondaire petit" data-restaurer="${echapper(o.cle)}" title="Remettre cet objet" aria-label="Restaurer ${echapper(o.texte)}">↺</button></li>`).join('')}${enleves.length > 200 ? `<li class="aide-calage">… et ${enleves.length - 200} plus anciens</li>` : ''}`
      : '<li class="aide-calage">Aucun : « Enlever des objets » puis clic sur un objet, ou rectangle.</li>';
    const bEnlever = page.querySelector('[data-zone="bouton-enlever"]');
    bEnlever.classList.toggle('actif', etat.enleverMain);
    bEnlever.setAttribute('aria-pressed', String(etat.enleverMain));
    const bChoisir = page.querySelector('[data-zone="bouton-choisir"]');
    bChoisir.classList.toggle('actif', etat.choisirCalques);
    bChoisir.setAttribute('aria-pressed', String(etat.choisirCalques));
    page.querySelector('[data-zone="bouton-voir-enleves"]').classList.toggle('actif', etat.voirEnleves);
    page.querySelector('[data-zone="bouton-restaurer"]').disabled = enleves.length === 0;
    page.querySelector('[data-zone="voir-ecartes"]').textContent = etat.voirEcartes ? 'Voir tous les calques' : `Voir les écartés (${r.ecartes.length})`;
    page.querySelector('[data-action="annuler-nettoyage"]').disabled = etat.avant.length === 0;
    const bEcarter = page.querySelector('[data-zone="bouton-ecarter"]');
    bEcarter.disabled = etat.selection.length === 0;
    bEcarter.querySelector('span').textContent = `Écarter la sélection${etat.selection.length ? ` (${etat.selection.length})` : ''}`;
    page.querySelector('[data-action="vider-selection"]').disabled = etat.selection.length === 0;
    page.querySelector('[data-zone="bouton-reference"]')?.classList.toggle('actif', etat.refVisible);
    page.querySelectorAll('[data-hachures]').forEach((b) => b.classList.toggle('actif', b.dataset.hachures === r.hachures));
    page.querySelectorAll('[data-type]').forEach((b) => { b.checked = Boolean(r.types[b.dataset.type]); });
    page.querySelector('[data-zone="boutons-zone"] .boutons-groupe').innerHTML = etat.dessinZone
      ? `<button type="button" class="outil-ruban" data-action="finir-zone">✓<span>Fermer (${etat.dessinZone.length} sommets)</span></button><button type="button" class="outil-ruban" data-action="abandonner-zone">✕<span>Abandonner</span></button>`
      : `<button type="button" class="outil-ruban" data-action="dessiner-zone">✎<span>${r.zone ? 'Redessiner' : 'Dessiner'}</span></button>${r.zone ? '<button type="button" class="outil-ruban" data-action="effacer-zone">✕<span>Effacer</span></button>' : ''}`;
    const { plan } = planNettoye();
    const ch = etat.voirChangements ? changementsDepuisAncien() : null;
    page.querySelector('[data-action="voir-changements"]')?.classList.toggle('actif', Boolean(ch));
    page.querySelector('[data-zone="consigne"]').textContent = etat.dessinZone
      ? 'Zone : cliquez les sommets sur le plan ; cliquez le premier sommet (ou « Fermer ») pour finir.'
      : etat.enleverMain ? `Enlever : cliquez un objet, ou tirez un rectangle (gauche → droite = entièrement dedans, droite → gauche = qui touche). Molette = zoom.${etat.voirEnleves ? ' Clic sur un objet rouge = le remettre.' : ''}`
      : etat.voirEnleves ? 'En rouge : les objets enlevés à la main ; cliquez-en un pour le remettre.'
      : etat.selection.length ? `${etat.selection.length} calque(s) en rose : cliquez-en d'autres, ou « Écarter la sélection » pour les enlever du plan.`
        : etat.choisirCalques ? 'Cliquez un calque sur le plan ou dans la liste : il passe en rose. Choisissez-en plusieurs, puis « Écarter la sélection ».'
          : 'Rien n\'est choisi au clic. Touchez « Choisir des calques » pour sélectionner des calques sur le plan.';
    page.querySelector('[data-zone="compteur"]').innerHTML = etat.dessinZone
      ? 'Cliquez les sommets de la zone ; double-clic, clic sur le premier sommet ou « Fermer la zone » pour finir.'
      : ch ? `<span style="color:#16a34a;font-weight:700">+${ch.d.compte.ajoutes} ajoutés</span> · <span style="color:#dc2626;font-weight:700">−${ch.d.compte.supprimes} supprimés</span> · ${ch.d.compte.inchanges} inchangés (gris)${ch.d.parCalque.length ? ` · surtout : ${ch.d.parCalque.slice(0, 4).map((c) => `${echapper(c.nom)} (+${c.ajoutes} / −${c.supprimes})`).join(', ')}` : ''}`
      : `<strong class="chiffre">${plan.compte.objets}</strong> objets gardés sur <span class="chiffre">${etat.lu.compte.objets}</span> · Suppr = écarter la sélection`;
    vues.forEach((v) => v.redessiner());
  }

  /** Passage de Caler à Nettoyer : le calage doit être juste (sinon confirmation, refusé s'il est faux). */
  async function allerNettoyer() {
    const r = etat.resultat;
    if (!r) {
      message(etat.erreur || 'Pas encore de calage : cliquez au moins 2 éléments de calage.', 4000);
      return;
    }
    if (r.verdict === 'faux') {
      message('Le calage est faux (vérification à plus de 4 mm) : corrigez les éléments avant de continuer.', 5000);
      return;
    }
    if (r.methode === 'automatique' && r.confiance === 'faible' && r.verdict === 'sans-verification') {
      message('Calage automatique incertain : cliquez un point de vérification, ou calez à la main.', 5000);
      return;
    }
    if (r.verdict !== 'juste' && r.methode !== 'deja-cale') {
      const choix = await demanderChoix({
        titre: r.verdict === 'a-revoir' ? 'Vérification à revoir (2 à 4 mm)' : 'Pas de vérification',
        texte: r.message,
        boutons: [{ cle: 'non', texte: 'Revenir au calage', principal: true }, { cle: 'oui', texte: 'Continuer quand même' }],
      });
      if (choix !== 'oui') return;
    }
    if (simple) {
      // Sur place : on garde tout le plan tel quel (pas de nettoyage), et on l'enregistre tout de suite.
      etat.recette = { ecartes: [], couleurs: {}, types: { cotations: false, reperes: false, attributs: false, textes: false, splines: false, pleins: false }, hachures: 'garder', zone: null, prefixe: '' };
      etat.avant = [];
      enregistrer();
      return;
    }
    if (!etat.recette) {
      etat.recette = recetteDeLAncien();
      etat.avant = [];
    }
    if (!etat.recette) {
      // 0.307.0 : préfixe des calques = nom du plan (sans l'indice : les calques gardent leur nom d'un indice à l'autre).
      const base = baseDuNomCale(etat.nom) || etat.fichier.replace(/\.[^.]+$/, '');
      etat.recette = recetteDeDepart(etat.lu, `${nomPlanCale(typeDuFichier(etat.fichier), base, '')} - `);
      etat.avant = [];
    }
    etat.recette.enleves ??= [];
    etape = 'nettoyer';
    dessiner();
  }

  // --- Écran Caler : vues, éléments, résultat ---

  // Plan reçu calé (aperçu « Calé ») : refait seulement quand le résultat change.
  let apercu = { resultat: null, plan: null };
  function planCaleProvisoire() {
    if (!etat.resultat) return null;
    if (apercu.resultat !== etat.resultat) {
      const p = Object.assign(Object.create(etat.lu), { recalage: { applique: true, parametres: versHelmert(etat.resultat.similitude) } });
      apercu = { resultat: etat.resultat, plan: enCouleur(planRecale(p), COULEUR_CALAGE) };
    }
    return apercu.plan;
  }

  function marquesDe(cote) {
    const noms = etiquettes(etat.elements);
    const marques = etat.elements.map((e, i) => ({
      type: e.type, xy: cote === 'plan' ? e.plan : e.ref, texte: noms[i], couleur: e.role === 'verification' ? COULEUR_VERIF : COULEUR_CALAGE,
    }));
    if (etat.enCours) {
      const couleur = etat.enCours.role === 'verification' ? COULEUR_VERIF : COULEUR_CALAGE;
      const texte = etiquettes([...etat.elements, etat.enCours]).at(-1);
      if (cote === 'plan' && etat.enCours.plan) marques.push({ type: etat.enCours.type, xy: etat.enCours.plan, texte, couleur, attente: true });
      // Axe par 2 points : les points déjà cliqués (plan reçu, puis référence).
      if (cote === 'plan') for (const q of etat.enCours.planPts ?? []) marques.push({ type: 'point', xy: q, texte, couleur, attente: true });
      if (cote === 'ref') for (const q of etat.enCours.refPts ?? []) marques.push({ type: 'point', xy: q, texte, couleur, attente: true });
      // Calage déjà connu : où l'élément devrait tomber sur la référence (aide au clic).
      if (cote === 'ref') for (const [e, n] of etat.enCours.refPoints ?? []) marques.push({ type: 'point', xy: [e, n], texte: texte, couleur, attente: true });
      if (cote === 'ref' && etat.resultat && etat.enCours.plan) {
        const s = etat.resultat.similitude;
        const pl = etat.enCours.plan;
        const xy = pl.length === 2 ? appliquerSimilitude(s, pl) : [...appliquerSimilitude(s, pl.slice(0, 2)), ...appliquerSimilitude(s, pl.slice(2))];
        marques.push({ type: etat.enCours.type, xy, texte: `${texte} ?`, couleur, attente: true });
      }
    }
    return marques;
  }

  /** Accroche sous la souris dans un plan : { est, nord } (point) ou { segment } (axe), ou null. */
  function accrocheDans(plans, position, tolerance, cote = 'plan') {
    const sources = sourcesDesPlans(plans, position, tolerance);
    // Référence « Points du projet » : on accroche seulement les points levés (aussi pour un axe : voir clicRef).
    if (cote === 'ref' && referencePoints()) return accrocher('sommet', position, tolerance, sources);
    if (etat.type === 'axe' && etat.axeMode !== 'points') {
      const t = accrocherTrait(position, tolerance, sources.lignes);
      if (!t) return null;
      const a = t.sommets[t.segment];
      const b = t.sommets[t.segment + 1];
      return { segment: [a.est, a.nord, b.est, b.nord] };
    }
    return accrocher(etat.accroche, position, tolerance, sources);
  }

  const versCoordonnees = (a) => (a.segment ? [...a.segment] : [a.est, a.nord]);

  function clicPlan(position, tolerance) {
    let a = accrocheDans([etat.lu], position, tolerance);
    // 0.298.0 : plan en image (PDF scanné) : rien à accrocher, le point cliqué est pris tel quel.
    if (!a && etat.lu.contenu?.image && etat.type === 'point') a = { est: position.est, nord: position.nord };
    if (!a) {
      message(etat.type === 'axe' ? 'Pas de trait ici : cliquez sur une ligne.' : `Rien à accrocher ici (${ACCROCHES.find(([v]) => v === etat.accroche)[2]}).`, 2500);
      return;
    }
    if (etat.type === 'axe' && etat.axeMode === 'points') {
      // Axe par 2 points accrochés sur le plan reçu : le 1er point, puis le 2e.
      const deja = etat.enCours?.planPts ?? [];
      const q = [a.est, a.nord];
      if (deja.length === 1 && !etat.enCours.plan) {
        if (Math.hypot(q[0] - deja[0][0], q[1] - deja[0][1]) < 1e-6) {
          message('Les deux points sont confondus : cliquez un autre point sur l\'axe.', 2500);
          return;
        }
        etat.enCours = { ...etat.enCours, plan: [...deja[0], ...q], planPts: [] };
        if (etat.affichage === 'plan') changerAffichage('ref');
      } else etat.enCours = { type: 'axe', role: etat.role, plan: null, planPts: [q] };
      majCaler();
      return;
    }
    etat.enCours = { type: etat.type, role: etat.role, plan: versCoordonnees(a) };
    if (etat.affichage === 'plan') changerAffichage('ref');
    majCaler();
  }

  function clicRef(position, tolerance) {
    if (!etat.enCours) {
      message('Cliquez d\'abord l\'élément sur le plan reçu.', 2500);
      return;
    }
    if (!etat.enCours.plan) {
      message('Axe par 2 points : cliquez d\'abord le 2e point sur le plan reçu (à gauche).', 3000);
      return;
    }
    const a = accrocheDans([referenceAffichee()], position, tolerance, 'ref');
    if (referencePoints() && etat.enCours.type === 'axe') {
      // Axe du plan reçu + points levés sur cet axe : on en cumule 2 ou plus, puis « Terminer l'axe » (droite ajustée).
      if (!a) {
        message('Pas de point levé ici : cliquez un point levé sur l\'axe.', 2500);
        return;
      }
      const vus = etat.enCours.refPoints ?? [];
      if (vus.some(([e, n]) => Math.hypot(e - a.est, n - a.nord) < 1e-6)) {
        message('Ce point est déjà pris : cliquez un autre point levé sur l\'axe.', 2500);
        return;
      }
      etat.enCours.refPoints = [...vus, [a.est, a.nord]];
      majCaler();
      return;
    }
    if (etat.enCours.type === 'axe' && etat.axeMode === 'points') {
      // Axe par 2 points accrochés sur la référence.
      if (!a) {
        message(`Rien à accrocher ici (${ACCROCHES.find(([v]) => v === etat.accroche)[2]}).`, 2500);
        return;
      }
      const vus = etat.enCours.refPts ?? [];
      const q = [a.est, a.nord];
      if (vus.length === 0) {
        etat.enCours.refPts = [q];
        majCaler();
        return;
      }
      if (Math.hypot(q[0] - vus[0][0], q[1] - vus[0][1]) < 1e-6) {
        message('Les deux points sont confondus : cliquez un autre point sur l\'axe.', 2500);
        return;
      }
      etat.elements.push({ type: 'axe', role: etat.enCours.role, plan: etat.enCours.plan, ref: [...vus[0], ...q] });
      etat.enCours = null;
      recalculer();
      if (etat.affichage === 'ref') changerAffichage('plan');
      majCaler();
      return;
    }
    if (!a) {
      message(etat.enCours.type === 'axe' ? 'Pas de trait ici : cliquez sur la même ligne.' : `Rien à accrocher ici (${ACCROCHES.find(([v]) => v === etat.accroche)[2]}).`, 2500);
      return;
    }
    if (Boolean(a.segment) !== (etat.enCours.type === 'axe')) return;
    etat.elements.push({ ...etat.enCours, ref: versCoordonnees(a) });
    etat.enCours = null;
    recalculer();
    if (etat.affichage === 'ref') changerAffichage('plan');
    majCaler();
  }

  /** Axe + points levés : la droite ajustée sur les points devient la ligne de la référence. */
  function finirAxe() {
    const e = etat.enCours;
    if (!e?.refPoints || e.refPoints.length < 2) {
      message('Cliquez au moins 2 points levés sur l\'axe, puis « Terminer l\'axe ».', 3500);
      return;
    }
    let droite;
    try {
      droite = droiteParPoints(e.refPoints);
    } catch (erreur) {
      message(erreur.message, 4000);
      return;
    }
    etat.elements.push({ type: 'axe', role: e.role, plan: e.plan, ref: droite.segment, pointsAxe: e.refPoints.length, ecartAxeM: droite.ecartMaxM });
    etat.enCours = null;
    recalculer();
    if (etat.affichage === 'ref') changerAffichage('plan');
    message(`Axe : droite ajustée sur ${e.refPoints.length} points (écart des points à la droite : ${mm(droite.ecartMaxM)} au plus).${droite.ecartMaxM > 0.02 ? ' ⚠ Les points ne sont pas bien alignés.' : ''}`, 5000, { ok: droite.ecartMaxM <= 0.02 });
    majCaler();
  }

  function recalculer() {
    etat.resultat = null;
    etat.erreur = '';
    if (!etat.elements.some((e) => e.role === 'calage')) {
      // Pas de point de calage : le calage automatique (s'il y en a un), vérifié par les points de vérification.
      if (etat.auto) etat.resultat = resultatAutomatique(etat.auto, etat.elements);
      return;
    }
    try {
      etat.resultat = caler(etat.elements);
      // 0.298.0 : plan PDF (lu à la taille de la feuille) : l'échelle trouvée EST l'échelle du plan (1:500…), pas une erreur d'unités.
      if (etat.lecturePdf) {
        const r = etat.resultat;
        r.message = r.message.replace(/ Échelle \S+ : pas une puissance de 10 \(unités inhabituelles \?\)\./, '') + ` Plan PDF au 1:${r.echelleBrute >= 100 ? Math.round(r.echelleBrute) : r.echelleBrute.toFixed(1)}.`;
      }
    } catch (erreur) {
      if (!(erreur instanceof ErreurCalage)) throw erreur;
      etat.erreur = erreur.message;
    }
  }

  function monterVues() {
    const toile = (cle) => page.querySelector(`[data-toile="${cle}"]`);
    vues = [
      creerVueCalage(toile('plan'), {
        plans: () => [etat.lu],
        marques: () => marquesDe('plan'),
        survol: (p, t) => accrocheDans([etat.lu], p, t),
        clic: clicPlan,
      }),
      creerVueCalage(toile('ref'), {
        plans: () => [referenceAffichee()],
        marques: () => marquesDe('ref'),
        survol: (p, t) => (etat.enCours ? accrocheDans([referenceAffichee()], p, t, 'ref') : null),
        clic: clicRef,
      }),
      creerVueCalage(toile('cale'), {
        plans: () => [refGrise(), ...(planCaleProvisoire() ? [planCaleProvisoire()] : [])],
        cadrage: () => [refGrise()], // cadré sur la référence (le plan reçu a souvent des objets égarés loin)
        marques: () => marquesDe('ref').filter((m) => !m.attente),
        // Ici les deux plans sont superposés : on ne sait pas lequel cliquer. Un clic passe en « Côte à côte » en rôle Vérification.
        clic: () => passerEnVerification(),
      }),
    ];
    majCaler();
  }

  /** Vérifier = cliquer le même point sur le plan reçu puis sur la référence : il faut les deux vues séparées. */
  function passerEnVerification() {
    etat.role = 'verification';
    changerAffichage('deux');
    majCaler();
    message('Vérification : cliquez un point sur le plan reçu (à gauche), puis le même point sur la référence (à droite).', 5000);
  }

  function changerAffichage(mode) {
    etat.affichage = mode;
    page.querySelector('.vues-calage').dataset.mode = mode;
    page.querySelectorAll('[data-outil="affichage"]').forEach((b) => b.classList.toggle('actif', b.dataset.valeur === mode));
    if (mode === 'cale') vues[2]?.cadrer();
  }

  function majCaler() {
    if (etape !== 'caler') return;
    page.querySelectorAll('.outil-ruban[data-outil]').forEach((b) => b.classList.toggle('actif', etat[b.dataset.outil] === b.dataset.valeur));
    page.querySelectorAll('[data-outil="accroche"]').forEach((b) => { b.disabled = etat.type === 'axe' && etat.axeMode !== 'points'; });
    const modeAxe = page.querySelector('[data-zone="mode-axe"]');
    if (modeAxe) modeAxe.hidden = etat.type !== 'axe';
    const noms = etiquettes(etat.elements);
    const prochain = etiquettes([...etat.elements, { type: etat.type, role: etat.role }]).at(-1);
    const bAxe = page.querySelector('[data-zone="finir-axe"]');
    if (bAxe) bAxe.disabled = !(etat.enCours?.type === 'axe' && (etat.enCours.refPoints?.length ?? 0) >= 2);
    page.querySelector('[data-zone="consigne"]').textContent = etat.calculAuto ? 'Calage automatique en cours (quelques secondes)…' : etat.enCours?.type === 'axe' && referencePoints()
      ? `${etiquettes([...etat.elements, etat.enCours]).at(-1)} : cliquez 2 points levés ou plus SUR l'axe (à droite)${etat.enCours.refPoints?.length ? ` : ${etat.enCours.refPoints.length} pris` : ''}, puis « Terminer l'axe ».` : etat.enCours
      ? etat.enCours.type === 'axe' && etat.axeMode === 'points'
        ? (!etat.enCours.plan ? `${etiquettes([...etat.elements, etat.enCours]).at(-1)} : cliquez le 2e point de l'axe sur le PLAN REÇU (à gauche).` : `${etiquettes([...etat.elements, etat.enCours]).at(-1)} : cliquez le point ${(etat.enCours.refPts?.length ?? 0) + 1} sur la RÉFÉRENCE (à droite), dans le même ordre que sur le plan reçu.`)
        : `${etiquettes([...etat.elements, etat.enCours]).at(-1)} : cliquez le même ${etat.enCours.type === 'axe' ? 'trait' : 'point'} sur la RÉFÉRENCE (à droite)${etat.resultat ? ' (marque « ? » = où il devrait être)' : ''}.`
      : etat.type === 'axe' && etat.axeMode === 'points' ? `${prochain} : cliquez 2 points (avec accroche) sur l'axe du PLAN REÇU (à gauche), puis les 2 mêmes points sur la référence (à droite).`
        : `${prochain} : cliquez ${etat.type === 'axe' ? 'un trait (axe)' : 'un point'} sur le PLAN REÇU (à gauche), puis le même sur la référence (à droite).`;
    const compte = (f) => etat.elements.filter(f).length;
    page.querySelector('[data-zone="titre-elements"]').textContent = `Éléments (${compte((e) => e.role === 'calage' && e.type === 'point')} points + ${compte((e) => e.role === 'calage' && e.type === 'axe')} axes de calage, ${compte((e) => e.role === 'verification')} vérification)`;
    const evalues = etat.resultat?.elements;
    page.querySelector('[data-zone="elements"]').innerHTML = etat.elements.length ? etat.elements.map((e, i) => {
      const ev = evalues?.[i];
      const ecart = ev ? `<span class="chiffre" style="color:${couleurEcart(ev.ecartM)}">${mm(ev.ecartM)}${ev.ecartAngleDeg !== undefined ? ` · ${nombre(ev.ecartAngleDeg, 3)}°` : ''}</span>` : '<span class="aide-calage">—</span>';
      return `<li><span class="etiquette-calage" style="background:${e.role === 'verification' ? COULEUR_VERIF : COULEUR_CALAGE}">${noms[i]}</span><span>${e.type === 'axe' ? 'Axe' : 'Point'} · ${e.role === 'verification' ? 'vérification' : 'calage'}</span>${ecart}<button type="button" class="suppr-calage" data-retirer="${i}" aria-label="Retirer ${noms[i]}">✕</button></li>`;
    }).join('') : (etat.auto ? '' : '<li class="aide-calage">Aucun élément : 2 points de calage + 1 point de vérification suffisent, ou « Caler auto ».</li>');
    if (etat.auto && !etat.elements.some((e) => e.role === 'calage')) {
      const a = etat.auto;
      page.querySelector('[data-zone="elements"]').insertAdjacentHTML('afterbegin', `<li><span class="etiquette-calage" style="background:#7c3aed">Auto</span><span>confiance ${echapper(a.niveau)}${a.points ? ` · ${a.points} sommets à ${nombre(a.ecartMoyenM * 1000, 1)} mm` : ''}</span><button type="button" class="suppr-calage" data-action="retirer-auto" aria-label="Retirer le calage automatique">✕</button></li>`);
    }
    const r = etat.resultat;
    const zone = page.querySelector('[data-zone="resultat"]');
    if (!r) {
      zone.innerHTML = `<h3>Résultat</h3><p class="aide-calage">${echapper(etat.erreur || 'Le calcul se fait dès qu\'il y a assez d\'éléments.')}</p>`;
    } else {
      const s = r.similitude;
      const [texte, classe] = VERDICTS[r.verdict];
      zone.innerHTML = `<h3>Résultat</h3>
        <dl>
          <dt>Échelle</dt><dd class="chiffre">${s.echelle.toPrecision(6).replace(/\.?0+$/, '')} ${r.echelleArrondie ? '<span class="aide-calage">(arrondie)</span>' : ''}</dd>
          <dt>Rotation</dt><dd class="chiffre">${nombre(s.rotationDeg, 4)}° <span class="aide-calage">(${nombre(s.rotationDeg / 0.9, 4)} gon)</span></dd>
          <dt>Est / Nord</dt><dd class="chiffre">${nombre(s.tx, 3)} / ${nombre(s.ty, 3)}</dd>
          ${r.auto?.sources?.length ? `<dt>Comparé avec</dt><dd>${r.auto.sources.map(echapper).join(', ')}</dd>` : ''}
        </dl>
        <div class="verdict-calage"><span class="pastille-calage ${classe}">${texte}</span><span>${echapper(r.message)}</span></div>`;
    }
    const bAuto = page.querySelector('[data-action="caler-auto"]');
    if (bAuto) bAuto.disabled = etat.calculAuto;
    const bouton = page.querySelector('[data-action="vers-nettoyer"]');
    bouton?.setAttribute('aria-disabled', String(!r || r.verdict === 'faux'));
    vues.forEach((v) => v.redessiner());
  }

  // --- Actions ---

  /**
   * Fichiers choisis [{ nom, octets }] : le plan (demandé s'il y en a plusieurs) et ses xrefs (les autres).
   * Nouvel indice : contrôle « même origine » tout de suite.
   */
  async function lireFichiers(fichiers, { reference: pourReference = false } = {}) {
    if (!fichiers.length) return;
    let principal = fichiers[0];
    if (fichiers.length > 1) {
      const cle = await demanderChoix({
        titre: 'Quel est le plan ? (les autres = ses xrefs)',
        boutons: fichiers.map((f, i) => ({ cle: String(i), texte: f.nom, detail: f.xrefTrouve ? 'xref trouvé à côté du plan' : '', principal: i === 0 })),
      });
      principal = fichiers[Number(cle)] ?? fichiers[0];
    }
    etat.lecture = '';
    etat.occupe = `Lecture de « ${principal.nom} » (gros plans : quelques secondes)…`;
    dessiner();
    await new Promise((fin) => setTimeout(fin, 30));
    try {
      let plan;
      if (estPdf(principal.nom)) {
        const lu = await lirePdfPourCalage(principal.octets, principal.nom, { page: choisirPagePdf, mode: choisirModePdf }, (texte) => {
          etat.occupe = texte;
          dessiner();
        });
        if (!lu) {
          etat.occupe = '';
          dessiner();
          return;
        }
        plan = lu.plan;
        etat.lecturePdf = { page: lu.page, mode: lu.mode, avertissements: lu.avertissements };
      } else {
        const xrefs = new Map(fichiers.filter((f) => f !== principal).map((f) => [nomXref(f.nom), texteDuDxf(f.octets)]));
        const lecture = lirePlanDxf(texteDuDxf(principal.octets), principal.nom, { xrefs, annotations: true });
        if (lecture.erreur || !lecture.plan.bornes) throw new Error(lecture.erreur ?? 'aucun objet dessiné trouvé');
        plan = lecture.plan;
        etat.lecturePdf = null;
      }
      if (pourReference) {
        // Référence locale acceptée (travail local) : le plan calé sera dans le même repère.
        entrerReference(plan, principal.nom);
        etat.occupe = '';
        dessiner();
        return;
      }
      Object.assign(etat, { lu: plan, fichier: principal.nom, lecture: '', elements: [], enCours: null, resultat: null, erreur: '', recette: null, avant: [], dessinZone: null, selection: [] });
      if (!etat.nouvelIndice) etat.nom = principal.nom.replace(/\.(dxf|dwg|pdf)$/i, '');
      else {
        const c = etat.nouvelIndice.ancien.calage;
        etat.nouvelIndice.controle = controlerIndice(c.reperes ?? [], plan, c.similitude.echelle);
        if (etat.dejaCale && !etat.nouvelIndice.controle.memeOrigine) {
          // Plan déjà calé : pas de référence pour le recaler ; s'il est bien en MN95, on continue sans calage.
          const ctl = etat.nouvelIndice.controle;
          ctl.message = ctl.message.replace(/ ?(Le plan a bougé : )?calez[^.]*\./, '') + (estEnMn95(plan.bornes)
            ? ' Il est en MN95 : si vous êtes sûr de lui, continuez (déjà calé) ; sinon calez-le sur une référence.'
            : ' Il n\'est pas en MN95 : calez-le sur une référence.');
        } else if (!etat.nouvelIndice.controle.memeOrigine) {
          etat.nouvelIndice.controle.enCours = true;
          essayerRecalage(plan); // en arrière-plan ; l'écran se redessine à la fin
        }
      }
    } catch (erreur) {
      etat.lecture = `${pourReference ? 'Référence refusée' : 'Plan illisible'} : ${erreur.message}`;
    }
    etat.occupe = '';
    dessiner();
  }

  /** PDF de plusieurs pages : laquelle caler ? (numéro, ou null). */
  async function choisirPagePdf(nombre) {
    etat.occupe = '';
    dessiner();
    const pages = Array.from({ length: Math.min(nombre, 12) }, (_, i) => i + 1);
    const cle = await demanderChoix({
      titre: `PDF de ${nombre} pages : laquelle caler ?`,
      texte: nombre > 12 ? 'Seules les 12 premières pages sont proposées.' : '',
      boutons: pages.map((n) => ({ cle: String(n), texte: `Page ${n}`, principal: n === 1 })),
    });
    return cle ? Number(cle) : null;
  }

  /** PDF avec des traits : les lire (accroche) ou poser la page en image. */
  async function choisirModePdf({ traits, images }) {
    etat.occupe = '';
    dessiner();
    return demanderChoix({
      titre: 'PDF vectoriel : comment le lire ?',
      texte: `${traits} traits${images ? ` et ${images} image(s)` : ''} sur la page.`,
      boutons: [
        { cle: 'traits', texte: 'En traits (accroche sur les sommets)', detail: 'Calques, textes et traits du PDF ; comme un DXF', principal: true },
        { cle: 'image', texte: 'En image', detail: 'La page telle quelle ; points cliqués à vue' },
      ],
    });
  }

  /** Ajout d'une référence : état du calage gardé, puis nettoyage du plan (déjà en MN95) sans calage. */
  function entrerReference(plan, fichier) {
    // 0.316.1 : l'état gardé ne doit PAS contenir le message de chargement (« Lecture de… ») : remis à la validation, il
    // laissait l'écran de chargement tourner sans fin (retour du 25.11).
    reserve = { ...etat, occupe: '' };
    const base = fichier.replace(/\.[^.]+$/, '');
    Object.assign(etat, {
      lu: plan, fichier, nom: base, modeReference: true, resultat: { similitude: { ...IDENTITE }, verdict: 'juste' }, nouvelIndice: null,
      recette: recetteDeDepart(plan, ''), avant: [], selection: [], dessinZone: null, voirChangements: false, refVisible: false, elements: [], enCours: null, auto: null,
    });
    etape = 'nettoyer';
  }

  /** Fin de l'ajout d'une référence (ajoutée ou abandonnée) : retour à l'étape 1 avec l'état d'avant. */
  function sortirReference(idNouvelle = null) {
    if (!reserve) return;
    const nouvelleReference = idNouvelle && idNouvelle !== reserve.referenceId;
    Object.assign(etat, reserve);
    etat.occupe = '';
    reserve = null;
    etat.modeReference = false;
    if (nouvelleReference) Object.assign(etat, { referenceId: idNouvelle, elements: [], enCours: null, resultat: null, recette: null, auto: null });
    etape = 'plan';
  }

  /** Plan reçu, textes multi-lignes explosés si la recette le demande (0.307.0). */
  const luExplose = () => (etat.recette?.exploserTextes ? exploserTextes(etat.lu) : etat.lu);

  function enregistrerReference() {
    const { plan: propre } = planNettoye();
    if (!propre.compte.objets) {
      message('Rien à garder : tous les objets sont écartés.', 4000);
      return;
    }
    const nom = etat.nom.trim();
    if (!nom) {
      message('Donnez un nom à la référence.', 3000);
      return;
    }
    const plan = planReference({ lu: propre, nom, fichier: etat.fichier, le: new Date().toISOString(), nettoyage: etat.recette, local: !estEnMn95(propre.bornes) });
    if (dossiers().length) plan.sousDossiers = dossierDepart() ? [dossierDepart()] : [];
    const range = ajouterPlan(plan);
    if (!range) return;
    sortirReference(range.id);
    message(`Référence « ${range.nom} » ajoutée au projet`, 4000, { ok: true });
    dessiner();
  }

  /**
   * Nouvel indice qui n'a pas la même origine : calage automatique sur l'indice d'avant (calé) et la référence. Accepté
   * (« recalé », orange) si la confiance est FORTE et qu'au moins 50 % des repères concordent après correction.
   */
  async function essayerRecalage(plan) {
    const ni = etat.nouvelIndice;
    const c = ni.ancien.calage;
    const cibles = [{ nom: `indice ${c.indice ?? '?'}`, plan: planRecale(ni.ancien) }, { nom: `référence « ${reference().nom} »`, plan: referenceAffichee() }];
    let r = null;
    try {
      r = await calculerAuto(segmentsDuPlan(plan), cibles.flatMap((x) => segmentsDuPlan(x.plan)));
    } catch (erreur) {
      ni.controle.message += ` (Calage automatique impossible : ${erreur.message}.)`;
    }
    if (etat.nouvelIndice !== ni || etat.lu !== plan) return; // autre fichier choisi entre-temps
    ni.controle.enCours = false;
    if (r) {
      const inverse = inverserSimilitude(r.similitude);
      // Coordonnées de l'ancien plan reçu → MN95 → coordonnées du nouveau plan reçu.
      const versNouveau = (xy) => appliquerSimilitude(inverse, appliquerSimilitude(c.similitude, xy));
      const reperes = (c.reperes ?? []).map(versNouveau);
      const partApres = partRetrouvee(reperes, plan, TOLERANCE_REPERE_M / r.similitude.echelle);
      if (r.niveau === 'forte' && partApres >= PART_MEME_ORIGINE) {
        const centre = reperes.length ? (c.reperes[0]) : [0, 0];
        const arrivee = versNouveau(centre);
        const depM = Math.hypot(arrivee[0] - centre[0], arrivee[1] - centre[1]) * r.similitude.echelle;
        const rot = ((((c.similitude.rotationDeg - r.similitude.rotationDeg) % 360) + 540) % 360) - 180;
        const rapport = c.similitude.echelle / r.similitude.echelle;
        ni.recalage = { auto: { ...r, sources: cibles.map((x) => x.nom) }, versNouveau };
        ni.controle = {
          ...ni.controle,
          recale: true,
          partApres,
          message: `Le plan a bougé depuis l'indice ${c.indice ?? '?'} : recalé automatiquement (confiance forte). Rotation ${rot >= 0 ? '+' : ''}${nombre(rot, 4)}°, déplacement ≈ ${nombre(depM, 2)} m ; ${Math.round(partApres * 100)} % des repères concordent après correction.${Math.abs(rapport - 1) > 0.01 ? ` L'unité du plan semble avoir changé (×${nombre(rapport, rapport < 1 ? 3 : 0)}) : vérifiez.` : ''} Vérifiez l'aperçu au nettoyage.`,
        };
      } else {
        ni.controle.message += ` Calage automatique : confiance ${r.niveau}, ${Math.round(partApres * 100)} % des repères après correction : pas assez sûr.`;
      }
    }
    if (etape === 'plan') dessiner();
  }

  /** Calage automatique du plan reçu sur la référence et les plans déjà calés du projet. */
  async function lancerAuto() {
    if (etat.calculAuto) return;
    const aRemplacer = etat.elements.filter((e) => e.role === 'calage').length;
    if (aRemplacer && !window.confirm('Le calage automatique remplace les points et axes de calage cliqués (les vérifications restent). Continuer ?')) return;
    const cibles = [
      { nom: `référence « ${reference().nom} »`, plan: referenceAffichee() },
      ...plansCales(projet.plansDxf).map((p) => ({ nom: `${p.nom} (${p.calage.indice ?? '?'})`, plan: planRecale(p) })),
    ];
    etat.calculAuto = true;
    etat.enCours = null;
    majCaler();
    try {
      const r = await calculerAuto(segmentsDuPlan(etat.lu), cibles.flatMap((x) => segmentsDuPlan(x.plan)));
      if (!r) message('Aucun calage automatique trouvé : calez à la main (points ou axes).', 5000);
      else {
        etat.auto = { ...r, sources: cibles.map((x) => x.nom) };
        etat.elements = etat.elements.filter((e) => e.role === 'verification');
        recalculer();
        changerAffichage('cale');
        message(r.niveau === 'faible' ? 'Calage automatique incertain (probablement faux) : calez à la main.' : `Calage automatique trouvé (confiance ${r.niveau}) : cliquez un point de vérification pour en être sûr.`, 5000, { ok: r.niveau !== 'faible' });
      }
    } catch (erreur) {
      message(`Calage automatique impossible : ${erreur.message}`, 6000);
    }
    etat.calculAuto = false;
    majCaler();
  }

  async function choisirDwg({ reference: pourReference = false } = {}) {
    // Écran de chargement tant que ODA convertit (ça peut durer une minute) ; la fenêtre de choix de fichier passe devant.
    etat.lecture = '';
    etat.occupe = 'Conversion du plan par ODA File Converter… (patientez, ça peut durer une minute)';
    dessiner();
    try {
      const fichiers = await choisirDwgBureau();
      if (!fichiers.length) {
        etat.occupe = '';
        dessiner();
        return;
      }
      await lireFichiers(fichiers, { reference: pourReference });
    } catch (erreur) {
      etat.occupe = '';
      etat.lecture = `Conversion impossible : ${erreur.message}`;
      dessiner();
    }
  }

  /** Nouvel indice d'un plan calé : même référence, recette du nettoyage reprise. */
  function commencerIndice(planId) {
    const ancien = projet.plansDxf.find((p) => p.id === planId);
    if (!ancien?.calage) return;
    remettreAZero();
    etat.nouvelIndice = { planId, ancien, controle: null };
    etat.referenceId = ancien.calage.referenceId;
    etat.nom = baseDuNomCale(ancien.nom);
    etat.baseId = ancien.id;
    etat.indice = indiceSuivant(ancien.calage.indice);
    etat.dejaCale = estDejaCale(ancien);
    if (!etat.dejaCale && !reference()) {
      message(`La référence « ${ancien.calage.referenceNom} » n'est plus dans le projet : nouvel indice impossible.`, 6000);
      remettreAZero();
      return;
    }
    etape = 'plan';
    dessiner();
  }

  /** Nouvel indice : recette du nettoyage de l'indice d'avant (copie), ou celle de départ. */
  function recetteDeLAncien() {
    const c = etat.nouvelIndice?.ancien.calage;
    if (!c?.nettoyage) return null;
    const recette = JSON.parse(JSON.stringify(c.nettoyage));
    // Types ajoutés depuis (cotations, lignes de repère : 0.281.0) : leur réglage de départ.
    recette.types = { ...recetteDeDepart(etat.lu).types, ...recette.types };
    // Zone : coordonnées de l'ancien plan reçu → MN95 (ancien calage) → nouveau plan reçu (nouveau calage).
    if (recette.zone && etat.resultat) {
      const inverse = inverserSimilitude(etat.resultat.similitude);
      recette.zone = recette.zone.map((xy) => appliquerSimilitude(inverse, appliquerSimilitude(c.similitude, xy)));
    }
    return recette;
  }

  function enregistrer() {
    const { plan: propre } = planNettoye();
    if (!propre.compte.objets) {
      message('Rien à garder : tous les objets sont écartés (calques, types ou zone).', 4000);
      return;
    }
    const ni = etat.nouvelIndice;
    const plan = planCale({
      lu: propre, nom: nomPlanCale(typeDuFichier(etat.fichier), baseDuNomCale(etat.nom) || etat.fichier.replace(/\.[^.]+$/, ''), etat.indice.trim() || 'A'), fichier: etat.fichier, resultat: etat.resultat, reference: reference(), elements: etat.elements,
      le: new Date().toISOString(), nettoyage: etat.recette, indice: etat.indice.trim() || 'A',
      reperes: reperesDuPlan(etat.lu, etat.recette), calquesVus: etat.lu.calques.map((c) => c.nom),
      historique: ni?.ancien.calage.indices ?? [],
      mode: ni?.mode ?? (etat.dejaCale ? 'deja-cale' : 'a-la-main'),
      part: ni?.controle ? Math.round(ni.controle.part * 1000) / 1000 : null,
      // « +21 / −6 » est toujours par rapport à l'indice d'avant (même si la comparaison affichée était avec un autre).
      changements: ni && planNettoye().cale ? (({ ajoutes, supprimes }) => ({ ajoutes, supprimes }))(differencesPlans(planRecale(ni.ancien), planNettoye().cale).compte) : null,
      groupe: ni ? (ni.ancien.calage.groupe ?? ni.ancien.id) : null,
    });
    if (!ni && dossiers().length) plan.sousDossiers = etat.dossier ? [etat.dossier] : (dossierDepart() ? [dossierDepart()] : []);
    // Nouvel indice : l'indice d'avant reste dans le projet (caché), le nouveau prend sa place à l'écran.
    const range = ajouterPlan(plan, ni ? { conserve: ni.planId } : {});
    if (!range) return;
    etat.enregistre = range;
    message(`Plan « ${etat.enregistre.nom} » ${etat.dejaCale ? 'importé (déjà calé)' : 'calé'} et rangé dans le projet`, 4000, { ok: true });
    etape = 'fin';
    dessiner();
  }

  /** Vérification après coup : le plan enregistré est rouvert sur sa référence, en rôle Vérification. */
  async function verifier(planId) {
    const plan = projet.plansDxf.find((p) => p.id === planId);
    const c = plan?.calage;
    if (!c) return;
    // Plan déjà calé (0.309.0) : pas de référence à lui ; on choisit le plan (ou les points) qui sert à le vérifier.
    let refVerif = c.referenceId;
    if (estDejaCale(plan)) {
      const refs = referencesPourVerifier(projet.plansDxf, plan);
      if (!refs.length && !points().length) {
        message('Aucun autre plan ni point dans le projet pour le vérifier : importez un plan de référence, ou « Contrôler (points) » après un levé.', 7000);
        return;
      }
      refVerif = await demanderChoix({
        titre: `Vérifier « ${plan.nom} » sur :`,
        texte: 'Cliquez ensuite le même point sur ce plan (à gauche) et sur celui-ci (à droite).',
        boutons: [...refs.map((q, i) => ({ cle: q.id, texte: q.nom, detail: planEnMn95(q) ? '' : 'local', principal: i === 0 })),
          ...(points().length ? [{ cle: REF_POINTS, texte: 'Points du projet', detail: `${points().length} points : levés, à implanter, contrôle` }] : [])],
      });
      if (!refVerif) return;
    }
    remettreAZero();
    etat.dejaCale = false;
    etat.referenceId = refVerif;
    if (!reference()) {
      message(`La référence « ${c.referenceNom} » n'est plus dans le projet : vérification impossible.`, 6000);
      return;
    }
    Object.assign(etat, { verif: { planId }, lu: plan, fichier: c.fichier ?? plan.nom, nom: plan.nom, indice: c.indice ?? 'A', elements: c.elements.map((e) => ({ ...e, plan: [...e.plan], ref: [...e.ref] })), role: 'verification', type: 'point', affichage: 'deux' });
    if (!etat.elements.some((e) => e.role === 'calage')) {
      etat.auto = { similitude: { ...c.similitude }, niveau: c.auto?.niveau ?? 'forte', echelleBrute: c.echelleBrute, echelleArrondie: c.echelleArrondie, sources: [`calage de l'indice ${c.indice ?? '?'}`] };
    }
    recalculer();
    etape = 'caler';
    dessiner();
    message('Vérification : cliquez un point sur le plan reçu (à gauche), puis le même point sur la référence (à droite).', 5000);
  }

  function enregistrerVerification() {
    const r = etat.resultat;
    const plan = projet.plansDxf.find((p) => p.id === etat.verif?.planId);
    if (!r || !plan) return;
    if (!etat.elements.some((e) => e.role === 'verification')) {
      message('Cliquez d\'abord au moins un point de vérification.', 3500);
      return;
    }
    const maj = {
      ...plan,
      calage: {
        ...plan.calage,
        elements: etat.elements.map(({ type, role, plan: pl, ref, pointsAxe, ecartAxeM }) => ({ type, role, plan: [...pl], ref: [...ref], ...(pointsAxe ? { pointsAxe, ecartAxeM } : {}) })),
        verdict: r.verdict,
        ecartVerificationM: Math.max(0, ...r.elements.filter((e) => e.role === 'verification').map((e) => e.ecartM)),
        message: r.message,
        verifieLe: new Date().toISOString(),
        ...(estDejaCale(plan) ? { verifieAvec: reference()?.nom ?? '' } : {}),
      },
    };
    const range = ajouterPlan(maj, { remplace: plan.id });
    if (!range) return;
    message(`Vérification enregistrée : ${VERDICTS[r.verdict][0]}`, 4000, { ok: r.verdict === 'juste' });
    remettreAZero();
    etape = 'liste';
    dessiner();
  }

  /**
   * Afficher un ancien indice : il sort des Archives et prend la place de l'indice affiché (dossier, couleur, affichage),
   * qui part à son tour dans les Archives. Un indice du projet seulement caché est simplement montré.
   */
  function afficherIndice(id) {
    const choisi = planParId(id);
    if (!choisi) return false;
    const archive = archiveDu(id);
    return modifier(() => {
      if (!archive) {
        indicesDuGroupe(projet.plansDxf, choisi).forEach((q) => { q.visible = q.id === choisi.id; });
        return;
      }
      const groupe = choisi.calage.groupe ?? choisi.id;
      const actuel = projet.plansDxf.find((p) => p.calage && (p.calage.groupe ?? p.id) === groupe);
      restaurer(projet, archive.id);
      const remis = projet.plansDxf.find((p) => p.id === id);
      if (actuel) {
        const { sousDossiers, couleur, transparence } = actuel;
        Object.assign(remis, { sousDossiers, visible: true, ...(couleur !== undefined ? { couleur } : {}), ...(transparence !== undefined ? { transparence } : {}) });
        const { archive: rangee } = archiver(projet, 'plan', actuel.id);
        if (rangee) rangee.nom = `${actuel.nom} (indice ${actuel.calage.indice ?? '?'})`;
      } else remis.visible = true;
      delete remis.calage.archive;
    });
  }

  /** Comparer deux indices d'un plan calé (au choix dans les deux listes). */
  function comparer(planId) {
    const plan = planParId(planId);
    if (!plan?.calage) return;
    const plans = indicesDuGroupe(tousPlans(), plan);
    if (plans.length < 2) {
      message('Il n\'y a qu\'un seul indice : rien à comparer.', 3500);
      return;
    }
    // L'indice choisi est comparé à celui d'avant ; s'il est le plus ancien, à celui d'après.
    const index = plans.findIndex((p) => p.id === planId);
    const [avant, apres] = index < plans.length - 1 ? [plans[index + 1], plans[index]] : [plans[index], plans[index - 1]];
    remettreAZero();
    etat.referenceId = plan.calage.referenceId;
    etat.comparaison = { plans, avantId: avant.id, apresId: apres.id };
    etape = 'comparer';
    dessiner();
  }

  /** 0.309.0 : importer un plan DXF / DWG déjà en MN95 (sans référence ni calage), le nettoyer, le ranger. */
  function commencerDejaCale() {
    remettreAZero();
    etat.dejaCale = true;
    etape = 'plan';
    dessiner();
  }

  /** Plan déjà calé lu : nettoyage (recette de l'indice d'avant pour un nouvel indice), sans calage. */
  async function nettoyerDejaCale() {
    if (!etat.lu) return;
    if (!estEnMn95(etat.lu.bornes)) {
      const choix = await demanderChoix({
        titre: 'Ce plan n\'est pas en MN95',
        texte: 'Ses coordonnées ne tombent pas en Suisse (MN95). Importé tel quel, il ne sera pas à sa place sur le plan.',
        boutons: [{ cle: 'caler', texte: 'Le caler sur une référence', principal: true }, { cle: 'oui', texte: 'L\'importer quand même' }],
      });
      if (choix === 'caler' && !etat.nouvelIndice) {
        etat.dejaCale = false;
        etat.referenceId = plansDeReference(projet.plansDxf)[0]?.id ?? '';
        dessiner();
        return;
      }
      if (choix !== 'oui') return;
    }
    etat.resultat = resultatDejaCale();
    if (etat.nouvelIndice) {
      etat.nouvelIndice.mode = etat.nouvelIndice.controle?.memeOrigine ? 'meme-origine' : 'deja-cale';
      etat.nouvelIndice.rejoue = true;
    }
    etat.recette = null;
    allerNettoyer();
  }

  function nouveau() {
    remettreAZero();
    if (simple) {
      etat.referenceId = REF_POINTS;
      etape = 'plan';
      dessiner();
      return;
    }
    if (!plansDeReference(projet.plansDxf).some((p) => p.id === etat.referenceId)) etat.referenceId = plansDeReference(projet.plansDxf)[0]?.id ?? '';
    etape = 'plan';
    dessiner();
  }

  page.addEventListener('click', (ev) => {
    // Nettoyer : toucher une ligne de calque (hors case et couleur) = le choisir (Suppr l'écarte).
    const ligne = ev.target.closest('[data-calque]');
    if (ligne && !ev.target.matches('input')) {
      etat.choisirCalques = true;
      basculerSelection(Number(ligne.dataset.calque));
      return;
    }
    const cible = ev.target.closest('button');
    if (!cible) return;
    const { action, aller, outil, valeur, zoom, retirer, hachures } = cible.dataset;
    if (action === 'retour') fermer();
    else if (action === 'vers-nettoyer') allerNettoyer();
    else if (action === 'choisir-dwg') choisirDwg();
    else if (action === 'choisir-dwg-ref') choisirDwg({ reference: true });
    else if (action === 'finir-axe') finirAxe();
    else if (cible.dataset.modifierPlan) modifierPlanListe(cible.dataset.modifierPlan);
    else if (cible.dataset.indiceDe) commencerIndice(cible.dataset.indiceDe);
    else if (cible.dataset.verifier) verifier(cible.dataset.verifier);
    else if (cible.dataset.controler) {
      // Contrôle avec les points levés (0.309.0) : celui de la page Plans (barre sur le plan de l'appli).
      const id = cible.dataset.controler;
      fermer({ sansRetour: true });
      controlerPlan?.(id);
    } else if (action === 'deja-cale') commencerDejaCale();
    else if (action === 'passer-deja-cale') {
      etat.dejaCale = true;
      etat.referenceId = '';
      dessiner();
    } else if (action === 'vers-calage') {
      etat.dejaCale = false;
      if (!plansDeReference(projet.plansDxf).some((p) => p.id === etat.referenceId)) etat.referenceId = plansDeReference(projet.plansDxf)[0]?.id ?? '';
      if (etat.nouvelIndice) {
        message('Nouvel indice d\'un plan déjà calé : calez plutôt un nouveau plan (« ＋ Caler un nouveau plan »).', 6000);
        return;
      }
      dessiner();
    } else if (action === 'nettoyer-deja-cale') nettoyerDejaCale();
    else if (cible.dataset.comparerAvec) comparer(cible.dataset.comparerAvec);
    else if (cible.dataset.afficherIndice) {
      if (afficherIndice(cible.dataset.afficherIndice)) dessiner();
    } else if (action === 'enregistrer-verif') enregistrerVerification();
    else if (action === 'enregistrer-reference') enregistrerReference();
    else if (action === 'annuler-reference') {
      sortirReference();
      dessiner();
    } else if (action === 'ecarter-selection') ecarterSelection();
    else if (action === 'vider-selection') {
      etat.selection = [];
      majNettoyer();
    } else if (action === 'voir-reference') {
      etat.refVisible = !etat.refVisible;
      majNettoyer();
    } else if (action === 'voir-reference-cmp') {
      etat.refVisible = !etat.refVisible;
      page.querySelector('[data-action="voir-reference-cmp"]').classList.toggle('actif', etat.refVisible);
      majComparer();
    }
    else if (action === 'caler-auto') lancerAuto();
    else if (action === 'retirer-auto') {
      etat.auto = null;
      recalculer();
      majCaler();
    } else if (action === 'voir-changements') {
      etat.voirChangements = !etat.voirChangements;
      majNettoyer();
      vues[0]?.cadrer();
    } else if (action === 'rejouer' || action === 'rejouer-recale') {
      // Même origine : mêmes éléments, même calage, même nettoyage. Recalé : éléments et zone déplacés sur le
      // nouveau plan (coordonnées de l'ancien plan reçu → nouveau), calage automatique s'il n'y avait pas de points.
      const ni = etat.nouvelIndice;
      const c = ni.ancien.calage;
      const deplacer = action === 'rejouer-recale' ? ni.recalage.versNouveau : (xy) => xy;
      const deplacerCoords = (v) => (v.length === 2 ? deplacer(v) : [...deplacer(v.slice(0, 2)), ...deplacer(v.slice(2))]);
      etat.elements = c.elements.map((e) => ({ ...e, plan: deplacerCoords(e.plan), ref: [...e.ref] }));
      etat.auto = null;
      if (!etat.elements.some((e) => e.role === 'calage')) {
        etat.auto = action === 'rejouer-recale' ? ni.recalage.auto
          : { similitude: { ...c.similitude }, niveau: c.auto?.niveau ?? 'forte', echelleBrute: c.echelleBrute, echelleArrondie: c.echelleArrondie, sources: [`recette de l'indice ${c.indice ?? '?'}`] };
      }
      ni.rejoue = true;
      ni.mode = action === 'rejouer-recale' ? 'recale' : 'meme-origine';
      etat.recette = null; // reprise au passage à « Nettoyer » (zone déplacée selon le nouveau calage)
      recalculer();
      allerNettoyer();
    } else if (action === 'caler-a-la-main') {
      etat.elements = [];
      etat.auto = null;
      etat.nouvelIndice.rejoue = false;
      etat.nouvelIndice.mode = 'a-la-main';
      recalculer();
      etape = 'caler';
      dessiner();
    }
    else if (hachures) changerRecette((r) => { r.hachures = hachures; });
    else if (action === 'enlever-main') {
      etat.enleverMain = !etat.enleverMain;
      if (etat.enleverMain) etat.choisirCalques = false;
      etat.selection = [];
      majNettoyer();
    } else if (action === 'voir-enleves') {
      etat.voirEnleves = !etat.voirEnleves;
      majNettoyer();
    } else if (action === 'restaurer-tout') restaurerObjets(null);
    else if (cible.dataset.restaurer) restaurerObjets([cible.dataset.restaurer]);
    else if (action === 'tout-garder') changerRecette((r) => { r.ecartes = []; });
    else if (action === 'tout-ecarter') changerRecette((r) => { r.ecartes = etat.lu.calques.map((c) => c.nom); });
    else if (action === 'voir-ecartes') {
      etat.voirEcartes = !etat.voirEcartes;
      majNettoyer();
    } else if (action === 'masquer-chargement') {
      etat.occupe = '';
      dessiner();
    } else if (action === 'choisir-calques') {
      etat.choisirCalques = !etat.choisirCalques;
      if (etat.choisirCalques) { etat.enleverMain = false; etat.dessinZone = null; }
      majNettoyer();
    } else if (action === 'annuler-nettoyage') {
      if (!etat.avant.length) return;
      etat.recette = JSON.parse(etat.avant.pop());
      majNettoyer();
    } else if (action === 'dessiner-zone') {
      etat.dessinZone = [];
      etat.choisirCalques = false;
      majNettoyer();
    } else if (action === 'finir-zone') finirZone();
    else if (action === 'abandonner-zone') {
      etat.dessinZone = null;
      majNettoyer();
    } else if (action === 'effacer-zone') changerRecette((r) => { r.zone = null; });
    else if (action === 'nouveau') nouveau();
    else if (aller) {
      if (etat.modeReference) sortirReference();
      // Retour à la liste après un enregistrement : on repart de zéro (pas deux fois le même plan).
      if (aller === 'liste' && (etat.enregistre || etat.verif || etat.comparaison)) remettreAZero();
      if (aller === 'nettoyer') {
        if (etat.dejaCale && !etat.resultat) nettoyerDejaCale();
        else allerNettoyer();
        return;
      }
      if (aller !== 'liste' && !accessible(aller)) {
        message(aller === 'caler' ? 'Choisissez d\'abord le plan reçu et la référence MN95.' : 'Pas encore disponible.', 3000);
        return;
      }
      etape = aller;
      dessiner();
    } else if (outil) {
      if (outil === 'affichage') changerAffichage(valeur);
      else if (outil === 'role' && valeur === 'verification') passerEnVerification();
      else {
        etat[outil] = valeur;
        // Changer de genre d'élément abandonne celui commencé.
        if (outil === 'type' && etat.enCours && etat.enCours.type !== valeur) etat.enCours = null;
        if (outil === 'axeMode') etat.enCours = null;
        if (outil === 'role' && etat.enCours) etat.enCours.role = valeur;
        majCaler();
      }
    } else if (zoom && (etape === 'nettoyer' || etape === 'comparer')) {
      if (zoom === 'tout') vues[0].cadrer();
      else vues[0].zoom(Number(zoom));
    } else if (zoom) {
      const visibles = { deux: [0, 1], plan: [0], ref: [1], cale: [2] }[etat.affichage];
      visibles.forEach((i) => (zoom === 'tout' ? vues[i].cadrer() : vues[i].zoom(Number(zoom))));
    } else if (retirer !== undefined) {
      etat.elements.splice(Number(retirer), 1);
      recalculer();
      majCaler();
    } else if (action === 'retirer-dernier') {
      if (etat.enCours?.refPoints?.length) etat.enCours.refPoints.pop();
      else if (etat.enCours?.refPts?.length) etat.enCours.refPts.pop();
      else if (etat.enCours) etat.enCours = null;
      else if (etat.elements.length) etat.elements.pop();
      else etat.auto = null;
      recalculer();
      majCaler();
    } else if (action === 'tout-effacer') {
      if ((etat.elements.length || etat.auto) && !window.confirm('Effacer tous les éléments cliqués (et le calage automatique) ?')) return;
      etat.elements = [];
      etat.auto = null;
      etat.enCours = null;
      recalculer();
      majCaler();
    } else if (action === 'enregistrer') enregistrer();
  });
  page.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.action === 'fichier' && t.files?.length) {
      Promise.all([...t.files].map(async (f) => ({ nom: f.name, octets: new Uint8Array(await f.arrayBuffer()) }))).then(lireFichiers);
    } else if (t.dataset.action === 'fichier-ref' && t.files?.length) {
      Promise.all([...t.files].map(async (f) => ({ nom: f.name, octets: new Uint8Array(await f.arrayBuffer()) }))).then((f) => lireFichiers(f, { reference: true }));
    } else if (t.dataset.champ === 'plan-projet') {
      const choisi = projet.plansDxf.find((p) => p.id === t.value);
      if (!choisi) return;
      Object.assign(etat, { lu: { ...choisi, visible: true, recalage: undefined, couleur: undefined, transparence: 0 }, fichier: choisi.nom, nom: `${choisi.nom} (calé)`, lecture: '', elements: [], enCours: null, resultat: null, erreur: '', recette: null, avant: [], selection: [] });
      etat.referenceId = REF_POINTS;
      dessiner();
    } else if (t.dataset.champ === 'indice') etat.indice = t.value;
    else if (t.dataset.champ === 'dossier') etat.dossier = t.value;
    else if (t.dataset.champ === 'base') {
      etat.baseId = t.value;
      etat.voirChangements = true;
      majNettoyer();
    } else if (t.dataset.champ === 'cmp-avant' || t.dataset.champ === 'cmp-apres') {
      etat.comparaison[t.dataset.champ === 'cmp-avant' ? 'avantId' : 'apresId'] = t.value;
      majComparer();
    }
    else if (t.dataset.champ === 'reference') {
      etat.referenceId = t.value;
      etat.elements = [];
      etat.enCours = null;
      etat.resultat = null;
      etat.recette = null;
      dessiner();
    } else if (t.dataset.garder !== undefined) {
      const nom = etat.lu.calques[Number(t.dataset.garder)].nom;
      changerRecette((r) => { r.ecartes = t.checked ? r.ecartes.filter((n) => n !== nom) : [...r.ecartes, nom]; });
    } else if (t.dataset.couleur !== undefined) {
      const nom = etat.lu.calques[Number(t.dataset.couleur)].nom;
      changerRecette((r) => { r.couleurs[nom] = t.value; });
    } else if (t.dataset.type) changerRecette((r) => { r.types[t.dataset.type] = t.checked; });
    else if (t.dataset.exploserTextes !== undefined) changerRecette((r) => { r.exploserTextes = t.checked; });
    else if (t.dataset.champ === 'prefixe') changerRecette((r) => { r.prefixe = t.value; });
  });
  page.addEventListener('input', (ev) => {
    if (ev.target.dataset.champ === 'nom') etat.nom = ev.target.value;
    if (ev.target.dataset.champ === 'filtre') {
      etat.filtre = ev.target.value;
      majNettoyer();
    }
  });
  // Échap abandonne l'élément commencé (sinon : retour, voir « cancel »).
  page.addEventListener('keydown', (ev) => {
    const dansChamp = ev.target.matches?.('input, select, textarea');
    // Nettoyer : Suppr = écarter le calque choisi ; Échap = abandonner la zone en cours ; Ctrl+Z = ↶ Annuler.
    if (etape === 'nettoyer' && !dansChamp) {
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && etat.selection.length) {
        ev.preventDefault();
        ecarterSelection();
      } else if (ev.key === 'Escape' && etat.dessinZone) {
        ev.preventDefault();
        ev.stopPropagation();
        etat.dessinZone = null;
        majNettoyer();
      } else if (ev.key === 'Escape' && etat.enleverMain) {
        ev.preventDefault();
        ev.stopPropagation();
        etat.enleverMain = false;
        majNettoyer();
      } else if (ev.key.toLowerCase() === 'z' && (ev.ctrlKey || ev.metaKey) && etat.avant.length) {
        ev.preventDefault();
        etat.recette = JSON.parse(etat.avant.pop());
        majNettoyer();
      }
      return;
    }
    if (ev.key === 'Escape' && etape === 'caler' && etat.enCours) {
      ev.preventDefault();
      ev.stopPropagation();
      etat.enCours = null;
      majCaler();
    }
  });

  // 0.309.0 : ouverte par Importer › Plan DXF : directement l'import d'un plan déjà calé.
  if (depart === 'deja-cale' && !simple) commencerDejaCale();
  else dessiner();
  return { fermer };
}
