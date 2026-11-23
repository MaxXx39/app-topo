// Plans de chantier (0.293.0) : tableau de gestion des phases. Lignes = « on est dans la phase X », colonnes = « on voit la
// phase Y » ; chaque case dit comment montrer les éléments de Y quand on est dans X (caché, normal, estompé, assombri,
// couleur unique), avec un réglage pour les éléments dont la fin est passée, par genre et par élément. Dates de phase.
import { echapper } from '../outils/echapper.js';
import { MODES_VUE, OPACITE_VUE, COULEUR_VUE, regleDeVue, reglerVue, reinitialiserVues, resumeObjet, ganttPhases } from '../topo/plan-chantier.js';

const GENRES = [['zone', 'Zones'], ['ligne', 'Lignes et clôtures'], ['piste', 'Pistes'], ['fleche', 'Flèches'], ['texte', 'Textes'], ['symbole', 'Symboles'], ['grue', 'Grues'], ['cotation', 'Cotations']];
const COURT = { cache: '—', normal: 'Normal', estompe: 'Estompé', assombri: 'Grisé', couleur: 'Couleur' };

/**
 * Ouvre la fenêtre. acces : { plan() → plan, avantChangement() → bool, enregistrer(), redessiner() }.
 */
export function ouvrirGestionPhases(acces) {
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-choix fenetre-champs fenetre-phases';
  let sel = null; // { courante, vue } : case en cours de réglage

  const optionsMode = (valeur, avecCache = true) => MODES_VUE.filter(([c]) => avecCache || c !== 'cache').map(([c, t]) => `<option value="${c}" ${c === valeur ? 'selected' : ''}>${t}</option>`).join('');

  function dessiner() {
    const p = acces.plan();
    const phases = p.phases;
    const ligneEntete = `<tr><th></th>${phases.map((ph) => `<th><i class="pastille-phase" style="background:${ph.couleur}"></i>${echapper(ph.nom)}</th>`).join('')}<th></th></tr>`;
    const lignes = phases.map((c) => `<tr><th class="en-cours"><i class="pastille-phase" style="background:${c.couleur}"></i>${echapper(c.nom)}</th>
      ${phases.map((v) => {
        if (v.id === c.id) return '<td class="case-vue soi">en cours</td>';
        const r = regleDeVue(p, c.id, v.id);
        const detail = (r.genresCaches?.length || r.elementsCaches?.length ? ' ✎' : '') + (r.fini && r.fini !== 'cache' ? ' ↪' : '');
        return `<td><button type="button" class="case-vue mode-${r.mode} ${sel?.courante === c.id && sel?.vue === v.id ? 'choisie' : ''}" data-c="${c.id}" data-v="${v.id}">${COURT[r.mode]}${detail}</button></td>`;
      }).join('')}
      <td><button type="button" class="lien-calage" data-reinit="${c.id}" title="Revenir à l'affichage de départ pour cette ligne">↺</button></td></tr>`).join('');
    const dates = phases.map((ph) => `<tr><td><i class="pastille-phase" style="background:${ph.couleur}"></i>${echapper(ph.nom)}</td>
      <td><input type="date" value="${ph.debut ?? ''}" data-date="debut" data-id="${ph.id}"></td><td><input type="date" value="${ph.fin ?? ''}" data-date="fin" data-id="${ph.id}"></td></tr>`).join('');
    fenetre.innerHTML = `
      <div class="entete-fenetre-champs"><h2>Gestion des phases</h2><button type="button" class="bouton-retour" data-cle="fermer" aria-label="Fermer">✕</button></div>
      <div class="corps-phases">
        <p class="aide-calage">Chaque ligne : « quand on est dans cette phase… » ; chaque colonne : « … on voit les éléments de cette phase comme ça ». Touchez une case pour la régler. ✎ = genres ou éléments cachés ; ↪ = éléments terminés visibles.</p>
        <div class="tableau-phases"><table>${ligneEntete}${lignes}</table></div>
        ${sel ? editeur(p) : '<p class="aide-calage">Aucune case choisie.</p>'}
        <h3>Planning des phases</h3>
        ${planning(p)}
        <h3>Dates des phases</h3>
        <table class="dates-phases"><tr><th>Phase</th><th>Début</th><th>Fin</th></tr>${dates}</table>
      </div>
      <div class="boutons-choix"><button type="button" class="bouton" data-cle="fermer"><strong>Fermer</strong></button></div>`;
  }

  /** Diagramme de Gantt (SVG) : une barre par phase, d'après ses dates. */
  function planning(p) {
    const g = ganttPhases(p.phases);
    if (!g) return '<p class="aide-calage">Saisissez les dates de début (et de fin) des phases pour voir le planning.</p>';
    const L = 560;
    const H = 22;
    const marge = 110;
    const fmt = (iso) => iso.split('-').reverse().join('.');
    const barres = g.lignes.map((l, i) => `<text x="0" y="${i * H + 15}" font-size="11" fill="currentColor">${echapper(l.nom)}</text>
      <rect x="${marge + l.x0 * L}" y="${i * H + 3}" width="${Math.max(3, (l.x1 - l.x0) * L)}" height="${H - 7}" rx="4" fill="${l.couleur}"/>
      <text x="${marge + l.x1 * L + 4}" y="${i * H + 15}" font-size="10" fill="currentColor">${fmt(l.debut)} → ${fmt(l.fin)}</text>`).join('');
    return `<svg viewBox="0 0 ${marge + L + 130} ${g.lignes.length * H + 4}" width="100%" role="img" aria-label="Planning des phases">${barres}</svg>
      ${g.sansDates.length ? `<p class="aide-calage">Sans dates : ${g.sansDates.map(echapper).join(', ')}</p>` : ''}
      <label class="case"><input type="checkbox" data-planning-feuille ${p.feuille?.planning ? 'checked' : ''}> Mettre ce planning sur la feuille (à côté du cartouche)</label>`;
  }

  function editeur(p) {
    const c = p.phases.find((x) => x.id === sel.courante);
    const v = p.phases.find((x) => x.id === sel.vue);
    const r = regleDeVue(p, sel.courante, sel.vue);
    const elements = p.objets.filter((o) => o.phase === v.id && o.type !== 'construction');
    const genresPresents = GENRES.filter(([g]) => elements.some((o) => o.type === g));
    return `<div class="editeur-vue">
      <h3>Dans « ${echapper(c.nom)} », on voit « ${echapper(v.nom)} »</h3>
      <label class="champ-calage"><span>Rendu</span><select data-champ="mode">${optionsMode(r.mode)}</select></label>
      ${r.mode === 'estompe' ? `<label class="champ-calage"><span>Opacité : <b>${Math.round((r.opacite ?? OPACITE_VUE) * 100)} %</b></span><input type="range" min="5" max="90" step="5" value="${Math.round((r.opacite ?? OPACITE_VUE) * 100)}" data-champ="opacite"></label>` : ''}
      ${r.mode === 'couleur' ? `<label class="champ-calage"><span>Couleur unique</span><input type="color" value="${r.couleur ?? v.couleur ?? COULEUR_VUE}" data-champ="couleur"></label>` : ''}
      <label class="champ-calage"><span>Éléments terminés (leur « Fin » est avant cette phase : démontés)</span><select data-champ="fini">${optionsMode(r.fini ?? 'cache')}</select></label>
      ${genresPresents.length ? `<p class="aide-calage">Genres montrés :</p>${genresPresents.map(([g, t]) => `<label class="case"><input type="checkbox" data-genre="${g}" ${r.genresCaches?.includes(g) ? '' : 'checked'}> ${t}</label>`).join('')}` : ''}
      ${elements.length ? `<details><summary>Éléments précis (${elements.length})</summary>${elements.map((o) => `<label class="case"><input type="checkbox" data-element="${o.id}" ${r.elementsCaches?.includes(o.id) ? '' : 'checked'}> ${echapper(resumeObjet(o))}</label>`).join('')}</details>` : '<p class="aide-calage">Cette phase n\'a pas d\'élément.</p>'}
    </div>`;
  }

  const appliquer = (champs) => {
    if (!sel || !acces.avantChangement()) return;
    reglerVue(acces.plan(), sel.courante, sel.vue, champs);
    acces.enregistrer();
    acces.redessiner();
    dessiner();
  };

  fenetre.addEventListener('click', (e) => {
    if (e.target.closest('button[data-cle="fermer"]')) return fenetre.close();
    const cas = e.target.closest('button[data-c]');
    if (cas) {
      sel = { courante: cas.dataset.c, vue: cas.dataset.v };
      return dessiner();
    }
    const reinit = e.target.closest('button[data-reinit]');
    if (reinit && acces.avantChangement()) {
      reinitialiserVues(acces.plan(), reinit.dataset.reinit);
      if (sel?.courante === reinit.dataset.reinit) sel = null;
      acces.enregistrer();
      acces.redessiner();
      dessiner();
    }
  });
  fenetre.addEventListener('change', (e) => {
    const c = e.target;
    if (c.dataset.date) {
      if (!acces.avantChangement()) return;
      const ph = acces.plan().phases.find((x) => x.id === c.dataset.id);
      if (c.value) ph[c.dataset.date] = c.value;
      else delete ph[c.dataset.date];
      acces.enregistrer();
      acces.redessiner();
      return dessiner();
    }
    if (c.dataset.planningFeuille !== undefined) {
      if (!acces.avantChangement()) return;
      const pl = acces.plan();
      pl.feuille = { ...(pl.feuille ?? {}), planning: c.checked };
      acces.enregistrer();
      acces.redessiner();
      return;
    }
    if (!sel) return;
    const p = acces.plan();
    const r = regleDeVue(p, sel.courante, sel.vue);
    if (c.dataset.champ === 'mode') appliquer({ mode: c.value });
    else if (c.dataset.champ === 'fini') appliquer({ fini: c.value });
    else if (c.dataset.champ === 'couleur') appliquer({ couleur: c.value });
    else if (c.dataset.champ === 'opacite') appliquer({ opacite: Number(c.value) / 100 });
    else if (c.dataset.genre) {
      const cache = new Set(r.genresCaches ?? []);
      if (c.checked) cache.delete(c.dataset.genre); else cache.add(c.dataset.genre);
      appliquer({ genresCaches: [...cache] });
    } else if (c.dataset.element) {
      const cache = new Set(r.elementsCaches ?? []);
      if (c.checked) cache.delete(c.dataset.element); else cache.add(c.dataset.element);
      appliquer({ elementsCaches: [...cache] });
    }
  });
  fenetre.addEventListener('cancel', (e) => { e.preventDefault(); fenetre.close(); });
  fenetre.addEventListener('close', () => fenetre.remove());
  dessiner();
  document.body.append(fenetre);
  fenetre.showModal();
}
