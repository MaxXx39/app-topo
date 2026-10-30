// Exports (0.69.0) : ce que l'on exporte se choisit dans une liste à cocher, rangée par catégories
// (volumes, surfaces, dessins, listes de points ; métrés et mesures pour l'export des mesures).
// Les cases partent de ce qui est affiché (menu « Afficher ») ; les changer ne change pas le plan.
import { echapper } from '../outils/echapper.js';

/**
 * Ids cochés pour l'export. groupes : [{ titre, elements: [{ id, nom, defaut (vrai si affiché) }] }] ;
 * changes : Map id → vrai / faux (cases touchées par l'utilisateur). Renvoie un Set d'ids.
 */
export function selectionExport(groupes, changes) {
  const choisis = new Set();
  for (const { elements } of groupes) {
    for (const element of elements) if (changes.get(element.id) ?? element.defaut) choisis.add(element.id);
  }
  return choisis;
}

/** HTML de la liste à cocher (dans un bloc repliable « Quoi exporter ? »). */
export function htmlChoixExport(groupes, changes, ouvert = false) {
  const choisis = selectionExport(groupes, changes);
  const total = groupes.reduce((n, g) => n + g.elements.length, 0);
  const pleins = groupes.filter((g) => g.elements.length > 0);
  return `<details class="choix-export" ${ouvert ? 'open' : ''}>
    <summary>Quoi exporter ? <span class="aide">${choisis.size} / ${total}</span></summary>
    ${pleins.length === 0 ? '<p class="vide">Rien à exporter.</p>' : pleins.map((g) => `<p class="titre-partie-menu">${echapper(g.titre)}</p>
      ${g.elements.map((e) => `<label class="case"><input type="checkbox" data-choix-export="${echapper(e.id)}" ${choisis.has(e.id) ? 'checked' : ''} /> ${echapper(e.nom)}</label>`).join('')}`).join('')}
    <div class="ligne-outils">
      <button type="button" class="bouton-lien bouton-lien-neutre" data-choix-tout="oui">tout</button>
      <button type="button" class="bouton-lien bouton-lien-neutre" data-choix-tout="non">rien</button>
      <button type="button" class="bouton-lien bouton-lien-neutre" data-choix-tout="affiche">comme le plan</button>
    </div>
  </details>`;
}

/**
 * Branche la liste à cocher dans "zone" (élément du formulaire d'export). obtenirGroupes() : les
 * groupes du moment. Renvoie { selection() : Set des ids cochés, rafraichir() }.
 */
export function brancherChoixExport(zone, obtenirGroupes) {
  const changes = new Map();
  let ouvert = false;
  const rafraichir = () => {
    zone.innerHTML = htmlChoixExport(obtenirGroupes(), changes, ouvert);
  };
  zone.addEventListener('toggle', (evenement) => {
    if (!evenement.target.matches('.choix-export')) return;
    // Le bloc redessiné (déjà ouvert) renvoie lui aussi « toggle » : sans ce test, il se redessinait
    // sans fin et les touchers sur les cases étaient perdus.
    if (evenement.target.open === ouvert) return;
    ouvert = evenement.target.open;
    if (ouvert) rafraichir(); // la liste du moment (levés, surfaces… ajoutés entre-temps)
  }, true);
  zone.addEventListener('change', (evenement) => {
    const id = evenement.target.dataset.choixExport;
    if (id == null) return;
    changes.set(id, evenement.target.checked);
    rafraichir();
  });
  zone.addEventListener('click', (evenement) => {
    const quoi = evenement.target.closest('[data-choix-tout]')?.dataset.choixTout;
    if (!quoi) return;
    changes.clear();
    if (quoi !== 'affiche') for (const g of obtenirGroupes()) for (const e of g.elements) changes.set(e.id, quoi === 'oui');
    rafraichir();
  });
  rafraichir();
  return { selection: () => selectionExport(obtenirGroupes(), changes), rafraichir };
}
