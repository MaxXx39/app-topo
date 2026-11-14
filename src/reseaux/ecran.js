// Écran de l'application Réseaux (0.235.0, Expert, test, demande du 14.11) : sous le plan, deux pages :
// « Créer » (un réseau : polyligne touchée sur le DXF, ou points touchés un à un avec leur fil d'eau ; type, nom,
// diamètre extérieur, surface de référence, tranchée facultative avec bords droits possibles) et « Voir » (liste des
// réseaux, coupe en travers ou dans l'axe, tranchées et bords G / D du fond sur le plan). Tout est rendu en HTML ;
// les actions passent par data-action (voir main.js « Réseaux »).
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { TYPES_RESEAU, couleurDuType, pentesDesSegments, longueurReseau, CIBLES_RESEAU, ALTITUDES_RESEAU } from '../topo/reseau.js';
import { bulle } from '../aide/bulles.js';

const nombre = (v) => (v == null ? '—' : formaterNombre(v));

function puces(types, actif) {
  return `<div class="puces-types" role="group" aria-label="Type de réseau">${types.map((t) => `<button type="button" class="puce-type ${t.cle === actif ? 'actif' : ''}" style="--couleur:${t.couleur}" data-action="type-reseau" data-valeur="${echapper(t.cle)}" aria-pressed="${t.cle === actif}">${echapper(t.cle)}</button>`).join('')}</div>`;
}

function htmlCreer(b, surfaces) {
  const selection = `<div class="choix-segment-reseau" role="group" aria-label="Façon de choisir le tracé">
      <button type="button" data-action="mode-reseau" data-valeur="dxf" class="${b.mode === 'dxf' ? 'actif' : ''}" aria-pressed="${b.mode === 'dxf'}">Clic sur le DXF</button>
      <button type="button" data-action="mode-reseau" data-valeur="points" class="${b.mode === 'points' ? 'actif' : ''}" aria-pressed="${b.mode === 'points'}">Point par point</button></div>`;
  const invite = b.sommets.length === 0
    ? `<p class="invite-reseau">${b.mode === 'dxf' ? 'Touche une polyligne sur le plan' : 'Touche le premier point sur le plan'}</p>`
    : b.message ? `<p class="ok-reseau">${echapper(b.message)}</p>` : '';
  const lignes = b.sommets.map((s, i) => `<tr><td>${i + 1}</td><td>${nombre(s.est)} · ${nombre(s.nord)}</td>
      <td><input type="text" inputmode="decimal" data-champ="fe-point-reseau" data-index="${i}" value="${echapper(s.fe)}" placeholder="FE" aria-label="Fil d'eau du point ${i + 1}" /></td></tr>`).join('');
  const points = b.sommets.length > 0
    ? `<div class="cadre-reseau"><h3>Points du tracé (fil d'eau en m)</h3>
        <table class="points-reseau"><thead><tr><th>#</th><th>Est · Nord</th><th>FE</th></tr></thead><tbody>${lignes}</tbody></table>
        <p class="note-reseau">${b.mode === 'points' ? 'Touche un autre point du plan pour continuer. ' : ''}<button type="button" class="bouton-lien" data-action="enlever-point-reseau" ${b.mode === 'points' ? '' : 'hidden'}>enlever le dernier</button></p></div>`
    : '';
  const t = b.tranchee;
  const options = surfaces.map((s) => `<option value="${echapper(s.id)}" ${b.surfaceId === s.id ? 'selected' : ''}>${echapper(s.nom)}</option>`).join('');
  return `<div class="cadre-reseau"><h3>Tracé ${bulle('reseaux')}</h3>${selection}${invite}</div>
    ${points}
    <div class="cadre-reseau"><h3>Réseau</h3>${puces(TYPES_RESEAU, b.type)}
      <label class="ligne-champ-reseau">Nom<input type="text" data-champ="nom-reseau" value="${echapper(b.nom)}" placeholder="ex. EU-1" autocomplete="off" /></label>
      <label class="ligne-champ-reseau">Diamètre extérieur (mm)<input type="text" inputmode="decimal" data-champ="diametre-reseau" value="${echapper(b.diametre)}" placeholder="ex. 315" /></label>
      <label class="ligne-champ-reseau">Surface de référence<select data-champ="surface-reseau"><option value="">— aucune —</option>${options}</select></label></div>
    <div class="cadre-reseau"><h3>Tranchée</h3>
      <button type="button" class="bouton-secondaire" data-action="tranchee-reseau" role="switch" aria-checked="${t.actif}">${t.actif ? '☑' : '☐'} Avec une tranchée</button>
      ${t.actif ? `<label class="ligne-champ-reseau">Hauteur fond de tranchée → FE (m)<input type="text" inputmode="decimal" data-champ="hauteur-tranchee" value="${echapper(t.hauteur)}" placeholder="ex. 0.150" /></label>
        <label class="ligne-champ-reseau">Largeur au fond (m)<input type="text" inputmode="decimal" data-champ="largeur-tranchee" value="${echapper(t.largeur)}" placeholder="ex. 0.800" /></label>
        <button type="button" class="bouton-secondaire" data-action="bords-droits-reseau" role="switch" aria-checked="${t.droit}">${t.droit ? '☑' : '☐'} Bords droits (blindage, sans talus)</button>
        ${t.droit ? '' : `<label class="ligne-champ-reseau">Pente du talus (H/V)<input type="text" inputmode="decimal" data-champ="talus-tranchee" value="${echapper(t.talus)}" placeholder="ex. 0.500" /></label>`}` : ''}</div>
    <div class="cadre-reseau"><button type="button" class="bouton" data-action="enregistrer-reseau">Enregistrer le réseau</button>
      <button type="button" class="bouton-secondaire" data-action="recommencer-reseau" ${b.sommets.length === 0 ? 'disabled' : ''}>Recommencer</button></div>`;
}

function htmlVoir(e) {
  const { reseaux, selectionId } = e;
  if (reseaux.length === 0) return '<div class="cadre-reseau"><p class="invite-reseau">Aucun réseau : crée-en un dans « Créer »</p></div>';
  const choisi = reseaux.find((r) => r.id === selectionId) ?? reseaux[0];
  const liste = reseaux.map((r) => `<div class="ligne-reseau ${r.id === choisi.id ? 'choisi' : ''}">
      <span class="pastille-reseau" style="--couleur:${couleurDuType(r.type)}"></span>
      <button type="button" class="bouton-lien nom" data-action="choisir-reseau" data-id="${echapper(r.id)}">${echapper(r.nom)} <small>${echapper(r.type)} · Ø${Math.round(r.diametre * 1000)}</small></button>
      <small>${nombre(r.sommets[0].fe)} → ${nombre(r.sommets.at(-1).fe)}</small></div>`).join('');
  const L = longueurReseau(choisi);
  const pentes = pentesDesSegments(choisi).map((p) => (p == null ? '—' : `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(2)} %`)).join(' · ');
  const case_ = (cle, texte, actif) => `<button type="button" class="case-reseau ${actif ? 'actif' : ''}" data-action="afficher-reseau" data-valeur="${cle}" role="switch" aria-checked="${actif}">${actif ? '☑' : '☐'} ${texte}</button>`;
  const coupe = (cle, texte) => `<button type="button" class="${e.coupe === cle ? 'actif' : ''}" data-action="coupe-reseau" data-valeur="${cle}" aria-pressed="${e.coupe === cle}">${texte}</button>`;
  return `<div class="cadre-reseau liste-reseaux"><h3>Réseaux (${reseaux.length})</h3>${liste}</div>
    <div class="cadre-reseau"><h3>${echapper(choisi.nom)} · ${echapper(choisi.type)} · Ø${Math.round(choisi.diametre * 1000)}</h3>
      <p class="note-reseau">Longueur ${nombre(L)} m · FE ${nombre(choisi.sommets[0].fe)} → ${nombre(choisi.sommets.at(-1).fe)} · pentes ${pentes}${choisi.tranchee ? ` · tranchée ${nombre(choisi.tranchee.largeur)} m au fond, ${choisi.tranchee.talus === 0 ? 'bords droits' : `talus ${nombre(choisi.tranchee.talus)}`}` : ''}</p>
      <div class="cases-reseau">${case_('tranchees', 'Tranchées', e.afficher.tranchees)}${case_('bords', 'Bords G / D du fond', e.afficher.bords)}</div></div>
    <div class="cadre-reseau"><div class="choix-segment-reseau" role="group" aria-label="Coupe">${coupe('perp', 'Perpendiculaire')}${coupe('axe', 'Dans l\'axe')}</div>
      ${e.coupe === 'perp' ? `<div class="barre-abscisse" style="margin-top:8px"><button type="button" class="bouton-secondaire" data-action="abscisse-reseau" data-valeur="-1" aria-label="Reculer d'un mètre">◀</button>
        <input type="range" min="0" max="${L.toFixed(3)}" step="0.1" value="${Math.min(e.abscisse, L).toFixed(1)}" data-champ="abscisse-reseau" aria-label="Place de la coupe sur le réseau" />
        <button type="button" class="bouton-secondaire" data-action="abscisse-reseau" data-valeur="1" aria-label="Avancer d'un mètre">▶</button>
        <strong>${nombre(Math.min(e.abscisse, L))} m</strong></div>` : ''}
      <div style="margin-top:8px">${e.coupeSvg || '<p class="note-reseau">Pas de coupe à cet endroit.</p>'}</div>
      <p class="note-reseau">${e.coupe === 'axe' ? `Hauteurs ×${e.exageration ?? 1} par rapport aux longueurs. ` : ''}${choisi.surfaceId ? '' : 'Pas de surface de référence : le terrain n\'est pas dessiné. '}</p>
      <button type="button" class="bouton-secondaire suppression-vraie" data-action="supprimer-reseau" data-id="${echapper(choisi.id)}">Supprimer ce réseau</button></div>`;
}

/** Page « Implanter » : quel réseau, quelle ligne suivre (axe ou bords du fond de tranchée) et quelle altitude viser. */
function htmlImplanter(e) {
  const { reseaux } = e;
  if (reseaux.length === 0) return '<div class="cadre-reseau"><p class="invite-reseau">Aucun réseau : crée-en un dans « Créer »</p></div>';
  const choisi = reseaux.find((r) => r.id === e.selectionId) ?? reseaux[0];
  const avecTranchee = Boolean(choisi.tranchee);
  const liste = reseaux.map((r) => `<option value="${echapper(r.id)}" ${r.id === choisi.id ? 'selected' : ''}>${echapper(r.nom)} · ${echapper(r.type)} · Ø${Math.round(r.diametre * 1000)}</option>`).join('');
  const choix = (action, options, actif, permis) => `<div class="puces-choix-reseau">${options.map(([cle, titre]) => `<button type="button" class="puce-choix ${cle === actif ? 'actif' : ''}" data-action="${action}" data-valeur="${cle}" ${permis(cle) ? '' : 'disabled'} aria-pressed="${cle === actif}">${titre}</button>`).join('')}</div>`;
  return `<div class="cadre-reseau"><h3>Réseau à implanter</h3>
      <label class="ligne-champ-reseau">Réseau<select data-champ="reseau-implanter">${liste}</select></label>
      <h3 style="margin-top:10px">Ligne à suivre</h3>${choix('cible-reseau', CIBLES_RESEAU, e.cible, (c) => c === 'axe' || avecTranchee)}
      <h3 style="margin-top:10px">Altitude visée</h3>${choix('altitude-reseau', ALTITUDES_RESEAU, e.altitude, (a) => a !== 'fond' || avecTranchee)}
      ${avecTranchee ? '' : '<p class="note-reseau">Ce réseau n\'a pas de tranchée : pas de bords ni de fond.</p>'}
      <button type="button" class="bouton" data-action="implanter-reseau" style="margin-top:10px">Implanter</button>
      <p class="note-reseau">Ouvre Implanter › Ligne sur ce réseau : « Monter / Descendre » suit la pente, et un profil en long apparaît à moins de 1 m de la ligne.</p></div>`;
}

/**
 * HTML de l'écran. e : { vue ('creer' ou 'voir'), brouillon, surfaces: [{ id, nom }], reseaux, selectionId, abscisse,
 * coupe ('perp' ou 'axe'), cible, altitude (page Implanter), afficher: { tranchees, bords }, coupeSvg, exageration }.
 */
export function htmlReseaux(e) {
  const onglet = (cle, titre) => `<button type="button" class="${e.vue === cle ? 'actif' : ''}" data-action="vue-reseaux" data-valeur="${cle}" aria-pressed="${e.vue === cle}">${titre}</button>`;
  return `<div class="ecran-reseaux">
    <div class="choix-segment-reseau" role="group" aria-label="Page">${onglet('creer', 'Créer')}${onglet('voir', 'Voir')}${onglet('implanter', 'Implanter')}</div>
    ${e.vue === 'creer' ? htmlCreer(e.brouillon, e.surfaces) : e.vue === 'implanter' ? htmlImplanter(e) : htmlVoir(e)}
  </div>`;
}
