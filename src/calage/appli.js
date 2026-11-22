// Application « Calage de plans » (0.278.0, Expert, site PC et Topo Bureau ; décisions du 22.11) : caler un plan
// reçu (architecte, ingénieur : ses unités, sa rotation, son origine) sur un plan MN95 du projet ouvert, en cliquant
// des éléments homologues sur les deux plans. Page plein écran à part (comme Matériel) :
//  Liste (plans calés du projet) → 1 Le plan (fichier reçu, référence) → 2 Caler (outils en haut, deux vues de même
//  taille, éléments et résultat en bas) → 3 Nettoyer (0.279.0 : calques, couleurs, types, hachures, zone, préfixe)
//  → Terminé (le plan calé et nettoyé est un plan du projet, avec sa recette).
// Calculs : topo/calage-plan.js (caler), topo/nettoyage-plan.js (nettoyer) ; rangement : calage/plans.js.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { demanderChoix } from '../outils/choix.js';
import { lirePlanDxf, texteDuDxf, estEnMn95 } from '../topo/dxf-plan.js';
import { planRecale } from '../topo/recalage.js';
import { accrocher, accrocherTrait, sourcesDesPlans } from '../topo/accroche.js';
import { caler, ErreurCalage, appliquerSimilitude, inverserSimilitude, versHelmert, SEUIL_JUSTE_M, SEUIL_A_REVOIR_M } from '../topo/calage-plan.js';
import { recetteDeDepart, nettoyerPlan, compterParCalque, calqueSousLePoint, TYPES_RETIRABLES, CHOIX_HACHURES } from '../topo/nettoyage-plan.js';
import { plansDeReference, plansCales, etiquettes, planCale } from './plans.js';
import { creerVueCalage } from './vue-calage.js';

const COULEUR_CALAGE = '#2563eb';
const COULEUR_VERIF = '#16a34a';
const COULEUR_REF_CALE = '#9ca3af';
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
export function ouvrirCalage({ projet, ajouterPlan, quandRetour = null, message = () => {} }) {
  const page = document.createElement('dialog');
  page.className = 'page-calage';
  document.body.append(page);
  page.showModal();

  let etape = 'liste';
  const etat = {
    lu: null, fichier: '', nom: '', referenceId: '', lecture: '',
    elements: [], enCours: null,
    type: 'point', role: 'calage', accroche: 'sommet', affichage: 'deux',
    resultat: null, erreur: '', enregistre: null,
    // Nettoyage : recette en cours, retours en arrière (↶), calque choisi, filtre, zone en cours de dessin.
    recette: null, avant: [], calqueChoisi: -1, filtre: '', voirEcartes: false, ecarterAuClic: true, dessinZone: null,
  };
  let vues = [];

  const reference = () => projet.plansDxf.find((p) => p.id === etat.referenceId) ?? null;
  const referenceAffichee = () => (reference() ? planRecale(reference()) : null);
  let grise = { source: null, plan: null };
  const refGrise = () => {
    const r = referenceAffichee();
    if (grise.source !== r) grise = { source: r, plan: enCouleur(r, COULEUR_REF_CALE) };
    return grise.plan;
  };

  function fermer() {
    vues.forEach((v) => v.detruire());
    page.close();
    page.remove();
    quandRetour?.();
  }
  page.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    fermer();
  });

  // --- Dessin de la page ---

  function dessiner() {
    vues.forEach((v) => v.detruire());
    vues = [];
    const etapes = [['plan', '1 Le plan'], ['caler', '2 Caler'], ['nettoyer', '3 Nettoyer'], ['fin', '4 Terminé']];
    page.innerHTML = `
      <header class="entete-calage">
        <button type="button" class="retour-reglages" data-action="retour" aria-label="Retour aux applications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        <h2>Calage de plans ${bulle('calage')}</h2>
        <nav class="etapes-calage" aria-label="Étapes">
          <button type="button" data-aller="liste" class="${etape === 'liste' ? 'actif' : ''}">Plans calés</button>
          ${etapes.map(([cle, titre]) => `<button type="button" data-aller="${cle}" class="${etape === cle ? 'actif' : ''}" ${accessible(cle) ? '' : 'disabled'}>${titre}</button>`).join('')}
        </nav>
      </header>
      <main class="contenu-calage ${etape === 'caler' || etape === 'nettoyer' ? 'en-calage' : ''}">${{ liste: htmlListe, plan: htmlPlan, caler: htmlCaler, nettoyer: htmlNettoyer, fin: htmlFin }[etape]()}</main>`;
    if (etape === 'caler') monterVues();
    if (etape === 'nettoyer') monterNettoyer();
  }

  function accessible(cle) {
    if (cle === 'plan') return etat.enregistre === null;
    if (cle === 'caler') return Boolean(etat.lu && reference()) && etat.enregistre === null;
    if (cle === 'nettoyer') return Boolean(etat.resultat && etat.resultat.verdict !== 'faux') && etat.enregistre === null;
    return etat.enregistre !== null;
  }

  function htmlListe() {
    const cales = plansCales(projet.plansDxf);
    const lignes = cales.map((p) => {
      const c = p.calage;
      const [texte, classe] = VERDICTS[c.verdict] ?? ['?', 'p-sans'];
      return `<tr>
        <td><strong>${echapper(p.nom)}</strong><br><span class="aide-calage">${echapper(c.fichier ?? '')}</span></td>
        <td>${echapper(c.referenceNom ?? '')}</td>
        <td class="chiffre">${c.similitude.echelle.toPrecision(6).replace(/\.?0+$/, '')}</td>
        <td class="chiffre">${nombre(c.similitude.rotationDeg, 4)}°</td>
        <td><span class="pastille-calage ${classe}">${texte}</span> ${c.verdict === 'sans-verification' ? '' : `<span class="chiffre">${mm(c.ecartVerificationM)}</span>`}</td>
        <td>${dateCourte(c.le)}</td>
      </tr>`;
    }).join('');
    return `
      <div class="barre-calage"><button type="button" class="bouton" data-action="nouveau">＋ Caler un nouveau plan</button></div>
      ${cales.length ? `<div class="cadre-tableau-calage"><table class="tableau-calage">
        <thead><tr><th>Plan calé</th><th>Référence</th><th>Échelle</th><th>Rotation</th><th>Vérification</th><th>Calé le</th></tr></thead>
        <tbody>${lignes}</tbody></table></div>` : '<p class="vide">Aucun plan calé dans ce projet.</p>'}`;
  }

  function htmlPlan() {
    const refs = plansDeReference(projet.plansDxf);
    const lu = etat.lu;
    let resume = '';
    if (lu) {
      const b = lu.bornes;
      resume = `<p class="resume-plan-recu"><strong>${echapper(etat.fichier)}</strong> : ${lu.compte.objets} objets, ${lu.calques.length} calques, étendue ${nombre(b.estMax - b.estMin, 1)} × ${nombre(b.nordMax - b.nordMin, 1)} (unités du plan).</p>
        ${estEnMn95(b) ? '<p class="note-calage ok">✓ Ce plan semble déjà en MN95 : le caler n\'est peut-être pas utile.</p>' : ''}`;
    }
    return `
      <section class="carte-calage">
        <h3>Plan reçu</h3>
        <label class="bouton-secondaire bouton-fichier">Choisir le fichier DXF…<input type="file" accept=".dxf" data-action="fichier" hidden></label>
        ${etat.lecture ? `<p class="aide-calage">${echapper(etat.lecture)}</p>` : ''}
        ${resume}
        ${lu ? `<label class="champ-calage"><span>Nom du plan calé</span><input type="text" data-champ="nom" value="${echapper(etat.nom)}"></label>` : ''}
      </section>
      <section class="carte-calage">
        <h3>Référence MN95 (un plan du projet)</h3>
        ${refs.length ? `<select data-champ="reference"><option value="">— choisir —</option>${refs.map((p) => `<option value="${echapper(p.id)}" ${p.id === etat.referenceId ? 'selected' : ''}>${echapper(p.nom)}</option>`).join('')}</select>`
          : '<p class="note-calage alerte">⚠ Aucun plan en MN95 dans ce projet : importez d\'abord la référence (Importer › Plan DXF).</p>'}
      </section>
      <div class="pied-calage"><button type="button" class="bouton" data-aller="caler" ${accessible('caler') ? '' : 'aria-disabled="true"'}>Caler →</button></div>`;
  }

  function htmlCaler() {
    const groupe = (titre, boutons) => `<div class="groupe-ruban"><span class="titre-groupe">${titre}</span><div class="boutons-groupe">${boutons}</div></div>`;
    const outil = (champ, valeur, icone, texte, extra = '') => `<button type="button" class="outil-ruban ${etat[champ] === valeur ? 'actif' : ''}" data-outil="${champ}" data-valeur="${valeur}" ${extra}>${icone}<span>${texte}</span></button>`;
    return `
      <div class="ruban-calage" role="toolbar" aria-label="Outils du calage">
        ${groupe('Élément', outil('type', 'point', '⊡', 'Point') + outil('type', 'axe', '╱', 'Axe'))}
        ${groupe('Rôle', outil('role', 'calage', `<i class="rond-role" style="background:${COULEUR_CALAGE}"></i>`, 'Calage') + outil('role', 'verification', `<i class="rond-role" style="background:${COULEUR_VERIF}"></i>`, 'Vérification'))}
        ${groupe('Accroche', ACCROCHES.map(([v, i, t]) => outil('accroche', v, i, t)).join(''))}
        ${groupe('Affichage', AFFICHAGES.map(([v, i, t]) => outil('affichage', v, i, t)).join(''))}
        ${groupe('Zoom', '<button type="button" class="outil-ruban" data-zoom="1.5">＋</button><button type="button" class="outil-ruban" data-zoom="0.667">−</button><button type="button" class="outil-ruban" data-zoom="tout">⤢<span>Tout</span></button>')}
        ${groupe('Modifier', '<button type="button" class="outil-ruban" data-action="retirer-dernier">↶<span>Retirer le dernier</span></button><button type="button" class="outil-ruban" data-action="tout-effacer">✕<span>Tout effacer</span></button>')}
      </div>
      <p class="consigne-calage" data-zone="consigne"></p>
      <div class="vues-calage" data-mode="${etat.affichage}">
        <div class="vue-calage" data-cote="plan"><div class="tete-vue"><strong>Plan reçu · ${echapper(etat.fichier)}</strong></div><div class="toile-calage" data-toile="plan"></div></div>
        <div class="vue-calage" data-cote="ref"><div class="tete-vue"><strong>Référence MN95 · ${echapper(reference()?.nom ?? '')}</strong></div><div class="toile-calage" data-toile="ref"></div></div>
        <div class="vue-calage" data-cote="cale"><div class="tete-vue"><strong>Plan calé sur la référence</strong><span class="aide-calage">bleu = plan calé · gris = référence</span></div><div class="toile-calage" data-toile="cale"></div></div>
      </div>
      <div class="bas-calage">
        <section class="carte-calage"><h3 data-zone="titre-elements"></h3><ul class="elements-calage" data-zone="elements"></ul></section>
        <section class="carte-calage resultat-calage" data-zone="resultat"></section>
      </div>
      <div class="pied-calage"><button type="button" class="bouton-secondaire" data-aller="plan">← Le plan</button><button type="button" class="bouton" data-action="vers-nettoyer">Nettoyer →</button></div>`;
  }

  function htmlFin() {
    const p = etat.enregistre;
    const c = p.calage;
    return `
      <section class="carte-calage">
        <h3>✓ Plan « ${echapper(p.nom)} » calé et rangé dans le projet</h3>
        <p>Échelle ${c.similitude.echelle.toPrecision(6).replace(/\.?0+$/, '')} · rotation ${nombre(c.similitude.rotationDeg, 4)}° · ${echapper(c.message)}</p>
        <p class="aide-calage">Il est dans la page Plans du projet : l'afficher, y accrocher, implanter, l'exporter en DXF (Exporter › Plan), comme les autres plans. Copié sur Drive avec le projet.</p>
      </section>
      <div class="pied-calage"><button type="button" class="bouton-secondaire" data-aller="liste">Plans calés</button><button type="button" class="bouton" data-action="nouveau">＋ Caler un autre plan</button></div>`;
  }

  // --- Écran Nettoyer (0.279.0, maquette validée le 22.11) ---

  function htmlNettoyer() {
    const ignores = Object.entries(etat.lu.compte.ignores ?? {});
    return `
      <div class="nettoyer-calage">
        <div class="colonne-nettoyer">
          <section class="carte-calage">
            <div class="ligne-titre"><h3 data-zone="titre-calques"></h3><button type="button" class="lien-calage" data-action="annuler-nettoyage">↶ Annuler</button></div>
            <input type="search" class="filtre-calques" data-champ="filtre" placeholder="Filtrer les calques" value="${echapper(etat.filtre)}">
            <div class="barre-calage">
              <button type="button" class="bouton-secondaire petit" data-action="tout-garder">Tout garder</button>
              <button type="button" class="bouton-secondaire petit" data-action="tout-ecarter">Tout écarter</button>
              <label class="aide-calage"><input type="checkbox" data-champ="ecarter-au-clic" ${etat.ecarterAuClic ? 'checked' : ''}> Écarter au clic</label>
            </div>
            <div class="liste-calques" data-zone="calques"></div>
            <button type="button" class="lien-calage" data-action="voir-ecartes" data-zone="voir-ecartes"></button>
          </section>
          <section class="carte-calage">
            <h3>Types d'objets à supprimer</h3>
            <div class="types-calage">${TYPES_RETIRABLES.map(([cle, titre]) => `<label><input type="checkbox" data-type="${cle}" ${etat.recette.types[cle] ? 'checked' : ''}> ${titre}</label>`).join('')}</div>
            ${ignores.length ? `<p class="aide-calage">Jamais lus par Topo : ${ignores.map(([t, n]) => `${n} ${echapper(t)}`).join(', ')}</p>` : ''}
          </section>
          <section class="carte-calage">
            <h3>Hachures</h3>
            <div class="choix-hachures" role="group" aria-label="Hachures">${CHOIX_HACHURES.map(([cle, titre]) => `<button type="button" data-hachures="${cle}" class="${etat.recette.hachures === cle ? 'actif' : ''}">${titre}</button>`).join('')}</div>
          </section>
          <section class="carte-calage">
            <h3>Zone à garder</h3>
            <div class="barre-calage" data-zone="boutons-zone"></div>
          </section>
          <section class="carte-calage">
            <label class="champ-calage"><span>Préfixe des calques</span><input type="text" data-champ="prefixe" value="${echapper(etat.recette.prefixe)}"></label>
          </section>
        </div>
        <div class="vue-calage vue-nettoyer">
          <div class="tete-vue"><strong>Plan calé sur la référence</strong><span class="zoom-calage"><button type="button" data-zoom="1.5" aria-label="Zoom avant">＋</button><button type="button" data-zoom="0.667" aria-label="Zoom arrière">−</button><button type="button" data-zoom="tout" aria-label="Tout voir">⤢</button></span></div>
          <div class="toile-calage" data-toile="nettoyer"></div>
          <div class="pied-vue" data-zone="compteur"></div>
        </div>
      </div>
      <div class="pied-calage"><button type="button" class="bouton-secondaire" data-aller="caler">← Caler</button><button type="button" class="bouton" data-action="enregistrer">Enregistrer dans le projet →</button></div>`;
  }

  // Plan nettoyé (plan reçu) et sa version calée, refaits seulement quand la recette change.
  let nettoye = { cle: '', plan: null, cale: null };
  function planNettoye() {
    const cle = JSON.stringify([etat.recette, etat.resultat.similitude]);
    if (nettoye.cle !== cle) {
      const plan = nettoyerPlan(etat.lu, etat.recette);
      const p = Object.assign(Object.create(plan), { recalage: { applique: true, parametres: versHelmert(etat.resultat.similitude) }, visible: true });
      nettoye = { cle, plan, cale: plan.compte.objets ? planRecale(p) : null };
    }
    return nettoye;
  }

  /** Point du plan reçu (coordonnées du fichier) ↔ point MN95. */
  const versMn95 = (xy) => appliquerSimilitude(etat.resultat.similitude, xy);
  const versPlanRecu = (xy) => appliquerSimilitude(inverserSimilitude(etat.resultat.similitude), xy);

  function marquesNettoyer() {
    const zone = etat.dessinZone ?? etat.recette.zone;
    if (!zone?.length) return [];
    return [{ type: 'zone', xy: zone.flatMap((p) => versMn95(p)), couleur: '#ea580c', attente: Boolean(etat.dessinZone) }];
  }

  function monterNettoyer() {
    vues = [creerVueCalage(page.querySelector('[data-toile="nettoyer"]'), {
      plans: () => [refGrise(), ...(planNettoye().cale ? [planNettoye().cale] : [])],
      cadrage: () => [refGrise()],
      marques: marquesNettoyer,
      clic: clicNettoyer,
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

  function clicNettoyer(position, toleranceM) {
    const xy = versPlanRecu([position.est, position.nord]);
    if (etat.dessinZone) {
      const premier = etat.dessinZone[0];
      const tolPlan = toleranceM / etat.resultat.similitude.echelle;
      // Clic sur le premier sommet : la zone est fermée.
      if (etat.dessinZone.length >= 3 && Math.hypot(xy[0] - premier[0], xy[1] - premier[1]) <= tolPlan) finirZone();
      else {
        etat.dessinZone.push(xy);
        majNettoyer();
      }
      return;
    }
    const ecartes = new Set(etat.recette.ecartes);
    const visibles = { ...etat.lu, contenu: Object.fromEntries(Object.entries(etat.lu.contenu).map(([k, l]) => [k, Array.isArray(l) ? l.filter((o) => !ecartes.has(etat.lu.calques[o.c]?.nom)) : l])) };
    const c = calqueSousLePoint(visibles, xy[0], xy[1], toleranceM / etat.resultat.similitude.echelle);
    if (c < 0) return;
    etat.calqueChoisi = c;
    if (etat.ecarterAuClic) ecarterCalque(c);
    else majNettoyer();
    page.querySelector('.calque-calage.choisi')?.scrollIntoView({ block: 'nearest' });
  }

  function ecarterCalque(c) {
    const nom = etat.lu.calques[c]?.nom;
    if (nom === undefined || etat.recette.ecartes.includes(nom)) return;
    changerRecette((r) => r.ecartes.push(nom));
    message(`Calque « ${nom} » écarté`, 2000);
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
    const lignes = etat.lu.calques.map((c, i) => ({ c, i }))
      .filter(({ c }) => (!filtre || c.nom.toLowerCase().includes(filtre)) && (!etat.voirEcartes || ecartes.has(c.nom)));
    page.querySelector('[data-zone="titre-calques"]').textContent = `Calques (${etat.lu.calques.length})`;
    page.querySelector('[data-zone="calques"]').innerHTML = lignes.map(({ c, i }) => `
      <div class="calque-calage ${ecartes.has(c.nom) ? 'ecarte' : ''} ${i === etat.calqueChoisi ? 'choisi' : ''}" data-calque="${i}">
        <input type="checkbox" data-garder="${i}" ${ecartes.has(c.nom) ? '' : 'checked'}>
        <input type="color" class="couleur-calque" data-couleur="${i}" value="${echapper(r.couleurs[c.nom] ?? c.couleur ?? '#000000')}" title="Couleur du calque" aria-label="Couleur du calque ${echapper(c.nom)}">
        <span class="nom-calque">${echapper(c.nom)}${c.visible === false ? ' <span class="badge-calque">gelé / éteint</span>' : ''}</span>
        <span class="aide-calage chiffre">${comptes[i]}</span>
      </div>`).join('') || '<p class="aide-calage">Aucun calque.</p>';
    page.querySelector('[data-zone="voir-ecartes"]').textContent = etat.voirEcartes ? 'Voir tous les calques' : `Voir les écartés (${r.ecartes.length})`;
    page.querySelector('[data-action="annuler-nettoyage"]').disabled = etat.avant.length === 0;
    page.querySelectorAll('[data-hachures]').forEach((b) => b.classList.toggle('actif', b.dataset.hachures === r.hachures));
    page.querySelectorAll('[data-type]').forEach((b) => { b.checked = Boolean(r.types[b.dataset.type]); });
    page.querySelector('[data-zone="boutons-zone"]').innerHTML = etat.dessinZone
      ? `<button type="button" class="bouton petit" data-action="finir-zone">✓ Fermer la zone (${etat.dessinZone.length} sommets)</button><button type="button" class="lien-calage" data-action="abandonner-zone">abandonner</button>`
      : `<button type="button" class="bouton-secondaire petit" data-action="dessiner-zone">✎ ${r.zone ? 'Redessiner' : 'Dessiner'} la zone</button>${r.zone ? '<button type="button" class="lien-calage" data-action="effacer-zone">effacer</button>' : ''}`;
    const { plan } = planNettoye();
    page.querySelector('[data-zone="compteur"]').innerHTML = etat.dessinZone
      ? 'Cliquez les sommets de la zone ; cliquez le premier sommet (ou « Fermer la zone ») pour finir.'
      : `<strong class="chiffre">${plan.compte.objets}</strong> objets gardés sur <span class="chiffre">${etat.lu.compte.objets}</span> · clic sur un objet = ${etat.ecarterAuClic ? 'écarter' : 'choisir'} son calque · Suppr = écarter le calque choisi`;
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
    if (r.verdict !== 'juste') {
      const choix = await demanderChoix({
        titre: r.verdict === 'a-revoir' ? 'Vérification à revoir (2 à 4 mm)' : 'Pas de vérification',
        texte: r.message,
        boutons: [{ cle: 'non', texte: 'Revenir au calage', principal: true }, { cle: 'oui', texte: 'Continuer quand même' }],
      });
      if (choix !== 'oui') return;
    }
    if (!etat.recette) {
      const base = etat.fichier.replace(/\.[^.]+$/, '');
      etat.recette = recetteDeDepart(etat.lu, `${/\.dwg$/i.test(etat.fichier) ? 'DWG' : 'DXF'}_${base} - `);
      etat.avant = [];
    }
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
      if (cote === 'plan') marques.push({ type: etat.enCours.type, xy: etat.enCours.plan, texte, couleur, attente: true });
      // Calage déjà connu : où l'élément devrait tomber sur la référence (aide au clic).
      if (cote === 'ref' && etat.resultat) {
        const s = etat.resultat.similitude;
        const pl = etat.enCours.plan;
        const xy = pl.length === 2 ? appliquerSimilitude(s, pl) : [...appliquerSimilitude(s, pl.slice(0, 2)), ...appliquerSimilitude(s, pl.slice(2))];
        marques.push({ type: etat.enCours.type, xy, texte: `${texte} ?`, couleur, attente: true });
      }
    }
    return marques;
  }

  /** Accroche sous la souris dans un plan : { est, nord } (point) ou { segment } (axe), ou null. */
  function accrocheDans(plans, position, tolerance) {
    const sources = sourcesDesPlans(plans, position, tolerance);
    if (etat.type === 'axe') {
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
    const a = accrocheDans([etat.lu], position, tolerance);
    if (!a) {
      message(etat.type === 'axe' ? 'Pas de trait ici : cliquez sur une ligne.' : `Rien à accrocher ici (${ACCROCHES.find(([v]) => v === etat.accroche)[2]}).`, 2500);
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
    const a = accrocheDans([referenceAffichee()], position, tolerance);
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

  function recalculer() {
    etat.resultat = null;
    etat.erreur = '';
    if (!etat.elements.some((e) => e.role === 'calage')) return;
    try {
      etat.resultat = caler(etat.elements);
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
        survol: (p, t) => (etat.enCours ? accrocheDans([referenceAffichee()], p, t) : null),
        clic: clicRef,
      }),
      creerVueCalage(toile('cale'), {
        plans: () => [refGrise(), ...(planCaleProvisoire() ? [planCaleProvisoire()] : [])],
        cadrage: () => [refGrise()], // cadré sur la référence (le plan reçu a souvent des objets égarés loin)
        marques: () => marquesDe('ref').filter((m) => !m.attente),
      }),
    ];
    majCaler();
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
    page.querySelectorAll('[data-outil="accroche"]').forEach((b) => { b.disabled = etat.type === 'axe'; });
    const noms = etiquettes(etat.elements);
    const prochain = etiquettes([...etat.elements, { type: etat.type, role: etat.role }]).at(-1);
    page.querySelector('[data-zone="consigne"]').textContent = etat.enCours
      ? `${etiquettes([...etat.elements, etat.enCours]).at(-1)} : cliquez le même ${etat.enCours.type === 'axe' ? 'trait' : 'point'} sur la référence MN95${etat.resultat ? ' (marque « ? » = où il devrait être)' : ''}.`
      : `${prochain} : cliquez ${etat.type === 'axe' ? 'un trait (axe)' : 'un point'} sur le plan reçu, puis le même sur la référence.`;
    const compte = (f) => etat.elements.filter(f).length;
    page.querySelector('[data-zone="titre-elements"]').textContent = `Éléments (${compte((e) => e.role === 'calage' && e.type === 'point')} points + ${compte((e) => e.role === 'calage' && e.type === 'axe')} axes de calage, ${compte((e) => e.role === 'verification')} vérification)`;
    const evalues = etat.resultat?.elements;
    page.querySelector('[data-zone="elements"]').innerHTML = etat.elements.length ? etat.elements.map((e, i) => {
      const ev = evalues?.[i];
      const ecart = ev ? `<span class="chiffre" style="color:${couleurEcart(ev.ecartM)}">${mm(ev.ecartM)}${ev.ecartAngleDeg !== undefined ? ` · ${nombre(ev.ecartAngleDeg, 3)}°` : ''}</span>` : '<span class="aide-calage">—</span>';
      return `<li><span class="etiquette-calage" style="background:${e.role === 'verification' ? COULEUR_VERIF : COULEUR_CALAGE}">${noms[i]}</span><span>${e.type === 'axe' ? 'Axe' : 'Point'} · ${e.role === 'verification' ? 'vérification' : 'calage'}</span>${ecart}<button type="button" class="suppr-calage" data-retirer="${i}" aria-label="Retirer ${noms[i]}">✕</button></li>`;
    }).join('') : '<li class="aide-calage">Aucun élément : 2 points de calage + 1 point de vérification suffisent.</li>';
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
        </dl>
        <div class="verdict-calage"><span class="pastille-calage ${classe}">${texte}</span><span>${echapper(r.message)}</span></div>`;
    }
    const bouton = page.querySelector('[data-action="vers-nettoyer"]');
    bouton.setAttribute('aria-disabled', String(!r || r.verdict === 'faux'));
    vues.forEach((v) => v.redessiner());
  }

  // --- Actions ---

  async function lireFichier(fichier) {
    etat.lecture = `Lecture de « ${fichier.name} »…`;
    dessiner();
    await new Promise((fin) => setTimeout(fin, 30));
    try {
      const { plan, erreur } = lirePlanDxf(texteDuDxf(new Uint8Array(await fichier.arrayBuffer())), fichier.name);
      if (erreur || !plan.bornes) throw new Error(erreur ?? 'aucun objet dessiné trouvé');
      Object.assign(etat, { lu: plan, fichier: fichier.name, nom: fichier.name.replace(/\.dxf$/i, ''), lecture: '', elements: [], enCours: null, resultat: null, erreur: '', recette: null, avant: [], dessinZone: null, calqueChoisi: -1 });
    } catch (erreur) {
      etat.lecture = `Plan illisible : ${erreur.message}`;
    }
    dessiner();
  }

  function enregistrer() {
    const { plan: propre } = planNettoye();
    if (!propre.compte.objets) {
      message('Rien à garder : tous les objets sont écartés (calques, types ou zone).', 4000);
      return;
    }
    const plan = planCale({ lu: propre, nom: etat.nom.trim(), fichier: etat.fichier, resultat: etat.resultat, reference: reference(), elements: etat.elements, le: new Date().toISOString(), nettoyage: etat.recette });
    const range = ajouterPlan(plan);
    if (!range) return;
    etat.enregistre = range;
    message(`Plan « ${etat.enregistre.nom} » calé et rangé dans le projet`, 4000, { ok: true });
    etape = 'fin';
    dessiner();
  }

  function nouveau() {
    Object.assign(etat, { lu: null, fichier: '', nom: '', lecture: '', elements: [], enCours: null, resultat: null, erreur: '', enregistre: null, recette: null, avant: [], dessinZone: null, calqueChoisi: -1 });
    if (!plansDeReference(projet.plansDxf).some((p) => p.id === etat.referenceId)) etat.referenceId = plansDeReference(projet.plansDxf)[0]?.id ?? '';
    etape = 'plan';
    dessiner();
  }

  page.addEventListener('click', (ev) => {
    // Nettoyer : toucher une ligne de calque (hors case et couleur) = le choisir (Suppr l'écarte).
    const ligne = ev.target.closest('[data-calque]');
    if (ligne && !ev.target.matches('input')) {
      etat.calqueChoisi = Number(ligne.dataset.calque);
      majNettoyer();
      return;
    }
    const cible = ev.target.closest('button');
    if (!cible) return;
    const { action, aller, outil, valeur, zoom, retirer, hachures } = cible.dataset;
    if (action === 'retour') fermer();
    else if (action === 'vers-nettoyer') allerNettoyer();
    else if (hachures) changerRecette((r) => { r.hachures = hachures; });
    else if (action === 'tout-garder') changerRecette((r) => { r.ecartes = []; });
    else if (action === 'tout-ecarter') changerRecette((r) => { r.ecartes = etat.lu.calques.map((c) => c.nom); });
    else if (action === 'voir-ecartes') {
      etat.voirEcartes = !etat.voirEcartes;
      majNettoyer();
    } else if (action === 'annuler-nettoyage') {
      if (!etat.avant.length) return;
      etat.recette = JSON.parse(etat.avant.pop());
      majNettoyer();
    } else if (action === 'dessiner-zone') {
      etat.dessinZone = [];
      majNettoyer();
    } else if (action === 'finir-zone') finirZone();
    else if (action === 'abandonner-zone') {
      etat.dessinZone = null;
      majNettoyer();
    } else if (action === 'effacer-zone') changerRecette((r) => { r.zone = null; });
    else if (action === 'nouveau') nouveau();
    else if (aller) {
      // Retour à la liste après un enregistrement : on repart de zéro (pas deux fois le même plan).
      if (aller === 'liste' && etat.enregistre) Object.assign(etat, { lu: null, fichier: '', nom: '', elements: [], enCours: null, resultat: null, erreur: '', enregistre: null, recette: null, avant: [], dessinZone: null });
      if (aller === 'nettoyer') {
        allerNettoyer();
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
      else {
        etat[outil] = valeur;
        // Changer de genre d'élément abandonne celui commencé.
        if (outil === 'type' && etat.enCours && etat.enCours.type !== valeur) etat.enCours = null;
        if (outil === 'role' && etat.enCours) etat.enCours.role = valeur;
        majCaler();
      }
    } else if (zoom && etape === 'nettoyer') {
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
      if (etat.enCours) etat.enCours = null;
      else etat.elements.pop();
      recalculer();
      majCaler();
    } else if (action === 'tout-effacer') {
      if (etat.elements.length && !window.confirm('Effacer tous les éléments cliqués ?')) return;
      etat.elements = [];
      etat.enCours = null;
      recalculer();
      majCaler();
    } else if (action === 'enregistrer') enregistrer();
  });
  page.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.action === 'fichier' && t.files?.[0]) lireFichier(t.files[0]);
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
    else if (t.dataset.champ === 'ecarter-au-clic') {
      etat.ecarterAuClic = t.checked;
      majNettoyer();
    } else if (t.dataset.champ === 'prefixe') changerRecette((r) => { r.prefixe = t.value; });
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
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && etat.calqueChoisi >= 0) {
        ev.preventDefault();
        ecarterCalque(etat.calqueChoisi);
      } else if (ev.key === 'Escape' && etat.dessinZone) {
        ev.preventDefault();
        ev.stopPropagation();
        etat.dessinZone = null;
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

  dessiner();
  return { fermer };
}
