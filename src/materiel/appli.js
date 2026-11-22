// Application « Matériel » (0.274.0, Expert, site seulement, demande du 22.11) : le parc de l'entreprise
// (un seul pour tous les projets), repris de l'appli « Planning du matériel ». Page plein écran à part
// (comme les Réglages) : Parc (liste, fiche d'un article), Chantiers, Catégories. Le planning du mois et
// ses exports viennent ensuite (étape 2), puis la comparaison avec le recap des tablettes (étape 3).
// Les calculs et contrôles sont dans donnees.js ; ici seulement l'écran, l'enregistrement et Drive.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { demanderChoix, demanderTexte } from '../outils/choix.js';
import { demanderCode } from '../outils/code.js';
import {
  STATUTS, PALETTE_MATERIEL, normaliserParc, categoriesTriees, articlesTries, filtrerArticles, ajouterArticle,
  modifierArticle, supprimerArticle, deplacerArticle, champsDupliques, couleurProposee, recolorerParc, valeurDuParc,
  ajouterCategorie, renommerCategorie, supprimerCategorie, deplacerCategorie, ajouterChantier, modifierChantier,
  supprimerChantier, chantiersTries, responsables, chantierDuProjet, projetsSansChantier, cleNumeroDuProjet,
  normaliserNumeroChantier, dateSuisse, montantSuisse, texteSurCouleur, nouvelId,
} from './donnees.js';
import {
  lireParcLocal, enregistrerParcLocal, lireFichierLocal, enregistrerFichierLocal, supprimerFichierLocal,
  listerFichiersLocaux, lireEtatDrive, ecrireEtatDrive, choixSynchro, enregistrerCopieAvantRestauration,
} from './stockage.js';
import { creerEcranPlanning } from './ecran-planning.js';
import { affectationDuJour, historiqueArticle, nomDuChantier, responsableDe, nombreDeJours, aujourdhui, finsProches } from './planning.js';
import { creerSauvegarde, lireSauvegarde, nomSauvegarde } from './sauvegarde.js';
import { creerXlsx } from '../recap/xlsx.js';

const PAGES = [['planning', 'Planning'], ['parc', 'Parc'], ['chantiers', 'Chantiers'], ['categories', 'Catégories'], ['sauvegarde', 'Sauvegarde']];
const TAILLE_MAX_FICHIER = 5 * 1024 * 1024; // limite d'un envoi sur Drive
const COTE_MAX_PHOTO = 1600; // photo réduite (px) avant d'être gardée
const ATTENTE_ENVOI_MS = 1500;
const libelleStatut = (s) => STATUTS.find(([c]) => c === s)?.[1] ?? s;

// Colonnes du tableau du parc : [clé, titre, valeur pour le tri].
const COLONNES = [
  ['numero', 'N°', (a) => a.numero],
  ['designation', 'Désignation', (a) => a.designation],
  ['categorie', 'Catégorie', (a, p) => p.categories.find((c) => c.id === a.categorieId)?.nom ?? ''],
  ['codeCompta', 'Code compta', (a) => a.codeCompta],
  ['statut', 'Statut', (a) => libelleStatut(a.statut)],
  ['marque', 'Marque / modèle', (a) => `${a.marque} ${a.modele}`.trim()],
  ['numeroSerie', 'N° de série', (a) => a.numeroSerie],
  ['prixChf', 'Prix CHF', (a) => a.prixChf ?? -1],
  ['ou', 'Où aujourd\'hui ?', (a, p) => ouAujourdhui(p, a)],
];

/** « 10 203 – OFROU PAB » (chantier du jour), « Dépôt » (actif, pas affecté) ou ''. */
function ouAujourdhui(parc, article, jour = aujourdhui()) {
  const af = affectationDuJour(parc, article.id, jour);
  if (af) return nomDuChantier(parc.chantiers.find((c) => c.id === af.chantierId));
  return article.statut === 'actif' ? 'Dépôt' : '';
}

/**
 * Ouvre la page Matériel. materiel : accès Drive (partage.materiel, voir partage.js) ou null ;
 * nomsProjets() : noms des projets connus (appareil et Drive), pour relier chantiers et projets ;
 * quandRetour() : après « ← » ; message(texte, durée, options) : message en haut de l'écran.
 */
export async function ouvrirMateriel({ materiel = null, nomsProjets = async () => [], quandRetour = null, message = () => {}, enregistrer = null }) {
  const page = document.createElement('dialog');
  page.className = 'page-materiel';
  page.innerHTML = '<p class="vide">Chargement du parc…</p>';
  document.body.append(page);
  page.showModal();

  let parc = normaliserParc(await lireParcLocal().catch(() => null));
  let etat = lireEtatDrive();
  let partie = 'planning';
  let fiche = null; // { id (null = nouvel article), brouillon (champs proposés), mdpVisible }
  let chantierEdite = null; // id du chantier dans le formulaire, 'nouveau', ou null
  const filtre = { texte: '', categorieId: '', statut: '' };
  const tri = { colonne: null, sens: 1 };
  let projets = [];
  let etatDrive = { quoi: materiel?.connecte() ? 'attente' : 'hors', texte: '' };
  let minuterieEnvoi = null;
  const adresses = new Map(); // id du fichier → adresse blob: (libérées à la fermeture)

  // --- Enregistrement : sur l'appareil tout de suite, sur Drive peu après ---

  /** Applique un changement (fonction qui modifie le parc) ; une erreur est affichée, rien n'est enregistré. */
  async function changer(action) {
    let resultat;
    try {
      resultat = action(parc);
    } catch (erreur) {
      message(erreur.message, 6000);
      return { ok: false };
    }
    parc.modifieLe = new Date().toISOString();
    await enregistrerParcLocal(parc);
    etat = { ...etat, aEnvoyer: true };
    ecrireEtatDrive(etat);
    clearTimeout(minuterieEnvoi);
    minuterieEnvoi = setTimeout(() => synchroniser(), ATTENTE_ENVOI_MS);
    return { ok: true, resultat };
  }

  /** Photos et documents ajoutés ici et pas encore sur Drive. */
  async function envoyerFichiers() {
    for (const f of await listerFichiersLocaux()) {
      if (f.envoye) continue;
      await materiel.ecrireFichier(f.id, f.nom || f.id, f.blob);
      await enregistrerFichierLocal({ ...f, envoye: true });
    }
  }

  /** Compare avec Drive : envoie ce qui a changé ici, ou prend la version de Drive (voir choixSynchro). */
  async function synchroniser() {
    if (!materiel?.connecte()) {
      etatDrive = { quoi: 'hors', texte: '' };
      dessinerEtat();
      return;
    }
    etatDrive = { quoi: 'envoi', texte: '' };
    dessinerEtat();
    try {
      const distant = await materiel.date();
      let choix = choixSynchro(distant, etat);
      if (choix === 'conflit') {
        const reponse = await demanderChoix({
          titre: 'Parc modifié sur un autre appareil',
          texte: 'Le parc a aussi changé sur Drive depuis le dernier échange avec ce PC.',
          boutons: [
            { cle: 'drive', texte: 'Prendre la version de Drive', detail: 'les changements faits ici depuis sont perdus', principal: true },
            { cle: 'ici', texte: 'Garder la version de ce PC', detail: 'elle remplace celle de Drive' },
          ],
        });
        choix = reponse === 'ici' ? 'envoyer' : 'prendre';
      }
      if (choix === 'prendre') {
        const lu = await materiel.lire();
        parc = normaliserParc(lu?.parc);
        parc.modifieLe = lu?.modifieLe ?? parc.modifieLe;
        await enregistrerParcLocal(parc);
        etat = { vu: distant, aEnvoyer: false };
        materiel.retenirNoms(parc);
        dessiner();
      } else if (choix === 'envoyer') {
        await envoyerFichiers();
        await materiel.ecrire(parc);
        etat = { vu: parc.modifieLe, aEnvoyer: false };
        materiel.retenirNoms(parc);
      } else if (!etat.vu && distant) etat = { ...etat, vu: distant };
      ecrireEtatDrive(etat);
      etatDrive = { quoi: 'ok', texte: '' };
    } catch (erreur) {
      etatDrive = { quoi: 'erreur', texte: erreur.message };
    }
    dessinerEtat();
  }

  // --- Fichiers joints (photo, documents) ---

  /** Adresse (blob:) d'un fichier joint, lu ici ou sur Drive ; null s'il est introuvable. */
  async function adresseFichier(id) {
    if (adresses.has(id)) return adresses.get(id);
    let fichier = await lireFichierLocal(id).catch(() => null);
    if (!fichier && materiel?.connecte()) {
      const blob = await materiel.lireFichier(id).catch(() => null);
      if (blob) {
        fichier = { id, nom: '', type: blob.type, blob, envoye: true };
        await enregistrerFichierLocal(fichier).catch(() => {});
      }
    }
    if (!fichier) return null;
    const adresse = URL.createObjectURL(fichier.blob);
    adresses.set(id, adresse);
    return adresse;
  }

  /** Photo réduite (1600 px au plus, JPEG) : les photos d'appareil font souvent plus de 5 Mo. */
  async function reduirePhoto(fichier) {
    let image;
    try {
      image = await createImageBitmap(fichier);
    } catch {
      throw new Error('photo illisible (format non lu par le navigateur : l\'enregistrer en JPEG ou PNG)');
    }
    const echelle = Math.min(1, COTE_MAX_PHOTO / Math.max(image.width, image.height));
    const toile = document.createElement('canvas');
    toile.width = Math.round(image.width * echelle);
    toile.height = Math.round(image.height * echelle);
    toile.getContext('2d').drawImage(image, 0, 0, toile.width, toile.height);
    return new Promise((resoudre, rejeter) => toile.toBlob((b) => (b ? resoudre(b) : rejeter(new Error('photo non enregistrée'))), 'image/jpeg', 0.85));
  }

  async function ajouterPhoto(articleId, fichier) {
    let blob;
    try {
      blob = await reduirePhoto(fichier);
    } catch (erreur) {
      message(`Photo non ajoutée : ${erreur.message}`, 6000);
      return;
    }
    const id = nouvelId('photo');
    await enregistrerFichierLocal({ id, nom: `${id}.jpg`, type: 'image/jpeg', blob, envoye: false });
    const ancienne = parc.articles.find((a) => a.id === articleId)?.photo;
    await changer((p) => { p.articles.find((a) => a.id === articleId).photo = id; });
    if (ancienne) oublierFichier(ancienne);
    dessiner();
  }

  async function ajouterDocuments(articleId, fichiers) {
    for (const fichier of fichiers) {
      if (fichier.size > TAILLE_MAX_FICHIER) {
        message(`« ${fichier.name} » non ajouté : trop gros pour Drive (${(fichier.size / 1e6).toFixed(1)} Mo, 5 Mo au plus)`, 8000);
        continue;
      }
      const id = nouvelId('doc');
      await enregistrerFichierLocal({ id, nom: fichier.name, type: fichier.type, blob: fichier, envoye: false });
      await changer((p) => { p.articles.find((a) => a.id === articleId).documents.push({ id, nom: fichier.name, ajouteLe: new Date().toISOString() }); });
    }
    dessiner();
  }

  /** Efface un fichier joint ici et sur Drive (sans réseau, il reste sur Drive : sans gêne). */
  function oublierFichier(id) {
    supprimerFichierLocal(id).catch(() => {});
    if (materiel?.connecte()) materiel.supprimerFichier(id).catch(() => {});
    if (adresses.has(id)) URL.revokeObjectURL(adresses.get(id));
    adresses.delete(id);
  }

  /** Fichier à garder (PDF, Excel, sauvegarde) : par l'outil d'export de l'appli. */
  function enregistrerFichier(blob, nom) {
    if (enregistrer) enregistrer(blob, nom);
    else {
      const lien = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nom });
      lien.click();
      setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
    }
  }

  const planning = creerEcranPlanning({ obtenirParc: () => parc, changer, message, enregistrer: enregistrerFichier, redessiner: () => dessiner() });
  planning.installer(page);

  // --- Dessin ---

  function dessinerEtat() {
    const zone = page.querySelector('[data-zone="etat-drive"]');
    if (!zone) return;
    const [texte, classe] = {
      hors: [etat.aEnvoyer ? 'Drive non connecté : enregistré sur ce PC seulement' : 'Drive non connecté', 'etat-attente'],
      attente: ['Drive : vérification…', 'etat-attente'],
      envoi: ['Drive : envoi…', 'etat-attente'],
      ok: ['Drive : à jour', 'etat-ok'],
      erreur: [`Drive : erreur (${etatDrive.texte})`, 'etat-erreur'],
    }[etatDrive.quoi];
    zone.className = `etat-partage ${classe}`;
    zone.textContent = texte;
  }

  function dessiner() {
    const enFiche = partie === 'parc' && fiche;
    page.innerHTML = `
      <header class="entete-materiel">
        <button type="button" class="retour-reglages" data-action="retour" aria-label="Retour aux applications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
        <h2>Matériel ${bulle('materiel')}</h2>
        <nav class="onglets-materiel" role="tablist" aria-label="Parties du matériel">
          ${PAGES.map(([cle, titre]) => `<button type="button" role="tab" data-partie="${cle}" aria-selected="${cle === partie}" class="${cle === partie ? 'actif' : ''}">${titre}</button>`).join('')}
        </nav>
        <span data-zone="etat-drive"></span>
      </header>
      <main class="contenu-materiel">
        ${enFiche ? htmlFiche() : { planning: () => planning.html(), parc: htmlParc, chantiers: htmlChantiers, categories: htmlCategories, sauvegarde: htmlSauvegarde }[partie]()}
      </main>`;
    dessinerEtat();
    if (partie === 'parc' && !fiche) dessinerTableau();
    if (enFiche) remplirPhoto();
  }

  // Parc : résumé, filtres, tableau.
  function htmlParc() {
    const cats = categoriesTriees(parc);
    const compte = (s) => parc.articles.filter((a) => a.statut === s).length;
    const jour = aujourdhui();
    const affectes = parc.articles.filter((a) => affectationDuJour(parc, a.id, jour));
    const affectesAujourdhui = affectes.length;
    const actifsAffectes = affectes.filter((a) => a.statut === 'actif').length;
    const fins = finsProches(parc, jour, 7);
    const numero = (af) => parc.articles.find((a) => a.id === af.articleId)?.numero ?? '?';
    return `
      <div class="resume-materiel">
        <span><strong>${parc.articles.length}</strong> articles</span>
        <span><strong>${compte('actif')}</strong> actifs</span>
        <span><strong>${compte('reparation')}</strong> en réparation</span>
        <span><strong>${affectesAujourdhui}</strong> sur un chantier aujourd'hui</span>
        <span><strong>${compte('actif') - actifsAffectes}</strong> disponibles au dépôt</span>
        <span>Valeur du parc <strong>${montantSuisse(valeurDuParc(parc)) || '0.00'}</strong> CHF</span>
      </div>
      ${fins.length ? `<p class="fins-proches"><strong>Fins dans les 7 jours :</strong> ${fins.map((af) => `${echapper(numero(af))} le ${dateSuisse(af.fin).slice(0, 5)}`).join(' · ')}</p>` : ''}
      <div class="barre-materiel">
        <input type="search" data-filtre="texte" value="${echapper(filtre.texte)}" placeholder="Chercher (n°, désignation, marque…)" aria-label="Chercher un article" />
        <select data-filtre="categorieId" aria-label="Catégorie"><option value="">Toutes les catégories</option>
          ${cats.map((c) => `<option value="${echapper(c.id)}" ${c.id === filtre.categorieId ? 'selected' : ''}>${echapper(c.nom)}</option>`).join('')}</select>
        <select data-filtre="statut" aria-label="Statut"><option value="">Tous les statuts</option>
          ${STATUTS.map(([c, t]) => `<option value="${c}" ${c === filtre.statut ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <button type="button" class="bouton" data-action="nouvel-article" ${cats.length ? '' : 'aria-disabled="true"'}>＋ Article</button>
        <button type="button" class="bouton-secondaire" data-action="excel-inventaire" ${parc.articles.length ? '' : 'aria-disabled="true"'}>Excel de l'inventaire</button>
      </div>
      ${cats.length ? '' : '<p class="aide">Créez d\'abord une catégorie (onglet Catégories), par ex. « Canne GPS ».</p>'}
      <div class="cadre-tableau-materiel" data-zone="tableau"></div>`;
  }

  /** Le tableau seul (redessiné à chaque lettre tapée dans « Chercher », sans perdre le curseur). */
  function dessinerTableau() {
    const zone = page.querySelector('[data-zone="tableau"]');
    if (!zone) return;
    let liste = filtrerArticles(parc, filtre);
    const colonne = COLONNES.find(([c]) => c === tri.colonne);
    if (colonne) {
      const valeur = (a) => colonne[2](a, parc);
      liste = [...liste].sort((a, b) => {
        const [x, y] = [valeur(a), valeur(b)];
        return tri.sens * (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'fr', { numeric: true }));
      });
    }
    const ordreLibre = !colonne && !filtre.texte && !filtre.statut;
    const nomCategorie = new Map(parc.categories.map((c) => [c.id, c.nom]));
    const parent = new Map(parc.articles.map((a) => [a.id, a.numero]));
    zone.innerHTML = liste.length === 0
      ? `<p class="vide">${parc.articles.length ? 'Aucun article ne correspond.' : 'Aucun article pour l\'instant.'}</p>`
      : `<table class="tableau-materiel">
        <thead><tr>${COLONNES.map(([c, t]) => `<th><button type="button" class="tri" data-tri="${c}">${t}${tri.colonne === c ? (tri.sens > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}<th><span class="sr">Ordre</span></th></tr></thead>
        <tbody>${liste.map((a) => `<tr data-article="${echapper(a.id)}" class="ligne-statut-${a.statut}">
          <td><span class="pastille-article" style="background:${a.couleur};color:${texteSurCouleur(a.couleur)}">${echapper(a.numero)}</span></td>
          <td>${echapper(a.designation)}${a.parentId ? ` <span class="aide">(accessoire de ${echapper(parent.get(a.parentId) ?? '?')})</span>` : ''}</td>
          <td>${echapper(nomCategorie.get(a.categorieId) ?? '')}</td>
          <td>${echapper(a.codeCompta)}</td>
          <td><span class="statut-materiel statut-${a.statut}">${libelleStatut(a.statut)}</span></td>
          <td>${echapper([a.marque, a.modele].filter(Boolean).join(' '))}</td>
          <td>${echapper(a.numeroSerie)}</td>
          <td class="nombre">${montantSuisse(a.prixChf)}</td>
          <td>${echapper(ouAujourdhui(parc, a))}</td>
          <td>${ordreLibre ? `<span class="ordre-materiel"><button type="button" data-action="monter-article" data-id="${echapper(a.id)}" aria-label="Monter ${echapper(a.numero)}">▲</button><button type="button" data-action="descendre-article" data-id="${echapper(a.id)}" aria-label="Descendre ${echapper(a.numero)}">▼</button></span>` : ''}</td>
        </tr>`).join('')}</tbody></table>`;
  }

  // Fiche d'un article (nouveau ou existant).
  function htmlFiche() {
    const article = fiche.id ? parc.articles.find((a) => a.id === fiche.id) : null;
    const v = article ?? fiche.brouillon ?? { categorieId: filtre.categorieId || categoriesTriees(parc)[0]?.id, statut: 'actif' };
    const couleur = v.couleur || couleurProposee(parc, v.categorieId);
    const champ = (nom, titre, { type = 'text', classe = '', attributs = '' } = {}) => {
      const valeur = ['dateAchat', 'finGarantie'].includes(nom) ? dateSuisse(v[nom]) : nom === 'prixChf' ? montantSuisse(v[nom]).replace(/'/g, '') : (v[nom] ?? '');
      return `<label class="champ-materiel ${classe}"><span>${titre}</span><input type="${type}" name="${nom}" value="${echapper(valeur)}" ${attributs} /></label>`;
    };
    const principaux = articlesTries(parc).filter((a) => !a.parentId && a.id !== fiche.id);
    const accessoires = article ? parc.articles.filter((a) => a.parentId === article.id) : [];
    return `
      <div class="entete-fiche">
        <button type="button" class="bouton-secondaire" data-action="retour-parc">← Parc</button>
        <h3>${article ? `Article ${echapper(article.numero)}` : 'Nouvel article'}</h3>
      </div>
      <form class="fiche-materiel" data-zone="fiche" autocomplete="off">
        <fieldset><legend>Identité</legend>
          <label class="champ-materiel"><span>Catégorie *</span><select name="categorieId">
            ${categoriesTriees(parc).map((c) => `<option value="${echapper(c.id)}" ${c.id === v.categorieId ? 'selected' : ''}>${echapper(c.nom)}</option>`).join('')}</select></label>
          <label class="champ-materiel"><span>Statut</span><select name="statut">
            ${STATUTS.map(([c, t]) => `<option value="${c}" ${c === v.statut ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          ${champ('numero', 'N° interne * (= n° de la tablette)', { attributs: 'required placeholder="ex. 953"' })}
          ${champ('codeCompta', 'Code compta (N° MS, à facturer)', { attributs: 'placeholder="ex. 112"' })}
          ${champ('designation', 'Désignation', { classe: 'large', attributs: 'placeholder="ex. Canne GPS RX2"' })}
          <label class="champ-materiel large"><span>Accessoire de</span><select name="parentId"><option value="">— aucun —</option>
            ${principaux.map((a) => `<option value="${echapper(a.id)}" ${a.id === v.parentId ? 'selected' : ''}>${echapper(a.numero)} ${echapper(a.designation)}</option>`).join('')}</select></label>
          <div class="champ-materiel large"><span>Couleur sur le planning</span>
            <div class="palette-materiel" role="group" aria-label="Couleur">
              ${PALETTE_MATERIEL.map((c) => `<button type="button" class="teinte ${c === couleur ? 'choisie' : ''}" data-action="couleur" data-couleur="${c}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join('')}
              <input type="color" name="couleur" value="${couleur.toLowerCase()}" aria-label="Autre couleur" />
            </div></div>
        </fieldset>
        <fieldset><legend>Achat et garantie</legend>
          ${champ('marque', 'Marque')}${champ('modele', 'Modèle')}${champ('numeroSerie', 'N° de série')}${champ('fournisseur', 'Fournisseur')}
          ${champ('dateAchat', 'Date d\'achat', { attributs: 'placeholder="JJ.MM.AAAA"' })}
          ${champ('prixChf', 'Prix (CHF)', { attributs: 'inputmode="decimal" placeholder="0.00"' })}
          ${champ('finGarantie', 'Fin de garantie', { attributs: 'placeholder="JJ.MM.AAAA"' })}
        </fieldset>
        <fieldset><legend>Téléphone et swipos</legend>
          ${champ('telephone', 'N° de téléphone (carte SIM)', { type: 'tel', attributs: 'placeholder="ex. 079 123 45 67"' })}
          ${champ('swiposNumero', 'N° swipos')}
          <div class="champ-materiel"><span>Mot de passe swipos</span>
            ${fiche.mdpVisible
              ? `<div class="ligne-mdp"><input type="text" name="swiposMotDePasse" value="${echapper(v.swiposMotDePasse ?? '')}" autocomplete="off" />
                 <button type="button" class="bouton-secondaire" data-action="copier-mdp">Copier</button></div>`
              : `<div class="ligne-mdp"><span class="mdp-cache">${v.swiposMotDePasse ? '••••••••' : 'aucun'}</span>
                 <button type="button" class="bouton-secondaire" data-action="voir-mdp">Voir / modifier</button></div>`}
          </div>
        </fieldset>
        <label class="champ-materiel large"><span>Notes</span><textarea name="notes" rows="3">${echapper(v.notes ?? '')}</textarea></label>
        <div class="boutons-fiche">
          <button type="submit" class="bouton" data-action="enregistrer-article">Enregistrer</button>
          <button type="button" class="bouton-secondaire" data-action="enregistrer-et-nouveau">Enregistrer et ajouter un autre</button>
          ${article ? `<button type="button" class="bouton-secondaire" data-action="dupliquer">Dupliquer</button>
            <button type="button" class="bouton-secondaire bouton-danger" data-action="supprimer-article">Supprimer</button>` : ''}
        </div>
      </form>
      ${article ? `<div class="annexes-fiche">
        <section class="carte-section"><h4>Photo</h4>
          <div data-zone="photo">${article.photo ? '<p class="vide">Chargement…</p>' : '<p class="vide">Aucune photo.</p>'}</div>
          <label class="bouton-secondaire bouton-fichier">${article.photo ? 'Changer la photo' : 'Ajouter une photo'}<input type="file" accept="image/*" data-fichier="photo" hidden /></label>
          ${article.photo ? '<button type="button" class="bouton-lien" data-action="supprimer-photo">retirer la photo</button>' : ''}
        </section>
        <section class="carte-section"><h4>Documents</h4>
          ${article.documents.length ? `<ul class="liste-documents">${article.documents.map((d) => `<li>
            <button type="button" class="bouton-lien" data-action="ouvrir-document" data-id="${echapper(d.id)}">${echapper(d.nom)}</button>
            <span class="aide">${dateSuisse(String(d.ajouteLe ?? '').slice(0, 10))}</span>
            <button type="button" class="bouton-lien" data-action="supprimer-document" data-id="${echapper(d.id)}" aria-label="Retirer ${echapper(d.nom)}">✕</button></li>`).join('')}</ul>` : '<p class="vide">Aucun document.</p>'}
          <label class="bouton-secondaire bouton-fichier">Ajouter des documents<input type="file" multiple data-fichier="documents" hidden /></label>
        </section>
        <section class="carte-section historique-fiche"><h4>Historique des affectations</h4>
          ${historiqueArticle(parc, article.id).length ? `<ul class="liste-documents">${historiqueArticle(parc, article.id).slice(0, 30).map((af) => `<li><span>${dateSuisse(af.debut)} → ${dateSuisse(af.fin)}</span>
            <strong>${echapper(nomDuChantier(parc.chantiers.find((c) => c.id === af.chantierId)))}</strong>
            <span class="aide">${nombreDeJours(af.debut, af.fin)} j${responsableDe(parc, af) ? ` · ${echapper(responsableDe(parc, af))}` : ''}</span></li>`).join('')}</ul>` : '<p class="vide">Jamais affecté.</p>'}
        </section>
        <section class="carte-section"><h4>Accessoires</h4>
          ${accessoires.length ? `<ul class="liste-documents">${accessoires.map((a) => `<li><button type="button" class="bouton-lien" data-action="ouvrir-article" data-id="${echapper(a.id)}">${echapper(a.numero)} ${echapper(a.designation)}</button></li>`).join('')}</ul>` : '<p class="vide">Aucun accessoire.</p>'}
        </section>
      </div>` : '<p class="aide">Photo, documents et accessoires : après le premier enregistrement.</p>'}`;
  }

  async function remplirPhoto() {
    const article = parc.articles.find((a) => a.id === fiche?.id);
    const zone = page.querySelector('[data-zone="photo"]');
    if (!article?.photo || !zone) return;
    const adresse = await adresseFichier(article.photo);
    if (!page.isConnected || fiche?.id !== article.id) return;
    zone.innerHTML = adresse ? `<img class="photo-materiel" src="${adresse}" alt="Photo de l'article ${echapper(article.numero)}" />` : '<p class="erreur">Photo introuvable (ni sur ce PC, ni sur Drive).</p>';
  }

  /** Champs de la fiche tels que tapés (le mot de passe n'y est que s'il a été ouvert avec le code). */
  function champsDeLaFiche() {
    const formulaire = page.querySelector('[data-zone="fiche"]');
    return Object.fromEntries(new FormData(formulaire).entries());
  }

  async function enregistrerFiche(ensuite = null) {
    const champs = champsDeLaFiche();
    const { ok, resultat } = await changer((p) => (fiche.id ? modifierArticle(p, fiche.id, champs) : ajouterArticle(p, champs)));
    if (!ok) return;
    message(`Article ${resultat.numero} enregistré`, 3000, { ok: true });
    if (ensuite === 'nouveau') fiche = { id: null, brouillon: { categorieId: resultat.categorieId, statut: 'actif' }, mdpVisible: false };
    else fiche = { id: resultat.id, mdpVisible: false };
    dessiner();
  }

  // Chantiers : tableau, formulaire, lien avec les projets de Topo.
  function htmlChantiers() {
    const c = chantierEdite && chantierEdite !== 'nouveau' ? parc.chantiers.find((x) => x.id === chantierEdite) : null;
    const v = c ?? { numero: '', nom: '', responsable: '', facturable: true, archive: false, notes: '' };
    const sansChantier = projetsSansChantier(parc, projets);
    const projetDe = (ch) => projets.find((nom) => ch.cle && cleNumeroDuProjet(nom) === ch.cle);
    return `
      <div class="barre-materiel">
        <button type="button" class="bouton" data-action="nouveau-chantier">＋ Chantier</button>
        <button type="button" class="bouton-secondaire" data-action="depuis-projets" ${sansChantier.length ? '' : 'aria-disabled="true"'}>＋ Depuis les projets (${sansChantier.length})</button>
      </div>
      ${chantierEdite ? `<form class="fiche-materiel fiche-chantier" data-zone="chantier" autocomplete="off">
        <fieldset><legend>${c ? `Chantier ${echapper(c.numero || c.nom)}` : 'Nouveau chantier'}</legend>
          <label class="champ-materiel"><span>N° de chantier</span><input name="numero" value="${echapper(v.numero)}" placeholder="ex. 10 203" /></label>
          <label class="champ-materiel large"><span>Nom *</span><input name="nom" value="${echapper(v.nom)}" required placeholder="ex. OFROU PAB" /></label>
          <label class="champ-materiel"><span>Responsable</span><input name="responsable" value="${echapper(v.responsable)}" list="liste-responsables" /></label>
          <datalist id="liste-responsables">${responsables(parc).map((r) => `<option value="${echapper(r)}"></option>`).join('')}</datalist>
          <label class="case-materiel"><input type="checkbox" name="facturable" ${v.facturable ? 'checked' : ''} /> Facturable</label>
          <label class="case-materiel"><input type="checkbox" name="archive" ${v.archive ? 'checked' : ''} /> Archivé</label>
          <label class="champ-materiel large"><span>Notes</span><textarea name="notes" rows="2">${echapper(v.notes)}</textarea></label>
        </fieldset>
        <div class="boutons-fiche">
          <button type="submit" class="bouton" data-action="enregistrer-chantier">Enregistrer</button>
          <button type="button" class="bouton-secondaire" data-action="fermer-chantier">Fermer</button>
          ${c ? '<button type="button" class="bouton-secondaire bouton-danger" data-action="supprimer-chantier">Supprimer</button>' : ''}
        </div>
      </form>` : ''}
      ${parc.chantiers.length ? `<div class="cadre-tableau-materiel"><table class="tableau-materiel">
        <thead><tr><th>N°</th><th>Nom</th><th>Responsable</th><th>Facturable</th><th>Projet de Topo</th></tr></thead>
        <tbody>${chantiersTries(parc).map((ch) => `<tr data-chantier="${echapper(ch.id)}" class="${ch.archive ? 'ligne-archivee' : ''}">
          <td>${echapper(ch.numero)}</td><td>${echapper(ch.nom)}${ch.archive ? ' <span class="aide">(archivé)</span>' : ''}</td><td>${echapper(ch.responsable)}</td>
          <td>${ch.facturable ? '✓' : '—'}</td><td>${projetDe(ch) ? `✓ ${echapper(projetDe(ch))}` : '<span class="aide">—</span>'}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="vide">Aucun chantier pour l\'instant.</p>'}`;
  }

  /** Crée un chantier pour chaque projet choisi qui n'en a pas (n° = début du nom du projet). */
  async function chantiersDepuisProjets() {
    const sansChantier = projetsSansChantier(parc, projets);
    if (sansChantier.length === 0) {
      message('Tous les projets qui commencent par un n° ont déjà leur chantier.', 5000);
      return;
    }
    const reponse = await demanderChoix({
      titre: `Créer ${sansChantier.length} chantier(s) ?`,
      texte: sansChantier.slice(0, 12).join(' · ') + (sansChantier.length > 12 ? ' …' : ''),
      boutons: [{ cle: 'oui', texte: 'Créer', principal: true }, { cle: 'non', texte: 'Annuler' }],
    });
    if (reponse !== 'oui') return;
    await changer((p) => {
      for (const nom of sansChantier) {
        const debut = String(nom).trim().match(/^\d[\d\s.'’]*/)[0];
        const reste = String(nom).trim().slice(debut.length).replace(/^[\s\-–·:]+/, '').trim();
        ajouterChantier(p, { numero: normaliserNumeroChantier(cleNumeroDuProjet(nom)), nom: reste || nom });
      }
    });
    dessiner();
  }

  // Catégories : ordre (= ordre du planning), renommer, supprimer, recolorer.
  function htmlCategories() {
    const cats = categoriesTriees(parc);
    return `
      <div class="barre-materiel">
        <button type="button" class="bouton" data-action="nouvelle-categorie">＋ Catégorie</button>
        <button type="button" class="bouton-secondaire" data-action="recolorer" ${parc.articles.length ? '' : 'aria-disabled="true"'}>Recolorer tout le parc</button>
      </div>
      ${cats.length ? `<ul class="liste-categories">${cats.map((c, i) => `<li>
        <span class="nom-categorie">${echapper(c.nom)}</span>
        <span class="aide">${parc.articles.filter((a) => a.categorieId === c.id).length} article(s)</span>
        <span class="ordre-materiel">
          <button type="button" data-action="monter-categorie" data-id="${echapper(c.id)}" ${i === 0 ? 'disabled' : ''} aria-label="Monter ${echapper(c.nom)}">▲</button>
          <button type="button" data-action="descendre-categorie" data-id="${echapper(c.id)}" ${i === cats.length - 1 ? 'disabled' : ''} aria-label="Descendre ${echapper(c.nom)}">▼</button>
        </span>
        <button type="button" class="bouton-lien" data-action="renommer-categorie" data-id="${echapper(c.id)}">renommer</button>
        <button type="button" class="bouton-lien" data-action="supprimer-categorie" data-id="${echapper(c.id)}">supprimer</button>
      </li>`).join('')}</ul>` : '<p class="vide">Aucune catégorie. Exemple : Canne GPS, Station totale, Divers.</p>'}`;
  }

  // Sauvegarde : fichier .zip complet, restauration, listes Excel.
  function htmlSauvegarde() {
    return `
      <section class="carte-section bloc-sauvegarde">
        <h4>Sauvegarde complète</h4>
        <p class="aide">${parc.articles.length} articles · ${parc.chantiers.length} chantiers · ${parc.affectations.length} affectations · photos et documents compris.</p>
        <div class="barre-materiel">
          <button type="button" class="bouton" data-action="sauvegarder">Télécharger la sauvegarde (.zip)</button>
          <label class="bouton-secondaire bouton-fichier">Restaurer une sauvegarde…<input type="file" accept=".zip,application/zip" data-fichier="restaurer" hidden /></label>
        </div>
      </section>
      <section class="carte-section bloc-sauvegarde">
        <h4>Listes Excel</h4>
        <div class="barre-materiel">
          <button type="button" class="bouton-secondaire" data-action="excel-inventaire" ${parc.articles.length ? '' : 'aria-disabled="true"'}>Inventaire du parc</button>
          <button type="button" class="bouton-secondaire" data-action="excel-affectations" ${parc.affectations.length ? '' : 'aria-disabled="true"'}>Toutes les affectations</button>
        </div>
      </section>`;
  }

  async function sauvegarder() {
    const fichiers = [];
    const manquants = [];
    for (const id of parc.articles.flatMap((a) => [a.photo, ...a.documents.map((d) => d.id)]).filter(Boolean)) {
      let f = await lireFichierLocal(id).catch(() => null);
      if (!f && materiel?.connecte()) {
        const blob = await materiel.lireFichier(id).catch(() => null);
        if (blob) f = { id, nom: '', type: blob.type, blob };
      }
      if (f) fichiers.push({ id, nom: f.nom, type: f.type, octets: new Uint8Array(await f.blob.arrayBuffer()) });
      else manquants.push(id);
    }
    enregistrerFichier(new Blob([creerSauvegarde(parc, fichiers)], { type: 'application/zip' }), nomSauvegarde(aujourdhui()));
    message(manquants.length ? `Sauvegarde faite, mais ${manquants.length} photo(s) ou document(s) introuvable(s) (ni sur ce PC, ni sur Drive)` : 'Sauvegarde faite : garder le fichier en lieu sûr (le mot de passe swipos y est)', 7000, { ok: !manquants.length });
  }

  async function restaurer(fichier) {
    let lu;
    try {
      lu = await lireSauvegarde(new Uint8Array(await fichier.arrayBuffer()));
    } catch (erreur) {
      message(`Restauration impossible : ${erreur.message}`, 8000);
      return;
    }
    const reponse = await demanderChoix({
      titre: 'Remplacer tout le parc ?',
      texte: `La sauvegarde contient ${lu.parc.articles.length} articles, ${lu.parc.chantiers.length} chantiers et ${lu.parc.affectations.length} affectations. Le parc actuel est remplacé (une copie est gardée sur ce PC), puis envoyé sur Drive.`,
      boutons: [{ cle: 'non', texte: 'Garder le parc actuel', principal: true }, { cle: 'oui', texte: 'Remplacer', classe: 'bouton-danger' }],
    });
    if (reponse !== 'oui') return;
    await enregistrerCopieAvantRestauration(parc);
    for (const f of lu.fichiers) await enregistrerFichierLocal({ id: f.id, nom: f.nom, type: f.type, blob: new Blob([f.octets], { type: f.type }), envoye: false });
    const nouveau = lu.parc;
    await changer((p) => {
      for (const cle of ['categories', 'articles', 'chantiers', 'affectations']) p[cle] = nouveau[cle];
    });
    message('Parc restauré', 4000, { ok: true });
    dessiner();
  }

  function excelInventaire() {
    const nomCategorie = new Map(parc.categories.map((c) => [c.id, c.nom]));
    const numeroDe = new Map(parc.articles.map((a) => [a.id, a.numero]));
    const entetes = ['Catégorie', 'N° interne', 'Désignation', 'Code compta', 'Statut', 'Marque', 'Modèle', 'N° de série', 'Date d\'achat', 'Prix (CHF)', 'Fournisseur', 'Fin de garantie', 'Accessoire de', 'N° tél.', 'N° swipos', 'Où est-il aujourd\'hui ?', 'Notes'];
    const lignes = articlesTries(parc).map((a) => [nomCategorie.get(a.categorieId) ?? '', a.numero, a.designation, a.codeCompta, libelleStatut(a.statut), a.marque, a.modele, a.numeroSerie,
      dateSuisse(a.dateAchat), a.prixChf ?? null, a.fournisseur, dateSuisse(a.finGarantie), numeroDe.get(a.parentId) ?? '', a.telephone, a.swiposNumero, ouAujourdhui(parc, a), a.notes]);
    const octets = creerXlsx([{ nom: 'Inventaire', lignes: [entetes.map((v) => ({ v, style: 'gras' })), ...lignes], largeurs: [16, 10, 28, 10, 18, 12, 14, 16, 12, 12, 18, 14, 12, 14, 12, 28, 30] }]);
    enregistrerFichier(new Blob([octets], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `inventaire_${aujourdhui()}.xlsx`);
  }

  function excelAffectations() {
    const nomCategorie = new Map(parc.categories.map((c) => [c.id, c.nom]));
    const rang = new Map(articlesTries(parc).map((a, i) => [a.id, i]));
    const entetes = ['N° interne', 'Catégorie', 'Code compta', 'N° chantier', 'Chantier', 'Responsable', 'Facturable', 'Du', 'Au', 'Nombre de jours', 'Remarque'];
    const lignes = [...parc.affectations].sort((x, y) => x.debut.localeCompare(y.debut) || (rang.get(x.articleId) ?? 0) - (rang.get(y.articleId) ?? 0)).map((af) => {
      const a = parc.articles.find((x) => x.id === af.articleId);
      const c = parc.chantiers.find((x) => x.id === af.chantierId);
      return [a?.numero ?? '?', nomCategorie.get(a?.categorieId) ?? '', a?.codeCompta ?? '', c?.numero ?? '', c?.nom ?? '?', responsableDe(parc, af), c?.facturable ? 'Oui' : 'Non',
        dateSuisse(af.debut), dateSuisse(af.fin), nombreDeJours(af.debut, af.fin), af.remarque];
    });
    const octets = creerXlsx([{ nom: 'Affectations', lignes: [entetes.map((v) => ({ v, style: 'gras' })), ...lignes], largeurs: [10, 16, 10, 10, 28, 18, 10, 12, 12, 10, 30] }]);
    enregistrerFichier(new Blob([octets], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `affectations_${aujourdhui()}.xlsx`);
  }

  // --- Actions ---

  async function agir(action, bouton) {
    const id = bouton?.dataset.id;
    if (action === 'retour') return fermer();
    if (partie === 'planning' && planning.agir(action, bouton)) return undefined;
    if (action === 'sauvegarder') return sauvegarder();
    if (action === 'excel-inventaire') return excelInventaire();
    if (action === 'excel-affectations') return excelAffectations();
    if (action === 'nouvel-article') {
      if (!parc.categories.length) return message('Créez d\'abord une catégorie (onglet Catégories).', 5000);
      fiche = { id: null, mdpVisible: false };
      return dessiner();
    }
    if (action === 'retour-parc') {
      fiche = null;
      return dessiner();
    }
    if (action === 'ouvrir-article') {
      fiche = { id, mdpVisible: false };
      return dessiner();
    }
    if (action === 'enregistrer-article') return enregistrerFiche();
    if (action === 'enregistrer-et-nouveau') return enregistrerFiche('nouveau');
    if (action === 'dupliquer') {
      const article = parc.articles.find((a) => a.id === fiche.id);
      fiche = { id: null, brouillon: champsDupliques(article), mdpVisible: false, couleurChoisie: true };
      dessiner();
      return message('Copie : donnez-lui un n° interne, puis Enregistrer.', 5000);
    }
    if (action === 'supprimer-article') {
      const article = parc.articles.find((a) => a.id === fiche.id);
      const reponse = await demanderChoix({ titre: `Supprimer l'article ${article.numero} ?`, texte: 'Sa photo et ses documents sont effacés aussi.', boutons: [{ cle: 'non', texte: 'Garder', principal: true }, { cle: 'oui', texte: 'Supprimer', classe: 'bouton-danger' }] });
      if (reponse !== 'oui') return;
      const { ok, resultat } = await changer((p) => supprimerArticle(p, article.id));
      if (!ok) return;
      resultat.forEach(oublierFichier);
      fiche = null;
      return dessiner();
    }
    if (action === 'monter-article' || action === 'descendre-article') {
      await changer((p) => deplacerArticle(p, id, action === 'monter-article' ? -1 : 1));
      return dessinerTableau();
    }
    if (action === 'couleur') {
      fiche.couleurChoisie = true;
      page.querySelector('[name="couleur"]').value = bouton.dataset.couleur.toLowerCase();
      for (const t of page.querySelectorAll('.teinte')) t.classList.toggle('choisie', t === bouton);
      return;
    }
    if (action === 'voir-mdp') {
      if (!(await demanderCode('Mot de passe swipos'))) return;
      // La fiche est redessinée avec le mot de passe visible ; ce qui était déjà tapé est remis.
      const tapes = champsDeLaFiche();
      fiche = { ...fiche, mdpVisible: true };
      dessiner();
      for (const [nom, valeur] of Object.entries(tapes)) {
        const champ = page.querySelector(`[data-zone="fiche"] [name="${nom}"]`);
        if (champ) champ.value = valeur;
      }
      return page.querySelector('[name="swiposMotDePasse"]')?.focus();
    }
    if (action === 'copier-mdp') {
      const champ = page.querySelector('[name="swiposMotDePasse"]');
      try {
        await navigator.clipboard.writeText(champ.value);
        message('Mot de passe copié', 2000, { ok: true });
      } catch {
        champ.select();
        message('Copie impossible : le texte est sélectionné, faites Ctrl+C.', 4000);
      }
      return;
    }
    if (action === 'supprimer-photo') {
      const article = parc.articles.find((a) => a.id === fiche.id);
      const ancienne = article.photo;
      await changer((p) => { p.articles.find((a) => a.id === fiche.id).photo = null; });
      oublierFichier(ancienne);
      return dessiner();
    }
    if (action === 'ouvrir-document') {
      const adresse = await adresseFichier(id);
      if (!adresse) return message('Document introuvable (ni sur ce PC, ni sur Drive).', 5000);
      const nom = parc.articles.flatMap((a) => a.documents).find((d) => d.id === id)?.nom ?? 'document';
      const lien = Object.assign(document.createElement('a'), { href: adresse, download: nom, target: '_blank', rel: 'noopener' });
      document.body.append(lien);
      lien.click();
      lien.remove();
      return;
    }
    if (action === 'supprimer-document') {
      await changer((p) => {
        const article = p.articles.find((a) => a.id === fiche.id);
        article.documents = article.documents.filter((d) => d.id !== id);
      });
      oublierFichier(id);
      return dessiner();
    }
    // Chantiers
    if (action === 'nouveau-chantier') {
      chantierEdite = 'nouveau';
      dessiner();
      return page.querySelector('[data-zone="chantier"] [name="numero"]')?.focus();
    }
    if (action === 'fermer-chantier') {
      chantierEdite = null;
      return dessiner();
    }
    if (action === 'enregistrer-chantier') {
      const formulaire = page.querySelector('[data-zone="chantier"]');
      const champs = { ...Object.fromEntries(new FormData(formulaire).entries()), facturable: formulaire.facturable.checked, archive: formulaire.archive.checked };
      const { ok, resultat } = await changer((p) => (chantierEdite === 'nouveau' ? ajouterChantier(p, champs) : modifierChantier(p, chantierEdite, champs)));
      if (!ok) return;
      message(`Chantier ${resultat.numero || resultat.nom} enregistré`, 3000, { ok: true });
      chantierEdite = null;
      return dessiner();
    }
    if (action === 'supprimer-chantier') {
      const c = parc.chantiers.find((x) => x.id === chantierEdite);
      const reponse = await demanderChoix({ titre: `Supprimer le chantier ${c.numero || c.nom} ?`, boutons: [{ cle: 'non', texte: 'Garder', principal: true }, { cle: 'oui', texte: 'Supprimer', classe: 'bouton-danger' }] });
      if (reponse !== 'oui') return;
      const { ok } = await changer((p) => supprimerChantier(p, c.id));
      if (ok) chantierEdite = null;
      return dessiner();
    }
    if (action === 'depuis-projets') return chantiersDepuisProjets();
    // Catégories
    if (action === 'nouvelle-categorie' || action === 'renommer-categorie') {
      const ancienne = parc.categories.find((c) => c.id === id);
      const nom = await demanderTexte({ titre: ancienne ? 'Renommer la catégorie' : 'Nouvelle catégorie', valeur: ancienne?.nom ?? '' });
      if (nom === null) return;
      await changer((p) => (ancienne ? renommerCategorie(p, id, nom) : ajouterCategorie(p, nom)));
      return dessiner();
    }
    if (action === 'supprimer-categorie') {
      await changer((p) => supprimerCategorie(p, id));
      return dessiner();
    }
    if (action === 'monter-categorie' || action === 'descendre-categorie') {
      await changer((p) => deplacerCategorie(p, id, action === 'monter-categorie' ? -1 : 1));
      return dessiner();
    }
    if (action === 'recolorer') {
      const reponse = await demanderChoix({ titre: 'Recolorer tout le parc ?', texte: 'Toutes les couleurs choisies à la main sont remplacées par celles de la palette, dans l\'ordre du planning.', boutons: [{ cle: 'non', texte: 'Garder les couleurs', principal: true }, { cle: 'oui', texte: 'Recolorer' }] });
      if (reponse !== 'oui') return;
      await changer(recolorerParc);
      message('Parc recoloré', 3000, { ok: true });
      return dessiner();
    }
    return undefined;
  }

  page.addEventListener('click', (evenement) => {
    const onglet = evenement.target.closest('[data-partie]');
    if (onglet) {
      partie = onglet.dataset.partie;
      fiche = null;
      chantierEdite = null;
      return dessiner();
    }
    const titreTri = evenement.target.closest('[data-tri]');
    if (titreTri) {
      if (tri.colonne === titreTri.dataset.tri) tri.sens = -tri.sens;
      else Object.assign(tri, { colonne: titreTri.dataset.tri, sens: 1 });
      return dessinerTableau();
    }
    const bouton = evenement.target.closest('button[data-action]');
    if (bouton) {
      evenement.preventDefault();
      if (bouton.getAttribute('aria-disabled') === 'true') {
        const raison = planning.raison(bouton.dataset.action) ?? { 'nouvel-article': 'Créez d\'abord une catégorie (onglet Catégories).', 'depuis-projets': 'Aucun projet sans chantier (le nom du projet doit commencer par le n° du chantier).', recolorer: 'Aucun article.', 'excel-inventaire': 'Aucun article.', 'excel-affectations': 'Aucune affectation.' }[bouton.dataset.action];
        return message(raison ?? 'Pas possible pour l\'instant.', 4000);
      }
      agir(bouton.dataset.action, bouton).catch((erreur) => message(`Erreur : ${erreur.message}`, 8000));
      return undefined;
    }
    const ligne = evenement.target.closest('tr[data-article]');
    if (ligne) return agir('ouvrir-article', { dataset: { id: ligne.dataset.article } });
    const ligneChantier = evenement.target.closest('tr[data-chantier]');
    if (ligneChantier) {
      chantierEdite = ligneChantier.dataset.chantier;
      dessiner();
      page.querySelector('[data-zone="chantier"]')?.scrollIntoView({ block: 'nearest' });
    }
    return undefined;
  });
  // « Entrée » dans un formulaire = Enregistrer (pas de vrai envoi de page).
  page.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    const zone = evenement.target.dataset.zone;
    agir(zone === 'chantier' ? 'enregistrer-chantier' : 'enregistrer-article').catch((erreur) => message(`Erreur : ${erreur.message}`, 8000));
  });
  page.addEventListener('input', (evenement) => {
    if (evenement.target.dataset.filtre === 'texte') {
      filtre.texte = evenement.target.value;
      dessinerTableau();
    }
    if (evenement.target.name === 'couleur') {
      if (fiche) fiche.couleurChoisie = true;
      for (const t of page.querySelectorAll('.teinte')) t.classList.remove('choisie');
    }
  });
  page.addEventListener('change', (evenement) => {
    const cible = evenement.target;
    if (cible.name === 'categorieId' && fiche && !fiche.id && !fiche.couleurChoisie) {
      // Nouvel article : la couleur proposée suit la catégorie tant qu'on n'en a pas choisi une.
      const couleur = couleurProposee(parc, cible.value);
      page.querySelector('[name="couleur"]').value = couleur.toLowerCase();
      for (const t of page.querySelectorAll('.teinte')) t.classList.toggle('choisie', t.dataset.couleur === couleur);
    } else if (cible.dataset.filtre && cible.dataset.filtre !== 'texte') {
      filtre[cible.dataset.filtre] = cible.value;
      dessinerTableau();
    } else if (cible.dataset.fichier === 'photo' && cible.files[0]) ajouterPhoto(fiche.id, cible.files[0]);
    else if (cible.dataset.fichier === 'documents' && cible.files.length) ajouterDocuments(fiche.id, [...cible.files]);
    else if (cible.dataset.fichier === 'restaurer' && cible.files[0]) restaurer(cible.files[0]).catch((erreur) => message(`Restauration impossible : ${erreur.message}`, 8000));
  });
  page.addEventListener('cancel', (evenement) => {
    evenement.preventDefault();
    if (fiche) {
      fiche = null;
      dessiner();
    } else fermer();
  });

  function fermer() {
    clearTimeout(minuterieEnvoi);
    if (etat.aEnvoyer) synchroniser(); // dernier envoi, même après la fermeture de la page
    for (const adresse of adresses.values()) URL.revokeObjectURL(adresse);
    page.close();
    page.remove();
    quandRetour?.();
  }

  dessiner();
  nomsProjets().then((noms) => {
    projets = noms;
    if (partie === 'chantiers' && page.isConnected) dessiner();
  }).catch(() => {});
  synchroniser();
  return { fermer };
}
