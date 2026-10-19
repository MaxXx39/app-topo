// Écran des stocks : créer des stocks et donner un rôle aux points
// (contour, surface de base, lignes de rupture, points du dessus).
// Trois façons de choisir les points : taper une liste de noms,
// cocher des cases, ou toucher les points sur le plan.
import {
  creerStock,
  creerLigne,
  detecterSeries,
  pointsDeBase,
  lireListeDeNoms,
  ecrireListeDeNoms,
  verifierStock,
} from '../topo/stocks.js';
import { echapper } from '../outils/echapper.js';

const NOMS_DES_ROLES = {
  contour: 'Contour',
  base: 'Surface de base',
  ligne: 'Ligne de rupture',
  dessus: 'Points du dessus',
};

/**
 * Crée l'écran des stocks dans "conteneur".
 * - obtenirPoints() : renvoie les points importés
 * - quandChange() : appelé après chaque modification (pour redessiner le plan)
 * - allerAuPlan() : affiche l'onglet du plan (sur téléphone)
 */
export function creerEditeurStocks(conteneur, barre, { obtenirPoints, quandChange, allerAuPlan }) {
  const etat = {
    stocks: [],
    indexActif: -1,
    edition: null, // rôle en cours de modification : { role, index }
    messages: [], // erreurs de la dernière liste tapée
    listeCasesOuverte: false,
  };

  // --- Accès à la liste de noms du rôle en cours de modification ---

  function stockActif() {
    return etat.stocks[etat.indexActif] ?? null;
  }

  function listeDuRole(stock, edition) {
    if (edition.role === 'contour') return stock.contour;
    if (edition.role === 'base') return stock.base;
    if (edition.role === 'ligne') return stock.lignesRupture[edition.index].noms;
    return stock.pointsDessus;
  }

  function remplacerListe(noms) {
    const stock = stockActif();
    const { role, index } = etat.edition;
    if (role === 'contour') stock.contour = noms;
    else if (role === 'base') stock.base = noms;
    else if (role === 'ligne') stock.lignesRupture[index].noms = noms;
    else stock.pointsDessus = noms;
  }

  function nomRole(edition) {
    return edition.role === 'ligne' ? `${NOMS_DES_ROLES.ligne} ${edition.index + 1}` : NOMS_DES_ROLES[edition.role];
  }

  // --- Modifications ---

  function changer() {
    afficher();
    quandChange();
  }

  /** Ajoute le point à la fin de la liste en cours, ou l'enlève s'il y est déjà. */
  function basculerPoint(nom) {
    if (!etat.edition) return;
    const liste = listeDuRole(stockActif(), etat.edition);
    remplacerListe(liste.includes(nom) ? liste.filter((n) => n !== nom) : [...liste, nom]);
    etat.messages = [];
    changer();
  }

  const actions = {
    'nouveau-stock': () => {
      etat.stocks.push(creerStock(`Stock ${etat.stocks.length + 1}`));
      etat.indexActif = etat.stocks.length - 1;
      etat.edition = { role: 'contour' };
    },
    'supprimer-stock': () => {
      const stock = stockActif();
      if (!stock || !confirm(`Supprimer « ${stock.nom} » ?`)) return;
      etat.stocks.splice(etat.indexActif, 1);
      etat.indexActif = Math.min(etat.indexActif, etat.stocks.length - 1);
      etat.edition = null;
    },
    modifier: (bouton) => {
      etat.edition = { role: bouton.dataset.role, index: Number(bouton.dataset.index ?? 0) };
      etat.messages = [];
    },
    'aller-au-plan': () => allerAuPlan?.(),
    termine: () => {
      etat.edition = null;
      etat.messages = [];
    },
    'retirer-dernier': () => remplacerListe(listeDuRole(stockActif(), etat.edition).slice(0, -1)),
    vider: () => remplacerListe([]),
    'utiliser-serie': (bouton) => {
      // Ajoute la série proposée à la fin de la liste (sans répéter les points déjà dedans).
      const serie = detecterSeries(obtenirPoints().map((p) => p.nom))[Number(bouton.dataset.index)];
      const liste = listeDuRole(stockActif(), etat.edition);
      remplacerListe([...liste, ...serie.filter((nom) => !liste.includes(nom))]);
      etat.messages = [];
    },
    appliquer: () => {
      const texte = conteneur.querySelector('[data-champ="liste"]').value;
      const resultat = lireListeDeNoms(texte, obtenirPoints().map((p) => p.nom));
      remplacerListe(resultat.noms);
      etat.messages = resultat.erreurs;
    },
    'ajouter-ligne': () => {
      const stock = stockActif();
      stock.lignesRupture.push(creerLigne());
      etat.edition = { role: 'ligne', index: stock.lignesRupture.length - 1 };
    },
    'supprimer-ligne': (bouton) => {
      const stock = stockActif();
      stock.lignesRupture.splice(Number(bouton.dataset.index), 1);
      if (stock.lignesRupture.length === 0) stock.lignesRupture.push(creerLigne());
      etat.edition = null;
    },
  };

  // Un seul écouteur pour tous les boutons de l'écran et de la barre.
  for (const zone of [conteneur, barre]) {
    zone.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-action]');
      if (!bouton) return;
      actions[bouton.dataset.action](bouton);
      changer();
    });
  }

  conteneur.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    if (cible.dataset.champ === 'choix-stock') {
      etat.indexActif = Number(cible.value);
      etat.edition = null;
    } else if (cible.dataset.champ === 'nom-stock') {
      stockActif().nom = cible.value.trim() || stockActif().nom;
    } else if (cible.dataset.champ === 'ligne-fermee') {
      stockActif().lignesRupture[Number(cible.dataset.index)].fermee = cible.checked;
    } else if (cible.dataset.champ === 'base-egale-contour') {
      stockActif().baseEgaleContour = cible.checked;
      etat.edition = cible.checked ? null : { role: 'base', index: 0 };
    } else if (cible.dataset.case) {
      basculerPoint(cible.dataset.case);
      return;
    } else {
      return;
    }
    changer();
  });

  // On retient si la liste des cases est ouverte, pour la garder ouverte après chaque clic.
  conteneur.addEventListener(
    'toggle',
    (evenement) => {
      if (evenement.target.dataset.zone === 'cases') etat.listeCasesOuverte = evenement.target.open;
    },
    true,
  );

  // Valider la liste tapée avec la touche Entrée.
  conteneur.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter' && evenement.target.dataset.champ === 'liste') {
      actions.appliquer();
      changer();
    }
  });

  // --- Affichage ---

  function afficher() {
    const stock = stockActif();
    const nomsExistants = obtenirPoints().map((p) => p.nom);

    let html = `
      <div class="ligne-outils">
        ${
          etat.stocks.length > 0
            ? `<select data-champ="choix-stock" aria-label="Stock affiché">
                ${etat.stocks.map((s, i) => `<option value="${i}" ${i === etat.indexActif ? 'selected' : ''}>${echapper(s.nom)}</option>`).join('')}
              </select>`
            : ''
        }
        <button type="button" class="bouton" data-action="nouveau-stock">+ Nouveau stock</button>
      </div>`;

    if (stock) {
      const problemes = verifierStock(stock, nomsExistants);
      html += `
        <div class="ligne-outils">
          <label>Nom : <input type="text" data-champ="nom-stock" value="${echapper(stock.nom)}" /></label>
          <button type="button" class="bouton-secondaire" data-action="supprimer-stock">Supprimer ce stock</button>
        </div>
        ${carteRole(stock, { role: 'contour' }, 'Bord du stock, dans l\'ordre. Le polygone est fermé automatiquement.')}
        <div class="carte-role">
          <div class="titre-role">
            <strong>${NOMS_DES_ROLES.base}</strong>
            <label class="case"><input type="checkbox" data-champ="base-egale-contour" ${stock.baseEgaleContour ? 'checked' : ''} /> mêmes points que le contour</label>
          </div>
          ${stock.baseEgaleContour ? '' : contenuRole(stock, { role: 'base' }, 'Points du pied du stock.')}
        </div>
        ${stock.lignesRupture
          .map((_, index) =>
            carteRole(stock, { role: 'ligne', index }, 'Haut de talus, arêtes : dans l\'ordre de la ligne.', true),
          )
          .join('')}
        <button type="button" class="bouton-secondaire" data-action="ajouter-ligne">+ Ajouter une ligne de rupture</button>
        ${carteRole(stock, { role: 'dessus' }, 'Points isolés sur le dessus, hors lignes de rupture.')}
        ${
          problemes.length > 0
            ? `<div class="avertissement"><p><strong>À compléter :</strong></p><ul>${problemes.map((p) => `<li>${echapper(p)}</li>`).join('')}</ul></div>`
            : '<p class="ok">✓ Stock complet.</p>'
        }`;
    }

    conteneur.innerHTML = html;
    afficherBarre();
  }

  /** Une carte pour un rôle : titre, liste des points, et bouton pour la modifier. */
  function carteRole(stock, edition, aide, supprimable = false) {
    return `
      <div class="carte-role ${estEnEdition(edition) ? 'en-edition' : ''}">
        <div class="titre-role">
          <strong>${nomRole(edition)}</strong>
          ${supprimable && stock.lignesRupture.length > 1 ? `<button type="button" class="bouton-lien" data-action="supprimer-ligne" data-index="${edition.index}">supprimer</button>` : ''}
        </div>
        ${contenuRole(stock, edition, aide)}
      </div>`;
  }

  /** Contenu d'une carte : résumé de la liste, ou outils de modification si elle est en cours. */
  function contenuRole(stock, edition, aide) {
    const liste = listeDuRole(stock, edition);
    const resume = liste.length > 0 ? `${echapper(ecrireListeDeNoms(liste))} <span class="aide">(${liste.length} pt)</span>` : '<span class="aide">aucun point</span>';

    if (!estEnEdition(edition)) {
      return `
        <p class="liste-noms">${resume}</p>
        <button type="button" class="bouton-secondaire" data-action="modifier" data-role="${edition.role}" data-index="${edition.index ?? 0}">Modifier</button>`;
    }

    const points = obtenirPoints();
    const series = detecterSeries(points.map((p) => p.nom));
    const nomsUtilises = new Set(etat.stocks.flatMap(nomsDuStock));
    return `
      <p class="aide">${aide}</p>
      ${
        edition.role === 'ligne'
          ? `<label class="case"><input type="checkbox" data-champ="ligne-fermee" data-index="${edition.index}" ${stock.lignesRupture[edition.index].fermee ? 'checked' : ''} /> ligne fermée (le dernier point est relié au premier)</label>`
          : ''
      }
      ${
        series.length > 0
          ? `<p class="aide">Séries trouvées dans le fichier (toucher pour l'ajouter) :</p>
            <div class="series">
              ${series
                .map(
                  (serie, index) =>
                    `<button type="button" class="pastille ${serie.every((nom) => nomsUtilises.has(nom)) ? 'utilisee' : ''}" data-action="utiliser-serie" data-index="${index}">${echapper(ecrireListeDeNoms(serie))} <span class="aide">(${serie.length})</span></button>`,
                )
                .join('')}
            </div>`
          : ''
      }
      <label class="champ-liste">
        Liste de noms (ex. « b100 à b116, b120 »)
        <span class="ligne-outils">
          <input type="text" data-champ="liste" value="${echapper(ecrireListeDeNoms(liste))}" autocomplete="off" autocapitalize="off" spellcheck="false" />
          <button type="button" class="bouton" data-action="appliquer">Valider</button>
        </span>
      </label>
      ${etat.messages.length > 0 ? `<div class="erreur"><ul>${etat.messages.map((m) => `<li>${echapper(m)}</li>`).join('')}</ul></div>` : ''}
      <p class="aide">Ou touche les points sur le plan (toucher à nouveau un point le retire).</p>
      <button type="button" class="bouton-secondaire seulement-telephone" data-action="aller-au-plan">Toucher les points sur le plan</button>
      <details data-zone="cases" ${etat.listeCasesOuverte ? 'open' : ''}>
        <summary>Ou cocher dans la liste des points</summary>
        <div class="liste-cases">
          ${points
            .map((p) => {
              const rang = liste.indexOf(p.nom);
              return `<label class="case"><input type="checkbox" data-case="${echapper(p.nom)}" ${rang >= 0 ? 'checked' : ''} /> ${echapper(p.nom)}${rang >= 0 ? ` <span class="rang">${rang + 1}</span>` : ''}</label>`;
            })
            .join('')}
        </div>
      </details>`;
  }

  function estEnEdition(edition) {
    return (
      etat.edition !== null &&
      etat.edition.role === edition.role &&
      (edition.role !== 'ligne' || etat.edition.index === edition.index)
    );
  }

  /** Barre fixée en bas de l'écran pendant une modification, visible même en regardant le plan. */
  function afficherBarre() {
    const stock = stockActif();
    if (!etat.edition || !stock) {
      barre.hidden = true;
      return;
    }
    const liste = listeDuRole(stock, etat.edition);
    barre.hidden = false;
    barre.innerHTML = `
      <div class="barre-texte"><strong>${echapper(stock.nom)} · ${nomRole(etat.edition)}</strong> : ${liste.length} point(s)${liste.length > 0 ? `, dernier ${echapper(liste.at(-1))}` : ''}</div>
      <div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="retirer-dernier" ${liste.length === 0 ? 'disabled' : ''}>Retirer le dernier</button>
        <button type="button" class="bouton-secondaire" data-action="vider" ${liste.length === 0 ? 'disabled' : ''}>Vider</button>
        <button type="button" class="bouton" data-action="termine">Terminé</button>
      </div>`;
  }

  afficher();

  return {
    /** Appelé quand on touche un point sur le plan. */
    toucherPoint: basculerPoint,
    /** À appeler quand les points importés changent. */
    rafraichir: afficher,
    /** Ce que le plan doit montrer : tous les stocks, le stock actif et la liste en cours. */
    obtenirDessin() {
      const stock = stockActif();
      return {
        stocks: etat.stocks,
        stockActif: stock,
        pointsDeBase: stock ? pointsDeBase(stock) : [],
        listeEnCours: stock && etat.edition ? listeDuRole(stock, etat.edition) : [],
      };
    },
  };
}

/** Tous les noms utilisés dans un stock, quel que soit leur rôle. */
function nomsDuStock(stock) {
  return [...stock.contour, ...stock.base, ...stock.lignesRupture.flatMap((ligne) => ligne.noms), ...stock.pointsDessus];
}
