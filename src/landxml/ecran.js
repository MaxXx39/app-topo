// Écran d'import d'un fichier LandXML : lecture, choix de la surface, résumé.
import { lireLandXML, resumerSurface } from '../topo/landxml.js';
import { formaterNombre } from '../topo/format.js';
import { echapper } from '../outils/echapper.js';

/**
 * Crée l'écran LandXML dans "conteneur".
 * - quandChange() : appelé quand la surface choisie change
 * Renvoie { surfaceChoisie() } : la surface TIN choisie, ou null.
 */
export function creerEcranLandXML(conteneur, { quandChange }) {
  let nomFichier = '';
  let lecture = null; // résultat de lireLandXML
  let indexChoisi = -1;

  conteneur.innerHTML = `
    <p class="aide">Surface TIN exportée de Mensura (LandXML 1.1). Elle servira de surface de base en mode B.</p>
    <label class="bouton">
      Choisir un fichier LandXML
      <input type="file" data-champ="fichier-landxml" accept=".xml,.landxml,application/xml,text/xml" hidden />
    </label>
    <div data-zone="resultat"></div>
  `;
  const zone = conteneur.querySelector('[data-zone="resultat"]');

  conteneur.querySelector('[data-champ="fichier-landxml"]').addEventListener('change', async (evenement) => {
    const fichier = evenement.target.files[0];
    if (!fichier) return;
    nomFichier = fichier.name;
    try {
      lecture = lireLandXML(await fichier.text());
    } catch (erreur) {
      lecture = { surfaces: [], erreurs: [`impossible de lire le fichier : ${erreur.message}`], avertissements: [] };
    }
    indexChoisi = lecture.surfaces.length > 0 ? 0 : -1;
    evenement.target.value = '';
    afficher();
    quandChange();
  });

  zone.addEventListener('change', (evenement) => {
    if (evenement.target.name !== 'surface-landxml') return;
    indexChoisi = Number(evenement.target.value);
    afficher();
    quandChange();
  });

  function afficher() {
    if (!lecture) return;
    const { surfaces, erreurs, avertissements } = lecture;
    let html = `<p class="resume"><strong>${surfaces.length} surface(s) TIN</strong> dans « ${echapper(nomFichier)} ».</p>`;

    if (erreurs.length > 0) {
      html += `<div class="erreur"><p><strong>Problèmes de lecture :</strong></p><ul>${erreurs.map((e) => `<li>${echapper(e)}</li>`).join('')}</ul></div>`;
    }
    if (avertissements.length > 0) {
      html += `<div class="avertissement"><ul>${avertissements.map((a) => `<li>${echapper(a)}</li>`).join('')}</ul></div>`;
    }

    html += surfaces
      .map((surface, index) => {
        const resume = resumerSurface(surface);
        return `
        <label class="carte-role ${index === indexChoisi ? 'en-edition' : ''} choix-surface">
          <span class="titre-role">
            <span><input type="radio" name="surface-landxml" value="${index}" ${index === indexChoisi ? 'checked' : ''} />
            <strong>${echapper(surface.nom)}</strong> ${surface.description ? `<span class="aide">(${echapper(surface.description)})</span>` : ''}</span>
          </span>
          <table class="tableau-detail">
            <tr><td>Points</td><td>${surface.points.length}</td></tr>
            <tr><td>Triangles</td><td>${surface.triangles.length}${surface.trianglesInvisibles > 0 ? ` (+ ${surface.trianglesInvisibles} invisibles ignorés)` : ''}</td></tr>
            <tr><td>Lignes de rupture</td><td>${surface.lignesRupture.length}</td></tr>
            <tr><td>Contours</td><td>${surface.contours.length}</td></tr>
            <tr><td>Surface en plan</td><td>${formaterNombre(resume.surfacePlan)} m²${surface.surfaceAnnoncee !== null ? `<br /><span class="aide">fichier : ${formaterNombre(surface.surfaceAnnoncee)} m²</span>` : ''}</td></tr>
            <tr><td>Altitudes</td><td>${formaterNombre(resume.altitudeMin)} à ${formaterNombre(resume.altitudeMax)} m</td></tr>
            <tr><td>Est</td><td>${formaterNombre(resume.estMin)} à ${formaterNombre(resume.estMax)}</td></tr>
            <tr><td>Nord</td><td>${formaterNombre(resume.nordMin)} à ${formaterNombre(resume.nordMax)}</td></tr>
          </table>
        </label>`;
      })
      .join('');

    zone.innerHTML = html;
  }

  return {
    surfaceChoisie: () => lecture?.surfaces[indexChoisi] ?? null,
  };
}
