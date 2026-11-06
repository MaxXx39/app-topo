// Papier, orientation et échelle d'un PDF de plan (0.151.0, demande du 06.11) : trois façons :
// - tout « auto » : A4, l'échelle la plus détaillée où tout tient (mise en évidence à l'export) ;
// - papier choisi, échelle auto : l'échelle la plus détaillée qui tient sur ce papier ;
// - échelle choisie, papier auto : la plus petite feuille (A4 → A0) où le plan tient.
// Paysage au départ.
import { ECHELLES, ORDRE_PAPIERS } from './echelle.js';

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
