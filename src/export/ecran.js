// Formulaire d'export : cartouche (affaire, date, dessiné par), échelle, boutons CSV et PDF.
import { genererCsv } from './csv.js';
import { ECHELLES } from './echelle.js';
import { echapper } from '../outils/echapper.js';

const CLE_MEMOIRE = 'topo-cartouche';

/**
 * Crée le formulaire d'export dans "conteneur".
 * - obtenirDonnees() : renvoie { stocks, resultats, points, fichierPoints }
 */
export function creerEcranExport(conteneur, { obtenirDonnees }) {
  const memoire = lireMemoire();
  const aujourdhui = new Date().toISOString().slice(0, 10);

  conteneur.innerHTML = `
    <h3>Exporter</h3>
    <div class="champs-export">
      <label>Affaire <input type="text" data-champ="affaire" value="${echapper(memoire.affaire ?? '')}" placeholder="ex. 10 203" /></label>
      <label>Date <input type="date" data-champ="date" value="${aujourdhui}" /></label>
      <label>Dessiné par <input type="text" data-champ="dessinePar" value="${echapper(memoire.dessinePar ?? '')}" placeholder="ex. MGO" /></label>
      <label>Échelle du plan (PDF)
        <select data-champ="echelle">
          <option value="auto">auto (tout le plan sur la feuille)</option>
          ${ECHELLES.map((e) => `<option value="${e}">1:${e}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="ligne-outils">
      <button type="button" class="bouton" data-action="pdf">Télécharger le PDF</button>
      <button type="button" class="bouton-secondaire" data-action="csv">Télécharger le CSV</button>
    </div>
    <p class="aide" data-zone="message"></p>
  `;
  const champ = (nom) => conteneur.querySelector(`[data-champ="${nom}"]`);
  const message = conteneur.querySelector('[data-zone="message"]');

  // On retient l'affaire et le dessinateur pour la prochaine fois.
  for (const nom of ['affaire', 'dessinePar']) {
    champ(nom).addEventListener('change', () => ecrireMemoire({ affaire: champ('affaire').value, dessinePar: champ('dessinePar').value }));
  }

  conteneur.querySelector('[data-action="csv"]').addEventListener('click', () => {
    const { stocks, resultats } = obtenirDonnees();
    if (!verifier(resultats)) return;
    // Le caractère invisible ﻿ au début aide Excel à lire les accents.
    const contenu = '﻿' + genererCsv(stocks, resultats);
    telecharger(new Blob([contenu], { type: 'text/csv;charset=utf-8' }), `${nomDeFichier()}.csv`);
    message.textContent = 'CSV téléchargé.';
  });

  conteneur.querySelector('[data-action="pdf"]').addEventListener('click', async () => {
    const { stocks, resultats, points, fichierPoints } = obtenirDonnees();
    if (!verifier(resultats)) return;
    message.textContent = 'Préparation du PDF…';
    try {
      // La bibliothèque PDF n'est chargée qu'au premier export (l'appli démarre plus vite).
      const { creerPdf } = await import('./pdf.js');
      const echelleChoisie = champ('echelle').value;
      const { document, echelle } = creerPdf({
        stocks,
        resultats,
        points,
        cartouche: {
          affaire: champ('affaire').value.trim(),
          date: dateSuisse(champ('date').value),
          dessinePar: champ('dessinePar').value.trim(),
          fichierPoints,
        },
        echelleImposee: echelleChoisie === 'auto' ? null : Number(echelleChoisie),
      });
      telecharger(document.output('blob'), `${nomDeFichier()}.pdf`);
      message.textContent = `PDF téléchargé (plan à l'échelle 1:${echelle}).`;
    } catch (erreur) {
      message.textContent = `Impossible de créer le PDF : ${erreur.message}`;
    }
  });

  /** Vérifie qu'au moins un stock est calculé, sinon affiche un message. */
  function verifier(resultats) {
    if (resultats.some((r) => !r.erreurs)) return true;
    message.textContent = 'Aucun stock calculé à exporter : complète d\'abord un stock.';
    return false;
  }

  /** Nom des fichiers : volumes_<affaire>_<date>. */
  function nomDeFichier() {
    const affaire = champ('affaire').value.trim().replace(/[^\w-]+/g, '_') || 'stocks';
    return `volumes_${affaire}_${champ('date').value || 'sans-date'}`;
  }
}

/** '2026-05-20' -> '20.05.2026' */
function dateSuisse(iso) {
  const [annee, mois, jour] = iso.split('-');
  return annee && mois && jour ? `${jour}.${mois}.${annee}` : '';
}

/** Fait télécharger un fichier par le navigateur. */
function telecharger(blob, nom) {
  const adresse = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = adresse;
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 10000);
}

function lireMemoire() {
  try {
    return JSON.parse(localStorage.getItem(CLE_MEMOIRE) ?? '{}');
  } catch {
    return {};
  }
}

function ecrireMemoire(valeurs) {
  try {
    localStorage.setItem(CLE_MEMOIRE, JSON.stringify(valeurs));
  } catch {
    // Pas grave : les champs seront vides à la prochaine ouverture.
  }
}
