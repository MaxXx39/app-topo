// Fenêtres de la barre d'accroche (Terrain › Implanter, accroche « Point ») :
// - « + Point » : taper un point (nom, Est, Nord, altitude facultative) ;
// - « Liste » : chercher un point du projet, rangé liste par liste (fichier importé, surface,
//   métré, Autres, points ajoutés, À implanter), sans connaître son nom exact.
import { echapper } from '../outils/echapper.js';
import { htmlFormulairePoint, lireFormulairePoint } from '../outils/formulaire-point.js';

/** Fenêtre vide avec un titre et un bouton ✕ ; renvoie l'élément <dialog> (déjà ouvert). */
function creerFenetre(classe, titre, contenu) {
  const fenetre = document.createElement('dialog');
  fenetre.className = `fenetre-points ${classe}`;
  fenetre.innerHTML = `
    <div class="entete-fenetre-recepteur">
      <h2>${echapper(titre)}</h2>
      <button type="button" class="bouton-retour" data-action="fermer" aria-label="Fermer">✕</button>
    </div>
    ${contenu}`;
  fenetre.addEventListener('click', (evenement) => {
    if (evenement.target === fenetre || evenement.target.closest('[data-action="fermer"]')) fenetre.close();
  });
  fenetre.addEventListener('close', () => fenetre.remove());
  document.body.append(fenetre);
  fenetre.showModal();
  return fenetre;
}

/**
 * « + Point » : taper un point. ajouter(valeurs) renvoie { erreur } si le point est refusé
 * (nom déjà pris…), sinon la fenêtre se ferme.
 */
export function ouvrirFenetrePointTape({ nomPropose, ajouter }) {
  const fenetre = creerFenetre('fenetre-point-tape', 'Taper un point', `${htmlFormulairePoint(nomPropose)}<p class="erreur" data-zone="erreur"></p>`);
  const valider = () => {
    const valeurs = lireFormulairePoint(fenetre);
    const erreur = valeurs.erreur ?? ajouter(valeurs)?.erreur;
    if (erreur) fenetre.querySelector('[data-zone="erreur"]').textContent = erreur;
    else fenetre.close();
  };
  fenetre.addEventListener('click', (evenement) => {
    if (evenement.target.closest('[data-action="ajouterPointTape"]')) valider();
  });
  fenetre.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter' && evenement.target.dataset.point) {
      evenement.preventDefault();
      valider();
    }
  });
  fenetre.querySelector('[data-point="est"]')?.focus();
}

/**
 * « Liste » : groupes = [{ titre, noms }] ; une case de recherche réduit la liste (sans tenir
 * compte des majuscules) ; toucher un point le choisit (choisir(nom)) et ferme la fenêtre.
 */
export function ouvrirListePoints({ groupes, choisir }) {
  const total = groupes.reduce((somme, g) => somme + g.noms.length, 0);
  const fenetre = creerFenetre('fenetre-liste-points', 'Points du projet', `
    <input type="search" class="recherche-points" data-champ="recherche" placeholder="Chercher (ex. b10)" autocomplete="off" autocapitalize="characters" aria-label="Chercher un point" />
    <div class="groupes-points">
      ${total === 0 ? '<p class="vide">Aucun point dans le projet.</p>' : groupes.map((g, i) => `<details class="groupe-points" ${groupes.length === 1 || i === 0 ? 'open' : ''}>
        <summary>${echapper(g.titre)} <span class="aide">${g.noms.length}</span></summary>
        <div class="noms-points">${g.noms.map((nom) => `<button type="button" class="puce-choix" data-nom="${echapper(nom)}">${echapper(nom)}</button>`).join('')}</div>
      </details>`).join('')}
    </div>`);
  fenetre.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-nom]');
    if (!bouton) return;
    fenetre.close();
    choisir(bouton.dataset.nom);
  });
  // Recherche : seuls les points qui contiennent le texte restent ; les groupes trouvés s'ouvrent.
  fenetre.querySelector('[data-champ="recherche"]').addEventListener('input', (evenement) => {
    const texte = evenement.target.value.trim().toLowerCase();
    for (const groupe of fenetre.querySelectorAll('.groupe-points')) {
      let trouves = 0;
      for (const bouton of groupe.querySelectorAll('button[data-nom]')) {
        const garde = !texte || bouton.dataset.nom.toLowerCase().includes(texte);
        bouton.hidden = !garde;
        if (garde) trouves += 1;
      }
      groupe.hidden = trouves === 0;
      if (texte) groupe.open = true;
    }
  });
}
