// Petite fenêtre avec plusieurs boutons au choix (à la place de « OK / Annuler », qui ne dit pas
// clairement ce qui va se passer). Le premier bouton marqué « principal » est mis en avant.
import { echapper } from './echapper.js';
import { sansPrefixe } from '../topo/surface.js';

/**
 * Ouvre la fenêtre et attend le choix. boutons : [{ cle, texte, detail, principal, classe (facultative) }].
 * Renvoie la clé du bouton touché. signal (AbortSignal, facultatif) : la fenêtre se ferme toute
 * seule quand il est déclenché, et renvoie null.
 */
export function demanderChoix({ titre, texte = '', boutons, signal = null }) {
  return new Promise((resoudre) => {
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-choix';
    fenetre.innerHTML = `
      <h2>${echapper(titre)}</h2>
      ${texte ? `<p>${echapper(texte)}</p>` : ''}
      <div class="boutons-choix">
        ${boutons.map((b) => `<button type="button" class="${b.principal ? 'bouton' : 'bouton-secondaire'}${b.classe ? ` ${echapper(b.classe)}` : ''}" data-cle="${echapper(b.cle)}">
          <strong>${echapper(b.texte)}</strong>${b.detail ? `<span>${echapper(b.detail)}</span>` : ''}</button>`).join('')}
      </div>`;
    fenetre.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-cle]');
      if (!bouton) return;
      fenetre.close();
      resoudre(bouton.dataset.cle);
    });
    // Touche « retour » ou Échap : le premier bouton (le choix mis en avant).
    fenetre.addEventListener('cancel', (evenement) => evenement.preventDefault());
    fenetre.addEventListener('close', () => fenetre.remove());
    signal?.addEventListener('abort', () => {
      if (fenetre.open) fenetre.close();
      resoudre(null);
    });
    document.body.append(fenetre);
    fenetre.showModal();
  });
}

/**
 * Petite fenêtre pour taper un texte (ex. renommer un levé) : « OK » ou « Annuler ».
 * Renvoie le texte tapé (sans espaces autour), ou null si annulé.
 * prefixe (0.104.0, ex. « LV- ») : début du nom, montré à gauche du champ, qu'on ne peut ni modifier
 * ni effacer ; on ne tape que la suite, et le texte rendu commence toujours par le préfixe (« » si la suite est vide).
 */
export function demanderTexte({ titre, valeur = '', prefixe = '' }) {
  return new Promise((resoudre) => {
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-choix';
    fenetre.innerHTML = `
      <h2>${echapper(titre)}</h2>
      <div class="champ-prefixe">
        ${prefixe ? `<span class="prefixe-nom">${echapper(prefixe)}</span>` : ''}
        <input type="text" data-champ="texte" value="${echapper(prefixe ? sansPrefixe(valeur, prefixe) : valeur)}" aria-label="${echapper(titre)}" />
      </div>
      <div class="boutons-choix">
        <button type="button" class="bouton" data-cle="ok"><strong>OK</strong></button>
        <button type="button" class="bouton-secondaire" data-cle="annuler"><strong>Annuler</strong></button>
      </div>`;
    const champ = fenetre.querySelector('input');
    const finir = (cle) => {
      fenetre.close();
      if (cle !== 'ok') return resoudre(null);
      const suite = prefixe ? sansPrefixe(champ.value, prefixe) : champ.value.trim();
      resoudre(prefixe && suite ? `${prefixe}${suite}` : suite);
    };
    fenetre.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-cle]');
      if (bouton) finir(bouton.dataset.cle);
    });
    champ.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Enter') finir('ok');
    });
    fenetre.addEventListener('cancel', (evenement) => {
      evenement.preventDefault();
      finir('annuler');
    });
    fenetre.addEventListener('close', () => fenetre.remove());
    document.body.append(fenetre);
    fenetre.showModal();
    champ.select();
  });
}

/**
 * Petite fenêtre avec plusieurs cases à remplir puis « OK » (ex. nouveau projet : affaire,
 * désignation). champs : [{ cle, titre, exemple, valeur (texte déjà là, facultatif) }]. note (0.217.0, facultative) :
 * { texte, ton: 'ok' | 'alerte' } = une ligne colorée sous le titre (ex. « ✓ déjà en coordonnées suisses »). Renvoie { cle: texte tapé } avec OK, ou null
 * si la fenêtre est fermée (✕, touche retour, Échap) : rien n'est fait.
 */
const attributsSi = (c) => (c.visibleSi ? `data-si-cle="${echapper(c.visibleSi.cle)}" data-si-valeur="${echapper(c.visibleSi.valeur)}"` : '');

export function demanderChamps({ titre, champs, note = null }) {
  return new Promise((resoudre) => {
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-choix fenetre-champs';
    fenetre.innerHTML = `
      <div class="entete-fenetre-champs">
        <h2>${echapper(titre)}</h2>
        <button type="button" class="bouton-retour" data-cle="fermer" title="Fermer" aria-label="Fermer">✕</button>
      </div>
      ${note ? `<p class="note-fenetre note-${note.ton === 'ok' ? 'ok' : 'alerte'}">${echapper(note.texte)}</p>` : ''}
      ${champs.map((c) => (c.choix
        // Liste à choix (0.125.0, ex. le dossier d'un nouveau projet) : choix = [[valeur, texte], ...].
        ? `<label ${attributsSi(c)}>${echapper(c.titre)}<select data-champ="${echapper(c.cle)}">${c.choix.map(([v, t]) => `<option value="${echapper(v)}" ${v === (c.valeur ?? '') ? 'selected' : ''}>${echapper(t)}</option>`).join('')}</select></label>`
        : `<label ${attributsSi(c)}>${echapper(c.titre)}<input type="text" data-champ="${echapper(c.cle)}" value="${echapper(c.valeur ?? '')}" placeholder="${echapper(c.exemple ?? '')}" /></label>`)).join('')}
      <div class="boutons-choix">
        <button type="button" class="bouton" data-cle="ok"><strong>OK</strong></button>
      </div>`;
    const finir = (cle) => {
      const valeurs = Object.fromEntries([...fenetre.querySelectorAll('input[data-champ], select[data-champ]')].map((champ) => [champ.dataset.champ, champ.value.trim()]));
      fenetre.close();
      resoudre(cle === 'ok' ? valeurs : null);
    };
    fenetre.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-cle]');
      if (bouton) finir(bouton.dataset.cle);
    });
    // 0.239.0 : champ « visibleSi » : montré seulement quand un autre champ a la valeur demandée (ex. netteté de l'image).
    const majVisibilite = () => {
      for (const etiquette of fenetre.querySelectorAll('label[data-si-cle]')) {
        const autre = fenetre.querySelector(`[data-champ="${etiquette.dataset.siCle}"]`);
        etiquette.hidden = autre ? autre.value !== etiquette.dataset.siValeur : false;
      }
    };
    fenetre.addEventListener('change', majVisibilite);
    fenetre.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Enter' && evenement.target.matches('input')) finir('ok');
    });
    fenetre.addEventListener('cancel', (evenement) => {
      evenement.preventDefault();
      finir('fermer');
    });
    fenetre.addEventListener('close', () => fenetre.remove());
    document.body.append(fenetre);
    majVisibilite();
    fenetre.showModal();
    fenetre.querySelector('input')?.focus();
  });
}

/**
 * Petite fenêtre de cases à cocher puis « OK » (0.260.0 : choisir les dossiers d'une liste). options : [{ cle, texte, coche }].
 * Renvoie la liste des clés cochées avec OK, ou null si la fenêtre est fermée (rien n'est changé).
 */
export function demanderCases({ titre, options }) {
  return new Promise((resoudre) => {
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-choix fenetre-champs';
    fenetre.innerHTML = `
      <div class="entete-fenetre-champs">
        <h2>${echapper(titre)}</h2>
        <button type="button" class="bouton-retour" data-cle="fermer" title="Fermer" aria-label="Fermer">✕</button>
      </div>
      <div class="cases-fenetre">${options.map((o, i) => `<label class="case"><input type="checkbox" data-i="${i}" ${o.coche ? 'checked' : ''} /> ${echapper(o.texte)}</label>`).join('')}</div>
      <div class="boutons-choix"><button type="button" class="bouton" data-cle="ok"><strong>OK</strong></button></div>`;
    const finir = (cle) => {
      const cochees = [...fenetre.querySelectorAll('input[data-i]:checked')].map((c) => options[Number(c.dataset.i)].cle);
      fenetre.close();
      resoudre(cle === 'ok' ? cochees : null);
    };
    fenetre.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button[data-cle]');
      if (bouton) finir(bouton.dataset.cle);
    });
    fenetre.addEventListener('cancel', (evenement) => {
      evenement.preventDefault();
      finir('fermer');
    });
    fenetre.addEventListener('close', () => fenetre.remove());
    document.body.append(fenetre);
    fenetre.showModal();
  });
}

/**
 * Fenêtre « dossier réservé au projet » (0.272.3) : nom (si `nom` est donné, même vide), palette de couleurs à toucher,
 * et « Supprimer ce dossier » si `suppression` est vrai. couleurs : liste de « #rrggbb ».
 * Renvoie { nom, couleur } avec OK, { supprimer: true } avec Supprimer, ou null si annulé.
 */
export function demanderDossier({ titre, nom = null, couleur, couleurs, suppression = false }) {
  return new Promise((resoudre) => {
    let choisie = couleur ?? couleurs[0];
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-choix';
    fenetre.innerHTML = `
      <h2>${echapper(titre)}</h2>
      ${nom === null ? '' : `<div class="champ-prefixe"><input type="text" data-champ="texte" value="${echapper(nom)}" aria-label="Nom du dossier" /></div>`}
      <div class="palette-dossier" role="radiogroup" aria-label="Couleur du dossier">
        ${couleurs.map((c) => `<button type="button" class="pastille-couleur ${c === choisie ? 'actif' : ''}" data-couleur="${echapper(c)}" role="radio" aria-checked="${c === choisie}" aria-label="Couleur ${echapper(c)}" style="background: ${echapper(c)}"></button>`).join('')}
      </div>
      <div class="boutons-choix">
        <button type="button" class="bouton" data-cle="ok"><strong>OK</strong></button>
        ${suppression ? '<button type="button" class="bouton-secondaire" data-cle="supprimer"><strong>Supprimer ce dossier</strong></button>' : ''}
        <button type="button" class="bouton-secondaire" data-cle="annuler"><strong>Annuler</strong></button>
      </div>`;
    const champ = fenetre.querySelector('input');
    const finir = (cle) => {
      const texte = champ ? champ.value.trim() : '';
      fenetre.close();
      if (cle === 'supprimer') return resoudre({ supprimer: true });
      if (cle !== 'ok') return resoudre(null);
      return resoudre({ nom: texte, couleur: choisie });
    };
    fenetre.addEventListener('click', (evenement) => {
      const pastille = evenement.target.closest('[data-couleur]');
      if (pastille) {
        choisie = pastille.dataset.couleur;
        for (const p of fenetre.querySelectorAll('[data-couleur]')) {
          p.classList.toggle('actif', p === pastille);
          p.setAttribute('aria-checked', String(p === pastille));
        }
        return;
      }
      const bouton = evenement.target.closest('button[data-cle]');
      if (bouton) finir(bouton.dataset.cle);
    });
    champ?.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Enter') finir('ok');
    });
    fenetre.addEventListener('cancel', (evenement) => {
      evenement.preventDefault();
      finir('annuler');
    });
    fenetre.addEventListener('close', () => fenetre.remove());
    document.body.append(fenetre);
    fenetre.showModal();
    champ?.select();
  });
}
