// Calculs › Dessin › « Talus d'une surface » (0.135.0, Expert, demande du 05.11.2026) : une surface
// importée (terrain, plateforme, terrassement…) reçoit des talus côté par côté. On choisit les côtés
// de son contour sur le plan (un, plusieurs ou tous), on règle leur pente, leur sens et leur fin,
// puis « Appliquer ». La surface « … talus » (surface importée + talus) est refaite à chaque réglage.
// Calculs dans topo/talus-cotes.js ; le reste dans main.js.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { PENTES_TALUS } from '../topo/plateforme-talus.js';
import { demanderTexte } from '../outils/choix.js';

const nombre = (valeur) => (valeur == null ? '' : String(Math.round(valeur * 1000) / 1000));

/** Lit une pente tapée « 5/4 » (H/V) : { horizontal, vertical } ou null. */
export function lirePente(texte) {
  const morceaux = String(texte ?? '').replace(/,/g, '.').split('/').map((x) => Number(x.trim()));
  if (morceaux.length !== 2 || !morceaux.every((x) => Number.isFinite(x) && x > 0)) return null;
  return { horizontal: morceaux[0], vertical: morceaux[1] };
}

/**
 * Crée l'écran dans "conteneur". actions (main.js) : nouveauTalusSurface(sourceId),
 * choisirCotesTalus(id) (commencer / finir le choix sur le plan), toutChoisirTalus(id),
 * rienChoisirTalus(id), appliquerTalus(id, reglage), enleverTalus(id), reglerTerrainTalus(id, terrainId),
 * supprimerTalusSurface(id).
 * Renvoie { afficher(donnees) } ; donnees : { sources: [{ id, nom }], terrains: [{ id, nom }],
 * talus: [{ id, nom, sourceId, terrainId, enChoix, choisis (nombre), cleChoix, nombreCotes, reglage (du 1er côté choisi),
 * groupes: [{ cotes (texte), texte, etat, message }], erreur }] }.
 */
export function creerEcranTalusSurface(conteneur, actions) {
  // Réglage en cours de saisie, par talus (gardé quand l'écran est redessiné).
  const formulaires = new Map();
  let derniers = null;

  // Quand le choix des côtés change, la saisie reprend le réglage du premier côté choisi (s'il en a un).
  const formulaire = (t) => {
    let f = formulaires.get(t.id);
    if (!f || (f.cleChoix !== t.cleChoix && t.reglage)) {
      f = { horizontal: 3, vertical: 2, sens: 'auto', longueur: null, altitudeSol: null, ...(f ?? {}), ...(t.reglage ?? {}) };
      formulaires.set(t.id, f);
    }
    f.cleChoix = t.cleChoix;
    return f;
  };

  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton || bouton.disabled) return;
    const { action, id } = bouton.dataset;
    if (action === 'nouveauTalusSurface') {
      const choix = conteneur.querySelector('[data-champ="source-talus"]')?.value;
      if (choix) actions.nouveauTalusSurface(choix);
      return;
    }
    if (action === 'appliquerTalus') {
      lireChamps(id);
      const { cleChoix, ...reglage } = formulaires.get(id);
      actions.appliquerTalus(id, reglage);
      return;
    }
    actions[action]?.(id);
  });

  /** Longueur et altitude du sol tapées (lues aussi sans Entrée). */
  function lireChamps(id) {
    const f = formulaires.get(id);
    if (!f) return;
    for (const cle of ['longueur', 'altitudeSol']) {
      const champ = conteneur.querySelector(`[data-reglage="${cle}"][data-id="${id}"]`);
      if (!champ) continue;
      const texte = champ.value.trim().replace(',', '.');
      const valeur = texte === '' ? null : Number(texte);
      f[cle] = Number.isFinite(valeur) && (cle === 'altitudeSol' || valeur > 0) ? valeur : null;
    }
  }

  conteneur.addEventListener('change', (evenement) => {
    const champ = evenement.target;
    const { id } = champ.dataset;
    if (champ.dataset.champ === 'terrain-talus') {
      actions.reglerTerrainTalus(id, champ.value || null);
      return;
    }
    const cle = champ.dataset.reglage;
    if (!cle) return;
    const f = formulaires.get(id);
    if (!f) return;
    if (cle === 'pente') {
      if (champ.value !== 'tapee') {
        Object.assign(f, lirePente(champ.value));
        return;
      }
      demanderTexte({ titre: 'Pente du talus en H/V (ex. 5/4)' }).then((texte) => {
        const lue = lirePente(texte);
        if (lue) Object.assign(f, lue);
        else if (texte) alert(`Pente « ${texte} » illisible : écris H/V, par exemple 5/4.`);
        if (derniers) afficher(derniers);
      });
      return;
    }
    if (cle === 'sens') f.sens = champ.value;
    else lireChamps(id);
  });

  function htmlTalus(t, donnees) {
    const f = formulaire(t);
    const texte = `${nombre(f.horizontal)}/${nombre(f.vertical)}`;
    const connue = PENTES_TALUS.some(([c]) => c === texte);
    const sansTerrain = !t.terrainId;
    const groupes = t.groupes.length
      ? `<ul class="groupes-talus">${t.groupes.map((g) => `<li class="talus-${g.etat}"><strong>${echapper(g.cotes)}</strong> · ${echapper(g.texte)}${g.message ? ` <span class="aide">(${echapper(g.message)})</span>` : ''}</li>`).join('')}</ul>`
      : '';
    return `<div class="carte-talus-surface">
      <div class="entete-talus-surface">
        <strong>${echapper(t.nom)}</strong>
        <button type="button" class="bouton-lien" data-action="supprimerTalusSurface" data-id="${t.id}">supprimer</button>
      </div>
      ${t.erreur ? `<p class="erreur">${echapper(t.erreur)}</p>` : ''}
      <label class="champ-talus-dessin">Terrain de référence
        <select data-champ="terrain-talus" data-id="${t.id}" aria-label="Terrain de référence">
          <option value="" ${sansTerrain ? 'selected' : ''}>— aucun —</option>
          ${donnees.terrains.filter((s) => s.id !== t.sourceId && s.id !== t.id).map((s) => `<option value="${s.id}" ${s.id === t.terrainId ? 'selected' : ''}>${echapper(s.nom)}</option>`).join('')}
        </select></label>
      <div class="choix-cotes-talus">
        <button type="button" class="${t.enChoix ? 'principal' : ''}" data-action="choisirCotesTalus" data-id="${t.id}" aria-pressed="${t.enChoix}">${t.enChoix ? 'Terminé' : 'Choisir les côtés'}</button>
        ${t.enChoix ? `<button type="button" data-action="toutChoisirTalus" data-id="${t.id}">Tous</button>
          <button type="button" data-action="rienChoisirTalus" data-id="${t.id}">Aucun</button>` : ''}
        <span class="aide">${t.choisis} / ${t.nombreCotes} côté${t.nombreCotes > 1 ? 's' : ''}</span>
        ${bulle('talusSurface')}
      </div>
      ${t.enChoix ? `<div class="reglages-talus-dessin">
          <label class="champ-talus-dessin">Pente
            <select data-reglage="pente" data-id="${t.id}" aria-label="Pente du talus (H/V)">
              ${PENTES_TALUS.map(([c]) => `<option value="${c}" ${c === texte ? 'selected' : ''}>${c}</option>`).join('')}
              <option value="tapee" ${connue ? '' : 'selected'}>${connue ? 'autre…' : texte}</option>
            </select></label>
          <label class="champ-talus-dessin">Sens
            <select data-reglage="sens" data-id="${t.id}" aria-label="Sens du talus">
              <option value="auto" ${f.sens === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="remblai" ${f.sens === 'remblai' ? 'selected' : ''}>Remblai</option>
              <option value="deblai" ${f.sens === 'deblai' ? 'selected' : ''}>Déblai</option>
            </select></label>
          <label class="champ-talus-dessin">Longueur (m)
            <input type="text" inputmode="decimal" data-reglage="longueur" data-id="${t.id}" value="${nombre(f.longueur)}" placeholder="${sansTerrain ? '—' : 'terrain'}" /></label>
          ${sansTerrain ? `<label class="champ-talus-dessin">Altitude du sol (m)
            <input type="text" inputmode="decimal" data-reglage="altitudeSol" data-id="${t.id}" value="${nombre(f.altitudeSol)}" placeholder="—" /></label>` : ''}
        </div>
        <div class="choix-cotes-talus">
          <button type="button" class="principal" data-action="appliquerTalus" data-id="${t.id}" ${t.choisis ? '' : 'disabled'}>Appliquer</button>
          <button type="button" data-action="enleverTalus" data-id="${t.id}" ${t.choisis ? '' : 'disabled'}>Enlever le talus</button>
        </div>` : ''}
      ${groupes}
    </div>`;
  }

  function afficher(donnees) {
    derniers = donnees;
    // Talus supprimés : leur saisie est oubliée.
    for (const id of formulaires.keys()) if (!donnees.talus.some((t) => t.id === id)) formulaires.delete(id);
    conteneur.innerHTML = `<h3>Talus d'une surface ${bulle('talusSurface')}</h3>
      ${donnees.sources.length ? `<div class="choix-cotes-talus">
          <select data-champ="source-talus" aria-label="Surface importée">
            ${donnees.sources.map((s) => `<option value="${s.id}">${echapper(s.nom)}</option>`).join('')}
          </select>
          <button type="button" data-action="nouveauTalusSurface">+ Talus</button>
        </div>` : '<p class="vide">Aucune surface importée.</p>'}
      ${donnees.talus.map((t) => htmlTalus(t, donnees)).join('')}`;
  }

  return { afficher };
}
