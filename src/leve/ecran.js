// Bloc « Lever avec le récepteur » de l'onglet 1. Points (seulement dans l'appli Android) :
// connexion au récepteur Emlid, levé et stock en cours, rôle du prochain point (contour, ligne
// de rupture, point isolé), gros bouton PRENDRE LE POINT, annulation du dernier point.
// Aussi : les bandeaux « RTK » et « Inclinaison » sous l'en-tête, visibles dans tous les onglets.
//
// L'état du récepteur arrive 2 fois par seconde (mettreAJourRecepteur) : on ne change alors que
// quelques textes et l'état du bouton, sans redessiner le bloc (le doigt peut être dessus).
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { titreSection } from '../outils/section.js';
import { bulle } from '../aide/bulles.js';
import { ROLES_LEVE } from '../topo/leve-direct.js';

// Petit dessin de chaque rôle, comme dans 2.1 Surfaces (contour rouge, ligne orange, point vert).
const ICONES = {
  contour: '<path d="M4 8 11 3l9 5-2 11-13 1z" />',
  ligne: '<path d="M3 18l6-7 4 4 8-9" />',
  isole: '<circle cx="12" cy="12" r="4" />',
};

/**
 * Crée le bloc dans "conteneur". Les actions sont faites par main.js via "actions" :
 * choisirRecepteur(), reconnecter(), deconnecter(), nouveauLeve(), choisirLeve(id), nouveauStock(),
 * choisirStock(id), choisirRole(role), nouvelleLigne(), basculerFermeture(), prendrePoint(nom),
 * annulerDernierPoint(), voirSurPlan()
 * Renvoie { afficher(donnees), mettreAJourRecepteur(etat) }.
 */
export function creerEcranLeve(conteneur, actions) {
  let etat = null; // dernier état du récepteur (voir src/android/pont.js)
  let donnees = null;

  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton || bouton.disabled) return;
    const { action } = bouton.dataset;
    if (action === 'prendre') actions.prendrePoint(conteneur.querySelector('[data-champ="nom-point"]')?.value ?? '');
    else if (action === 'role') actions.choisirRole(bouton.dataset.role);
    else actions[action]?.();
  });

  conteneur.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'leve') actions.choisirLeve(cible.value);
    else if (cible.dataset.champ === 'stock') actions.choisirStock(cible.value);
  });

  // Touche Entrée dans le nom : prend le point (comme le bouton), si c'est permis.
  conteneur.addEventListener('keydown', (evenement) => {
    if (evenement.key !== 'Enter' || evenement.target.dataset.champ !== 'nom-point') return;
    evenement.preventDefault();
    const bouton = conteneur.querySelector('[data-action="prendre"]');
    if (bouton && !bouton.disabled) actions.prendrePoint(evenement.target.value);
  });

  /** Partie « récepteur » : connexion, position, bouton. Mise à jour sans redessiner le bloc. */
  function rafraichirVivant() {
    const connecte = Boolean(etat?.connecte);
    for (const element of conteneur.querySelectorAll('[data-si-connecte]')) element.hidden = !connecte;
    for (const element of conteneur.querySelectorAll('[data-si-deconnecte]')) element.hidden = connecte;
    const texte = conteneur.querySelector('[data-vivant="connexion"]');
    if (texte) texte.textContent = etat?.bluetooth ?? 'non connecté';
    const reconnecter = conteneur.querySelector('[data-action="reconnecter"]');
    if (reconnecter) {
      reconnecter.hidden = connecte || !etat?.dernierRecepteur;
      reconnecter.textContent = `Reconnecter ${etat?.dernierRecepteur ?? ''}`;
    }

    const position = conteneur.querySelector('[data-vivant="position"]');
    if (position) {
      const p = connecte && etat.recu ? etat.position : null;
      position.classList.toggle('pas-prete', !etat?.inclinaisonPrete);
      position.innerHTML = p
        ? `<span>E <strong>${formaterNombre(p.est)}</strong></span><span>N <strong>${formaterNombre(p.nord)}</strong></span><span>H <strong>${formaterNombre(p.altitude)}</strong></span>
           ${etat.inclinaisonPrete ? '' : '<span class="aide">antenne, pas le bout de canne</span>'}`
        : `<span class="aide">${connecte ? (etat.erreurConversion ? echapper(etat.erreurConversion) : 'En attente de la position…') : 'Récepteur non connecté'}</span>`;
    }

    const bouton = conteneur.querySelector('[data-action="prendre"]');
    const raison = conteneur.querySelector('[data-vivant="raison"]');
    const permis = connecte && Boolean(etat?.autorise) && Boolean(donnees?.stock);
    if (bouton) bouton.disabled = !permis;
    if (raison) {
      raison.textContent = permis || !connecte ? '' : etat?.raison ?? '';
      raison.hidden = permis || !connecte;
    }
  }

  /** Choix du rôle : 3 gros boutons à la couleur du rôle. */
  function boutonsRoles() {
    return `<div class="roles-leve" role="group" aria-label="Rôle du prochain point">
      ${ROLES_LEVE.map(
        ([cle, titre]) => `<button type="button" class="role-leve role-${cle} ${donnees.role === cle ? 'choisi' : ''}" data-action="role" data-role="${cle}" aria-pressed="${donnees.role === cle}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[cle]}</svg>${titre}</button>`,
      ).join('')}
    </div>`;
  }

  /** Ligne de rupture en cours : numéro, nombre de points, nouvelle ligne, fermer. */
  function outilsLigne() {
    if (donnees.role !== 'ligne') return '';
    const { ligne } = donnees;
    return `<div class="outils-ligne">
      <span>Ligne ${ligne.numero} · ${ligne.nbPoints} point(s)${ligne.fermee ? ' · <strong>fermée</strong>' : ''}</span>
      <div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="nouvelleLigne" ${ligne.nbPoints === 0 ? 'disabled' : ''}>+ Nouvelle ligne</button>
        <button type="button" class="bouton-secondaire ${ligne.fermee ? 'actif' : ''}" data-action="basculerFermeture" aria-pressed="${ligne.fermee}" ${ligne.nbPoints < 3 ? 'disabled' : ''}>
          ${ligne.fermee ? '✓ Ligne fermée' : 'Fermer la ligne'}</button>
      </div>
    </div>`;
  }

  /** Levé et stock en cours (listes de choix), ou bouton pour commencer. */
  function choixLeveEtStock() {
    if (!donnees.leve) {
      return `<p class="aide">Un levé garde les points pris avec le récepteur (comme un fichier importé) ; chaque stock y a son contour, ses lignes de rupture et ses points isolés.</p>
        <button type="button" class="bouton" data-action="nouveauLeve">+ Commencer un levé</button>`;
    }
    return `
      <label class="champ-leve">Levé
        <span class="ligne-outils">
          <select data-champ="leve">${donnees.leves.map((l) => `<option value="${l.id}" ${l.id === donnees.leve.id ? 'selected' : ''}>${echapper(l.nom)} (${l.points.length} pts)</option>`).join('')}</select>
          <button type="button" class="bouton-secondaire" data-action="nouveauLeve">+ Nouveau</button>
        </span>
      </label>
      <label class="champ-leve">Stock
        <span class="ligne-outils">
          ${donnees.stocks.length > 0
            ? `<select data-champ="stock">${donnees.stocks.map((s) => `<option value="${s.id}" ${s.id === donnees.stock?.id ? 'selected' : ''}>${echapper(s.nom)}</option>`).join('')}</select>`
            : '<span class="aide">aucun stock</span>'}
          <button type="button" class="bouton-secondaire" data-action="nouveauStock">+ Nouveau</button>
        </span>
      </label>`;
  }

  /** Prise de point : rôle, nom, position, bouton, annulation, état du stock. */
  function priseDePoint() {
    if (!donnees.stock) return '';
    const { resume } = donnees;
    return `
      ${boutonsRoles()}
      ${outilsLigne()}
      <label class="champ-leve">Nom du prochain point
        <input type="text" data-champ="nom-point" value="${echapper(donnees.nomPropose)}" autocomplete="off" autocapitalize="characters" />
      </label>
      <div class="position-leve" data-vivant="position"></div>
      <button type="button" class="bouton bouton-prendre" data-action="prendre" disabled>PRENDRE LE POINT</button>
      <p class="raison-leve" data-vivant="raison" hidden></p>
      <div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="annulerDernierPoint" ${donnees.dernierPoint ? '' : 'disabled'}>
          Annuler le dernier point${donnees.dernierPoint ? ` (${echapper(donnees.dernierPoint)})` : ''}</button>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-action="voirSurPlan">voir sur le plan</button>
      </div>
      <p class="resume">${echapper(donnees.stock.nom)} : contour ${resume.contour} pt(s) · ${resume.lignes} ligne(s) de rupture (${resume.pointsLignes} pts) · ${resume.isoles} point(s) isolé(s)</p>
      ${donnees.description}`;
  }

  return {
    /**
     * Redessine le bloc. donnees : { leves (levés faits avec le récepteur), leve, stocks (du levé),
     * stock, role, ligne: { numero, nbPoints, fermee }, nomPropose, dernierPoint (nom), resume
     * (voir resumeStock), description (HTML : triangles, volume) }.
     */
    afficher(nouvellesDonnees) {
      donnees = nouvellesDonnees;
      conteneur.innerHTML = `
        <section class="carte-section bloc-leve">
          ${titreSection('lever', 'Lever avec le récepteur', bulle('lever'))}
          <div class="connexion-leve">
            <span>Récepteur : <strong data-vivant="connexion"></strong></span>
            <span class="ligne-outils">
              <button type="button" class="bouton-secondaire" data-action="choisirRecepteur" data-si-deconnecte>Choisir le récepteur</button>
              <button type="button" class="bouton-secondaire" data-action="reconnecter" data-si-deconnecte hidden></button>
              <button type="button" class="bouton-lien" data-action="deconnecter" data-si-connecte hidden>couper</button>
            </span>
          </div>
          ${choixLeveEtStock()}
          ${priseDePoint()}
        </section>`;
      rafraichirVivant();
    },

    /** Nouvel état du récepteur (2 fois par seconde). */
    mettreAJourRecepteur(nouvelEtat) {
      etat = nouvelEtat;
      rafraichirVivant();
    },
  };
}

/**
 * Bandeaux sous l'en-tête, dans tous les onglets, quand le récepteur est connecté :
 * « RTK FIXE » (vert) ou autre (rouge), « Inclinaison PRÊTE » (vert) ou « NON PRÊTE » (rouge).
 */
export function mettreAJourBandeaux(etat) {
  let bandeaux = document.querySelector('#bandeaux-recepteur');
  if (!bandeaux) {
    bandeaux = document.createElement('div');
    bandeaux.id = 'bandeaux-recepteur';
    bandeaux.className = 'bandeaux-recepteur';
    bandeaux.setAttribute('role', 'status');
    bandeaux.innerHTML = '<span data-bandeau="rtk"></span><span data-bandeau="inclinaison"></span>';
    document.querySelector('.entete').append(bandeaux);
  }
  const visible = Boolean(etat?.connecte);
  document.body.classList.toggle('avec-recepteur', visible);
  if (!visible) return;

  const rtk = bandeaux.querySelector('[data-bandeau="rtk"]');
  const inclinaison = bandeaux.querySelector('[data-bandeau="inclinaison"]');
  if (!etat.recu) {
    rtk.textContent = 'En attente du récepteur…';
    rtk.className = 'attente';
  } else {
    const satellites = etat.nbSatellites != null ? ` · ${etat.nbSatellites} sat.` : '';
    const statut = { 4: 'RTK FIXE', 5: 'RTK FLOTTANT' }[etat.qualite] ?? `GNSS : ${etat.libelleQualite ?? '?'}`;
    rtk.textContent = `${statut}${satellites}`;
    rtk.className = etat.qualite === 4 ? 'ok' : 'pas-ok';
  }
  if (etat.etatInclinaison == null) {
    inclinaison.textContent = 'Inclinaison : ?';
    inclinaison.className = 'attente';
  } else {
    const angle = etat.inclinaison != null ? ` (${etat.inclinaison.toFixed(0)}°)` : '';
    inclinaison.textContent = etat.inclinaisonPrete ? `Inclinaison PRÊTE${angle}` : 'Inclinaison NON PRÊTE';
    inclinaison.className = etat.inclinaisonPrete ? 'ok' : 'pas-ok';
  }
}
