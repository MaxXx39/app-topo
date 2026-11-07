// Papier, orientation et échelle d'un PDF de plan (0.151.0, demande du 06.11) : trois façons :
// - tout « auto » : A4, l'échelle la plus détaillée où tout tient (mise en évidence à l'export) ;
// - papier choisi, échelle auto : l'échelle la plus détaillée qui tient sur ce papier ;
// - échelle choisie, papier auto : la plus petite feuille (A4 → A0) où le plan tient.
// Paysage au départ.
import { ECHELLES, ORDRE_PAPIERS, feuillePrevue } from './echelle.js';

/** Champs « Papier », « Orientation » et « Échelle » (HTML). */
export function champsMiseEnPage() {
  return `<div class="champs-export champs-mise-en-page">
      <label>Papier
        <select data-champ="papier">
          <option value="auto">auto</option>
          ${ORDRE_PAPIERS.map((p) => `<option value="${p}">${p.toUpperCase()}</option>`).join('')}
        </select>
      </label>
      <label>Orientation
        <select data-champ="orientation">
          <option value="paysage">paysage</option>
          <option value="portrait">portrait</option>
        </select>
      </label>
      <label>Échelle du plan
        <select data-champ="echelle">
          <option value="auto">auto</option>
          ${ECHELLES.map((e) => `<option value="${e}">1:${e}</option>`).join('')}
        </select>
      </label>
    </div>`;
}

/** Choix lus dans le formulaire : { papier ('auto', 'a4'…), orientation, echelleImposee (nombre ou null) }. */
export function lireMiseEnPage(conteneur) {
  const valeur = (nom, defaut) => conteneur.querySelector(`[data-champ="${nom}"]`)?.value ?? defaut;
  const echelle = valeur('echelle', 'auto');
  return {
    papier: valeur('papier', 'auto'),
    orientation: valeur('orientation', 'paysage') === 'portrait' ? 'portrait' : 'paysage',
    echelleImposee: echelle === 'auto' ? null : Number(echelle),
  };
}

/** Texte court du choix (résumé des options) : « A4 auto · paysage », « A3 · 1:500 · portrait »… */
export function resumeMiseEnPage({ papier, orientation, echelleImposee }) {
  const morceaux = [];
  if (papier === 'auto' && !echelleImposee) morceaux.push('A4 auto');
  else {
    morceaux.push(papier === 'auto' ? 'papier auto' : papier.toUpperCase());
    morceaux.push(echelleImposee ? `1:${echelleImposee}` : 'échelle auto');
  }
  morceaux.push(orientation);
  return morceaux.join(' · ');
}

/** Ce qui a été fait, mis en évidence : « A3 paysage · échelle 1:500 ». */
export function texteFeuille(format, orientation, echelle) {
  return `${String(format).toUpperCase()} ${orientation ?? 'paysage'} · échelle 1:${echelle}`;
}

/**
 * Ligne « PDF : A3 paysage · échelle 1:500 » au-dessus du bouton Exporter (0.152.0) : refaite à
 * chaque changement (papier, orientation, échelle, choix) et quand le formulaire devient visible.
 * prevoir() renvoie la zone du terrain de la première feuille, ou null.
 */
export function brancherFeuillePrevue(conteneur, prevoir, estPdf) {
  const ligne = conteneur.querySelector('[data-zone="feuille-prevue"]');
  if (!ligne) return () => {};
  const mettreAJour = () => {
    if (!estPdf() || !ligne.isConnected) return;
    let zone = null;
    try {
      zone = prevoir();
    } catch {
      zone = null;
    }
    const f = feuillePrevue(zone, lireMiseEnPage(conteneur));
    ligne.classList.toggle('depasse', Boolean(f?.depasse));
    ligne.textContent = f ? `PDF : ${texteFeuille(f.format, f.orientation, f.echelle)}${f.depasse ? ' · le plan dépasse la feuille' : ''}` : 'PDF : rien à dessiner (coche un levé, un volume…)';
  };
  conteneur.addEventListener('change', () => setTimeout(mettreAJour, 0));
  conteneur.addEventListener('click', () => setTimeout(mettreAJour, 0));
  // Formulaire montré (onglet Exporter ouvert, tuile choisie) : recalculé.
  new IntersectionObserver((entrees) => {
    if (entrees.some((e) => e.isIntersecting)) mettreAJour();
  }).observe(ligne);
  return mettreAJour;
}

// Équidistances des courbes proposées dans les exports PDF (0.154.0, dès Intermédiaire), en m.
export const EQUIDISTANCES_PDF = ['auto', '0.1', '0.2', '0.25', '0.5', '1', '2', '5'];
