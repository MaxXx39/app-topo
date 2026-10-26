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
import { proposerEnvoi } from './partager.js';
import { brancherChoixExport } from './choix-export.js';

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
    <div data-zone="choix"></div>
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
      <button type="button" class="bouton-secondaire" data-action="csv">CSV</button>
      <button type="button" class="bouton-secondaire" data-action="dxf">DXF</button>
      <button type="button" class="bouton-secondaire" data-action="landxml">LandXML</button>
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
      telecharger(new Blob([texte], { type: 'application/dxf' }), `${nomDeFichier()}.dxf`);
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
 * Fait télécharger un fichier par le navigateur (dans l'APK : par l'appli Android), puis propose
 * de l'envoyer (barre « Envoyer », voir partager.js).
 */
export function telecharger(blob, nom) {
  proposerEnvoi(blob, nom);
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
