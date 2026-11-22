// Application « Calage de plans » (0.278.0, Expert, site PC et Topo Bureau ; décisions du 22.11) : caler un plan
// reçu (architecte, ingénieur : ses unités, sa rotation, son origine) sur un plan MN95 du projet ouvert, en cliquant
// des éléments homologues sur les deux plans. Page plein écran à part (comme Matériel) :
//  Liste (plans calés du projet) → 1 Le plan (fichier reçu, référence) → 2 Caler (outils en haut, deux vues de même
//  taille, éléments et résultat en bas) → Terminé (le plan calé est un plan du projet).
// Calculs : topo/calage-plan.js (caler) ; rangement : calage/plans.js. Le nettoyage (zone, calques) viendra ensuite.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { demanderChoix } from '../outils/choix.js';
import { lirePlanDxf, texteDuDxf, estEnMn95 } from '../topo/dxf-plan.js';
import { planRecale } from '../topo/recalage.js';
import { accrocher, accrocherTrait, sourcesDesPlans } from '../topo/accroche.js';
import { caler, ErreurCalage, appliquerSimilitude, versHelmert, SEUIL_JUSTE_M, SEUIL_A_REVOIR_M } from '../topo/calage-plan.js';
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
    const etapes = [['plan', '1 Le plan'], ['caler', '2 Caler'], ['fin', '3 Terminé']];
    page.innerHTML = `
      <header class="entete-calage">
        <button type="button" class="retour-reglages" data-action="retour" aria-label="Retour aux applications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        <h2>Calage de plans ${bulle('calage')}</h2>
        <nav class="etapes-calage" aria-label="Étapes">
          <button type="button" data-aller="liste" class="${etape === 'liste' ? 'actif' : ''}">Plans calés</button>
          ${etapes.map(([cle, titre]) => `<button type="button" data-aller="${cle}" class="${etape === cle ? 'actif' : ''}" ${accessible(cle) ? '' : 'disabled'}>${titre}</button>`).join('')}
        </nav>
      </header>
      <main class="contenu-calage ${etape === 'caler' ? 'en-calage' : ''}">${{ liste: htmlListe, plan: htmlPlan, caler: htmlCaler, fin: htmlFin }[etape]()}</main>`;
    if (etape === 'caler') monterVues();
  }

  function accessible(cle) {
    if (cle === 'plan') return etat.enregistre === null;
    if (cle === 'caler') return Boolean(etat.lu && reference()) && etat.enregistre === null;
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
      <div class="pied-calage"><button type="button" class="bouton-secondaire" data-aller="plan">← Le plan</button><button type="button" class="bouton" data-action="enregistrer">Enregistrer le plan calé</button></div>`;
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
    const bouton = page.querySelector('[data-action="enregistrer"]');
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
      Object.assign(etat, { lu: plan, fichier: fichier.name, nom: fichier.name.replace(/\.dxf$/i, ''), lecture: '', elements: [], enCours: null, resultat: null, erreur: '' });
    } catch (erreur) {
      etat.lecture = `Plan illisible : ${erreur.message}`;
    }
    dessiner();
  }

  async function enregistrer() {
    const r = etat.resultat;
    if (!r) {
      message(etat.erreur || 'Pas encore de calage : cliquez au moins 2 éléments de calage.', 4000);
      return;
    }
    if (r.verdict === 'faux') {
      message('Le calage est faux (vérification à plus de 4 mm) : corrigez les éléments avant d\'enregistrer.', 5000);
      return;
    }
    if (r.verdict !== 'juste') {
      const choix = await demanderChoix({
        titre: r.verdict === 'a-revoir' ? 'Vérification à revoir (2 à 4 mm)' : 'Pas de vérification',
        texte: r.message,
        boutons: [{ cle: 'non', texte: 'Revenir au calage', principal: true }, { cle: 'oui', texte: 'Enregistrer quand même' }],
      });
      if (choix !== 'oui') return;
    }
    const plan = planCale({ lu: etat.lu, nom: etat.nom.trim(), fichier: etat.fichier, resultat: r, reference: reference(), elements: etat.elements, le: new Date().toISOString() });
    const range = ajouterPlan(plan);
    if (!range) return;
    etat.enregistre = range;
    message(`Plan « ${etat.enregistre.nom} » calé et rangé dans le projet`, 4000, { ok: true });
    etape = 'fin';
    dessiner();
  }

  function nouveau() {
    Object.assign(etat, { lu: null, fichier: '', nom: '', lecture: '', elements: [], enCours: null, resultat: null, erreur: '', enregistre: null });
    if (!plansDeReference(projet.plansDxf).some((p) => p.id === etat.referenceId)) etat.referenceId = plansDeReference(projet.plansDxf)[0]?.id ?? '';
    etape = 'plan';
    dessiner();
  }

  page.addEventListener('click', (ev) => {
    const cible = ev.target.closest('button');
    if (!cible) return;
    const { action, aller, outil, valeur, zoom, retirer } = cible.dataset;
    if (action === 'retour') fermer();
    else if (action === 'nouveau') nouveau();
    else if (aller) {
      // Retour à la liste après un enregistrement : on repart de zéro (pas deux fois le même plan).
      if (aller === 'liste' && etat.enregistre) Object.assign(etat, { lu: null, fichier: '', nom: '', elements: [], enCours: null, resultat: null, erreur: '', enregistre: null });
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
      dessiner();
    }
  });
  page.addEventListener('input', (ev) => {
    if (ev.target.dataset.champ === 'nom') etat.nom = ev.target.value;
  });
  // Échap abandonne l'élément commencé (sinon : retour, voir « cancel »).
  page.addEventListener('keydown', (ev) => {
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
