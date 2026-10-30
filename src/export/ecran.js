// Formulaire d'export : échelle, calques et cartouche du PDF (dessiné par, date ; affaire et lieu du projet),
// boutons PDF, CSV, DXF et LandXML.
import { genererCsv } from './csv.js';
import { genererDxf } from './dxf.js';
import { ECHELLES } from './echelle.js';
import { ecrireLandXML } from '../topo/landxml.js';
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
export function creerEcranExport(conteneur, { obtenirGroupes, obtenirDonnees: donneesChoisies }) {

  conteneur.innerHTML = `
    ${titreSection('exporter', 'Exporter', bulle('exporter'))}
    <div data-zone="choix" class="seulement-expert"></div>
    <div class="champs-export">
      <label>Échelle du plan (PDF)
        <select data-champ="echelle">
          <option value="auto">auto (tout le plan sur une A4)</option>
          ${ECHELLES.map((e) => `<option value="${e}">1:${e}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="calques-pdf">
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
    ${champsCartouche()}
    <div class="ligne-outils">
      <button type="button" class="bouton-secondaire" data-action="pdf">PDF</button>
      <button type="button" class="bouton-secondaire seulement-expert" data-action="csv">CSV</button>
      <button type="button" class="bouton-secondaire" data-action="dxf">DXF</button>
      <button type="button" class="bouton-secondaire seulement-expert" data-action="landxml">LandXML</button>
    </div>
    <div class="options-geotiff">
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
    <p class="aide" data-zone="message"></p>
  `;
  const choix = brancherChoixExport(conteneur.querySelector('[data-zone="choix"]'), obtenirGroupes);
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
      const { nomProjet, dessinSurfaces } = obtenirDonnees();
      const { stocks, resultats, surfaces } = dessinSurfaces;
      const liste = [
        ...stocks.map((stock, i) => ({ nom: stock.nom, triangles: resultats[i]?.trianglesDessus ?? [] })),
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
      const { stocks, resultats, points, fichierPoints, comparaisons, volumes, photos, coupes, dessins } = obtenirDonnees();
      if (!verifier(volumes)) return;
      message.textContent = 'Préparation du PDF…';
      try {
        // La bibliothèque PDF n'est chargée qu'au premier export (l'appli démarre plus vite).
        const { creerPdf } = await import('./pdf.js');
        const echelleChoisie = champ('echelle').value;
        const calques = Object.fromEntries(
          [...conteneur.querySelectorAll('[data-calque]')].map((caseACocher) => [caseACocher.dataset.calque, caseACocher.checked]),
        );
        // Couleurs du plan : déblai / remblai, altitude, ou aucune. La photo aérienne est toujours atténuée à 50 %.
        const couleurs = conteneur.querySelector('[data-couleurs]:checked')?.dataset.couleurs;
        calques.ecarts = couleurs === 'ecarts';
        calques.couleurs = couleurs === 'couleurs';
        calques.photoAttenuee = true;
        calques.palier = champ('palier').value;
        const { document, echelle, format, messageFond } = await creerPdf({
          stocks,
          resultats,
          points,
          comparaisons,
          photos,
          coupes,
          dessins,
          calques,
          cartouche: {
            affaire: obtenirDonnees().cartouche.affaire ?? '',
            lieu: obtenirDonnees().cartouche.lieu ?? '',
            date: dateSuisse(lireCartouche(conteneur).date),
            dessinePar: lireCartouche(conteneur).dessinePar,
            fichierPoints,
          },
          echelleImposee: echelleChoisie === 'auto' ? null : Number(echelleChoisie),
        });
        telecharger(document.output('blob'), `${nomDeFichier()}.pdf`);
        message.textContent = `PDF téléchargé (${format.toUpperCase()}, plan à l'échelle 1:${echelle}).${messageFond ? ` Attention : ${messageFond}.` : ''}`;
      } catch (erreur) {
        message.textContent = `Impossible de créer le PDF : ${erreur.message}`;
      }
    },
  };
  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (bouton) boutons[bouton.dataset.action]();
  });

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
  function verifier(volumes) {
    if (volumes.some(({ resultat }) => resultat && !resultat.erreurs)) return true;
    message.textContent = 'Aucun volume à exporter.';
    return false;
  }

  /** Nom des fichiers : volumes_<affaire>_<date>. */
  function nomDeFichier() {
    const affaire = (obtenirDonnees().cartouche.affaire ?? '').replace(/[^\w-]+/g, '_') || 'stocks';
    return `volumes_${affaire}_${dateDuPlan()}`;
  }
}

/** '2026-05-20' -> '20.05.2026' */
export function dateSuisse(iso) {
  const [annee, mois, jour] = iso.split('-');
  return annee && mois && jour ? `${jour}.${mois}.${annee}` : '';
}

/**
 * Un fichier exporté (0.79.0) : la fenêtre « Exporter » (voir fenetre-export.js) propose de
 * l'enregistrer, de l'envoyer par mail ou autrement.
 */
export function telecharger(blob, nom, { quandFerme = null } = {}) {
  ouvrirFenetreExport({ titre: nom, fabriquer: () => ({ blob, nom }), enregistrer, message: messageExport, quandFerme });
}

/** Petit message en bas de l'écran (enregistré, mail…), qui disparaît tout seul. */
function messageExport(texte) {
  let zone = document.querySelector('#message-export');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'message-export';
    zone.className = 'message-flottant';
    zone.setAttribute('role', 'status');
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
