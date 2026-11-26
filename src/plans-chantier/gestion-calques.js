// Plans de chantier (0.296.0) : calques d'un plan affiché dessous (masquer, couleur), réglés pour CE plan de chantier
// seulement (le plan du projet ne change pas). Rangé dans plan.fond.calques[idDuPlan][numéroDuCalque] = { visible, couleur }.
import { echapper } from '../outils/echapper.js';

/** Plans du projet avec les réglages de calques du plan de chantier appliqués (copies stables : même objet tant que rien ne change). */
const memoire = new Map();
export function plansAvecCalques(plans, fond) {
  return plans.map((p) => {
    const reglages = fond?.calques?.[p.id];
    if (!reglages || !p.calques?.length) return p;
    const signature = JSON.stringify(reglages);
    const vu = memoire.get(p.id);
    if (vu && vu.origine === p && vu.signature === signature) return vu.copie;
    const copie = Object.assign(Object.create(p), { calques: p.calques.map((c, i) => ({ ...c, ...(reglages[i] ?? {}) })) }); // Object.create : garde ce qu'un plan recalé hérite
    memoire.set(p.id, { origine: p, signature, copie });
    return copie;
  });
}

/**
 * Ouvre la fenêtre. acces : { plans() → plans montrés dessous (d'origine), plan() → plan de chantier, avantChangement(),
 * enregistrer(), redessiner() }.
 */
export function ouvrirGestionCalques(acces) {
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-choix fenetre-champs fenetre-calques';
  const liste = acces.plans().filter((p) => p.calques?.length);
  let planId = liste[0]?.id ?? null;
  let filtre = '';

  const reglage = (id, i) => acces.plan().fond?.calques?.[id]?.[i] ?? {};
  const changer = (id, i, champs) => {
    if (!acces.avantChangement()) return false;
    const fond = acces.plan().fond;
    fond.calques ??= {};
    fond.calques[id] ??= {};
    fond.calques[id][i] = { ...(fond.calques[id][i] ?? {}), ...champs };
    return true;
  };

  function dessiner() {
    const p = liste.find((x) => x.id === planId);
    const lignes = (p?.calques ?? []).map((c, i) => ({ c, i })).filter(({ c }) => c.nom.toLowerCase().includes(filtre.toLowerCase()));
    fenetre.innerHTML = `
      <div class="entete-fenetre-champs"><h2>Calques des plans affichés</h2><button type="button" class="bouton-retour" data-cle="fermer" aria-label="Fermer">✕</button></div>
      <div class="corps-calques">
        ${liste.length ? `<label class="champ-calage"><span>Plan</span><select data-plan>${liste.map((x) => `<option value="${x.id}" ${x.id === planId ? 'selected' : ''}>${echapper(x.nom ?? x.id)}</option>`).join('')}</select></label>
        <div class="barre-calques"><input type="search" placeholder="Filtrer les calques…" value="${echapper(filtre)}" data-filtre>
          <button type="button" class="bouton-secondaire petit" data-tout="1">Tout montrer</button><button type="button" class="bouton-secondaire petit" data-tout="0">Tout cacher</button>
          <button type="button" class="bouton-secondaire petit" data-reinit>↺ Couleurs d'origine</button></div>
        <ul class="liste-calques">${lignes.map(({ c, i }) => {
          const r = reglage(planId, i);
          const visible = (r.visible ?? c.visible) !== false;
          return `<li><label><input type="checkbox" data-visible="${i}" ${visible ? 'checked' : ''}> ${echapper(c.nom)}</label><input type="color" value="${r.couleur ?? c.couleur ?? '#000000'}" data-couleur="${i}" aria-label="Couleur de ${echapper(c.nom)}"></li>`;
        }).join('') || '<li class="aide-calage">Aucun calque.</li>'}</ul>`
          : '<p class="aide-calage">Aucun plan du projet avec des calques n\'est montré dessous (voir « Plans… »).</p>'}
      </div>
      <div class="boutons-choix"><button type="button" class="bouton" data-cle="fermer"><strong>Fermer</strong></button></div>`;
  }

  const refaire = () => { acces.enregistrer(); acces.redessiner(); };

  fenetre.addEventListener('click', (e) => {
    if (e.target.closest('button[data-cle="fermer"]')) return fenetre.close();
    const tout = e.target.closest('[data-tout]');
    if (tout) {
      const p = liste.find((x) => x.id === planId);
      if (!p || !acces.avantChangement()) return;
      const fond = acces.plan().fond;
      fond.calques ??= {};
      fond.calques[planId] ??= {};
      p.calques.forEach((c, i) => {
        if (c.nom.toLowerCase().includes(filtre.toLowerCase())) fond.calques[planId][i] = { ...(fond.calques[planId][i] ?? {}), visible: tout.dataset.tout === '1' };
      });
      refaire();
      return dessiner();
    }
    if (e.target.closest('[data-reinit]')) {
      if (!acces.avantChangement()) return;
      if (acces.plan().fond.calques) delete acces.plan().fond.calques[planId];
      refaire();
      dessiner();
    }
  });
  fenetre.addEventListener('change', (e) => {
    const c = e.target;
    if (c.matches('[data-plan]')) {
      planId = c.value;
      return dessiner();
    }
    if (c.dataset.visible !== undefined && changer(planId, c.dataset.visible, { visible: c.checked })) refaire();
    else if (c.dataset.couleur !== undefined && changer(planId, c.dataset.couleur, { couleur: c.value })) refaire();
  });
  fenetre.addEventListener('input', (e) => {
    if (e.target.matches('[data-filtre]')) {
      filtre = e.target.value;
      const pos = e.target.selectionStart;
      dessiner();
      const champ = fenetre.querySelector('[data-filtre]');
      champ.focus();
      champ.setSelectionRange(pos, pos);
    }
  });
  fenetre.addEventListener('cancel', (e) => { e.preventDefault(); fenetre.close(); });
  fenetre.addEventListener('close', () => fenetre.remove());
  dessiner();
  document.body.append(fenetre);
  fenetre.showModal();
}
