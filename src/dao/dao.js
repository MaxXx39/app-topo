// DAO, étape 1 (0.147.0, Expert, Calculs › Dessin › « DAO ») : une barre posée sur le plan choisit
// l'outil (ligne, polyligne, rectangle, cercle, arc 3 points, point, texte), l'accroche (Libre =
// l'endroit touché, Point, Sommet, Milieu, Sur ligne, Centre) et le calque ; chaque toucher du plan
// ajoute un point à l'objet en cours ; il est rangé quand il a ses points (polyligne : « Terminer »).
// Calculs dans topo/dao.js ; le dessin est un plan du projet (projet.plansDxf, champ `dao`).
import { echapper } from '../outils/echapper.js';
import { OUTILS_DAO, COULEURS_CALQUES_DAO, pointsDeLOutil, creerPlanDao, refaireContenuDao } from '../topo/dao.js';

const ACCROCHES_DAO = [['libre', 'Libre'], ['point', 'Point'], ['sommet', 'Sommet'], ['milieu', 'Milieu'], ['ligne', 'Sur ligne'], ['centre', 'Centre']];

/**
 * Crée la DAO. d : { cadre (élément du plan où poser la barre), projet() (projet ouvert),
 * nouvelId(), accrocher(mode, position, tolerance) → point { est, nord, altitude } ou null,
 * demanderTexte({ titre, valeur }), demanderChamps({ titre, champs }), message(texte, duree), redessiner() (sans enregistrer),
 * enregistrer() (modifié : enregistrer et redessiner), lectureSeule() (vrai = refusé) }.
 * Renvoie { actif(), commencer(), arreter(), toucher(position, tolerance), dernierPoint() }.
 */
export function creerDao(d) {
  const etat = { actif: false, outil: 'ligne', accroche: 'libre', calque: 0, enCours: null, hauteurTexte: 1 };
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
    refaireContenuDao(plan, etat.enCours?.points.length ? { ...etat.enCours, calque: etat.calque } : null);
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
    const consigne = etat.outil === 'polyligne'
      ? (enCours === 0 ? 'Touche le 1er point' : `${enCours} point(s) : touche le suivant, puis « Terminer »`)
      : `Touche le point ${enCours + 1} / ${voulu}`;
    barre.innerHTML = `<div class="ligne-barre-pointage">
        <strong class="titre-ajout">DAO</strong>
        ${OUTILS_DAO.map(([cle, titre]) => `<button type="button" class="puce-choix ${etat.outil === cle ? 'actif' : ''}" data-dao="outil" data-valeur="${cle}">${titre}</button>`).join('')}
        <button type="button" class="bouton" data-dao="fin">Terminé</button>
      </div>
      <div class="ligne-barre-pointage">
        ${ACCROCHES_DAO.map(([cle, titre]) => `<button type="button" class="puce-choix petite ${etat.accroche === cle ? 'actif' : ''}" data-dao="accroche" data-valeur="${cle}">${titre}</button>`).join('')}
        <label class="calque-dao">Calque <select data-dao="calque">${calques.map((c, i) => `<option value="${i}" ${i === etat.calque ? 'selected' : ''}>${echapper(c.nom)}</option>`).join('')}</select></label>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-dao="calque-plus">+ calque</button>
      </div>
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
    } else if (action === 'effacer-dernier' && plan) {
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
    const point = etat.accroche === 'libre'
      ? { est: position.est, nord: position.nord, altitude: null }
      : d.accrocher(etat.accroche, position, tolerance);
    if (!point) {
      d.message('Rien à accrocher sous le doigt (choisis « Libre » pour l\'endroit touché)', 3000);
      return;
    }
    const mm = (v) => Math.round(v * 1000) / 1000;
    const p = { est: mm(point.est), nord: mm(point.nord), altitude: point.altitude != null ? mm(point.altitude) : null };
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
    if (etat.enCours && plan) {
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
    dernierPoint: () => etat.enCours?.points.at(-1) ?? null,
  };
}
