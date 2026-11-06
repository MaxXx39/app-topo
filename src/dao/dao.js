// DAO, étape 1 (0.147.0, Expert, Calculs › Dessin › « DAO ») : une barre posée sur le plan choisit
// l'outil (ligne, polyligne, rectangle, cercle, arc 3 points, point, texte), l'accroche (Libre =
// l'endroit touché, Point, Sommet, Milieu, Sur ligne, Centre) et le calque ; chaque toucher du plan
// ajoute un point à l'objet en cours ; il est rangé quand il a ses points (polyligne : « Terminer »).
// Calculs dans topo/dao.js ; le dessin est un plan du projet (projet.plansDxf, champ `dao`).
import { echapper } from '../outils/echapper.js';
import { OUTILS_DAO, COULEURS_CALQUES_DAO, pointsDeLOutil, creerPlanDao, refaireContenuDao, objetSousLeDoigt, transformerObjet, translation, rotation, miroir, decalerObjet, prolongerJusqua, traceObjet } from '../topo/dao.js';

// Étape 2 (0.148.0) : actions sur les objets choisis (outil « Sélection ») et leurs consignes.
const ACTIONS_DAO = [
  ['deplacer', 'Déplacer', ['Touche le point de départ', 'Touche le point d\'arrivée']],
  ['copier', 'Copier', ['Touche le point de départ', 'Touche le point d\'arrivée']],
  ['rotation', 'Rotation', ['Touche le centre de la rotation']],
  ['miroir', 'Miroir', ['Touche le 1er point de l\'axe', 'Touche le 2e point de l\'axe']],
  ['decaler', 'Décaler', []],
  ['prolonger', 'Prolonger / couper', ['Touche la limite (ligne, cercle, trait d\'un plan)']],
];
const ACCROCHES_DAO = [['libre', 'Libre'], ['point', 'Point'], ['sommet', 'Sommet'], ['milieu', 'Milieu'], ['ligne', 'Sur ligne'], ['centre', 'Centre']];

/**
 * Crée la DAO. d : { cadre (élément du plan où poser la barre), projet() (projet ouvert),
 * nouvelId(), accrocher(mode, position, tolerance) → point { est, nord, altitude } ou null,
 * demanderTexte({ titre, valeur }), demanderChamps({ titre, champs }), confirmer(texte),
 * traitSous(position, tolerance) → points d'un trait de plan sous le doigt, ou null, message(texte, duree), redessiner() (sans enregistrer),
 * enregistrer() (modifié : enregistrer et redessiner), lectureSeule() (vrai = refusé) }.
 * Renvoie { actif(), commencer(), arreter(), toucher(position, tolerance), dernierPoint() }.
 */
export function creerDao(d) {
  const etat = { actif: false, outil: 'ligne', accroche: 'libre', calque: 0, enCours: null, hauteurTexte: 1, selection: new Set(), action: null };
  let barre = null;

  const planDao = () => (d.projet().plansDxf ?? []).find((p) => p.dao);

  /** Le plan DAO du projet, créé autour de "depart" s'il n'existe pas encore. */
  function planOuNouveau(depart) {
    let plan = planDao();
    if (!plan) {
      plan = creerPlanDao(d.nouvelId(), depart);
      d.projet().plansDxf.push(plan);
    }
    return plan;
  }

  /** Refait le contenu (avec l'objet en cours, pour le voir) et change la révision (le plan se redessine). */
  function refaire(plan) {
    refaireContenuDao(plan, etat.enCours?.points.length ? { ...etat.enCours, calque: etat.calque } : null, etat.selection);
    plan.revision = (plan.revision ?? 0) + 1;
  }

  function dessinerBarre() {
    if (!barre) {
      barre = document.createElement('div');
      barre.className = 'barre-pointage barre-dao';
      barre.addEventListener('click', (evenement) => {
        const bouton = evenement.target.closest('button[data-dao]');
        if (bouton) actionBarre(bouton.dataset.dao, bouton.dataset.valeur);
      });
      barre.addEventListener('change', (evenement) => {
        if (evenement.target.dataset.dao === 'calque') {
          etat.calque = Number(evenement.target.value);
          dessinerBarre();
        }
      });
      d.cadre().append(barre);
    }
    const plan = planDao();
    const calques = plan?.calques ?? [{ nom: 'DAO', couleur: COULEURS_CALQUES_DAO[0] }];
    const enCours = etat.enCours?.points.length ?? 0;
    const voulu = pointsDeLOutil(etat.outil);
    const enSelection = etat.outil === 'selection';
    const nbChoisis = etat.selection.size;
    const etapeAction = etat.action ? ACTIONS_DAO.find(([cle]) => cle === etat.action.sorte)?.[2][etat.action.points.length] : null;
    const consigne = etapeAction ?? (enSelection ? (nbChoisis ? `${nbChoisis} objet(s) choisi(s) : touche-en d'autres, ou une action` : 'Touche un objet pour le choisir (encore une fois : le retirer)') : null) ?? (etat.outil === 'polyligne'
      ? (enCours === 0 ? 'Touche le 1er point' : `${enCours} point(s) : touche le suivant, puis « Terminer »`)
      : `Touche le point ${enCours + 1} / ${voulu}`);
    const unSeulTrait = nbChoisis === 1 && ['ligne', 'polyligne'].includes(plan?.dao.objets[[...etat.selection][0]]?.sorte);
    const actions = enSelection && nbChoisis > 0
      ? `<div class="ligne-barre-pointage actions-dao">
          ${ACTIONS_DAO.filter(([cle]) => cle !== 'prolonger' || unSeulTrait).map(([cle, titre]) => `<button type="button" class="puce-choix petite ${etat.action?.sorte === cle ? 'actif' : ''}" data-dao="action" data-valeur="${cle}">${titre}</button>`).join('')}
          <button type="button" class="puce-choix petite effacer-dao" data-dao="effacer-choix">Effacer</button>
          <button type="button" class="bouton-lien bouton-lien-neutre" data-dao="deselectionner">tout retirer</button>
        </div>`
      : '';
    barre.innerHTML = `<div class="ligne-barre-pointage">
        <strong class="titre-ajout">DAO</strong>
        <button type="button" class="puce-choix ${enSelection ? 'actif' : ''}" data-dao="outil" data-valeur="selection">Sélection</button>
        ${OUTILS_DAO.map(([cle, titre]) => `<button type="button" class="puce-choix ${etat.outil === cle ? 'actif' : ''}" data-dao="outil" data-valeur="${cle}">${titre}</button>`).join('')}
        <button type="button" class="bouton" data-dao="fin">Terminé</button>
      </div>
      <div class="ligne-barre-pointage">
        ${ACCROCHES_DAO.map(([cle, titre]) => `<button type="button" class="puce-choix petite ${etat.accroche === cle ? 'actif' : ''}" data-dao="accroche" data-valeur="${cle}">${titre}</button>`).join('')}
        <label class="calque-dao">Calque <select data-dao="calque">${calques.map((c, i) => `<option value="${i}" ${i === etat.calque ? 'selected' : ''}>${echapper(c.nom)}</option>`).join('')}</select></label>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-dao="calque-plus">+ calque</button>
      </div>
      ${actions}
      <div class="ligne-barre-pointage">
        <span class="aide-pointage">${echapper(consigne)}</span>
        ${etat.outil === 'polyligne' && enCours >= 2 ? '<button type="button" class="bouton-secondaire" data-dao="terminer">Terminer</button><button type="button" class="bouton-secondaire" data-dao="fermer">Fermer</button>' : ''}
        ${enCours > 0 ? '<button type="button" class="bouton-lien bouton-lien-neutre" data-dao="oublier">annuler l\'objet</button>' : ''}
        ${plan?.dao.objets.length ? '<button type="button" class="bouton-lien" data-dao="effacer-dernier">↶ effacer le dernier objet</button>' : ''}
      </div>`;
  }

  async function actionBarre(action, valeur) {
    const plan = planDao();
    if (action === 'outil') {
      etat.outil = valeur;
      etat.enCours = null;
      etat.action = null;
      if (valeur !== 'selection') etat.selection.clear();
      if (plan) refaire(plan);
      d.redessiner();
    } else if (action === 'accroche') etat.accroche = valeur;
    else if (action === 'fin') {
      arreter();
      return;
    } else if (action === 'oublier') {
      etat.enCours = null;
      if (plan) refaire(plan);
      d.redessiner();
    } else if (action === 'terminer' || action === 'fermer') {
      if (etat.enCours) etat.enCours.ferme = action === 'fermer';
      ranger();
    } else if (action === 'action' && plan) {
      etat.action = etat.action?.sorte === valeur ? null : { sorte: valeur, points: [] };
      if (valeur === 'decaler') {
        etat.action = null;
        await decaler(plan);
      }
    } else if (action === 'deselectionner') {
      etat.selection.clear();
      etat.action = null;
      if (plan) refaire(plan);
      d.redessiner();
    } else if (action === 'effacer-choix' && plan) {
      if (d.lectureSeule() || !d.confirmer(`Effacer ${etat.selection.size} objet(s) ?`)) return;
      plan.dao.objets = plan.dao.objets.filter((_, i) => !etat.selection.has(i));
      etat.selection.clear();
      etat.action = null;
      refaire(plan);
      d.enregistrer();
    } else if (action === 'effacer-dernier' && plan) {
      etat.selection.clear();
      if (d.lectureSeule()) return;
      plan.dao.objets.pop();
      etat.enCours = null;
      refaire(plan);
      d.enregistrer();
    } else if (action === 'calque-plus') {
      if (d.lectureSeule()) return;
      const nom = await d.demanderTexte({ titre: 'Nom du nouveau calque', valeur: '' });
      if (!nom?.trim()) return;
      const leplan = plan ?? null;
      if (!leplan) {
        d.message('Dessine d\'abord un objet : le calque sera ajouté au dessin', 3500);
        return;
      }
      leplan.calques.push({ nom: nom.trim(), couleur: COULEURS_CALQUES_DAO[leplan.calques.length % COULEURS_CALQUES_DAO.length], visible: true });
      etat.calque = leplan.calques.length - 1;
      refaire(leplan);
      d.enregistrer();
    }
    dessinerBarre();
  }

  /** Objets choisis, transformés par "f" ; "copie" : les originaux restent, les copies deviennent la sélection. */
  function appliquer(plan, f, copie = false) {
    const choisis = [...etat.selection].sort((a, b) => a - b);
    if (copie) {
      const debut = plan.dao.objets.length;
      choisis.forEach((i) => plan.dao.objets.push(transformerObjet(plan.dao.objets[i], f)));
      etat.selection = new Set(choisis.map((_, n) => debut + n));
    } else choisis.forEach((i) => { plan.dao.objets[i] = transformerObjet(plan.dao.objets[i], f); });
    etat.action = null;
    refaire(plan);
    d.enregistrer();
  }

  /** Décaler (copie parallèle) : distance et côté demandés ; les copies deviennent la sélection. */
  async function decaler(plan) {
    const choix = await d.demanderChamps({ titre: 'Décaler', champs: [
      { cle: 'distance', titre: 'Distance (m)', valeur: '1.000' },
      { cle: 'cote', titre: 'Côté', choix: [['droite', 'À droite (cercle, arc : plus grand)'], ['gauche', 'À gauche (cercle, arc : plus petit)']], valeur: 'droite' },
    ] });
    if (!choix) return;
    const distance = Math.abs(Number(String(choix.distance).replace(',', '.')));
    if (!Number.isFinite(distance) || distance === 0) {
      d.message('Distance illisible : un nombre de mètres, par exemple 1.500', 3500);
      return;
    }
    const signe = choix.cote === 'gauche' ? -1 : 1;
    const copies = [...etat.selection].map((i) => decalerObjet(plan.dao.objets[i], signe * distance)).filter(Boolean);
    if (copies.length === 0) {
      d.message('Rien à décaler (point et texte ne se décalent pas)', 3500);
      return;
    }
    const debut = plan.dao.objets.length;
    plan.dao.objets.push(...copies);
    etat.selection = new Set(copies.map((_, n) => debut + n));
    refaire(plan);
    d.enregistrer();
    dessinerBarre();
  }

  /** Un point de plus pour l'action en cours ; quand elle a ses points, elle est faite. */
  async function pointPourAction(plan, p, position, tolerance) {
    const action = etat.action;
    action.points.push(p);
    const [a, b] = action.points;
    if ((action.sorte === 'deplacer' || action.sorte === 'copier') && b) appliquer(plan, translation(a, b), action.sorte === 'copier');
    else if (action.sorte === 'miroir' && b) appliquer(plan, miroir(a, b));
    else if (action.sorte === 'rotation') {
      const choix = await d.demanderChamps({ titre: 'Rotation', champs: [
        { cle: 'angle', titre: 'Angle (degrés)', valeur: '90' },
        { cle: 'sens', titre: 'Sens', choix: [['horaire', 'Horaire (comme les aiguilles d\'une montre)'], ['inverse', 'Inverse']], valeur: 'horaire' },
      ] });
      const angle = Number(String(choix?.angle ?? '').replace(',', '.'));
      if (!choix || !Number.isFinite(angle)) {
        etat.action = null;
        if (choix) d.message('Angle illisible : un nombre de degrés, par exemple 90', 3500);
      } else appliquer(plan, rotation(a, angle, choix.sens !== 'inverse'));
    } else if (action.sorte === 'prolonger') {
      const index = [...etat.selection][0];
      const objet = plan.dao.objets[index];
      // Limite : un autre objet du dessin sous le doigt, sinon un trait d'un plan (DXF, PDF…).
      const autre = objetSousLeDoigt(plan.dao.objets.map((o, i) => (i === index ? { sorte: 'point', points: [{ est: Infinity, nord: Infinity }] } : o)), position, tolerance);
      const limite = autre >= 0 ? traceObjet(plan.dao.objets[autre]) : d.traitSous(position, tolerance);
      const nouveau = limite ? prolongerJusqua(objet, position, limite) : null;
      if (!nouveau) d.message(limite ? 'Pas de croisement avec cette limite dans le prolongement du bout' : 'Aucune limite sous le doigt', 3500);
      else {
        plan.dao.objets[index] = nouveau;
        refaire(plan);
        d.enregistrer();
      }
      etat.action = null;
    }
    dessinerBarre();
    d.redessiner();
  }

  /** Range l'objet en cours dans le dessin (et l'enregistre). */
  function ranger() {
    const plan = planDao();
    if (!plan || !etat.enCours) return;
    plan.dao.objets.push({ ...etat.enCours, calque: etat.calque });
    etat.enCours = null;
    refaire(plan);
    d.enregistrer();
    dessinerBarre();
  }

  /** Toucher du plan : un point de plus pour l'objet en cours. */
  async function toucher(position, tolerance) {
    if (d.lectureSeule()) return;
    const planActuel = planDao();
    // Sélection (0.148.0) : toucher un objet le choisit ou le retire (pas d'accroche).
    if (etat.outil === 'selection' && !etat.action) {
      if (!planActuel) return;
      const i = objetSousLeDoigt(planActuel.dao.objets, position, tolerance);
      if (i < 0) {
        d.message('Aucun objet du dessin sous le doigt', 2500);
        return;
      }
      if (etat.selection.has(i)) etat.selection.delete(i);
      else etat.selection.add(i);
      refaire(planActuel);
      d.redessiner();
      dessinerBarre();
      return;
    }
    const point = etat.accroche === 'libre'
      ? { est: position.est, nord: position.nord, altitude: null }
      : d.accrocher(etat.accroche, position, tolerance);
    if (!point) {
      d.message('Rien à accrocher sous le doigt (choisis « Libre » pour l\'endroit touché)', 3000);
      return;
    }
    const mm = (v) => Math.round(v * 1000) / 1000;
    const p = { est: mm(point.est), nord: mm(point.nord), altitude: point.altitude != null ? mm(point.altitude) : null };
    if (etat.action && planActuel) {
      await pointPourAction(planActuel, p, position, tolerance);
      return;
    }
    const plan = planOuNouveau(p);
    etat.enCours ??= { sorte: etat.outil, points: [] };
    etat.enCours.points.push(p);
    if (etat.outil === 'texte') {
      const choix = await d.demanderChamps({ titre: 'Texte', champs: [{ cle: 'texte', titre: 'Texte à écrire', valeur: '' }, { cle: 'hauteur', titre: 'Hauteur des lettres (m)', valeur: String(etat.hauteurTexte) }] });
      const texte = choix?.texte;
      const hauteur = Number(String(choix?.hauteur ?? '').replace(',', '.'));
      if (Number.isFinite(hauteur) && hauteur > 0 && hauteur <= 100) etat.hauteurTexte = hauteur;
      if (!texte?.trim()) {
        etat.enCours = null;
        refaire(plan);
        d.redessiner();
        dessinerBarre();
        return;
      }
      etat.enCours.texte = texte.trim();
      etat.enCours.hauteur = etat.hauteurTexte;
      ranger();
      return;
    }
    if (etat.enCours.points.length >= pointsDeLOutil(etat.outil)) {
      ranger();
      return;
    }
    refaire(plan);
    d.redessiner();
    dessinerBarre();
  }

  function commencer() {
    etat.actif = true;
    etat.enCours = null;
    dessinerBarre();
    barre.hidden = false;
    d.redessiner();
  }

  function arreter() {
    etat.actif = false;
    const plan = planDao();
    etat.selection.clear();
    etat.action = null;
    if (plan) {
      etat.enCours = null;
      refaire(plan);
    }
    if (barre) barre.hidden = true;
    d.redessiner();
  }

  return {
    actif: () => etat.actif,
    commencer,
    arreter,
    toucher,
    /** Dernier point touché de l'objet en cours (croix sur le plan), ou null. */
    dernierPoint: () => etat.enCours?.points.at(-1) ?? etat.action?.points.at(-1) ?? null,
  };
}
