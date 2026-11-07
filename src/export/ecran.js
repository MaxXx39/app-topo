// Formulaire d'export : échelle, calques et cartouche du PDF (dessiné par, date ; affaire et lieu du projet),
// boutons PDF, CSV, DXF et LandXML.
import { genererCsv } from './csv.js';
import { genererDxf } from './dxf.js';
import { brancherFeuillePrevue, champsMiseEnPage, lireMiseEnPage, resumeMiseEnPage, texteFeuille } from './mise-en-page.js';
import { zonePremiereFeuille } from './zone-plan.js';
import { ecrireLandXML, geometrieDeSurface } from '../topo/landxml.js';
import { plageAltitudes, equidistanceAuto } from '../topo/courbes.js';
import { bulle } from '../aide/bulles.js';
import { titreSection } from '../outils/section.js';
import { champsCartouche, lireCartouche } from './cartouche.js';
import { PALIERS } from '../plan/ecarts.js';
import { estDansAppliAndroid, enregistrerDansAndroid } from '../android/pont.js';
import { ouvrirFenetreExport } from './fenetre-export.js';
import { brancherChoixExport } from './choix-export.js';
import { emprisePhoto, fabriquerGeotiff, PIXELS_MAX } from './geotiff.js';

// Cases du PDF : [clé, texte, cochée au départ]. « Photos » (celles des surfaces) en dernier.
const CALQUES = [
  ['triangles', 'Triangles', true],
  ['noms', 'Noms des points', true],
  ['altitudes', 'Altitudes des points', false],
  ['courbes', 'Courbes de niveau', false],
  ['photo', 'Photo aérienne', false],
  ['cadastre', 'Cadastre', false],
  ['photos', 'Photos', true],
];
// Couleurs du plan : l'une ou l'autre (elles ne se lisent pas l'une sur l'autre), ou aucune.
const COULEURS = [
  ['ecarts', 'Déblai / remblai', true],
  ['couleurs', 'Altitude', false],
  ['aucune', 'Aucune', false],
];

/**
 * Crée le formulaire d'export dans "conteneur".
 * - obtenirGroupes() : liste à cocher « Quoi exporter ? » (voir choix-export.js) ;
 * - obtenirDonnees(selection : Set des ids cochés) : { nomProjet, stocks, resultats, comparaisons, volumes, dessinSurfaces, points, fichierPoints, photos, cartouche, coupes }
 *   stocks, resultats : calculs dessinés sur la feuille principale du PDF (surface 1 et volume) ;
 *   comparaisons : calculs dans un contour, une feuille chacun [{ nom, description, resultat }] ;
 *   volumes : tous les calculs, pour le CSV [{ nom, base, resultat }] ;
 *   dessinSurfaces : surfaces affichées, pour le DXF et le LandXML { stocks, resultats, surfaces } ;
 *   cartouche : { affaire, lieu } du projet
 */
// Formats proposés (0.114.0) : [clé, titre, mode minimum ou ''].
const FORMATS = [['pdf', 'PDF', ''], ['csv', 'CSV', 'expert'], ['dxf', 'DXF', ''], ['landxml', 'LandXML', 'expert']];

export function creerEcranExport(conteneur, { obtenirGroupes, obtenirDonnees: donneesChoisies }) {

  conteneur.innerHTML = `
    ${titreSection('exporter', 'Exporter', bulle('exporter'))}
    <div>
      <p class="titre-choix titre-etape">Lesquels ?</p>
      <div data-zone="choix"></div>
    </div>
    <p class="titre-choix titre-etape">Format</p>
    <div class="choix-format-export" role="radiogroup" aria-label="Format">
      ${FORMATS.map(([cle, titre, niveau]) => `<button type="button" class="puce-choix ${niveau ? `seulement-${niveau}` : ''}" data-format="${cle}">${titre}</button>`).join('')}
    </div>
    <details class="options-export" data-pour="pdf dxf landxml">
    <summary><span data-zone="resume-options"></span> <span class="lien-modifier">modifier ▾</span></summary>
    <div data-pour="pdf">${champsMiseEnPage()}</div>
    <div class="calques-pdf" data-pour="pdf">
      <p class="titre-choix">Contenu du PDF</p>
      <div class="liste-calques-pdf">
        ${CALQUES.map(([cle, titre, coche]) => `<label class="case"><input type="checkbox" data-calque="${cle}" ${coche ? 'checked' : ''} /> ${titre}</label>`).join('')}
      </div>
      <div class="ligne-couleurs-pdf" role="radiogroup" aria-label="Couleurs du plan">
        <span>Couleurs :</span>
        ${COULEURS.map(([cle, titre, coche]) => `<label class="case"><input type="radio" name="couleurs-pdf" data-couleurs="${cle}" ${coche ? 'checked' : ''} /> ${titre}</label>`).join('')}
      </div>
      <label class="choix-equidistance">Palier déblai / remblai
        <select data-champ="palier">
          ${PALIERS.map((e) => `<option value="${e}">${e === 'auto' ? 'auto' : `${e} m`}</option>`).join('')}
        </select>
      </label>
    </div>
    <div data-pour="pdf">${champsCartouche()}</div>
    <div data-pour="landxml">
      <label class="case"><input type="checkbox" data-champ="landxml-contour" checked /> Avec le contour et les lignes de rupture du levé</label>
    </div>
    <div class="options-geotiff" data-pour="dxf">
      <label class="case"><input type="checkbox" data-champ="geotiff" /> Avec le DXF : photo aérienne swisstopo (GeoTIFF)</label>
      <div class="champs-export">
        <label>Marge autour des points (m)<input type="text" inputmode="decimal" data-champ="marge-geotiff" value="30" /></label>
        <label>Taille du pixel
          <select data-champ="resolution-geotiff">
            <option value="0.1">10 cm</option>
            <option value="0.25">25 cm</option>
            <option value="0.5">50 cm</option>
            <option value="1">1 m</option>
          </select>
        </label>
      </div>
    </div>
    </details>
    <p class="feuille-prevue" data-pour="pdf" data-zone="feuille-prevue"></p>
    <button type="button" class="bouton bouton-exporter" data-action="exporter">Exporter</button>
    <p class="aide" data-zone="message"></p>
  `;
  const choix = brancherChoixExport(conteneur.querySelector('[data-zone="choix"]'), obtenirGroupes);
  // 0.146.0 : réglages retenus sur l'appareil (format, échelle, cases, couleurs, palier, options DXF / LandXML).
  remettreReglages(conteneur);
  conteneur.addEventListener('change', () => {
    retenirReglages(conteneur, format);
    resumer();
  });
  // Ce qui est exporté : seulement ce qui est coché dans « Quoi exporter ? ».
  const obtenirDonnees = () => donneesChoisies(choix.selection());
  const champ = (nom) => conteneur.querySelector(`[data-champ="${nom}"]`);
  const message = conteneur.querySelector('[data-zone="message"]');

  /** Date du cartouche ('AAAA-MM-JJ') : celle de la case, sinon la date du jour. */
  const dateDuPlan = () => lireCartouche(conteneur).date;

  const boutons = {
    csv: () => {
      const { volumes } = obtenirDonnees();
      if (!verifier(volumes)) return;
      // Le caractère invisible ﻿ au début aide Excel à lire les accents.
      telecharger(new Blob(['﻿' + genererCsv(volumes)], { type: 'text/csv;charset=utf-8' }), `${nomDeFichier()}.csv`);
      message.textContent = 'CSV téléchargé.';
    },
    dxf: () => {
      const { points, dessinSurfaces, dessins } = obtenirDonnees();
      const { stocks, resultats, surfaces } = dessinSurfaces;
      const triangles = resultats.flatMap((r) => r.trianglesDessus ?? []);
      const plage = triangles.length > 0 ? plageAltitudes(triangles) : null;
      const texte = genererDxf({
        points,
        stocks,
        resultats,
        surfaces,
        equidistance: plage ? equidistanceAuto(plage.min, plage.max) : null,
        dessins,
      });
      // Photo aérienne (0.98.0) : son GeoTIFF est fabriqué quand la fenêtre du DXF se ferme.
      const avecPhoto = champ('geotiff').checked;
      const tousLesPoints = [...points, ...surfaces.flatMap((s) => (s.triangles ?? []).flat()), ...(dessins ?? []).flatMap((d) => d.points ?? [])];
      telecharger(new Blob([texte], { type: 'application/dxf' }), `${nomDeFichier()}.dxf`, avecPhoto ? { quandFerme: () => exporterGeotiff(tousLesPoints) } : {});
      message.textContent = 'DXF téléchargé (coordonnées MN95, altitudes en Z).';
    },
    landxml: () => {
      const { nomProjet, dessinSurfaces, points } = obtenirDonnees();
      const { stocks, resultats, surfaces } = dessinSurfaces;
      // 0.133.0 : contour et lignes de rupture du levé dans le fichier (SourceData), pour les logiciels
      // qui refont la triangulation à l'import (Mensura) : sans eux, ils recréent des triangles retirés.
      const avecContour = champ('landxml-contour').checked;
      const liste = [
        ...stocks.map((stock, i) => ({ nom: stock.nom, triangles: resultats[i]?.trianglesDessus ?? [], ...(avecContour ? geometrieDeSurface(stock, points) : {}) })),
        ...surfaces,
      ].filter((s) => s.triangles.length > 0);
      if (liste.length === 0) {
        message.textContent = 'Aucune surface à exporter.';
        return;
      }
      telecharger(new Blob([ecrireLandXML(liste, nomProjet)], { type: 'application/xml' }), `${nomDeFichier()}.xml`);
      message.textContent = `LandXML téléchargé (${liste.length} surface(s)).`;
    },
    pdf: async () => {
      const { stocks, resultats, points, fichierPoints, comparaisons, volumes, photos, coupes, dessins, levesSeuls = [] } = obtenirDonnees();
      // Sans volume, le PDF montre quand même les points, levés et dessins cochés (levé seul).
      if (!verifier(volumes, points.length > 0 || dessins.length > 0 || levesSeuls.length > 0)) return;
      message.textContent = 'Préparation du PDF…';
      try {
        // La bibliothèque PDF n'est chargée qu'au premier export (l'appli démarre plus vite).
        const { creerPdf } = await import('./pdf.js');
        const miseEnPage = lireMiseEnPage(conteneur);
        const calques = Object.fromEntries(
          [...conteneur.querySelectorAll('[data-calque]')].map((caseACocher) => [caseACocher.dataset.calque, caseACocher.checked]),
        );
        // Couleurs du plan : déblai / remblai, altitude, ou aucune. La photo aérienne est toujours atténuée à 50 %.
        const couleurs = conteneur.querySelector('[data-couleurs]:checked')?.dataset.couleurs;
        calques.ecarts = couleurs === 'ecarts';
        calques.couleurs = couleurs === 'couleurs';
        calques.photoAttenuee = true;
        calques.palier = champ('palier').value;
        const { document, echelle, format, orientation, messageFond } = await creerPdf({
          stocks,
          resultats,
          points,
          comparaisons,
          photos,
          coupes,
          dessins,
          levesSeuls,
          calques,
          cartouche: {
            affaire: obtenirDonnees().cartouche.affaire ?? '',
            lieu: obtenirDonnees().cartouche.lieu ?? '',
            date: dateSuisse(lireCartouche(conteneur).date),
            dessinePar: lireCartouche(conteneur).dessinePar,
            fichierPoints,
          },
          ...miseEnPage,
        });
        // 0.151.0 : papier et échelle obtenus, mis en évidence dans la fenêtre Exporter et l'aperçu.
        const feuille = texteFeuille(format, orientation, echelle);
        telecharger(document.output('blob'), `${nomDeFichier()}.pdf`, { resume: feuille });
        message.textContent = `PDF prêt : ${feuille}.${messageFond ? ` Attention : ${messageFond}.` : ''}`;
      } catch (erreur) {
        message.textContent = `Impossible de créer le PDF : ${erreur.message}`;
      }
    },
  };
  // Format choisi (0.114.0) : ses options seulement, puis le gros bouton « Exporter ».
  let format = FORMATS.some(([cle]) => cle === reglagesRetenus().format) ? reglagesRetenus().format : 'pdf';
  /** Résumé des options en une ligne (0.146.0), les cases restent repliées sous « modifier ». */
  function resumer() {
    const zone = conteneur.querySelector('[data-zone="resume-options"]');
    if (!zone) return;
    let texte = '';
    if (format === 'pdf') {
      const miseEnPage = resumeMiseEnPage(lireMiseEnPage(conteneur));
      const cases = CALQUES.filter(([cle]) => conteneur.querySelector(`[data-calque="${cle}"]`)?.checked).map(([, titre]) => titre.toLowerCase());
      const couleurs = COULEURS.find(([cle]) => conteneur.querySelector(`[data-couleurs="${cle}"]`)?.checked)?.[1] ?? '';
      texte = [miseEnPage, cases.join(', ') || 'sans options', `couleurs : ${couleurs.toLowerCase()}`].join(' · ');
    } else if (format === 'dxf') texte = champ('geotiff').checked ? 'avec la photo aérienne (GeoTIFF)' : 'sans photo aérienne';
    else if (format === 'landxml') texte = champ('landxml-contour').checked ? 'avec contour et lignes de rupture' : 'triangles seulement';
    zone.textContent = texte;
  }
  function montrerFormat() {
    resumer();
    for (const puce of conteneur.querySelectorAll('[data-format]')) puce.classList.toggle('actif', puce.dataset.format === format);
    for (const bloc of conteneur.querySelectorAll('[data-pour]')) bloc.hidden = !bloc.dataset.pour.split(' ').includes(format);
    conteneur.querySelector('[data-action="exporter"]').textContent = `Exporter en ${FORMATS.find(([cle]) => cle === format)[1]}`;
  }
  conteneur.addEventListener('click', (evenement) => {
    const puce = evenement.target.closest('button[data-format]');
    if (puce) {
      format = puce.dataset.format;
      retenirReglages(conteneur, format);
      montrerFormat();
      return;
    }
    const bouton = evenement.target.closest('button[data-action]');
    if (bouton?.dataset.action === 'exporter') boutons[format]();
  });
  montrerFormat();
  // 0.152.0 : papier et échelle du futur PDF, en direct.
  const feuilleAJour = brancherFeuillePrevue(conteneur, () => zonePremiereFeuille(obtenirDonnees()), () => format === 'pdf');
  feuilleAJour();

  /**
   * GeoTIFF de la photo aérienne swisstopo autour de ces points (marge et taille du pixel choisies),
   * puis la fenêtre « Exporter » (voir geotiff.js). Internet nécessaire.
   */
  async function exporterGeotiff(points) {
    const marge = Number(String(champ('marge-geotiff').value).replace(',', '.'));
    const resolution = Number(champ('resolution-geotiff').value);
    if (!Number.isFinite(marge) || marge < 0 || marge > 500) {
      message.textContent = 'Photo aérienne : marge illisible (entre 0 et 500 m).';
      return;
    }
    const emprise = emprisePhoto(points, marge, resolution);
    if (!emprise) {
      message.textContent = 'Photo aérienne : aucun point à exporter.';
      return;
    }
    if (emprise.largeur * emprise.hauteur > PIXELS_MAX) {
      message.textContent = `Photo aérienne trop grande (${emprise.largeur} × ${emprise.hauteur} pixels) : choisis un pixel plus grand ou une marge plus petite.`;
      return;
    }
    try {
      const blob = await fabriquerGeotiff(emprise, resolution, (fait, total) => {
        message.textContent = `Photo aérienne : morceau ${fait} / ${total}…`;
      });
      message.textContent = `Photo aérienne prête : ${Math.round((emprise.estMax - emprise.estMin))} × ${Math.round(emprise.nordMax - emprise.nordMin)} m, GeoTIFF MN95 (source : swisstopo).`;
      telecharger(blob, `${nomDeFichier()}_swissimage.tif`);
    } catch (erreur) {
      message.textContent = `Photo aérienne impossible (pas de connexion ?) : ${erreur.message}`;
    }
  }

  /** Vérifie qu'il y a quelque chose à exporter, sinon affiche un message. */
  function verifier(volumes, autreContenu = false) {
    if (autreContenu || volumes.some(({ resultat }) => resultat && !resultat.erreurs)) return true;
    message.textContent = autreContenu === false && volumes.length === 0 ? 'Rien de coché à exporter (volume, levé ou dessin).' : 'Aucun volume à exporter.';
    return false;
  }

  /** Nom des fichiers : volumes_<affaire>_<date>. */
  function nomDeFichier() {
    const affaire = (obtenirDonnees().cartouche.affaire ?? '').replace(/[^\w-]+/g, '_') || 'stocks';
    return `volumes_${affaire}_${dateDuPlan()}`;
  }
}

/** '2026-05-20' -> '20.05.2026' */
const CLE_REGLAGES = 'topo-export-plan';

/** Réglages d'export retenus sur l'appareil (0.146.0) : {} si rien ou mémoire indisponible. */
function reglagesRetenus() {
  try {
    return JSON.parse(localStorage.getItem(CLE_REGLAGES) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

/** Retient le format et toutes les cases / listes du formulaire (sauf le cartouche, retenu à part). */
function retenirReglages(conteneur, format) {
  const champs = {};
  for (const element of conteneur.querySelectorAll('[data-calque], [data-couleurs], select[data-champ], input[data-champ]')) {
    const cle = element.dataset.calque ? `calque:${element.dataset.calque}` : element.dataset.couleurs ? `couleurs:${element.dataset.couleurs}` : `champ:${element.dataset.champ}`;
    champs[cle] = element.type === 'checkbox' || element.type === 'radio' ? element.checked : element.value;
  }
  try {
    localStorage.setItem(CLE_REGLAGES, JSON.stringify({ format, champs }));
  } catch {
    // Mémoire indisponible : les réglages reviendront simplement au départ.
  }
}

/** Remet les réglages retenus dans le formulaire. */
function remettreReglages(conteneur) {
  const { champs } = reglagesRetenus();
  if (!champs) return;
  for (const element of conteneur.querySelectorAll('[data-calque], [data-couleurs], select[data-champ], input[data-champ]')) {
    const cle = element.dataset.calque ? `calque:${element.dataset.calque}` : element.dataset.couleurs ? `couleurs:${element.dataset.couleurs}` : `champ:${element.dataset.champ}`;
    if (!(cle in champs)) continue;
    if (element.type === 'checkbox' || element.type === 'radio') element.checked = Boolean(champs[cle]);
    else if (element.tagName === 'SELECT' ? [...element.options].some((o) => o.value === champs[cle]) : true) element.value = champs[cle];
  }
}

export function dateSuisse(iso) {
  const [annee, mois, jour] = iso.split('-');
  return annee && mois && jour ? `${jour}.${mois}.${annee}` : '';
}

/**
 * Un fichier exporté (0.79.0) : la fenêtre « Exporter » (voir fenetre-export.js) propose de
 * l'enregistrer, de l'envoyer par mail ou autrement.
 */
export function telecharger(blob, nom, { quandFerme = null, resume = null } = {}) {
  ouvrirFenetreExport({ titre: nom, resume, fabriquer: () => ({ blob, nom }), enregistrer, message: messageExport, quandFerme });
}

/** Petit message en bas de l'écran (enregistré, mail…), qui disparaît tout seul. */
function messageExport(texte) {
  let zone = document.querySelector('#message-export');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'message-export';
    zone.className = 'message-flottant';
    zone.setAttribute('role', 'status');
    zone.addEventListener('click', () => (zone.hidden = true)); // fermé d'un toucher (0.126.0)
    document.body.append(zone);
  }
  zone.textContent = texte;
  zone.hidden = false;
  clearTimeout(zone.minuterie);
  zone.minuterie = setTimeout(() => (zone.hidden = true), 5000);
}

/** Fait télécharger un fichier par le navigateur (dans l'APK : l'enregistre par l'appli Android). */
export function enregistrer(blob, nom) {
  if (estDansAppliAndroid()) {
    enregistrerDansAndroid(blob, nom);
    return;
  }
  const adresse = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = adresse;
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 10000);
}
