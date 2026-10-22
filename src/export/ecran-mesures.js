// Formulaire d'export des mesures (onglet Calculs › Mesures) : à part de l'export des volumes,
// il ne contient aucun volume. Échelle et contenu du PDF, boutons PDF, CSV et DXF.
// Cartouche : dessiné par et date ici, affaire et lieu du projet (onglet Projet).
import { genererCsvMesures } from './csv.js';
import { genererDxfMesures } from './dxf.js';
import { ECHELLES } from './echelle.js';
import { telecharger, dateSuisse } from './ecran.js';
import { bulle } from '../aide/bulles.js';
import { titreSection } from '../outils/section.js';
import { champsCartouche, lireCartouche } from './cartouche.js';

// Cases du PDF des mesures : [clé, texte, cochée au départ].
const CALQUES = [
  ['noms', 'Noms des points', true],
  ['altitudes', 'Altitudes des points', false],
  ['valeurs', 'Valeurs sur le plan (morceaux, aires)', true],
  ['courbes', 'Courbes de niveau', false],
  ['photo', 'Photo aérienne (atténuée 50 %)', false],
  ['cadastre', 'Cadastre', false],
];

/**
 * Crée le formulaire d'export des mesures dans "conteneur".
 * - obtenirDonnees() : { mesures: [{ mesure, resultat }] (mesures calculées du levé affiché),
 *   points, fichierPoints, cartouche: { affaire, lieu } du projet }
 */
export function creerEcranExportMesures(conteneur, { obtenirDonnees }) {
  // Fermé au départ : on l'ouvre avec « Exporter les mesures » (l'écran reste simple).
  conteneur.innerHTML = `
    <details class="export-repliable">
    <summary>${titreSection('exporter', 'Exporter les mesures', bulle('exporterMesures'))}</summary>
    <div class="champs-export">
      <label>Échelle du plan (PDF)
        <select data-champ="echelle">
          <option value="auto">auto (tout le plan sur une A4)</option>
          ${ECHELLES.map((e) => `<option value="${e}">1:${e}</option>`).join('')}
        </select>
      </label>
      <p class="aide">Plan centré sur les mesures. Échelle choisie : feuille A4 si le plan y tient, sinon A3.</p>
    </div>
    <div class="calques-pdf">
      <p class="titre-choix">Contenu du PDF</p>
      <div class="liste-calques-pdf">
        ${CALQUES.map(([cle, titre, coche]) => `<label class="case"><input type="checkbox" data-calque="${cle}" ${coche ? 'checked' : ''} /> ${titre}</label>`).join('')}
      </div>
    </div>
    ${champsCartouche()}
    <div class="ligne-outils">
      <button type="button" class="bouton-secondaire" data-action="pdf">PDF</button>
      <button type="button" class="bouton-secondaire" data-action="csv">CSV</button>
      <button type="button" class="bouton-secondaire" data-action="dxf">DXF</button>
    </div>
    <p class="aide" data-zone="message"></p>
    </details>
  `;
  const message = conteneur.querySelector('[data-zone="message"]');

  /** Date du cartouche ('AAAA-MM-JJ') : celle de la case, sinon la date du jour. */
  const dateDuPlan = () => lireCartouche(conteneur).date;

  /** Nom des fichiers : mesures_<affaire>_<date>. */
  function nomDeFichier() {
    const affaire = (obtenirDonnees().cartouche.affaire ?? '').replace(/[^\w-]+/g, '_') || 'topo';
    return `mesures_${affaire}_${dateDuPlan()}`;
  }

  /** Mesures à exporter, ou null (avec un message) s'il n'y en a pas. */
  function mesuresAExporter() {
    const { mesures } = obtenirDonnees();
    if (mesures.length > 0) return mesures;
    message.textContent = 'Rien à exporter : crée d\'abord une mesure (ci-dessus), avec assez de points.';
    return null;
  }

  const boutons = {
    csv: () => {
      const mesures = mesuresAExporter();
      if (!mesures) return;
      // Le caractère invisible ﻿ au début aide Excel à lire les accents.
      telecharger(new Blob(['﻿' + genererCsvMesures(mesures)], { type: 'text/csv;charset=utf-8' }), `${nomDeFichier()}.csv`);
      message.textContent = 'CSV des mesures téléchargé.';
    },
    dxf: () => {
      const mesures = mesuresAExporter();
      if (!mesures) return;
      const texte = genererDxfMesures({ points: obtenirDonnees().points, mesures });
      telecharger(new Blob([texte], { type: 'application/dxf' }), `${nomDeFichier()}.dxf`);
      message.textContent = 'DXF des mesures téléchargé (calque MESURES, coordonnées MN95, altitudes en Z).';
    },
    pdf: async () => {
      const mesures = mesuresAExporter();
      if (!mesures) return;
      const { points, fichierPoints, cartouche } = obtenirDonnees();
      message.textContent = 'Préparation du PDF…';
      try {
        // La bibliothèque PDF n'est chargée qu'au premier export (l'appli démarre plus vite).
        const { creerPdfMesures } = await import('./pdf-mesures.js');
        const echelleChoisie = conteneur.querySelector('[data-champ="echelle"]').value;
        const calques = Object.fromEntries(
          [...conteneur.querySelectorAll('[data-calque]')].map((caseACocher) => [caseACocher.dataset.calque, caseACocher.checked]),
        );
        calques.photoAttenuee = true;
        const { document, echelle, format, messageFond } = await creerPdfMesures({
          mesures,
          points,
          calques,
          cartouche: {
            affaire: cartouche.affaire ?? '',
            lieu: cartouche.lieu ?? '',
            date: dateSuisse(lireCartouche(conteneur).date),
            dessinePar: lireCartouche(conteneur).dessinePar,
            fichierPoints,
          },
          echelleImposee: echelleChoisie === 'auto' ? null : Number(echelleChoisie),
        });
        telecharger(document.output('blob'), `${nomDeFichier()}.pdf`);
        message.textContent = `PDF des mesures téléchargé (${format.toUpperCase()}, plan à l'échelle 1:${echelle}).${messageFond ? ` Attention : ${messageFond}.` : ''}`;
      } catch (erreur) {
        message.textContent = `Impossible de créer le PDF : ${erreur.message}`;
      }
    },
  };
  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (bouton) boutons[bouton.dataset.action]();
  });
}
