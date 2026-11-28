// Plans de chantier (0.338.0) : fenêtre « Phases » (ouverte par le ⚙ du bandeau). Une ligne par phase : couleur, nom,
// montrer / cacher, monter, descendre, dupliquer, supprimer. En bas : ajouter, et les règles de vue entre phases (ancien tableau).
import { echapper } from '../outils/echapper.js';
import { ajouterPhase } from '../topo/plan-chantier.js';
import { deplacerPhase, dupliquerPhase, renommerPhase, nomSansNumero } from '../topo/phases-chantier.js';

/**
 * Ouvre la fenêtre. acces : { plan() → plan, avantChangement() → bool, enregistrer(), rafraichir(), ouvrirRegles(), supprimer(id) → promesse de vrai si supprimée }.
 */
export function ouvrirFenetrePhases(acces) {
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-choix fenetre-champs fenetre-phases-chantier';

  const enregistrer = () => { acces.enregistrer(); acces.rafraichir(); dessiner(); };
  const avant = (action) => { if (!acces.avantChangement()) return; action(); enregistrer(); };

  function dessiner() {
    const p = acces.plan();
    const n = p.phases.length;
    fenetre.innerHTML = `
      <div class="entete-fenetre-champs"><h2>Phases</h2><button type="button" class="bouton-retour" data-cle="fermer" aria-label="Fermer">✕</button></div>
      <p class="aide-calage">Dans la phase active, on dessine. Les éléments d'une phase sont supprimés avec elle.</p>
      <ul class="liste-phases-chantier compact">${p.phases.map((ph, i) => `<li class="${ph.id === p.phaseActive ? 'active' : ''}">
        <span class="num-phase">${i + 1} -</span>
        <input type="color" value="${ph.couleur}" data-couleur="${ph.id}" aria-label="Couleur de ${echapper(nomSansNumero(ph.nom))}">
        <input type="text" maxlength="60" value="${echapper(nomSansNumero(ph.nom))}" data-nom="${ph.id}" aria-label="Nom de la phase (le numéro se met tout seul)">
        <label class="case" title="Montrer cette phase"><input type="checkbox" data-visible="${ph.id}" ${ph.visible !== false ? 'checked' : ''}> Voir</label>
        <button type="button" class="bouton-secondaire petit" data-active="${ph.id}" title="Dessiner dans cette phase">${ph.id === p.phaseActive ? '✎' : 'Choisir'}</button>
        <button type="button" class="bouton-secondaire petit" data-monter="${ph.id}" ${i === 0 ? 'disabled' : ''} title="Monter">▲</button>
        <button type="button" class="bouton-secondaire petit" data-descendre="${ph.id}" ${i === n - 1 ? 'disabled' : ''} title="Descendre">▼</button>
        <button type="button" class="bouton-secondaire petit" data-dupliquer="${ph.id}" title="Dupliquer (avec ses éléments)">⧉</button>
        <button type="button" class="bouton-secondaire petit" data-supprimer="${ph.id}" ${n <= 1 ? 'disabled' : ''} title="Supprimer cette phase et ses éléments">✕</button>
      </li>`).join('')}</ul>
      <div class="actions-chantier"><button type="button" class="bouton" data-ajouter="1">＋ Nouvelle phase</button>
        <button type="button" class="bouton-secondaire" data-regles="1">Règles de vue entre phases…</button></div>
      <div class="boutons-choix"><button type="button" class="bouton" data-cle="fermer"><strong>Fermer</strong></button></div>`;
  }

  fenetre.addEventListener('click', (e) => {
    if (e.target.closest('[data-cle="fermer"]')) return fenetre.close();
    const b = e.target.closest('button');
    if (!b) return;
    const p = acces.plan();
    const d = b.dataset;
    if (d.ajouter) return avant(() => ajouterPhase(p));
    if (d.regles) return acces.ouvrirRegles();
    if (d.active) return avant(() => { p.phaseActive = d.active; });
    if (d.monter) return avant(() => deplacerPhase(p, d.monter, -1));
    if (d.descendre) return avant(() => deplacerPhase(p, d.descendre, 1));
    if (d.dupliquer) return avant(() => dupliquerPhase(p, d.dupliquer));
    if (d.supprimer) return acces.supprimer(d.supprimer).then((ok) => { if (ok) enregistrer(); });
  });
  fenetre.addEventListener('change', (e) => {
    const c = e.target;
    const d = c.dataset;
    const p = acces.plan();
    if (d.couleur) return avant(() => { p.phases.find((x) => x.id === d.couleur).couleur = c.value; });
    if (d.nom) return c.value.trim() ? avant(() => renommerPhase(p, d.nom, c.value)) : dessiner();
    if (d.visible) return avant(() => { p.phases.find((x) => x.id === d.visible).visible = c.checked; });
  });
  fenetre.addEventListener('cancel', (e) => { e.preventDefault(); fenetre.close(); });
  fenetre.addEventListener('close', () => fenetre.remove());
  dessiner();
  document.body.append(fenetre);
  fenetre.showModal();
}
