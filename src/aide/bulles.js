// Bulles d'aide : un bouton « ? » dans l'en-tête active ou désactive l'aide.
// Aide activée : des petits ronds « ? » apparaissent à côté des éléments importants ;
// en touchant un rond, sa bulle s'ouvre. Aide désactivée : ronds et bulles sont cachés.
import { TEXTES_AIDE } from './textes.js';

const CLE_MEMOIRE = 'topo-aide';

/** Petit rond « ? » à placer dans le code HTML d'un écran, à côté d'un titre. */
export function bulle(cle) {
  return `<button type="button" class="rond-aide" data-aide="${cle}" aria-label="Aide">?</button>`;
}

/**
 * Met en place l'aide : bouton d'activation (boutonAide) et ouverture des bulles.
 * Le choix (activée ou non) est retenu sur l'appareil.
 */
export function installerAide(boutonAide) {
  const fenetre = document.createElement('div');
  fenetre.className = 'bulle-aide';
  fenetre.setAttribute('role', 'tooltip');
  fenetre.hidden = true;
  document.body.append(fenetre);
  let rondOuvert = null;

  function activer(active) {
    document.body.classList.toggle('aide-active', active);
    boutonAide.setAttribute('aria-pressed', String(active));
    if (!active) fermer();
    try {
      localStorage.setItem(CLE_MEMOIRE, active ? 'oui' : 'non');
    } catch {
      // Mémoire du navigateur indisponible : le choix ne sera simplement pas retenu.
    }
  }

  function fermer() {
    fenetre.hidden = true;
    rondOuvert = null;
  }

  /** Ouvre la bulle sous le rond touché, sans dépasser du bord de l'écran. */
  function ouvrir(rond) {
    fenetre.textContent = TEXTES_AIDE[rond.dataset.aide] ?? '';
    fenetre.hidden = false;
    rondOuvert = rond;
    const cadre = rond.getBoundingClientRect();
    const largeur = Math.min(320, window.innerWidth - 24);
    fenetre.style.width = `${largeur}px`;
    const gauche = Math.min(Math.max(12, cadre.left + cadre.width / 2 - largeur / 2), window.innerWidth - largeur - 12);
    fenetre.style.left = `${gauche}px`;
    // Sous le rond s'il y a la place, sinon au-dessus.
    const hauteur = fenetre.offsetHeight;
    const dessous = cadre.bottom + 8;
    fenetre.style.top = `${dessous + hauteur < window.innerHeight - 8 ? dessous : Math.max(8, cadre.top - hauteur - 8)}px`;
  }

  boutonAide.addEventListener('click', () => activer(!document.body.classList.contains('aide-active')));

  // Toucher un rond ouvre sa bulle (ou la ferme si elle est déjà ouverte) ; toucher ailleurs la ferme.
  document.addEventListener(
    'click',
    (evenement) => {
      const rond = evenement.target.closest('.rond-aide');
      if (rond) {
        evenement.preventDefault();
        evenement.stopPropagation();
        if (rond === rondOuvert) fermer();
        else ouvrir(rond);
      } else if (!evenement.target.closest('.bulle-aide')) {
        fermer();
      }
    },
    true,
  );
  // Les écrans sont redessinés souvent : une bulle ouverte se ferme quand on fait défiler la page.
  document.addEventListener('scroll', fermer, true);
  window.addEventListener('resize', fermer);

  let memoire = null;
  try {
    memoire = localStorage.getItem(CLE_MEMOIRE);
  } catch {
    // Mémoire indisponible : aide désactivée.
  }
  activer(memoire === 'oui');
}
