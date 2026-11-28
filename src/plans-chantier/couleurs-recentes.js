// Dernières couleurs choisies (0.363.0) : sous chaque sélecteur de couleur, une petite rangée des dernières couleurs
// utilisées (gardées sur l'appareil, 8 au plus) pour remettre la même d'un clic.
const CLE = 'topo-couleurs-recentes';
const MAX = 8;
const HEX = /^#[0-9a-f]{6}$/i;

/** Dernières couleurs, la plus récente d'abord. */
export function lireRecentes() {
  try {
    const l = JSON.parse(localStorage.getItem(CLE) ?? '[]');
    return Array.isArray(l) ? l.filter((c) => HEX.test(c)).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Ajoute une couleur en tête (sans doublon). */
export function noterCouleur(couleur) {
  const c = String(couleur ?? '').toLowerCase();
  if (!HEX.test(c)) return;
  const liste = [c, ...lireRecentes().filter((x) => x.toLowerCase() !== c)].slice(0, MAX);
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch { /* stockage refusé : les couleurs récentes ne sont simplement pas gardées */ }
}

const html = () => lireRecentes().map((c) => `<button type="button" class="recente-couleur" data-recente="${c}" style="background:${c}" title="${c}" aria-label="Couleur récente ${c}"></button>`).join('');

/**
 * Surveille une page : chaque sélecteur de couleur reçoit sa rangée de couleurs récentes ; choisir une couleur (ou toucher
 * une pastille) la note. Renvoie une fonction qui arrête la surveillance.
 */
export function surveillerCouleurs(racine) {
  const ajouter = () => {
    const liste = lireRecentes();
    racine.querySelectorAll('input[type="color"]').forEach((entree) => {
      if (entree.disabled) return;
      const suivant = entree.nextElementSibling;
      if (suivant?.classList.contains('recentes-couleurs')) {
        if (suivant.dataset.liste !== liste.join(',')) { suivant.dataset.liste = liste.join(','); suivant.innerHTML = html(); }
        return;
      }
      if (!liste.length) return;
      const bande = document.createElement('span');
      bande.className = 'recentes-couleurs';
      bande.setAttribute('role', 'group');
      bande.setAttribute('aria-label', 'Dernières couleurs');
      bande.dataset.liste = liste.join(',');
      bande.innerHTML = html();
      entree.after(bande);
    });
  };
  const observateur = new MutationObserver(() => ajouter());
  observateur.observe(racine, { childList: true, subtree: true });
  const clic = (ev) => {
    const b = ev.target.closest?.('.recente-couleur');
    if (b) {
      ev.stopPropagation();
      ev.preventDefault();
      const entree = b.closest('.recentes-couleurs')?.previousElementSibling;
      if (entree?.matches('input[type="color"]')) {
        entree.value = b.dataset.recente;
        entree.dispatchEvent(new Event('input', { bubbles: true }));
        entree.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    const pastille = ev.target.closest?.('[data-pastille-valeur]');
    if (pastille?.dataset.pastilleValeur) setTimeout(() => { noterCouleur(pastille.dataset.pastilleValeur); ajouter(); }, 0);
  };
  racine.addEventListener('click', clic, true);
  const choisie = (ev) => {
    if (ev.target.matches?.('input[type="color"]')) { noterCouleur(ev.target.value); setTimeout(ajouter, 0); }
  };
  racine.addEventListener('change', choisie);
  ajouter();
  return () => { observateur.disconnect(); racine.removeEventListener('click', clic, true); racine.removeEventListener('change', choisie); };
}
