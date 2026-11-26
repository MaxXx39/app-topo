// Plans de chantier (0.296.0) : calques d'un plan affiché dessous (masquer, couleur), réglés pour CE plan de chantier
// seulement (le plan du projet ne change pas). Rangé dans plan.fond.calques[idDuPlan][numéroDuCalque] = { visible, couleur }.
import { echapper } from '../outils/echapper.js';

/** Plans du projet avec les réglages de calques du plan de chantier appliqués (copies stables : même objet tant que rien ne change). */
const memoire = new Map();
export function plansAvecCalques(plans, fond) {
  return plans.map((p) => {
    const reglages = p.calques?.length ? fond?.calques?.[p.id] : null;
    const generaux = fond?.reglagesPlans?.[p.id]; // 0.337.0 : transparence et couleur propres à ce plan de chantier
    if (!reglages && !generaux) return p;
    const signature = JSON.stringify([reglages, generaux]);
    const vu = memoire.get(p.id);
    if (vu && vu.origine === p && vu.signature === signature) return vu.copie;
    const champs = {};
    if (reglages) champs.calques = p.calques.map((c, i) => ({ ...c, ...(reglages[i] ?? {}) }));
    if (generaux?.transparence !== undefined) champs.transparence = generaux.transparence;
    if (generaux?.couleur) champs.couleur = generaux.couleur;
    const copie = Object.assign(Object.create(p), champs); // Object.create : garde ce qu'un plan recalé hérite
    memoire.set(p.id, { origine: p, signature, copie });
    return copie;
  });
}

/**
 * « Geler » / « Isoler » (comme dans Lever) sur les plans d'un plan de chantier : plans = plans avec les réglages déjà appliqués
 * (plansAvecCalques), choisis = éléments touchés ({ planId, calque }), mode = 'geler' (cache leurs calques) ou 'isoler'
 * (ne garde que leurs calques). Écrit dans fond.calques[idPlan][n°].visible ; renvoie le nombre de calques cachés.
 */
export function gelIsolementChantier(plans, fond, choisis, mode) {
  const gardes = new Set(choisis.map((e) => `${e.planId}|${e.calque}`));
  let caches = 0;
  for (const plan of plans) {
    (plan.calques ?? []).forEach((calque, i) => {
      const choisi = gardes.has(`${plan.id}|${i}`);
      if ((mode === 'geler' ? choisi : !choisi) && calque.visible !== false) {
        fond.calques ??= {};
        fond.calques[plan.id] ??= {};
        fond.calques[plan.id][i] = { ...(fond.calques[plan.id][i] ?? {}), visible: false };
        caches += 1;
      }
    });
  }
  return caches;
}

/** « Tout réafficher » : tous les calques cachés de ce plan de chantier redeviennent visibles. Renvoie leur nombre. */
export function reafficherCalquesChantier(fond) {
  let remis = 0;
  for (const reglagesPlan of Object.values(fond?.calques ?? {})) {
    for (const r of Object.values(reglagesPlan)) {
      if (r.visible === false) {
        r.visible = true;
        remis += 1;
      }
    }
  }
  return remis;
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
