// Choix d'une couleur (0.366.0, demande du 28.11) : un clic sur un sélecteur de couleur ouvre une petite fenêtre avec
// les dernières couleurs choisies (6 au plus), la palette, et « Autre couleur… » (le sélecteur du navigateur).
// Les dernières couleurs ne s'affichent PAS dans l'appli, seulement dans cette fenêtre.
const CLE = 'topo-couleurs-recentes';
const MAX = 6;
const HEX = /^#[0-9a-f]{6}$/i;

/** Palette proposée (en plus des dernières couleurs). */
export const PALETTE = [
  '#000000', '#475569', '#9ca3af', '#ffffff', '#7f1d1d', '#dc2626', '#ea580c', '#f5c518',
  '#16a34a', '#14532d', '#0891b2', '#2563eb', '#1e3a8a', '#7c3aed', '#db2777', '#a16207',
];

/** Dernières couleurs, la plus récente d'abord. */
export function lireRecentes() {
  try {
    const l = JSON.parse(localStorage.getItem(CLE) ?? '[]');
    return Array.isArray(l) ? l.filter((c) => HEX.test(c)).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Ajoute une couleur en tête (sans doublon, 6 au plus). */
export function noterCouleur(couleur) {
  const c = String(couleur ?? '').toLowerCase();
  if (!HEX.test(c)) return;
  const liste = [c, ...lireRecentes().filter((x) => x.toLowerCase() !== c)].slice(0, MAX);
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch { /* stockage refusé : les dernières couleurs ne sont simplement pas gardées */ }
}

const pastille = (c) => `<button type="button" class="pastille-choix" data-couleur-choisie="${c}" style="background:${c}" title="${c}" aria-label="Couleur ${c}"></button>`;

/**
 * Surveille une page : un clic sur un `input[type=color]` ouvre la fenêtre de choix (le sélecteur du navigateur n'est
 * plus ouvert directement). Renvoie une fonction qui arrête la surveillance.
 */
export function surveillerCouleurs(racine) {
  let fenetre = null;
  let fermeture = null;
  const fermer = () => {
    fenetre?.remove();
    fenetre = null;
    if (fermeture) { racine.removeEventListener('pointerdown', fermeture, true); document.removeEventListener('keydown', echap, true); fermeture = null; }
  };
  const echap = (ev) => { if (ev.key === 'Escape' && fenetre) { ev.stopPropagation(); fermer(); } };

  const appliquer = (entree, couleur) => {
    noterCouleur(couleur);
    entree.value = couleur;
    entree.dispatchEvent(new Event('input', { bubbles: true }));
    entree.dispatchEvent(new Event('change', { bubbles: true }));
    fermer();
  };

  const ouvrir = (entree) => {
    fermer();
    const recentes = lireRecentes();
    fenetre = document.createElement('div');
    fenetre.className = 'popup-couleur';
    fenetre.setAttribute('role', 'dialog');
    fenetre.setAttribute('aria-label', 'Choisir une couleur');
    fenetre.innerHTML = `
      <b>Dernières couleurs</b>
      <div class="rang-couleurs">${recentes.length ? recentes.map(pastille).join('') : '<span class="aucune-couleur">Aucune pour l\'instant</span>'}</div>
      <b>Palette</b>
      <div class="rang-couleurs grille">${PALETTE.map(pastille).join('')}</div>
      <label class="autre-couleur">Autre couleur… <input type="color" value="${entree.value}" aria-label="Autre couleur"></label>`;
    racine.append(fenetre);
    // sous le sélecteur, ramenée dans l'écran
    const r = entree.getBoundingClientRect();
    const l = fenetre.offsetWidth;
    const h = fenetre.offsetHeight;
    fenetre.style.left = `${Math.max(4, Math.min(window.innerWidth - l - 4, r.left))}px`;
    fenetre.style.top = `${r.bottom + h + 8 > window.innerHeight ? Math.max(4, r.top - h - 4) : r.bottom + 4}px`;
    fenetre.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-couleur-choisie]');
      if (b) { ev.stopPropagation(); appliquer(entree, b.dataset.couleurChoisie); }
    });
    fenetre.querySelector('.autre-couleur input').addEventListener('change', (ev) => appliquer(entree, ev.target.value));
    fermeture = (ev) => { if (fenetre && !fenetre.contains(ev.target) && ev.target !== entree) fermer(); };
    racine.addEventListener('pointerdown', fermeture, true);
    document.addEventListener('keydown', echap, true);
  };

  const clic = (ev) => {
    const entree = ev.target.closest?.('input[type="color"]');
    if (entree && !entree.disabled && !fenetre?.contains(entree)) {
      ev.preventDefault();
      ev.stopPropagation();
      ouvrir(entree);
      return;
    }
    const pastilleApp = ev.target.closest?.('[data-pastille-valeur]'); // les pastilles de l'appli comptent aussi
    if (pastilleApp?.dataset.pastilleValeur) noterCouleur(pastilleApp.dataset.pastilleValeur);
  };
  racine.addEventListener('click', clic, true);
  return () => { fermer(); racine.removeEventListener('click', clic, true); };
}
