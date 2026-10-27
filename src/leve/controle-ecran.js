// Terrain › Contrôle (autocontrôle sur des points connus, demande du 26.10.2026) : morceaux d'écran.
// - la liste des points de contrôle (toucher un point = aller le mesurer, guidage comme pour implanter) ;
// - l'historique des contrôles du projet (couleur selon les tolérances, remarque facultative) ;
// - la gestion (roue ⚙, protégée par le code de sécurité) : tolérances et points de contrôle.
// Le guidage lui-même est dans leve/ecran.js (le même que pour implanter un point).
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { formaterNombre } from '../topo/format.js';
import { dateHeure } from '../topo/controle.js';

const MOTS = { vert: 'OK', orange: 'Limite', rouge: 'Hors tolérance' };
const cm = (m) => String(Math.round(m * 1000) / 10);

/**
 * Écran du mode Contrôler (hors guidage). ac : { points: [{ id, nom, est, nord, altitude, dernier }],
 * tolerances, controles (les plus récents d'abord), necessaire, nbControles }, gestionOuverte : vrai
 * après le code de sécurité, erreurGestion : texte ou ''.
 */
export function htmlControle(ac, { gestionOuverte, erreurGestion }) {
  return `
    <div class="entete-controle">
      <p class="titre-choix">Points de contrôle ${bulle('autocontrole')}</p>
      <button type="button" class="bouton-retour ${gestionOuverte ? 'actif' : ''}" data-action="basculerGestionControle" title="Points de contrôle et tolérances (code de sécurité)" aria-label="Points de contrôle et tolérances" aria-expanded="${gestionOuverte}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg></button>
    </div>
    ${gestionOuverte ? htmlGestion(ac, erreurGestion) : ''}
    <p class="etat-controle ${ac.necessaire ? 'a-faire' : 'fait'}">${ac.necessaire ? 'Contrôle à faire' : `Dernier contrôle réussi : ${echapper(dateHeure(ac.dernierReussi))}`}</p>
    ${ac.points.length === 0
      ? '<p class="vide">Aucun point de contrôle.</p>'
      : `<p class="titre-choix titre-choisir-controle">Choisir un point sur le plan ou dans la liste</p>
      <div class="points-controle">${ac.points.map((p) => `<button type="button" class="point-controle" data-action="controlerPoint" data-valeur="${p.id}">
          <strong>${echapper(p.nom)}</strong>
          ${p.dernier ? `<span class="pastille-resultat ${p.dernier.global}">${echapper(dateHeure(p.dernier.le))}</span>` : '<span class="aide">jamais contrôlé</span>'}
        </button>`).join('')}</div>`}
    ${htmlHistorique(ac)}`;
}

/** Tolérances (cm) et points de contrôle : ajouter (projet, fichier, tapé) ou enlever. */
function htmlGestion(ac, erreur) {
  const t = ac.tolerances;
  const champ = (cle, valeur, titre) => `<label>${titre}<input type="text" inputmode="decimal" data-tolerance="${cle}" value="${cm(valeur)}" /></label>`;
  return `<div class="gestion-controle">
    <p class="titre-choix">Tolérances (cm)</p>
    <div class="tolerances-controle">
      <span>Plan</span>${champ('planVert', t.plan.vert, 'vert ≤')}${champ('planOrange', t.plan.orange, 'orange ≤')}
      <span>Hauteur</span>${champ('hauteurVert', t.hauteur.vert, 'vert ≤')}${champ('hauteurOrange', t.hauteur.orange, 'orange ≤')}
    </div>
    <div class="ligne-outils"><button type="button" class="bouton-secondaire" data-action="enregistrerTolerances">Enregistrer les tolérances</button></div>
    <p class="titre-choix">Points de contrôle (${ac.points.length})</p>
    ${ac.points.map((p) => `<div class="ligne-a-implanter">
        <span><strong>${echapper(p.nom)}</strong> <span class="aide"><span class="coord-en">E ${formaterNombre(p.est)} · N ${formaterNombre(p.nord)} · </span>H ${p.altitude != null ? formaterNombre(p.altitude) : '—'}</span></span>
        <button type="button" class="bouton-lien" data-action="supprimerPointControle" data-valeur="${p.id}" aria-label="Enlever ${echapper(p.nom)}">×</button>
      </div>`).join('')}
    <div class="ligne-outils">
      <button type="button" class="bouton-secondaire" data-action="choisirPointControle">+ Point du projet</button>
      <label class="bouton-secondaire bouton-fichier">+ Fichier (CSV, TXT)<input type="file" data-champ="fichier-controle" accept=".csv,.txt,.pts,.xyz,.dat,.asc,text/csv,text/plain" hidden /></label>
      <button type="button" class="bouton-secondaire" data-action="taperPointControle">+ Taper</button>
    </div>
    ${erreur ? `<p class="erreur">${echapper(erreur)}</p>` : ''}
  </div>`;
}

/** Historique : les contrôles du projet, les plus récents d'abord ; export CSV et PDF. */
function htmlHistorique(ac) {
  if (ac.controles.length === 0) return '';
  const ecart = (valeur) => (valeur == null ? '—' : `${formaterNombre(valeur)} m`);
  return `<div class="historique-controle">
    <p class="titre-choix">Contrôles (${ac.nbControles})</p>
    ${ac.controles.map((c) => (c.type === 'refus'
      ? `<div class="ligne-controle rouge"><span class="date-controle">${echapper(dateHeure(c.le))}</span><strong>Refusé</strong><span class="aide">${echapper(c.appareil ?? '')}</span></div>`
      : `<div class="ligne-controle ${c.resultat.global}">
          <span class="date-controle">${echapper(dateHeure(c.le))}</span>
          <strong>${echapper(c.nom)} · ${MOTS[c.resultat.global]}</strong>
          <span class="ecarts-controle"><span class="${c.resultat.plan}">plan ${ecart(c.ecarts.plan)}</span> · <span class="${c.resultat.hauteur ?? ''}">haut. ${ecart(c.ecarts.hauteur)}</span>
            <span class="aide">(E ${ecart(c.ecarts.est)} · N ${ecart(c.ecarts.nord)})</span></span>
          <input type="text" class="remarque-controle" data-champ="remarque-controle" data-id="${c.id}" value="${echapper(c.remarque ?? '')}" placeholder="remarque" aria-label="Remarque" />
        </div>`)).join('')}
    <p class="aide">exporter : <button type="button" class="bouton-lien bouton-lien-neutre" data-action="exporterControles" data-valeur="csv">CSV</button>
      · <button type="button" class="bouton-lien bouton-lien-neutre" data-action="exporterControles" data-valeur="pdf">PDF</button></p>
  </div>`;
}
