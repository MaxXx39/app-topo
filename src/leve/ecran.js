// Onglet Terrain (seulement dans l'appli Android) : levé avec le récepteur Emlid.
// Écran épuré pour le chantier : le plan en haut (voir style.css, « mode-leve »), puis le rôle
// du prochain point (contour, ligne de rupture, point isolé), son nom, la position et le gros
// bouton PRENDRE LE POINT. Le levé, le stock et le récepteur sont dans une ligne repliable.
// Aussi : les bandeaux « RTK » et « Inclinaison » sous l'en-tête, visibles dans tous les onglets.
//
// L'état du récepteur arrive 2 fois par seconde (mettreAJourRecepteur) : on ne change alors que
// quelques textes et l'état du bouton, sans redessiner l'écran (le doigt peut être dessus).
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { ROLES_LEVE } from '../topo/leve-direct.js';

// Petit dessin de chaque rôle, comme dans Calculs › Surfaces (contour rouge, ligne orange, point vert).
const ICONES = {
  contour: '<path d="M4 8 11 3l9 5-2 11-13 1z" />',
  ligne: '<path d="M3 18l6-7 4 4 8-9" />',
  isole: '<circle cx="12" cy="12" r="4" />',
};

/**
 * Crée l'écran dans "conteneur". Les actions sont faites par main.js via "actions" :
 * choisirRecepteur(), reconnecter(), deconnecter(), nouveauLeve(), choisirLeve(id), nouveauStock(),
 * choisirStock(id), choisirRole(role), nouvelleLigne(), basculerFermeture(), prendrePoint(nom),
 * annulerDernierPoint()
 * Renvoie { afficher(donnees), mettreAJourRecepteur(etat) }.
 */
export function creerEcranLeve(conteneur, actions) {
  let etat = null; // dernier état du récepteur (voir src/android/pont.js)
  let donnees = null;
  let reglagesOuverts = false; // ligne « Levé · Stock » dépliée (gardée d'un dessin à l'autre)

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

  conteneur.addEventListener('toggle', (evenement) => {
    if (evenement.target.matches('details.reglages-leve')) reglagesOuverts = evenement.target.open;
  }, true);

  // Touche Entrée dans le nom : prend le point (comme le bouton), si c'est permis.
  conteneur.addEventListener('keydown', (evenement) => {
    if (evenement.key !== 'Enter' || evenement.target.dataset.champ !== 'nom-point') return;
    evenement.preventDefault();
    const bouton = conteneur.querySelector('[data-action="prendre"]');
    if (bouton && !bouton.disabled) actions.prendrePoint(evenement.target.value);
  });

  /** Partie « récepteur » : connexion, position, bouton. Mise à jour sans redessiner l'écran. */
  function rafraichirVivant() {
    const connecte = Boolean(etat?.connecte);
    for (const element of conteneur.querySelectorAll('[data-si-connecte]')) element.hidden = !connecte;
    for (const element of conteneur.querySelectorAll('[data-si-deconnecte]')) element.hidden = connecte;
    const texte = conteneur.querySelector('[data-vivant="connexion"]');
    if (texte) texte.textContent = etat?.bluetooth ?? 'non connecté';
    // Bouton principal de connexion : le dernier récepteur s'il est connu, sinon la liste.
    const connecter = conteneur.querySelector('[data-vivant="connecter"]');
    if (connecter) {
      connecter.dataset.action = etat?.dernierRecepteur ? 'reconnecter' : 'choisirRecepteur';
      connecter.textContent = etat?.dernierRecepteur ? `Connecter ${etat.dernierRecepteur}` : 'Connecter le récepteur';
    }
    const autre = conteneur.querySelector('[data-vivant="autre-recepteur"]');
    if (autre) autre.hidden = connecte || !etat?.dernierRecepteur;

    const position = conteneur.querySelector('[data-vivant="position"]');
    if (position) {
      const p = connecte && etat.recu ? etat.position : null;
      position.classList.toggle('pas-prete', !etat?.inclinaisonPrete);
      position.innerHTML = p
        ? `<span>E <strong>${formaterNombre(p.est)}</strong></span><span>N <strong>${formaterNombre(p.nord)}</strong></span><span>H <strong>${formaterNombre(p.altitude)}</strong></span>`
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

  /** Connexion au récepteur : un gros bouton tant qu'il n'est pas connecté. */
  function connexion() {
    return `<div class="connexion-terrain" data-si-deconnecte>
      <button type="button" class="bouton bouton-large" data-vivant="connecter" data-action="choisirRecepteur">Connecter le récepteur</button>
      <button type="button" class="bouton-lien bouton-lien-neutre" data-vivant="autre-recepteur" data-action="choisirRecepteur" hidden>autre récepteur</button>
    </div>`;
  }

  /** Ligne repliable : levé et stock en cours (à changer), récepteur connecté (à couper). */
  function reglages() {
    if (!donnees.leve) return '';
    const titre = `${echapper(donnees.leve.nom)} · ${donnees.stock ? echapper(donnees.stock.nom) : 'aucun stock'}`;
    return `<details class="reglages-leve" ${reglagesOuverts ? 'open' : ''}>
      <summary><span>${titre}</span><span class="aide">changer</span></summary>
      <label class="champ-leve">Levé
        <span class="ligne-outils">
          <select data-champ="leve">${donnees.leves.map((l) => `<option value="${l.id}" ${l.id === donnees.leve.id ? 'selected' : ''}>${echapper(l.nom)} (${l.points.length} pts)</option>`).join('')}</select>
          <button type="button" class="bouton-secondaire" data-action="nouveauLeve">+ Nouveau levé</button>
        </span>
      </label>
      <label class="champ-leve">Stock
        <span class="ligne-outils">
          ${donnees.stocks.length > 0
            ? `<select data-champ="stock">${donnees.stocks.map((s) => `<option value="${s.id}" ${s.id === donnees.stock?.id ? 'selected' : ''}>${echapper(s.nom)}</option>`).join('')}</select>`
            : ''}
          <button type="button" class="bouton-secondaire" data-action="nouveauStock">+ Nouveau stock</button>
        </span>
      </label>
      <p class="ligne-outils" data-si-connecte hidden>
        <span>Récepteur : <strong data-vivant="connexion"></strong></span>
        <button type="button" class="bouton-lien" data-action="deconnecter">couper</button>
      </p>
    </details>`;
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
      <span>Ligne ${ligne.numero} · ${ligne.nbPoints} pt(s)</span>
      <button type="button" class="bouton-secondaire" data-action="nouvelleLigne" ${ligne.nbPoints === 0 ? 'disabled' : ''}>+ Nouvelle</button>
      <button type="button" class="bouton-secondaire ${ligne.fermee ? 'actif' : ''}" data-action="basculerFermeture" aria-pressed="${ligne.fermee}" ${ligne.nbPoints < 3 ? 'disabled' : ''}>
        ${ligne.fermee ? '✓ Fermée' : 'Fermer'}</button>
    </div>`;
  }

  /** Une ligne courte : points du stock par rôle et volume (le détail est dans Calculs). */
  function resume() {
    const { resume: r, volume } = donnees;
    const morceaux = [`${r.contour} contour`, `${r.pointsLignes} lignes`, `${r.isoles} isolés`];
    return `<p class="resume-terrain">${morceaux.join(' · ')}${volume != null ? ` · <strong>${formaterNombre(volume)} m³</strong>` : ''}</p>`;
  }

  /** Prise de point : rôle, nom, position, bouton, annulation. */
  function priseDePoint() {
    if (!donnees.leve) {
      return '<button type="button" class="bouton bouton-large" data-action="nouveauLeve">+ Commencer un levé</button>';
    }
    if (!donnees.stock) {
      return '<button type="button" class="bouton bouton-large" data-action="nouveauStock">+ Nouveau stock</button>';
    }
    return `
      ${boutonsRoles()}
      ${outilsLigne()}
      <div class="nom-et-position">
        <input type="text" class="nom-point" data-champ="nom-point" value="${echapper(donnees.nomPropose)}" autocomplete="off" autocapitalize="characters" aria-label="Nom du prochain point" />
        <div class="position-leve" data-vivant="position"></div>
      </div>
      <button type="button" class="bouton bouton-prendre" data-action="prendre" disabled>PRENDRE LE POINT</button>
      <p class="raison-leve" data-vivant="raison" hidden></p>
      <div class="pied-terrain">
        <button type="button" class="bouton-secondaire" data-action="annulerDernierPoint" ${donnees.dernierPoint ? '' : 'disabled'}>
          Annuler ${donnees.dernierPoint ? echapper(donnees.dernierPoint) : 'le dernier point'}</button>
        ${resume()}
      </div>`;
  }

  return {
    /**
     * Redessine l'écran. donnees : { leves (levés faits avec le récepteur), leve, stocks (du levé),
     * stock, role, ligne: { numero, nbPoints, fermee }, nomPropose, dernierPoint (nom), resume
     * (voir resumeStock), volume (remblai en m³, ou null) }.
     */
    afficher(nouvellesDonnees) {
      donnees = nouvellesDonnees;
      conteneur.innerHTML = `
        <div class="ecran-terrain">
          ${connexion()}
          ${reglages()}
          ${priseDePoint()}
        </div>`;
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
