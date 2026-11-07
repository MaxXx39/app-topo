// Formulaire d'export des mesures (onglet Calculs › Mesures) : à part de l'export des volumes,
// il ne contient aucun volume. Échelle et contenu du PDF, boutons PDF, CSV et DXF.
// Cartouche : dessiné par et date ici, affaire et lieu du projet (onglet Projet).
import { genererCsvMesures } from './csv.js';
import { genererDxfMesures } from './dxf.js';
import { brancherFeuillePrevue, champsMiseEnPage, lireMiseEnPage, texteFeuille } from './mise-en-page.js';
import { contenuDesMesures } from './zone-plan.js';
import { telecharger, dateSuisse } from './ecran.js';
import { bulle } from '../aide/bulles.js';
import { titreSection } from '../outils/section.js';
import { champsCartouche, lireCartouche } from './cartouche.js';
import { brancherChoixExport } from './choix-export.js';

// Cases du PDF des mesures : [clé, texte, cochée au départ].
const CALQUES = [
  ['noms', 'Noms des points', true],
  ['altitudes', 'Altitudes des points', false],
  ['valeurs', 'Valeurs sur le plan (morceaux, aires)', true],
  ['courbes', 'Courbes de niveau', false],
  ['photo', 'Photo aérienne (atténuée 50 %)', false],
  ['cadastre', 'Cadastre', false],
  ['photos', 'Photos des mesures', true],
];

/**
 * Crée le formulaire d'export des mesures dans "conteneur".
 * - obtenirGroupes() : liste à cocher « Quoi exporter ? » (métrés, mesures ; voir choix-export.js) ;
 * - obtenirDonnees(selection : Set des ids cochés) : { mesures: [{ mesure, resultat }] (mesures cochées),
 *   points, fichierPoints, cartouche: { affaire, lieu } du projet }
 */
// Formats proposés (0.114.0) : [clé, titre, mode minimum ou ''].
const FORMATS = [['pdf', 'PDF', ''], ['csv', 'CSV', 'expert'], ['dxf', 'DXF', '']];

export function creerEcranExportMesures(conteneur, { obtenirGroupes, obtenirDonnees: donneesChoisies }) {
  // Fermé au départ : on l'ouvre avec « Exporter les mesures » (l'écran reste simple).
  conteneur.innerHTML = `
    <details class="export-repliable">
    <summary>${titreSection('exporter', 'Exporter les mesures', bulle('exporterMesures'))}</summary>
    <div>
      <p class="titre-choix titre-etape">Lesquels ?</p>
      <div data-zone="choix"></div>
    </div>
    <p class="titre-choix titre-etape">Format</p>
    <div class="choix-format-export" role="radiogroup" aria-label="Format">
      ${FORMATS.map(([cle, titre, niveau]) => `<button type="button" class="puce-choix ${niveau ? `seulement-${niveau}` : ''}" data-format="${cle}">${titre}</button>`).join('')}
    </div>
    <p class="titre-choix titre-etape" data-pour="pdf">Options</p>
    <div data-pour="pdf">${champsMiseEnPage()}</div>
    <div class="calques-pdf" data-pour="pdf">
      <p class="titre-choix">Contenu du PDF</p>
      <div class="liste-calques-pdf">
        ${CALQUES.map(([cle, titre, coche]) => `<label class="case"><input type="checkbox" data-calque="${cle}" ${coche ? 'checked' : ''} /> ${titre}</label>`).join('')}
      </div>
    </div>
    <div data-pour="pdf">${champsCartouche()}</div>
    <p class="feuille-prevue" data-pour="pdf" data-zone="feuille-prevue"></p>
    <button type="button" class="bouton bouton-exporter" data-action="exporter">Exporter</button>
    <p class="aide" data-zone="message"></p>
    </details>
  `;
  const message = conteneur.querySelector('[data-zone="message"]');
  const choix = brancherChoixExport(conteneur.querySelector('[data-zone="choix"]'), obtenirGroupes);
  // Ce qui est exporté : seulement ce qui est coché dans « Quoi exporter ? ».
  const obtenirDonnees = () => donneesChoisies(choix.selection());

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
    message.textContent = 'Aucune mesure à exporter.';
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
        const miseEnPage = lireMiseEnPage(conteneur);
        const calques = Object.fromEntries(
          [...conteneur.querySelectorAll('[data-calque]')].map((caseACocher) => [caseACocher.dataset.calque, caseACocher.checked]),
        );
        calques.photoAttenuee = true;
        const { document, echelle, format, orientation, messageFond } = await creerPdfMesures({
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
          ...miseEnPage,
        });
        const feuille = texteFeuille(format, orientation, echelle);
        telecharger(document.output('blob'), `${nomDeFichier()}.pdf`, { resume: feuille });
        message.textContent = `PDF des mesures prêt : ${feuille}.${messageFond ? ` Attention : ${messageFond}.` : ''}`;
      } catch (erreur) {
        message.textContent = `Impossible de créer le PDF : ${erreur.message}`;
      }
    },
  };
  // Format choisi (0.114.0) : ses options seulement, puis le gros bouton « Exporter ».
  let format = 'pdf';
  function montrerFormat() {
    for (const puce of conteneur.querySelectorAll('[data-format]')) puce.classList.toggle('actif', puce.dataset.format === format);
    for (const bloc of conteneur.querySelectorAll('[data-pour]')) bloc.hidden = !bloc.dataset.pour.split(' ').includes(format);
    conteneur.querySelector('[data-action="exporter"]').textContent = `Exporter en ${FORMATS.find(([cle]) => cle === format)[1]}`;
  }
  conteneur.addEventListener('click', (evenement) => {
    const puce = evenement.target.closest('button[data-format]');
    if (puce) {
      format = puce.dataset.format;
      montrerFormat();
      return;
    }
    const bouton = evenement.target.closest('button[data-action]');
    if (bouton?.dataset.action === 'exporter') boutons[format]();
  });
  montrerFormat();
  // 0.152.0 : papier et échelle du futur PDF, en direct.
  const feuilleAJour = brancherFeuillePrevue(conteneur, () => contenuDesMesures(obtenirDonnees().mesures ?? [], obtenirDonnees().points ?? []).zone, () => format === 'pdf');
  feuilleAJour();
}
