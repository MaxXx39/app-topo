// Onglet 2. Surfaces : créer et modifier les surfaces (stock, terrassement, terrain...).
// Pour une surface créée à partir d'un levé, on choisit les points de chaque rôle :
// contour, lignes de rupture, points de la surface ; puis on peut supprimer des triangles au doigt.
// Trois façons de choisir les points : taper une liste de noms,
// cocher des cases, ou toucher les points sur le plan.
// Une surface importée (LandXML, DXF) ne se modifie pas : on peut la renommer ou la supprimer.
import { creerLigne, detecterSeries, lireListeDeNoms, ecrireListeDeNoms, verifierSurface } from '../topo/noms.js';
import { creerSurface, estImportee } from '../topo/surface.js';
import { bulle } from '../aide/bulles.js';
import { echapper } from '../outils/echapper.js';

const TEXTES = {
  nouveau: '+ Nouvelle surface',
  nomParDefaut: (n) => `Surface ${n}`,
  supprimer: 'Supprimer cette surface',
  choix: 'Surface affichée',
  roles: { contour: 'Contour', ligne: 'Ligne de rupture', dessus: 'Points de la surface' },
};

/**
 * Crée l'écran dans "conteneur" ("barre" : barre du bas pendant une modification).
 * Options :
 * - obtenirPoints(objet) : points utilisables pour cet objet (son levé)
 * - quandChange() : appelé après chaque modification
 * - decrire(objet) : HTML d'état sous la surface (nombre de triangles, erreurs...)
 * - etiquette(objet) : texte de la surface dans la liste déroulante (nom et levé)
 * - ajouterPhotos(surface, fichiers) : prépare et range les photos choisies (voir photos/photo.js)
 * - leveActifId() : levé utilisé pour une nouvelle surface
 */
export function creerEditeurSurfaces(conteneur, barre, options) {
  const { obtenirPoints, quandChange, decrire, leveActifId, etiquette, ajouterPhotos } = options;
  const textes = TEXTES;
  const etat = {
    objets: [],
    indexActif: -1,
    edition: null, // rôle en cours de modification : { role, index }
    suppression: false, // surface : toucher un triangle le supprime / le rétablit
    messages: [], // erreurs de la dernière liste tapée
    listeCasesOuverte: false,
  };

  // --- Accès à la liste de noms du rôle en cours de modification ---

  function objetActif() {
    return etat.objets[etat.indexActif] ?? null;
  }

  function pointsDe(objet) {
    return objet ? obtenirPoints(objet) : [];
  }

  function listeDuRole(objet, edition) {
    if (edition.role === 'contour') return objet.contour;
    if (edition.role === 'ligne') return objet.lignesRupture[edition.index].noms;
    return objet.points;
  }

  function remplacerListe(noms) {
    const objet = objetActif();
    const { role, index } = etat.edition;
    if (role === 'contour') objet.contour = noms;
    else if (role === 'ligne') objet.lignesRupture[index].noms = noms;
    else objet.points = noms;
  }

  function nomRole(edition) {
    return edition.role === 'ligne' ? `${textes.roles.ligne} ${edition.index + 1}` : textes.roles[edition.role];
  }

  // --- Modifications ---

  function changer() {
    afficher();
    quandChange();
  }

  /** Ajoute le point à la fin de la liste en cours, ou l'enlève s'il y est déjà. */
  function basculerPoint(nom) {
    if (!etat.edition) return;
    const liste = listeDuRole(objetActif(), etat.edition);
    remplacerListe(liste.includes(nom) ? liste.filter((n) => n !== nom) : [...liste, nom]);
    etat.messages = [];
    changer();
  }

  /** Ajoute une ligne de rupture indépendante avec ces points, et passe à sa modification. */
  function nouvelleLigne(noms) {
    const objet = objetActif();
    objet.lignesRupture.push({ ...creerLigne(), noms: [...noms] });
    etat.edition = { role: 'ligne', index: objet.lignesRupture.length - 1 };
  }

  const actions = {
    nouveau: () => {
      const nom = textes.nomParDefaut(etat.objets.length + 1);
      etat.objets.push(creerSurface(nom, leveActifId()));
      etat.indexActif = etat.objets.length - 1;
      // On commence par le contour : c'est lui qui délimite le stock ou le terrassement.
      etat.edition = { role: 'contour' };
      etat.suppression = false;
    },
    supprimer: () => {
      const objet = objetActif();
      if (!objet || !confirm(`Supprimer « ${objet.nom} » ?`)) return;
      etat.objets.splice(etat.indexActif, 1);
      etat.indexActif = Math.min(etat.indexActif, etat.objets.length - 1);
      etat.edition = null;
      etat.suppression = false;
    },
    modifier: (bouton) => {
      etat.edition = { role: bouton.dataset.role, index: Number(bouton.dataset.index ?? 0) };
      etat.suppression = false;
      etat.messages = [];
    },
    termine: () => {
      etat.edition = null;
      etat.suppression = false;
      etat.messages = [];
    },
    'retirer-dernier': () => remplacerListe(listeDuRole(objetActif(), etat.edition).slice(0, -1)),
    vider: () => remplacerListe([]),
    'utiliser-serie': (bouton) => {
      const serie = detecterSeries(pointsDe(objetActif()).map((p) => p.nom))[Number(bouton.dataset.index)];
      const liste = listeDuRole(objetActif(), etat.edition);
      if (etat.edition.role === 'ligne' && liste.length > 0) {
        // Ligne de rupture déjà commencée : la série devient une nouvelle ligne, indépendante
        // (elle n'est pas reliée à la ligne précédente).
        nouvelleLigne(serie);
      } else {
        // Contour, points... : la série est ajoutée à la fin (sans répéter les points déjà dedans).
        remplacerListe([...liste, ...serie.filter((nom) => !liste.includes(nom))]);
      }
      etat.messages = [];
    },
    appliquer: () => {
      const texte = conteneur.querySelector('[data-champ="liste"]').value;
      const nomsExistants = pointsDe(objetActif()).map((p) => p.nom);
      if (etat.edition.role === 'ligne') {
        // Lignes de rupture : le point-virgule sépare des lignes indépendantes
        // (« h1 à h31; h100 à h114 » donne 2 lignes), la virgule continue la même ligne.
        const morceaux = texte.split(';').filter((m) => m.trim() !== '');
        const lectures = (morceaux.length > 0 ? morceaux : ['']).map((m) => lireListeDeNoms(m, nomsExistants));
        remplacerListe(lectures[0].noms);
        for (const lecture of lectures.slice(1)) if (lecture.noms.length > 0) nouvelleLigne(lecture.noms);
        etat.messages = lectures.flatMap((l) => l.erreurs);
        return;
      }
      const resultat = lireListeDeNoms(texte, nomsExistants);
      remplacerListe(resultat.noms);
      etat.messages = resultat.erreurs;
    },
    'ajouter-ligne': () => {
      const objet = objetActif();
      objet.lignesRupture.push(creerLigne());
      etat.edition = { role: 'ligne', index: objet.lignesRupture.length - 1 };
    },
    'supprimer-ligne': (bouton) => {
      const objet = objetActif();
      objet.lignesRupture.splice(Number(bouton.dataset.index), 1);
      if (objet.lignesRupture.length === 0) objet.lignesRupture.push(creerLigne());
      etat.edition = null;
    },
    // Surfaces : suppression de triangles au doigt
    'mode-suppression': () => {
      etat.suppression = !etat.suppression;
      etat.edition = null;
    },
    'retablir-triangles': () => {
      objetActif().trianglesSupprimes = [];
    },
    'supprimer-photo': (bouton) => {
      const surface = objetActif();
      if (!confirm('Supprimer cette photo ?')) return;
      surface.photos = surface.photos.filter((photo) => photo.id !== bouton.dataset.id);
    },
  };

  // Un seul écouteur pour tous les boutons de l'écran et de la barre.
  for (const zone of [conteneur, barre]) {
    zone.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-action]');
      if (!bouton || !actions[bouton.dataset.action]) return;
      actions[bouton.dataset.action](bouton);
      changer();
    });
  }

  conteneur.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    const objet = objetActif();
    if (cible.dataset.champ === 'choix') {
      etat.indexActif = Number(cible.value);
      etat.edition = null;
      etat.suppression = false;
    } else if (cible.dataset.champ === 'nom') {
      objet.nom = cible.value.trim() || objet.nom;
    } else if (cible.dataset.champ === 'ligne-fermee') {
      objet.lignesRupture[Number(cible.dataset.index)].fermee = cible.checked;
    } else if (cible.dataset.champ === 'tous-les-points') {
      objet.tousLesPoints = cible.checked;
      etat.edition = cible.checked ? null : { role: 'dessus', index: 0 };
    } else if (cible.dataset.champ === 'legende-photo') {
      const photo = objet.photos.find((p) => p.id === cible.dataset.id);
      if (photo) photo.legende = cible.value.trim();
    } else if (cible.dataset.champ === 'fichier-photo') {
      if (cible.files.length > 0) ajouterPhotos?.(objet, [...cible.files]);
      return;
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
    const objet = objetActif();

    let html = `
      <div class="ligne-outils">
        ${
          etat.objets.length > 0
            ? `<select data-champ="choix" aria-label="${textes.choix}">
                ${etat.objets.map((o, i) => `<option value="${i}" ${i === etat.indexActif ? 'selected' : ''}>${echapper(etiquette?.(o) ?? o.nom)}</option>`).join('')}
              </select>`
            : ''
        }
        <button type="button" class="bouton" data-action="nouveau">${textes.nouveau}</button>
      </div>`;

    if (objet) {
      html += `
        <div class="ligne-outils">
          <label>Nom : <input type="text" data-champ="nom" value="${echapper(objet.nom)}" /></label>
          <button type="button" class="bouton-secondaire" data-action="supprimer">${textes.supprimer}</button>
        </div>
        ${contenuSurface(objet)}`;
    }

    conteneur.innerHTML = html;
    afficherBarre();
  }

  /** Cartes d'une surface : contour, lignes de rupture, points, triangles supprimés, état. */
  function contenuSurface(surface) {
    if (estImportee(surface)) {
      return `<p class="aide">Surface importée du fichier « ${echapper(surface.nomFichier)} » (${surface.type === 'dxf' ? 'DXF' : 'LandXML'}).</p>${decrire?.(surface) ?? ''}${cartePhotos(surface)}`;
    }
    const problemes = verifierSurface(surface, pointsDe(surface).map((p) => p.nom));
    return `
      ${carteRole(surface, { role: 'contour' }, 'contour')}
      ${cartesLignes(surface)}
      <div class="carte-role ${estEnEdition({ role: 'dessus' }) ? 'en-edition' : ''}">
        <div class="titre-role"><strong>${textes.roles.dessus} ${bulle('pointsSurface')}</strong></div>
        <label class="case"><input type="checkbox" data-champ="tous-les-points" ${surface.tousLesPoints ? 'checked' : ''} /> tous les points du levé${surface.contour.length >= 3 ? ' (dans le contour)' : ''}</label>
        ${surface.tousLesPoints ? '' : contenuRole(surface, { role: 'dessus' })}
      </div>
      <div class="carte-role ${etat.suppression ? 'en-edition' : ''}">
        <div class="titre-role"><strong>Triangles en trop ${bulle('trianglesEnTrop')}</strong></div>
        <p>${surface.trianglesSupprimes.length} triangle(s) supprimé(s).</p>
        <div class="ligne-outils">
          <button type="button" class="${etat.suppression ? 'bouton' : 'bouton-secondaire'}" data-action="mode-suppression">${etat.suppression ? 'Mode suppression actif' : 'Supprimer des triangles au doigt'}</button>
          <button type="button" class="bouton-secondaire" data-action="retablir-triangles" ${surface.trianglesSupprimes.length === 0 ? 'disabled' : ''}>Tout rétablir</button>
        </div>
      </div>
      ${
        problemes.length > 0
          ? `<div class="avertissement"><p><strong>À compléter :</strong></p><ul>${problemes.map((p) => `<li>${echapper(p)}</li>`).join('')}</ul></div>`
          : ''
      }
      ${decrire?.(surface) ?? ''}
      ${cartePhotos(surface)}`;
  }

  /** Photos de la surface (pour le compte rendu PDF) : miniatures, légendes, ajout. */
  function cartePhotos(surface) {
    const photos = surface.photos ?? [];
    return `
      <div class="carte-role">
        <div class="titre-role"><strong>Photos ${bulle('photos')}</strong><span class="aide">${photos.length}</span></div>
        <div class="liste-photos">
          ${photos
            .map(
              (photo) => `
            <figure class="photo">
              <img src="${photo.miniature}" alt="${echapper(photo.legende || surface.nom)}" />
              <input type="text" data-champ="legende-photo" data-id="${photo.id}" value="${echapper(photo.legende)}" placeholder="Légende" aria-label="Légende de la photo" />
              <button type="button" class="bouton-lien" data-action="supprimer-photo" data-id="${photo.id}">supprimer</button>
            </figure>`,
            )
            .join('')}
        </div>
        <label class="bouton-secondaire">
          + Ajouter une photo
          <input type="file" data-champ="fichier-photo" accept="image/*" multiple hidden />
        </label>
      </div>`;
  }

  function cartesLignes(objet) {
    return `
      ${objet.lignesRupture
        .map((_, index) => carteRole(objet, { role: 'ligne', index }, 'ligne', true))
        .join('')}
      <button type="button" class="bouton-secondaire" data-action="ajouter-ligne">+ Ajouter une ligne de rupture</button>`;
  }

  /** Une carte pour un rôle : titre (avec sa bulle d'aide), liste des points, et bouton pour la modifier. */
  function carteRole(objet, edition, cleAide, supprimable = false) {
    return `
      <div class="carte-role ${estEnEdition(edition) ? 'en-edition' : ''}">
        <div class="titre-role">
          <strong>${nomRole(edition)} ${bulle(cleAide)}</strong>
          ${supprimable && objet.lignesRupture.length > 1 ? `<button type="button" class="bouton-lien" data-action="supprimer-ligne" data-index="${edition.index}">supprimer</button>` : ''}
        </div>
        ${contenuRole(objet, edition)}
      </div>`;
  }

  /** Contenu d'une carte : résumé de la liste, ou outils de modification si elle est en cours. */
  function contenuRole(objet, edition) {
    const liste = listeDuRole(objet, edition);
    const resume = liste.length > 0 ? `${echapper(ecrireListeDeNoms(liste))} <span class="aide">(${liste.length} pt)</span>` : '<span class="aide">aucun point</span>';

    if (!estEnEdition(edition)) {
      return `
        <p class="liste-noms">${resume}</p>
        <button type="button" class="bouton-secondaire" data-action="modifier" data-role="${edition.role}" data-index="${edition.index ?? 0}">Modifier</button>`;
    }

    const points = pointsDe(objet);
    const series = detecterSeries(points.map((p) => p.nom));
    const nomsUtilises = new Set(etat.objets.filter((o) => o.leveId === objet.leveId).flatMap(nomsDeLObjet));
    return `
      <p class="titre-choix">Choisir les points ${bulle('choisirPoints')}</p>
      ${
        edition.role === 'ligne'
          ? `<label class="case"><input type="checkbox" data-champ="ligne-fermee" data-index="${edition.index}" ${objet.lignesRupture[edition.index].fermee ? 'checked' : ''} /> ligne fermée (le dernier point est relié au premier)</label>`
          : ''
      }
      ${
        series.length > 0
          ? `<p class="aide">Séries du fichier :</p>
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
    const objet = objetActif();
    if (!objet || (!etat.edition && !etat.suppression)) {
      barre.hidden = true;
      return;
    }
    barre.hidden = false;
    if (etat.suppression) {
      barre.innerHTML = `
        <div class="barre-texte"><strong>${echapper(objet.nom)} · suppression de triangles</strong> : touche un triangle sur le plan (${objet.trianglesSupprimes.length} supprimé(s))</div>
        <div class="ligne-outils"><button type="button" class="bouton" data-action="termine">Terminé</button></div>`;
      return;
    }
    const liste = listeDuRole(objet, etat.edition);
    barre.innerHTML = `
      <div class="barre-texte"><strong>${echapper(objet.nom)} · ${nomRole(etat.edition)}</strong> : ${liste.length} point(s)${liste.length > 0 ? `, dernier ${echapper(liste.at(-1))}` : ''}</div>
      <div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="retirer-dernier" ${liste.length === 0 ? 'disabled' : ''}>Retirer le dernier</button>
        <button type="button" class="bouton-secondaire" data-action="vider" ${liste.length === 0 ? 'disabled' : ''}>Vider</button>
        <button type="button" class="bouton" data-action="termine">Terminé</button>
      </div>`;
  }

  afficher();

  return {
    /** Appelé quand on touche un point sur le plan pendant une modification. */
    toucherPoint: basculerPoint,
    /** Surface : supprime le triangle (clé) s'il est présent, sinon le rétablit. */
    basculerTriangle(cle) {
      const surface = objetActif();
      if (!surface || !etat.suppression) return;
      const liste = surface.trianglesSupprimes;
      surface.trianglesSupprimes = liste.includes(cle) ? liste.filter((c) => c !== cle) : [...liste, cle];
      changer();
    },
    /** À appeler quand les données changent ailleurs (import, autre onglet). */
    rafraichir: afficher,
    /**
     * Remplace la liste des surfaces (par exemple à l'ouverture d'un autre projet).
     * garderPosition : après « Annuler », on reste sur le même objet et la même modification si possible.
     */
    charger(objets, { garderPosition = false } = {}) {
      etat.objets = objets;
      if (garderPosition) {
        etat.indexActif = Math.min(Math.max(etat.indexActif, 0), objets.length - 1);
        const objet = objetActif();
        const ligneDisparue = etat.edition?.role === 'ligne' && etat.edition.index >= (objet?.lignesRupture.length ?? 0);
        if (!objet || ligneDisparue) etat.edition = null;
        if (!objet) etat.suppression = false;
      } else {
        etat.indexActif = objets.length > 0 ? 0 : -1;
        etat.edition = null;
        etat.suppression = false;
      }
      afficher();
    },
    /** Arrête la modification en cours (quand un autre écran commence une modification). */
    arreterModification() {
      if (!etat.edition && !etat.suppression) return;
      etat.edition = null;
      etat.suppression = false;
      afficher();
    },
    enModification: () => Boolean(etat.edition || etat.suppression),
    enSuppression: () => etat.suppression,
    objetActif,
    /** Ce que le plan doit montrer : objets, objet actif et liste en cours. */
    obtenirDessin() {
      const objet = objetActif();
      return {
        stocks: etat.objets,
        stockActif: objet,
        listeEnCours: objet && etat.edition ? listeDuRole(objet, etat.edition) : [],
        enEdition: Boolean(objet && etat.edition),
      };
    },
    /** Choisit l'objet affiché (par exemple en le touchant sur le plan). */
    choisir(index) {
      if (index === etat.indexActif) return;
      etat.indexActif = index;
      etat.edition = null;
      etat.suppression = false;
      changer();
    },
  };
}

/** Tous les noms utilisés dans une surface, quel que soit leur rôle. */
function nomsDeLObjet(objet) {
  return [
    ...(objet.contour ?? []),
    ...(objet.lignesRupture ?? []).flatMap((ligne) => ligne.noms),
    ...(objet.points ?? []).filter((p) => typeof p === 'string'),
  ];
}
