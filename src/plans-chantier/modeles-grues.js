// Plans de chantier (0.311.0) : fenêtre « Modèles de grues » = l'endroit où l'on entre, contrôle et modifie toutes les
// caractéristiques d'une grue d'après sa fiche technique (flèches, tableaux de charge, tours et pieds, HSC, dimensions).
// Les modèles livrés (Liebherr, Condecta) se lisent et se dupliquent ; les copies et les modèles neufs se modifient.
// Rangés dans projet.modelesGrues (donc partagés par Drive avec le projet). Voir topo/grue-modele.js pour la forme.
import { echapper } from '../outils/echapper.js';
import {
  tousLesModeles, modeleVide, copierModele, validerModele, lireCharges, texteCharges, lireHauteurs, texteHauteurs, modeleLivre,
} from '../topo/grue-modele.js';

const TYPES = [['tour', 'Grue à tour'], ['automontante', 'Grue automontante'], ['autre', 'Autre']];
const PIEDS = [['FA', 'Ancrage fixe'], ['UC', 'Châssis roulant'], ['CB', 'Croix de fondation'], ['ST', 'Stabilisateurs']];
// Dimensions : [clé, libellé, aide]
const DIMENSIONS = [
  ['flecheLargeur', 'Largeur de la flèche (m)', 'vue de dessus'],
  ['flecheDebut', 'Début de la flèche depuis l\'axe (m)', ''],
  ['flecheProfondeur', 'Épaisseur de la flèche (m)', 'hauteur de la flèche, vue de côté'],
  ['flecheAuDessusHsc', 'Dessous de la flèche au-dessus du crochet (m)', 'distance entre le crochet à la HSC et le dessous de la flèche'],
  ['teteAuDessusFleche', 'Haut de la tour au-dessus de la flèche (m)', ''],
  ['contreFlecheArriere', 'Contre-flèche : de l\'axe au bout (m)', ''],
  ['contreFlecheLargeur', 'Contre-flèche : largeur (m)', ''],
  ['arriereTotal', 'Arrière total, contrepoids compris (m)', ''],
];

const nombre = (v) => Number(String(v).trim().replace(',', '.'));

/** Brouillon éditable d'un modèle : les textes des tableaux sont gardés tels que tapés. */
function brouillonDe(m) {
  const b = JSON.parse(JSON.stringify(m));
  b.fleches = b.fleches.map((f) => ({ ...f, _charges: texteCharges(f.charges), _charges2: f.charges2 ? texteCharges(f.charges2) : '', _contrepoids: f.contrepoids?.t ?? '' }));
  b.tours = b.tours.map((t) => ({ ...t, _hauteurs: texteHauteurs(t.hauteurs.map(([e, h]) => [e, h])), _c: t.pied?.c ?? '' }));
  b._infos = (b.infos ?? []).map(([t, v]) => `${t} : ${v}`).join('\n');
  return b;
}

/** Modèle final (forme de topo/grue-modele.js) d'un brouillon ; { modele, erreurs }. */
function modeleDe(b) {
  const erreurs = [];
  const m = JSON.parse(JSON.stringify(b));
  m.nom = String(b.nom ?? '').trim();
  m.fleches = b.fleches.map((f) => {
    const c = lireCharges(f._charges);
    c.erreurs.forEach((e) => erreurs.push(`Flèche ${f.nom} m : ${e}`));
    const c2 = f._charges2.trim() ? lireCharges(f._charges2) : null;
    c2?.erreurs.forEach((e) => erreurs.push(`Flèche ${f.nom} m (tableau 2) : ${e}`));
    const res = { ...f, nom: nombre(f.nom), charges: c.liste };
    if (f.rMax !== '' && f.rMax != null) res.rMax = nombre(f.rMax); else delete res.rMax;
    if (f.rPlein !== '' && f.rPlein != null && nombre(f.rPlein) > 0) res.rPlein = nombre(f.rPlein); else delete res.rPlein;
    if (c2) res.charges2 = c2.liste; else { delete res.charges2; delete res.rPlein2; }
    if (f._contrepoids !== '' && f._contrepoids != null && nombre(f._contrepoids) > 0) res.contrepoids = { ...(f.contrepoids ?? {}), t: nombre(f._contrepoids) }; else delete res.contrepoids;
    delete res._charges; delete res._charges2; delete res._contrepoids;
    return res;
  }).sort((x, y) => x.nom - y.nom);
  m.tours = b.tours.map((t, i) => {
    const h = lireHauteurs(t._hauteurs);
    h.erreurs.forEach((e) => erreurs.push(`Tour « ${t.nom || i + 1} » : ${e}`));
    const anciennes = new Map((t.hauteurs ?? []).map(([e, hh, opt]) => [e, opt]));
    const res = { ...t, id: t.id || `tour${i + 1}`, mat: nombre(t.mat), hauteurs: h.liste.map(([e, hh]) => (anciennes.get(e) ? [e, hh, anciennes.get(e)] : [e, hh])) };
    res.pied = { ...t.pied, ...(t._c !== '' && nombre(t._c) > 0 ? { c: nombre(t._c) } : {}) };
    if (res.pied.type !== 'FA' && !(res.pied.c > 0)) erreurs.push(`Tour « ${t.nom} » : le côté du pied est nécessaire (châssis, croix ou stabilisateurs).`);
    if (res.pied.type === 'FA') delete res.pied.c;
    delete res._hauteurs; delete res._c;
    return res;
  });
  for (const d of ['flecheLargeur', 'flecheProfondeur', 'contreFlecheLargeur']) if (!(Number(m.dim[d]) > 0)) erreurs.push(`« ${DIMENSIONS.find((x) => x[0] === d)[1]} » doit être un nombre positif.`);
  m.infos = String(b._infos ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, '']; });
  delete m._infos;
  validerModele(m).forEach((e) => { if (!erreurs.includes(e)) erreurs.push(e); });
  return { modele: m, erreurs };
}

/**
 * Ouvre la fenêtre. acces : { projet() → projet, lectureSeule(), message(texte, durée), modifie() (enregistrer), redessiner() }.
 */
export function ouvrirModelesGrues(acces) {
  const fenetre = document.createElement('dialog');
  fenetre.className = 'fenetre-choix fenetre-champs fenetre-modeles-grues';
  let choisi = (acces.modeleInitial && tousLesModeles().some((m) => m.id === acces.modeleInitial())) ? acces.modeleInitial() : tousLesModeles()[0].id;
  let brouillon = null;
  let erreurs = [];
  const perso = () => {
    const p = acces.projet();
    p.modelesGrues ??= [];
    return p.modelesGrues;
  };
  const courant = () => tousLesModeles().find((m) => m.id === choisi) ?? tousLesModeles()[0];
  const modifiable = () => !acces.lectureSeule(); // 0.355.0 : les modèles livrés se modifient aussi (copie rangée dans le projet, même id)

  function ouvrirModele(id) {
    choisi = id;
    erreurs = [];
    brouillon = brouillonDe(courant());
    dessiner();
  }

  const champ = (attr, valeur, { type = 'text', pas = '', largeur = '', ok = true } = {}) => `<input type="${type}" ${pas ? `step="${pas}"` : ''} value="${echapper(String(valeur ?? ''))}" ${attr} ${ok ? '' : 'disabled'} ${largeur ? `style="width:${largeur}"` : ''}>`;

  function dessiner() {
    if (!brouillon) brouillon = brouillonDe(courant());
    const ok = modifiable();
    const b = brouillon;
    const liste = tousLesModeles();
    fenetre.innerHTML = `
      <div class="entete-fenetre-champs"><h2>Modèles de grues</h2><button type="button" class="bouton-retour" data-cle="fermer" aria-label="Fermer">✕</button></div>
      <div class="corps-modeles-grues">
        <aside class="liste-modeles-grues">
          <ul>${liste.map((m) => `<li><button type="button" data-modele="${echapper(m.id)}" class="${m.id === choisi ? 'actif' : ''}">${echapper(m.nom)}${m.integre ? ' <small>(livré)</small>' : m.base ? ' <small>(livré, modifié)</small>' : ''}</button></li>`).join('')}</ul>
          <div class="boutons-modeles">
            <button type="button" class="bouton-secondaire petit" data-act="nouveau" ${acces.lectureSeule() ? 'disabled' : ''}>＋ Nouveau</button>
            <button type="button" class="bouton-secondaire petit" data-act="dupliquer" ${acces.lectureSeule() ? 'disabled' : ''}>Dupliquer</button>
            ${courant().base ? `<button type="button" class="bouton-secondaire petit" data-act="original" ${ok ? '' : 'disabled'}>↺ Revenir à l'original</button>` : `<button type="button" class="bouton-secondaire petit" data-act="supprimer" ${ok && !courant().integre ? '' : 'disabled'}>Supprimer</button>`}
            <button type="button" class="bouton-secondaire petit" data-act="exporter">Exporter (fichier)</button>
            <button type="button" class="bouton-secondaire petit" data-act="importer" ${acces.lectureSeule() ? 'disabled' : ''}>Importer (fichier)</button>
            <input type="file" accept=".json,application/json" data-fichier hidden>
          </div>
        </aside>
        <section class="formulaire-modele-grue">
          <div data-zone="erreurs">${htmlErreurs()}</div>
          <h3>Général</h3>
          <div class="grille-modele">
            <label>Nom ${champ('data-g="nom"', b.nom, { ok })}</label>
            <label>Fabricant ${champ('data-g="fabricant"', b.fabricant, { ok })}</label>
            <label>Type <select data-g="type" ${ok ? '' : 'disabled'}>${TYPES.map(([v, t]) => `<option value="${v}" ${b.type === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label>Nom court sur le plan ${champ('data-g="court"', b.court ?? '', { ok })}</label>
          </div>
          <label class="pleine">Notes <textarea data-g="notes" rows="2" ${ok ? '' : 'disabled'}>${echapper(b.notes ?? '')}</textarea></label>
          <h3>Dimensions (m) <small>case « ? » = estimée, pas dans la fiche</small></h3>
          <div class="grille-modele">${DIMENSIONS.map(([k, t, aide]) => `<label title="${echapper(aide)}">${t} ${champ(`data-dim="${k}"`, b.dim[k], { type: 'number', pas: '0.01', ok })}
            <span class="estime"><input type="checkbox" data-estime="${k}" ${(b.estimes ?? []).includes(k) ? 'checked' : ''} ${ok ? '' : 'disabled'}> ?</span></label>`).join('')}</div>
          <h3>Flèches et charges</h3>
          <p class="aide-calage">Charges : « portée:charge » en tonnes, séparées par des virgules (20:5.2, 25:3.8). La charge vaut jusqu'à cette portée ; entre deux portées, la suivante est prise. La dernière portée = portée maximale du crochet.</p>
          <div class="cadre-tableau-calage"><table class="tableau-calage tableau-flèches">
            <thead><tr><th>Longueur (m)</th><th>Charges (portée:charge)</th><th>Charges 2 (facultatif)</th><th>Contrepoids (t)</th><th></th></tr></thead>
            <tbody>${b.fleches.map((f, i) => `<tr>
              <td>${champ(`data-f="${i}:nom"`, f.nom, { type: 'number', pas: '0.1', largeur: '5.5em', ok })}</td>
              <td><textarea rows="2" data-f="${i}:_charges" ${ok ? '' : 'disabled'}>${echapper(f._charges)}</textarea></td>
              <td><textarea rows="2" data-f="${i}:_charges2" ${ok ? '' : 'disabled'}>${echapper(f._charges2)}</textarea></td>
              <td>${champ(`data-f="${i}:_contrepoids"`, f._contrepoids, { type: 'number', pas: '0.01', largeur: '5.5em', ok })}</td>
              <td><button type="button" class="suppr-calage" data-suppr-fleche="${i}" aria-label="Retirer cette flèche" ${ok ? '' : 'disabled'}>✕</button></td></tr>`).join('')}</tbody>
          </table></div>
          <button type="button" class="lien-calage" data-act="ajout-fleche" ${ok ? '' : 'disabled'}>＋ Ajouter une flèche</button>
          <h3>Tours, pieds et HSC</h3>
          <p class="aide-calage">HSC = hauteur sous crochet : « 18, 21, 24 » ou « rang 3:14.8 » (étiquette:hauteur). Pied : ancrage fixe, châssis roulant, croix de fondation ou stabilisateurs (côté du carré d'appui en m).</p>
          <div class="cadre-tableau-calage"><table class="tableau-calage tableau-tours">
            <thead><tr><th>Nom</th><th>Famille</th><th>Mât (m)</th><th>Pied</th><th>Côté (m)</th><th>HSC</th><th></th></tr></thead>
            <tbody>${b.tours.map((t, i) => `<tr>
              <td>${champ(`data-t="${i}:nom"`, t.nom, { ok })}</td><td>${champ(`data-t="${i}:famille"`, t.famille, { largeur: '7em', ok })}</td>
              <td>${champ(`data-t="${i}:mat"`, t.mat, { type: 'number', pas: '0.01', largeur: '4.5em', ok })}</td>
              <td><select data-t="${i}:pied" ${ok ? '' : 'disabled'}>${PIEDS.map(([v, n]) => `<option value="${v}" ${t.pied?.type === v ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
              <td>${champ(`data-t="${i}:_c"`, t._c, { type: 'number', pas: '0.01', largeur: '4.5em', ok })}</td>
              <td><textarea rows="2" data-t="${i}:_hauteurs" ${ok ? '' : 'disabled'}>${echapper(t._hauteurs)}</textarea></td>
              <td><button type="button" class="suppr-calage" data-suppr-tour="${i}" aria-label="Retirer cette tour" ${ok ? '' : 'disabled'}>✕</button></td></tr>`).join('')}</tbody>
          </table></div>
          <button type="button" class="lien-calage" data-act="ajout-tour" ${ok ? '' : 'disabled'}>＋ Ajouter une tour</button>
          <h3>Autres caractéristiques (affichées dans la fiche)</h3>
          <label class="pleine">Une par ligne : titre : texte <textarea data-g="_infos" rows="3" ${ok ? '' : 'disabled'}>${echapper(b._infos)}</textarea></label>
        </section>
      </div>
      <div class="boutons-choix">
        <span class="etat-modele" data-zone="etat-modele">${ok ? 'Enregistrement automatique' : 'Lecture seule'}</span>
        <button type="button" class="bouton" data-cle="fermer"><strong>Fermer</strong></button>
      </div>`;
  }

  const htmlErreurs = () => (erreurs.length ? `<ul class="erreurs-modele">${erreurs.map((e) => `<li>⚠ ${echapper(e)}</li>`).join('')}</ul>` : '');

  /**
   * Enregistrement automatique (0.355.0) après chaque changement : sans fenêtre redessinée (le champ suivant garde la main).
   * Un modèle incomplet n'est pas enregistré : les points à corriger s'affichent.
   */
  function enregistrerModele() {
    const { modele, erreurs: e } = modeleDe(brouillon);
    erreurs = e;
    const zoneErreurs = fenetre.querySelector('[data-zone="erreurs"]');
    const zoneEtat = fenetre.querySelector('[data-zone="etat-modele"]');
    if (zoneErreurs) zoneErreurs.innerHTML = htmlErreurs();
    if (e.length) {
      if (zoneEtat) zoneEtat.textContent = '⚠ Pas enregistré : voir les points en rouge';
      return;
    }
    if (modele.integre || modele.base) modele.base = true; // modèle livré modifié : même id, remplace l'original
    delete modele.integre;
    const l = perso();
    const i = l.findIndex((m) => m.id === modele.id);
    if (i >= 0) l[i] = modele; else l.push(modele);
    acces.modifie();
    choisi = modele.id;
    if (zoneEtat) zoneEtat.textContent = `✓ Enregistré (${new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`;
    const bouton = fenetre.querySelector(`[data-modele="${CSS.escape(modele.id)}"]`);
    if (bouton) bouton.innerHTML = `${echapper(modele.nom)}${modele.base ? ' <small>(livré, modifié)</small>' : ''}`;
    const suppr = modele.base ? fenetre.querySelector('[data-act="supprimer"]') : null;
    if (suppr) suppr.outerHTML = '<button type="button" class="bouton-secondaire petit" data-act="original">↺ Revenir à l\'original</button>';
    acces.redessiner();
  }

  fenetre.addEventListener('change', (ev) => {
    const c = ev.target;
    if (c.dataset.fichier !== undefined) {
      const fichier = c.files?.[0];
      if (!fichier) return;
      fichier.text().then((t) => {
        try {
          const m = JSON.parse(t);
          const e = validerModele(m);
          if (e.length) throw new Error(e[0]);
          const copie = copierModele(m, m.nom);
          perso().push(copie);
          acces.modifie();
          acces.redessiner();
          ouvrirModele(copie.id);
        } catch (err) {
          acces.message(`Fichier de modèle illisible : ${err.message}`, 5000);
        }
      });
      return;
    }
    if (!brouillon || !modifiable()) return;
    const v = c.type === 'checkbox' ? c.checked : c.value;
    if (c.dataset.g) brouillon[c.dataset.g] = v;
    else if (c.dataset.dim) brouillon.dim[c.dataset.dim] = c.value === '' ? null : nombre(c.value);
    else if (c.dataset.estime) {
      const s = new Set(brouillon.estimes ?? []);
      if (v) s.add(c.dataset.estime); else s.delete(c.dataset.estime);
      brouillon.estimes = [...s];
    } else if (c.dataset.f) {
      const [i, k] = c.dataset.f.split(':');
      brouillon.fleches[Number(i)][k] = v;
    } else if (c.dataset.t) {
      const [i, k] = c.dataset.t.split(':');
      const t = brouillon.tours[Number(i)];
      if (k === 'pied') t.pied = { ...t.pied, type: v };
      else t[k] = v;
    } else return;
    enregistrerModele();
  });

  fenetre.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.cle === 'fermer') {
      fenetre.close();
      fenetre.remove();
      return;
    }
    if (b.dataset.modele) return ouvrirModele(b.dataset.modele);
    if (b.dataset.supprFleche !== undefined && modifiable()) {
      brouillon.fleches.splice(Number(b.dataset.supprFleche), 1);
      dessiner();
      return enregistrerModele();
    }
    if (b.dataset.supprTour !== undefined && modifiable()) {
      brouillon.tours.splice(Number(b.dataset.supprTour), 1);
      dessiner();
      return enregistrerModele();
    }
    switch (b.dataset.act) {
      case 'ajout-fleche': {
        const der = brouillon.fleches[brouillon.fleches.length - 1];
        brouillon.fleches.push({ nom: der ? der.nom + 5 : 30, _charges: '', _charges2: '', _contrepoids: '' });
        return dessiner();
      }
      case 'ajout-tour':
        brouillon.tours.push({ id: `tour${brouillon.tours.length + 1}-${Date.now().toString(36)}`, nom: 'Nouvelle tour', famille: 'Tour', mat: 1.6, pied: { type: 'FA' }, element: 3, hauteurs: [], _hauteurs: '', _c: '' });
        return dessiner();
      case 'original': {
        const livre = modeleLivre(choisi);
        if (!livre || !window.confirm(`Revenir au modèle livré « ${livre.nom} » ? Tes modifications de ce modèle seront perdues.`)) return undefined;
        const l = perso();
        l.splice(l.findIndex((m) => m.id === choisi), 1);
        acces.modifie();
        acces.redessiner();
        return ouvrirModele(choisi);
      }
      case 'nouveau': {
        const m = modeleVide();
        perso().push(m);
        acces.modifie();
        acces.redessiner();
        return ouvrirModele(m.id);
      }
      case 'dupliquer': {
        const c = copierModele(courant());
        perso().push(c);
        acces.modifie();
        acces.redessiner();
        return ouvrirModele(c.id);
      }
      case 'supprimer': {
        if (!modifiable() || !window.confirm(`Supprimer le modèle « ${courant().nom} » ? Les grues déjà posées reprendront le premier modèle livré.`)) return;
        const l = perso();
        l.splice(l.findIndex((m) => m.id === choisi), 1);
        acces.modifie();
        acces.redessiner();
        return ouvrirModele(tousLesModeles()[0].id);
      }
      case 'exporter': {
        const m = courant();
        const lien = document.createElement('a');
        lien.href = URL.createObjectURL(new Blob([JSON.stringify(m, null, 1)], { type: 'application/json' }));
        lien.download = `modele-grue_${m.nom.replace(/[^\w-]+/g, '-')}.json`;
        lien.click();
        setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
        return undefined;
      }
      case 'importer':
        return fenetre.querySelector('[data-fichier]').click();
      default:
    }
    return undefined;
  });

  document.body.append(fenetre);
  dessiner();
  fenetre.showModal();
}
