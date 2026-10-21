// Onglet 3. Mesures : longueurs et aires, en 2D et en 3D, à part des surfaces et des volumes.
// Les points se choisissent comme pour une surface : séries, liste de noms tapée, cases à
// cocher, ou en touchant les points sur le plan. Seuls les points importés (levé) servent.
// Chaque valeur a sa case « Plan et PDF » : ce qui est coché s'écrit sur le plan et dans le PDF.
import { lireListeDeNoms, detecterSeries, creerLigne, verifierSurface } from '../topo/noms.js';
import { creerMesure, nomDeMesureLibre, nomsDeLaMesure } from '../topo/mesure.js';
import { formaterNombre } from '../topo/format.js';
import { htmlChoixPoints, resumeListe } from '../surfaces/choix-points.js';
import { VALEURS, TEXTE_MORCEAUX, NOM_TYPE, valeursMorceau } from './valeurs.js';
import { bulle } from '../aide/bulles.js';
import { echapper } from '../outils/echapper.js';

// Nom des listes de points que l'on modifie, selon la sorte de mesure.
const ROLES = {
  points: 'Points de la longueur',
  contour: 'Contour de l\'aire',
  ligne: 'Ligne de rupture',
  dessus: 'Points isolés / caractéristiques',
};

/**
 * Crée l'écran dans "conteneur" ("barre" : barre de modification, visible aussi sur le plan).
 * Options :
 * - obtenirProjet() : projet ouvert (projet.mesures)
 * - obtenirPoints(mesure) : points du levé de la mesure
 * - obtenirResultat(mesure) : résultat du calcul (voir calculerMesure)
 * - leveActifId() : levé utilisé pour une nouvelle mesure (null s'il n'y a pas de points)
 * - etiquette(mesure) : texte de la mesure dans la liste déroulante
 * - quandChange() : après chaque modification
 */
export function creerEcranMesures(conteneur, barre, options) {
  const { obtenirProjet, obtenirPoints, obtenirResultat, leveActifId, etiquette, quandChange } = options;
  const etat = {
    idActif: null,
    edition: null, // liste en cours de modification : { role, index }
    messages: [], // erreurs de la dernière liste tapée
    casesOuvertes: false,
    detailOuvert: false, // tableau « Détail des morceaux »
  };

  const mesures = () => obtenirProjet().mesures;

  function mesureActive() {
    const liste = mesures();
    const active = liste.find((m) => m.id === etat.idActif);
    if (active) {
      // Ligne de rupture disparue (après « Annuler ») : la modification s'arrête.
      if (etat.edition?.role === 'ligne' && !active.lignesRupture?.[etat.edition.index]) etat.edition = null;
      return active;
    }
    // Sinon (mesure supprimée, ou aucune choisie) : pas de modification en cours, et on montre
    // la première mesure du levé affiché, ou la première tout court.
    etat.edition = null;
    const parDefaut = liste.find((m) => m.leveId === leveActifId()) ?? liste[0] ?? null;
    etat.idActif = parDefaut?.id ?? null;
    return parDefaut;
  }

  function listeDuRole(mesure, edition) {
    if (edition.role === 'contour') return mesure.contour;
    if (edition.role === 'ligne') return mesure.lignesRupture[edition.index].noms;
    return mesure.points;
  }

  function remplacerListe(noms) {
    const mesure = mesureActive();
    const { role, index } = etat.edition;
    if (role === 'contour') mesure.contour = noms;
    else if (role === 'ligne') mesure.lignesRupture[index].noms = noms;
    else mesure.points = noms;
  }

  const nomRole = (edition) => (edition.role === 'ligne' ? `${ROLES.ligne} ${edition.index + 1}` : ROLES[edition.role]);

  function changer() {
    afficher();
    quandChange();
  }

  /** Ajoute le point à la fin de la liste en cours, ou l'enlève s'il y est déjà. */
  function basculerPoint(nom) {
    if (!etat.edition) return;
    const liste = listeDuRole(mesureActive(), etat.edition);
    remplacerListe(liste.includes(nom) ? liste.filter((n) => n !== nom) : [...liste, nom]);
    etat.messages = [];
    changer();
  }

  /** Ajoute une ligne de rupture indépendante avec ces points, et passe à sa modification. */
  function nouvelleLigne(noms) {
    const mesure = mesureActive();
    mesure.lignesRupture.push({ ...creerLigne(), noms: [...noms] });
    etat.edition = { role: 'ligne', index: mesure.lignesRupture.length - 1 };
  }

  const actions = {
    nouvelle: (bouton) => {
      const type = bouton.dataset.type;
      const mesure = creerMesure(type, nomDeMesureLibre(mesures(), type), leveActifId());
      mesures().push(mesure);
      etat.idActif = mesure.id;
      // On commence tout de suite à choisir les points.
      etat.edition = { role: type === 'longueur' ? 'points' : 'contour', index: 0 };
      etat.messages = [];
    },
    supprimer: () => {
      const mesure = mesureActive();
      if (!mesure || !confirm(`Supprimer la mesure « ${mesure.nom} » ?`)) return;
      obtenirProjet().mesures = mesures().filter((m) => m !== mesure);
      etat.idActif = null;
      etat.edition = null;
    },
    modifier: (bouton) => {
      etat.edition = { role: bouton.dataset.role, index: Number(bouton.dataset.index ?? 0) };
      etat.messages = [];
    },
    termine: () => {
      etat.edition = null;
      etat.messages = [];
    },
    'retirer-dernier': () => remplacerListe(listeDuRole(mesureActive(), etat.edition).slice(0, -1)),
    vider: () => remplacerListe([]),
    'utiliser-serie': (bouton) => {
      const serie = detecterSeries(obtenirPoints(mesureActive()).map((p) => p.nom))[Number(bouton.dataset.index)];
      const liste = listeDuRole(mesureActive(), etat.edition);
      if (etat.edition.role === 'ligne' && liste.length > 0) {
        // Ligne de rupture déjà commencée : la série devient une nouvelle ligne, indépendante.
        nouvelleLigne(serie);
      } else {
        remplacerListe([...liste, ...serie.filter((nom) => !liste.includes(nom))]);
      }
      etat.messages = [];
    },
    // « Valider » : la liste tapée est prise, puis la saisie se ferme (sauf s'il y a une erreur à lire).
    valider: () => {
      const texte = conteneur.querySelector('[data-champ="liste"]').value;
      const nomsExistants = obtenirPoints(mesureActive()).map((p) => p.nom);
      if (etat.edition.role === 'ligne') {
        // Lignes de rupture : le point-virgule sépare des lignes indépendantes, comme pour une surface.
        const morceaux = texte.split(';').filter((m) => m.trim() !== '');
        const lectures = (morceaux.length > 0 ? morceaux : ['']).map((m) => lireListeDeNoms(m, nomsExistants));
        remplacerListe(lectures[0].noms);
        for (const lecture of lectures.slice(1)) if (lecture.noms.length > 0) nouvelleLigne(lecture.noms);
        etat.messages = lectures.flatMap((l) => l.erreurs);
      } else {
        const resultat = lireListeDeNoms(texte, nomsExistants);
        remplacerListe(resultat.noms);
        etat.messages = resultat.erreurs;
      }
      if (etat.messages.length === 0) etat.edition = null;
    },
    'ajouter-ligne': () => {
      const mesure = mesureActive();
      mesure.lignesRupture.push(creerLigne());
      etat.edition = { role: 'ligne', index: mesure.lignesRupture.length - 1 };
    },
    'supprimer-ligne': (bouton) => {
      const mesure = mesureActive();
      mesure.lignesRupture.splice(Number(bouton.dataset.index), 1);
      if (mesure.lignesRupture.length === 0) mesure.lignesRupture.push(creerLigne());
      etat.edition = null;
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
    const mesure = mesureActive();
    if (cible.dataset.champ === 'choix') {
      etat.idActif = cible.value;
      etat.edition = null;
    } else if (cible.dataset.champ === 'nom') {
      mesure.nom = cible.value.trim() || mesure.nom;
    } else if (cible.dataset.afficher) {
      mesure.afficher = { ...mesure.afficher, [cible.dataset.afficher]: cible.checked };
    } else if (cible.dataset.champ === 'ligne-fermee') {
      mesure.lignesRupture[Number(cible.dataset.index)].fermee = cible.checked;
    } else if (cible.dataset.champ === 'tous-les-points') {
      mesure.tousLesPoints = cible.checked;
      etat.edition = cible.checked ? null : { role: 'dessus', index: 0 };
    } else if (cible.dataset.case) {
      basculerPoint(cible.dataset.case);
      return;
    } else {
      return;
    }
    changer();
  });

  // On retient si la liste des cases et le détail des morceaux sont ouverts (gardés après chaque clic).
  conteneur.addEventListener(
    'toggle',
    (evenement) => {
      if (evenement.target.dataset.zone === 'cases') etat.casesOuvertes = evenement.target.open;
      if (evenement.target.dataset.zone === 'detail') etat.detailOuvert = evenement.target.open;
    },
    true,
  );

  // Valider la liste tapée avec la touche Entrée.
  conteneur.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter' && evenement.target.dataset.champ === 'liste') {
      actions.valider();
      changer();
    }
  });

  // --- Affichage ---

  function afficher() {
    const mesure = mesureActive();
    const liste = mesures();
    const sansPoints = !leveActifId();
    let html = `
      <div class="ligne-outils">
        <button type="button" class="bouton" data-action="nouvelle" data-type="longueur" ${sansPoints ? 'disabled' : ''}>+ Longueur</button>
        <button type="button" class="bouton" data-action="nouvelle" data-type="aire" ${sansPoints ? 'disabled' : ''}>+ Aire</button>
      </div>
      ${sansPoints ? '<p class="vide">Importe d\'abord un fichier de points (onglet 1. Importer).</p>' : ''}`;
    if (liste.length > 0) {
      html += `
        <div class="ligne-outils">
          <select data-champ="choix" aria-label="Mesure affichée">
            ${liste.map((m) => `<option value="${m.id}" ${m === mesure ? 'selected' : ''}>${echapper(etiquette?.(m) ?? m.nom)}</option>`).join('')}
          </select>
        </div>`;
    }
    if (mesure) html += contenuMesure(mesure);
    html += recapitulatif();
    conteneur.innerHTML = html;
    afficherBarre();
  }

  /** Nom, listes de points, puis valeurs de la mesure affichée. */
  function contenuMesure(mesure) {
    const points = obtenirPoints(mesure);
    const listes =
      mesure.type === 'longueur'
        ? carteListe(mesure, { role: 'points' }, '<p class="aide">Les points dans l\'ordre, du début à la fin (la ligne n\'est pas fermée).</p>')
        : `${carteListe(mesure, { role: 'contour' }, '<p class="aide">Fermé automatiquement (le dernier point est relié au premier).</p>')}
           ${mesure.lignesRupture.map((_, index) => carteListe(mesure, { role: 'ligne', index }, '', index === mesure.lignesRupture.length - 1)).join('')}
           <div class="carte-role role-mesure ${estEnEdition({ role: 'dessus' }) ? 'en-edition' : ''}">
             <div class="titre-role"><strong>${ROLES.dessus}</strong></div>
             <label class="case"><input type="checkbox" data-champ="tous-les-points" ${mesure.tousLesPoints ? 'checked' : ''} /> tous les points du levé (dans le contour)</label>
             ${mesure.tousLesPoints ? '' : contenuListe(mesure, { role: 'dessus' })}
           </div>`;
    const problemes = mesure.type === 'aire' ? verifierSurface(mesure, points.map((p) => p.nom)) : [];
    return `
      <div class="ligne-outils">
        <label>Nom : <input type="text" data-champ="nom" value="${echapper(mesure.nom)}" /></label>
        <button type="button" class="bouton-secondaire" data-action="supprimer">Supprimer cette mesure</button>
      </div>
      <p class="aide">${NOM_TYPE[mesure.type]}${mesure.type === 'aire' ? ' : 2D = aire du contour à plat, 3D = aire des triangles' : ' : 2D = à plat, 3D = distance inclinée'}.</p>
      ${listes}
      ${problemes.length > 0 ? `<div class="avertissement"><p><strong>À compléter :</strong></p><ul>${problemes.map((p) => `<li>${echapper(p)}</li>`).join('')}</ul></div>` : ''}
      ${carteValeurs(mesure)}`;
  }

  /** Une carte pour une liste de points (titre, résumé ou outils de modification). */
  function carteListe(mesure, edition, aide = '', avecAjout = false) {
    const supprimable = edition.role === 'ligne' && mesure.lignesRupture.length > 1;
    return `
      <div class="carte-role role-mesure ${estEnEdition(edition) ? 'en-edition' : ''}">
        <div class="titre-role">
          <strong>${nomRole(edition)}</strong>
          ${supprimable ? `<button type="button" class="bouton-lien" data-action="supprimer-ligne" data-index="${edition.index}">supprimer</button>` : ''}
        </div>
        ${aide}
        ${contenuListe(mesure, edition)}
        ${avecAjout ? '<div class="ligne-outils pied-role"><button type="button" class="bouton-secondaire" data-action="ajouter-ligne">+ Ajouter une ligne de rupture</button></div>' : ''}
      </div>`;
  }

  /** Résumé de la liste, ou outils de choix des points si elle est en cours de modification. */
  function contenuListe(mesure, edition) {
    const liste = listeDuRole(mesure, edition);
    if (!estEnEdition(edition)) {
      return `
        <p class="liste-noms">${resumeListe(liste)}</p>
        <button type="button" class="bouton-secondaire" data-action="modifier" data-role="${edition.role}" data-index="${edition.index ?? 0}">Modifier</button>`;
    }
    return htmlChoixPoints({
      liste,
      points: obtenirPoints(mesure),
      nomsUtilises: new Set(mesures().filter((m) => m !== mesure && m.leveId === mesure.leveId).flatMap(nomsDeLaMesure)),
      messages: etat.messages,
      casesOuvertes: etat.casesOuvertes,
      enTete:
        edition.role === 'ligne'
          ? `<label class="case"><input type="checkbox" data-champ="ligne-fermee" data-index="${edition.index}" ${mesure.lignesRupture[edition.index].fermee ? 'checked' : ''} /> ligne fermée (le dernier point est relié au premier)</label>`
          : '',
    });
  }

  /** Valeurs de la mesure, chacune avec sa case « Plan et PDF », puis le détail des morceaux. */
  function carteValeurs(mesure) {
    const resultat = obtenirResultat(mesure);
    if (!resultat) return '';
    if (resultat.erreurs) {
      return `<div class="erreur"><ul>${resultat.erreurs.map((e) => `<li>${echapper(e)}</li>`).join('')}</ul></div>`;
    }
    const coche = (cle) => (mesure.afficher?.[cle] ? 'checked' : '');
    const lignes = VALEURS[mesure.type]
      .map(
        (v) => `<tr>
          <td>${v.titre}</td>
          <td class="nombre"><strong>${v.ecrire(resultat)}</strong></td>
          <td class="case-plan"><input type="checkbox" data-afficher="${v.cle}" ${coche(v.cle)} aria-label="${v.titre} sur le plan et dans le PDF" /></td>
        </tr>`,
      )
      .join('');
    const morceau = mesure.type === 'longueur' ? 'Morceau' : 'Côté';
    return `
      <div class="carte-valeurs">
        <div class="titre-role"><strong>Valeurs ${bulle('valeursMesure')}</strong></div>
        <table class="tableau-valeurs">
          <thead><tr><th></th><th class="nombre"></th><th class="case-plan">Plan et PDF</th></tr></thead>
          <tbody>
            ${lignes}
            <tr><td colspan="2">${TEXTE_MORCEAUX[mesure.type]}</td><td class="case-plan"><input type="checkbox" data-afficher="morceaux" ${coche('morceaux')} aria-label="${TEXTE_MORCEAUX[mesure.type]}" /></td></tr>
          </tbody>
        </table>
        ${resultat.triangles ? `<p class="aide">${resultat.triangles.length} triangles.</p>` : ''}
        ${resultat.avertissements?.length > 0 ? `<div class="avertissement"><ul>${resultat.avertissements.map((a) => `<li>${echapper(a)}</li>`).join('')}</ul></div>` : ''}
        <details data-zone="detail" ${etat.detailOuvert ? 'open' : ''}>
          <summary>Détail : ${resultat.morceaux.length} ${morceau.toLowerCase()}(s)</summary>
          <div class="tableau-defilant">
            <table class="tableau-morceaux">
              <thead><tr><th>${morceau}</th><th class="nombre">L 2D</th><th class="nombre">L 3D</th><th class="nombre">Déniv.</th><th class="nombre">Pente</th></tr></thead>
              <tbody>
                ${resultat.morceaux
                  .map(
                    (m) => `<tr><td>${echapper(m.debut.nom)} → ${echapper(m.fin.nom)}</td>${valeursMorceau(m)
                      .map((v) => `<td class="nombre">${v}</td>`)
                      .join('')}</tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </details>
      </div>`;
  }

  /** Tableau de toutes les mesures du projet : nom, sorte, valeur 2D et 3D. */
  function recapitulatif() {
    const liste = mesures();
    if (liste.length === 0) return '';
    const lignes = liste.map((m) => {
      const r = obtenirResultat(m);
      const unite = m.type === 'longueur' ? 'm' : 'm²';
      const [v2d, v3d] = m.type === 'longueur' ? [r?.l2d, r?.l3d] : [r?.a2d, r?.a3d];
      const valeur = (v) => (r && !r.erreurs ? `${formaterNombre(v)} ${unite}` : '-');
      return `<tr><td>${echapper(etiquette?.(m) ?? m.nom)}</td><td class="nombre">${valeur(v2d)}</td><td class="nombre">${valeur(v3d)}</td></tr>`;
    });
    return `
      <h3>Récapitulatif</h3>
      <div class="tableau-defilant">
        <table class="tableau-recap-mesures">
          <thead><tr><th>Mesure</th><th class="nombre">2D</th><th class="nombre">3D</th></tr></thead>
          <tbody>${lignes.join('')}</tbody>
        </table>
      </div>`;
  }

  function estEnEdition(edition) {
    return (
      etat.edition !== null &&
      etat.edition.role === edition.role &&
      (edition.role !== 'ligne' || etat.edition.index === edition.index)
    );
  }

  /** Barre de modification : visible même en regardant le plan. */
  function afficherBarre() {
    const mesure = mesureActive();
    if (!mesure || !etat.edition) {
      barre.hidden = true;
      return;
    }
    barre.hidden = false;
    barre.dataset.role = 'mesure';
    const liste = listeDuRole(mesure, etat.edition);
    barre.innerHTML = `
      <div class="barre-texte"><strong>${echapper(mesure.nom)} · ${nomRole(etat.edition)}</strong> : ${liste.length} point(s)${liste.length > 0 ? `, dernier ${echapper(liste.at(-1))}` : ''}</div>
      <div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="retirer-dernier" ${liste.length === 0 ? 'disabled' : ''}>Retirer le dernier</button>
        <button type="button" class="bouton-secondaire" data-action="vider" ${liste.length === 0 ? 'disabled' : ''}>Vider</button>
        <button type="button" class="bouton" data-action="termine">Terminé</button>
      </div>`;
  }

  return {
    afficher,
    /** Appelé quand on touche un point sur le plan pendant une modification. */
    toucherPoint: basculerPoint,
    /** Choisit la mesure affichée (par exemple en la touchant sur le plan). */
    choisir(id) {
      if (id === etat.idActif) return;
      etat.idActif = id;
      etat.edition = null;
      changer();
    },
    /** Arrête la modification en cours (en quittant l'onglet, ou après « Annuler »). */
    arreterModification() {
      if (!etat.edition) return;
      etat.edition = null;
      afficher();
    },
    enModification: () => Boolean(etat.edition),
    mesureActive,
    /** Liste en cours de modification (pour l'entourer sur le plan). */
    listeEnCours: () => (etat.edition && mesureActive() ? listeDuRole(mesureActive(), etat.edition) : []),
  };
}
