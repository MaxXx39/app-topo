// Formulaire d'export : cartouche (affaire, date, dessiné par), échelle et calques du PDF,
// boutons PDF, CSV, DXF et LandXML.
import { genererCsv } from './csv.js';
import { genererDxf } from './dxf.js';
import { ECHELLES } from './echelle.js';
import { ecrireLandXML } from '../topo/landxml.js';
import { plageAltitudes, equidistanceAuto } from '../topo/courbes.js';
import { bulle } from '../aide/bulles.js';

const CALQUES = [
  ['triangles', 'Triangles', true],
  ['noms', 'Noms des points', true],
  ['courbes', 'Courbes de niveau', false],
  ['couleurs', 'Couleurs selon l\'altitude', false],
  ['photo', 'Photo aérienne (swisstopo)', false],
  ['cadastre', 'Cadastre', false],
];

/**
 * Crée le formulaire d'export dans "conteneur".
 * - obtenirDonnees() : { nomProjet, stocks, resultats, points, fichierPoints, surfaces, comparaisons, cartouche }
 *   surfaces : [{ nom, triangles }] ; comparaisons : [{ nom, resultat }] ; cartouche : objet modifiable du projet
 * - quandChange() : appelé quand le cartouche change (pour enregistrer le projet)
 * Renvoie { rafraichir() } pour recharger les champs quand on change de projet.
 */
export function creerEcranExport(conteneur, { obtenirDonnees, quandChange }) {
  const aujourdhui = new Date().toISOString().slice(0, 10);

  conteneur.innerHTML = `
    <h3>Exporter ${bulle('exporter')}</h3>
    <div class="champs-export">
      <label>Affaire <input type="text" data-champ="affaire" placeholder="ex. 10 203" /></label>
      <label>Date <input type="date" data-champ="date" value="${aujourdhui}" /></label>
      <label>Dessiné par <input type="text" data-champ="dessinePar" placeholder="ex. MGO" /></label>
      <label>Échelle du plan (PDF)
        <select data-champ="echelle">
          <option value="auto">auto (tout le plan sur la feuille)</option>
          ${ECHELLES.map((e) => `<option value="${e}">1:${e}</option>`).join('')}
        </select>
      </label>
    </div>
    <details class="calques-pdf">
      <summary>Calques du PDF</summary>
      <div class="liste-calques-pdf">
        ${CALQUES.map(([cle, titre, coche]) => `<label class="case"><input type="checkbox" data-calque="${cle}" ${coche ? 'checked' : ''} /> ${titre}</label>`).join('')}
      </div>
    </details>
    <div class="ligne-outils">
      <button type="button" class="bouton" data-action="pdf">PDF</button>
      <button type="button" class="bouton-secondaire" data-action="csv">CSV</button>
      <button type="button" class="bouton-secondaire" data-action="dxf">DXF</button>
      <button type="button" class="bouton-secondaire" data-action="landxml">LandXML</button>
    </div>
    <p class="aide" data-zone="message"></p>
  `;
  const champ = (nom) => conteneur.querySelector(`[data-champ="${nom}"]`);
  const message = conteneur.querySelector('[data-zone="message"]');

  // L'affaire et le dessinateur sont rangés dans le projet.
  for (const nom of ['affaire', 'dessinePar']) {
    champ(nom).addEventListener('change', () => {
      obtenirDonnees().cartouche[nom] = champ(nom).value.trim();
      quandChange();
    });
  }

  const boutons = {
    csv: () => {
      const { stocks, resultats, comparaisons } = obtenirDonnees();
      if (!verifier(resultats, comparaisons)) return;
      // Le caractère invisible ﻿ au début aide Excel à lire les accents.
      telecharger(new Blob(['﻿' + genererCsv(stocks, resultats, comparaisons)], { type: 'text/csv;charset=utf-8' }), `${nomDeFichier()}.csv`);
      message.textContent = 'CSV téléchargé.';
    },
    dxf: () => {
      const { points, stocks, resultats, surfaces } = obtenirDonnees();
      const triangles = resultats.flatMap((r) => r.trianglesDessus ?? []);
      const plage = triangles.length > 0 ? plageAltitudes(triangles) : null;
      const texte = genererDxf({
        points,
        stocks,
        resultats,
        surfaces,
        equidistance: plage ? equidistanceAuto(plage.min, plage.max) : null,
      });
      telecharger(new Blob([texte], { type: 'application/dxf' }), `${nomDeFichier()}.dxf`);
      message.textContent = 'DXF téléchargé (coordonnées MN95, altitudes en Z).';
    },
    landxml: () => {
      const { nomProjet, stocks, resultats, surfaces } = obtenirDonnees();
      const liste = [
        ...stocks.map((stock, i) => ({ nom: `${stock.nom} (dessus)`, triangles: resultats[i]?.trianglesDessus ?? [] })),
        ...surfaces,
      ].filter((s) => s.triangles.length > 0);
      if (liste.length === 0) {
        message.textContent = 'Aucune surface à exporter : calcule d\'abord un stock ou crée une surface.';
        return;
      }
      telecharger(new Blob([ecrireLandXML(liste, nomProjet)], { type: 'application/xml' }), `${nomDeFichier()}.xml`);
      message.textContent = `LandXML téléchargé (${liste.length} surface(s)).`;
    },
    pdf: async () => {
      const { stocks, resultats, points, fichierPoints, comparaisons } = obtenirDonnees();
      if (!verifier(resultats, comparaisons)) return;
      message.textContent = 'Préparation du PDF…';
      try {
        // La bibliothèque PDF n'est chargée qu'au premier export (l'appli démarre plus vite).
        const { creerPdf } = await import('./pdf.js');
        const echelleChoisie = champ('echelle').value;
        const calques = Object.fromEntries(
          [...conteneur.querySelectorAll('[data-calque]')].map((caseACocher) => [caseACocher.dataset.calque, caseACocher.checked]),
        );
        const { document, echelle, messageFond } = await creerPdf({
          stocks,
          resultats,
          points,
          comparaisons,
          calques,
          cartouche: {
            affaire: champ('affaire').value.trim(),
            date: dateSuisse(champ('date').value),
            dessinePar: champ('dessinePar').value.trim(),
            fichierPoints,
          },
          echelleImposee: echelleChoisie === 'auto' ? null : Number(echelleChoisie),
        });
        telecharger(document.output('blob'), `${nomDeFichier()}.pdf`);
        message.textContent = `PDF téléchargé (plan à l'échelle 1:${echelle}).${messageFond ? ` Attention : ${messageFond}.` : ''}`;
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
  function verifier(resultats, comparaisons = []) {
    if (resultats.some((r) => !r.erreurs) || comparaisons.some(({ resultat }) => resultat && !resultat.erreurs)) return true;
    message.textContent = 'Rien à exporter : complète d\'abord un stock ou une comparaison.';
    return false;
  }

  /** Nom des fichiers : volumes_<affaire>_<date>. */
  function nomDeFichier() {
    const affaire = champ('affaire').value.trim().replace(/[^\w-]+/g, '_') || 'stocks';
    return `volumes_${affaire}_${champ('date').value || 'sans-date'}`;
  }

  return {
    /** Recharge l'affaire et le dessinateur du projet ouvert. */
    rafraichir() {
      const { cartouche } = obtenirDonnees();
      champ('affaire').value = cartouche.affaire ?? '';
      champ('dessinePar').value = cartouche.dessinePar ?? '';
    },
  };
}

/** '2026-05-20' -> '20.05.2026' */
function dateSuisse(iso) {
  const [annee, mois, jour] = iso.split('-');
  return annee && mois && jour ? `${jour}.${mois}.${annee}` : '';
}

/** Fait télécharger un fichier par le navigateur. */
export function telecharger(blob, nom) {
  const adresse = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = adresse;
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 10000);
}
