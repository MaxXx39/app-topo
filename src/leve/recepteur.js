// Bouton du récepteur (appli Android seulement, version 0.54.0) : dans la barre du bas, à côté de
// « Plan », visible dans tous les onglets. Son icône change de couleur selon l'état du récepteur
// (voir couleurRecepteur). Un toucher ouvre une fenêtre : connecter / couper le récepteur, son
// état en détail, et la roue ⚙ pour les réglages des corrections NTRIP (swipos), qui étaient avant
// en bas de l'onglet Terrain.
import { echapper } from '../outils/echapper.js';
import { demanderCode } from '../outils/code.js';
import { formaterNombre } from '../topo/format.js';
import { etatCorrections } from './corrections.js';
import { bulle } from '../aide/bulles.js';
import { lameActive } from '../reglages/reglages.js';
import { lireListesPartagees } from '../reglages/listes-partagees.js';

/**
 * Couleur du bouton selon l'état du récepteur (décision du 24.10.2026) :
 * - 'gris' : pas connecté (ou rien reçu encore) ;
 * - 'vert' : RTK fixe et inclinaison prête (on peut prendre un point) ;
 * - 'orange' : RTK flottant, ou RTK fixe mais inclinaison pas prête ;
 * - 'rouge' : autonome (sans corrections) ou autre.
 */
export function couleurRecepteur(etat) {
  if (!etat?.connecte || !etat.recu) return 'gris';
  if (etat.qualite === 4) return etat.inclinaisonPrete ? 'vert' : 'orange';
  if (etat.qualite === 5) return 'orange';
  return 'rouge';
}

// Mot de l'état, sous l'icône et dans la fenêtre.
const TEXTES_COULEURS = { gris: 'non connecté', vert: 'RTK fixe', orange: 'pas prêt', rouge: 'autonome' };

// Icône : le récepteur (disque) sur sa canne, avec deux ondes.
const ICONE = '<path d="M8.5 3.2a5 5 0 0 1 7 0M6.6 1.3a7.8 7.8 0 0 1 10.8 0" /><ellipse cx="12" cy="9" rx="6" ry="2.6" /><path d="M6 9v1.4a6 2.6 0 0 0 12 0V9M12 13v9" />';

/**
 * Crée le bouton dans la barre du bas "nav". actions : choisirRecepteur(), reconnecter(),
 * deconnecter(), lireReglagesCorrections() (ou null), demarrerCorrections(reglages), arreterCorrections(),
 * et pour l'essai à 2 récepteurs (ou null sans APK qui le sait) : choisirRecepteur2(), deconnecter2(),
 * choisirModeCorrections2('copie' ou 'ntrip'), lireReglagesCorrections2(), demarrerCorrections2(reglages),
 * arreterCorrections2().
 * Renvoie { mettreAJour(etat) } (appelé à chaque état du récepteur, 5 fois par seconde),
 * mettreAJour2(etat, mode) (2e récepteur), et ouvrir() (ouvre la fenêtre, par exemple depuis l'onglet Terrain).
 */
export function creerBoutonRecepteur(nav, actions) {
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton-recepteur couleur-gris';
  bouton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONE}</svg><span>Récepteur</span>`;
  nav.append(bouton);

  let etat = null;
  let etat2 = null; // 2e récepteur (essai)
  let mode2 = 'copie'; // corrections du 2e : 'copie' (copie de celles du 1er) ou 'ntrip' (sa propre connexion)
  let fenetre = null;
  let reglagesOuverts = false; // roue ⚙ : réglages NTRIP
  let reglages2Ouverts = false; // roue ⚙ du récepteur 2 : sa connexion NTRIP
  let deverrouille = false; // bon code tapé pour les réglages NTRIP (voir outils/code.js), jusqu'à la fermeture
  // Réglages NTRIP tapés, pas encore envoyés (gardés si la fenêtre se redessine), par récepteur (1, 2).
  const saisie = { 1: {}, 2: {} };
  // Mot de passe d'un réglage swipos choisi dans la liste partagée (0.79.0), pas encore envoyé.
  const motDePasseChoisi = { 1: '', 2: '' };

  bouton.addEventListener('click', ouvrir);

  /** Ouvre la fenêtre du récepteur. */
  function ouvrir() {
    fenetre?.close();
    fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-recepteur';
    fenetre.addEventListener('click', quandClic);
    fenetre.addEventListener('input', (evenement) => {
      const champ = evenement.target.dataset.correction;
      const numero = evenement.target.closest('[data-numero]')?.dataset.numero ?? '1';
      if (champ && champ !== 'motDePasse') saisie[numero][champ] = evenement.target.value;
    });
    // Réglage swipos choisi dans la liste partagée : il remplit les cases (puis « Démarrer »).
    fenetre.addEventListener('change', (evenement) => {
      const champ = evenement.target.dataset.champ;
      if (champ !== 'swipos-choisi' && champ !== 'swipos-direct') return;
      const numero = evenement.target.closest('[data-numero]')?.dataset.numero ?? '1';
      const choisi = lireListesPartagees().swipos.find((r) => r.id === evenement.target.value);
      if (!choisi) return;
      // Choix direct (0.84.0, sans code) : la connexion démarre tout de suite avec ce réglage.
      if (champ === 'swipos-direct') {
        const reglagesChoisis = { hote: choisi.hote, port: choisi.port, pointDeMontage: choisi.pointDeMontage, utilisateur: choisi.utilisateur, motDePasse: choisi.motDePasse };
        if (numero === '2') actions.demarrerCorrections2(reglagesChoisis);
        else actions.demarrerCorrections(reglagesChoisis);
        setTimeout(dessiner, 300);
        return;
      }
      saisie[numero] = { hote: choisi.hote, port: String(choisi.port), pointDeMontage: choisi.pointDeMontage, utilisateur: choisi.utilisateur };
      motDePasseChoisi[numero] = choisi.motDePasse;
      dessiner();
    });
    fenetre.addEventListener('close', () => {
      fenetre.remove();
      fenetre = null;
      // Le code est redemandé à la prochaine ouverture.
      reglagesOuverts = false;
      reglages2Ouverts = false;
      deverrouille = false;
    });
    document.body.append(fenetre);
    dessiner();
    fenetre.showModal();
  }

  function quandClic(evenement) {
    // Toucher le fond grisé (hors de la fenêtre) : on ferme.
    if (evenement.target === fenetre) {
      fenetre.close();
      return;
    }
    const cible = evenement.target.closest('button[data-action]');
    if (!cible) return;
    const { action } = cible.dataset;
    if (action === 'fermer') fenetre.close();
    else if (action === 'choisirRecepteur2') actions.choisirRecepteur2();
    else if (action === 'deconnecter2') actions.deconnecter2();
    else if (action === 'modeCorrections2') {
      mode2 = cible.dataset.valeur === 'ntrip' ? 'ntrip' : 'copie';
      actions.choisirModeCorrections2(mode2);
      if (mode2 === 'copie') reglages2Ouverts = false;
      dessiner();
    } else if (action === 'reglages2') basculerReglages(2);
    else if (action === 'reglages') basculerReglages(1);
    else if (action === 'demarrerCorrections') {
      // Bloc du récepteur 1 ou 2 (data-numero) : ses propres cases.
      const bloc = cible.closest('.bloc-ntrip');
      const numero = bloc.dataset.numero;
      const lire = (champ) => bloc.querySelector(`[data-correction="${champ}"]`)?.value.trim() ?? '';
      const reglages = {
        hote: lire('hote'),
        port: Number(lire('port')) || 2101,
        pointDeMontage: lire('pointDeMontage'),
        utilisateur: lire('utilisateur'),
        motDePasse: bloc.querySelector('[data-correction="motDePasse"]')?.value ?? '',
      };
      if (numero === '2') actions.demarrerCorrections2(reglages);
      else actions.demarrerCorrections(reglages);
      saisie[numero] = {};
      motDePasseChoisi[numero] = '';
      setTimeout(dessiner, 300); // « Redémarrer », mot de passe enregistré
    } else if (action === 'relancerCorrections') relancerCorrections(cible.closest('[data-numero]')?.dataset.numero === '2' ? 2 : 1);
    else if (action === 'arreterCorrections') {
      if (cible.closest('.bloc-ntrip').dataset.numero === '2') actions.arreterCorrections2();
      else actions.arreterCorrections();
      setTimeout(dessiner, 300);
    } else actions[action]?.();
  }

  /**
   * Roue ⚙ : ouvre ou ferme les réglages NTRIP du récepteur 1 (ou 2) ; les ouvrir demande le code
   * de sécurité (une fois par ouverture de la fenêtre).
   */
  async function basculerReglages(numero = 1) {
    const ouverts = numero === 2 ? reglages2Ouverts : reglagesOuverts;
    if (!ouverts && !deverrouille) {
      if (!(await demanderCode('Réglages des corrections (NTRIP)'))) return;
      deverrouille = true;
    }
    if (numero === 2) reglages2Ouverts = !reglages2Ouverts;
    else reglagesOuverts = !reglagesOuverts;
    dessiner();
  }

  /**
   * « Relancer la connexion NTRIP » (0.84.0, Confirmé) : redémarre avec les derniers réglages
   * enregistrés (mot de passe vide = l'APK garde celui qu'il a). Demande le code de sécurité.
   */
  async function relancerCorrections(numero) {
    const lire = numero === 2 ? actions.lireReglagesCorrections2 : actions.lireReglagesCorrections;
    const reglages = lire?.();
    if (!reglages?.hote) return;
    if (!(await demanderCode('Relancer la connexion NTRIP'))) return;
    const relance = { hote: reglages.hote, port: reglages.port, pointDeMontage: reglages.pointDeMontage, utilisateur: reglages.utilisateur, motDePasse: '' };
    if (numero === 2) actions.demarrerCorrections2(relance);
    else actions.demarrerCorrections(relance);
    setTimeout(dessiner, 300);
  }

  /**
   * Choix du réglage swipos (0.84.0) : la liste partagée, sans code ; un choix démarre la connexion.
   * En Confirmé : « Relancer la connexion NTRIP » (code de sécurité), si des réglages sont enregistrés.
   */
  function choixCorrections(reglages, numero = 1) {
    const enregistres = lireListesPartagees().swipos;
    const actuel = enregistres.find((r) => reglages.actives && r.hote === reglages.hote && r.utilisateur === reglages.utilisateur);
    const lance = reglages.hote ? `<button type="button" class="bouton-secondaire seulement-confirme" data-action="relancerCorrections">Relancer la connexion NTRIP</button>` : '';
    if (enregistres.length === 0 && !lance) return '';
    return `<div class="choix-corrections" data-numero="${numero}">
      <p class="titre-choix">Corrections swipos${numero === 2 ? ' du récepteur 2' : ''} ${bulle('corrections')}</p>
      ${enregistres.length > 0 ? `<label class="champ-large choix-swipos">
          <select data-champ="swipos-direct" aria-label="Réglage swipos"><option value="" ${actuel ? '' : 'selected'}>— choisir un réglage swipos —</option>
            ${enregistres.map((r) => `<option value="${echapper(r.id)}" ${actuel?.id === r.id ? 'selected' : ''}>${echapper(r.utilisateur)}${r.pointDeMontage ? ` · ${echapper(r.pointDeMontage)}` : ''}</option>`).join('')}
          </select></label>` : ''}
      ${lance}
    </div>`;
  }

  /** Dessine toute la fenêtre (à l'ouverture, ou quand la roue ⚙ est touchée). */
  function dessiner() {
    if (!fenetre) return;
    const reglages = actions.lireReglagesCorrections?.();
    fenetre.innerHTML = `
      <div class="entete-fenetre-recepteur">
        <h2>Récepteur</h2>
        ${reglages ? `<button type="button" class="bouton-retour seulement-confirme ${reglagesOuverts ? 'actif' : ''}" data-action="reglages" title="Réglages des corrections (NTRIP)" aria-label="Réglages des corrections (NTRIP)" aria-expanded="${reglagesOuverts}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg></button>` : ''}
        <button type="button" class="bouton-retour" data-action="fermer" title="Fermer" aria-label="Fermer">✕</button>
      </div>
      <div class="etat-recepteur" data-vivant="etat-recepteur"></div>
      <div class="actions-recepteur" data-vivant="actions-recepteur"></div>
      ${reglages ? choixCorrections(reglages, 1) : ''}
      ${actions.journalNmea ? `<div class="ligne-outils seulement-confirme">
          <button type="button" class="bouton-lien bouton-lien-neutre" data-action="journalNmea">Journal NMEA (1 min)</button> ${bulle('journalNmea')}</div>` : ''}
      ${reglages && reglagesOuverts ? `<div class="seulement-confirme">${blocNtrip(reglages, 1)}</div>` : ''}
      ${actions.choisirRecepteur2 && (lameActive() || etat2?.connecte) ? `<div class="bloc-recepteur2">
          <p class="titre-choix">Récepteur 2 (lame)</p>
          <div data-vivant="etat-recepteur2"></div>
          <div data-vivant="actions-recepteur2"></div>
          ${mode2 === 'ntrip' && actions.lireReglagesCorrections2 ? choixCorrections(actions.lireReglagesCorrections2() ?? {}, 2) : ''}
          ${mode2 === 'ntrip' && reglages2Ouverts ? blocNtrip(actions.lireReglagesCorrections2() ?? {}, 2) : ''}
        </div>` : ''}`;
    rafraichir();
    rafraichir2();
  }

  /** Réglages des corrections NTRIP (swipos), repris d'Emlid Flow, gardés sur la tablette. */
  function blocNtrip(reglages, numero = 1) {
    const valeur = (champ) => echapper(String(saisie[numero][champ] ?? reglages[champ] ?? ''));
    const enregistres = lireListesPartagees().swipos;
    return `<div class="bloc-ntrip" data-numero="${numero}">
      <p class="titre-choix">Corrections NTRIP${numero === 2 ? ' du récepteur 2' : ''} ${bulle('corrections')}</p>
      ${enregistres.length > 0 ? `<label class="champ-large choix-swipos">Réglage swipos enregistré
          <select data-champ="swipos-choisi"><option value="">— choisir —</option>
            ${enregistres.map((r) => `<option value="${echapper(r.id)}">${echapper(r.utilisateur)}${r.pointDeMontage ? ` · ${echapper(r.pointDeMontage)}` : ''}</option>`).join('')}
          </select></label>` : ''}
      <div class="champs-corrections">
        <label class="champ-large">Serveur<input type="text" data-correction="hote" value="${valeur('hote')}" placeholder="adresse (voir Emlid Flow)" autocapitalize="off" spellcheck="false" /></label>
        <label>Port<input type="text" inputmode="numeric" data-correction="port" value="${valeur('port')}" /></label>
        <label>Point de montage<input type="text" data-correction="pointDeMontage" value="${valeur('pointDeMontage')}" autocapitalize="off" spellcheck="false" /></label>
        <label>Identifiant<input type="text" data-correction="utilisateur" value="${valeur('utilisateur')}" autocapitalize="off" spellcheck="false" autocomplete="off" /></label>
        <label>Mot de passe<input type="password" data-correction="motDePasse" value="${echapper(motDePasseChoisi[numero])}" placeholder="${reglages.motDePasseEnregistre ? 'enregistré' : ''}" autocomplete="off" /></label>
      </div>
      <div class="ligne-outils">
        <button type="button" class="bouton-secondaire" data-action="demarrerCorrections">${reglages.actives ? 'Redémarrer' : 'Démarrer'}</button>
        ${reglages.actives ? '<button type="button" class="bouton-lien" data-action="arreterCorrections">arrêter (retour à Emlid Flow)</button>' : ''}
      </div>
    </div>`;
  }

  /** Met à jour l'état et les boutons de la fenêtre, sans toucher aux réglages NTRIP (on peut taper dedans). */
  function rafraichir() {
    if (!fenetre) return;
    const couleur = couleurRecepteur(etat);
    const zoneEtat = fenetre.querySelector('[data-vivant="etat-recepteur"]');
    const zoneActions = fenetre.querySelector('[data-vivant="actions-recepteur"]');
    const connecte = Boolean(etat?.connecte);
    const lignes = [];
    if (connecte && etat.recu) {
      const statut = { 4: 'RTK FIXE', 5: 'RTK FLOTTANT' }[etat.qualite] ?? `GNSS : ${etat.libelleQualite ?? '?'}`;
      lignes.push(['Position', `${statut}${etat.nbSatellites != null ? ` · ${etat.nbSatellites} sat.` : ''}`]);
      lignes.push(['Précision', `H ${formaterNombre(etat.precisionH)} · V ${formaterNombre(etat.precisionV)}`]);
      lignes.push(['Inclinaison', etat.inclinaisonPrete ? `prête${etat.inclinaison != null ? ` (${Math.round(etat.inclinaison)}°)` : ''}` : 'pas prête']);
    } else if (connecte) lignes.push(['Position', 'en attente du récepteur…']);
    if (connecte) lignes.push(['Corrections', etatCorrections(etat?.corrections).texte]);
    zoneEtat.innerHTML = `
      <p class="pastille-etat-recepteur couleur-${couleur}"><span></span>${connecte ? echapper(etat.bluetooth ?? 'connecté') : 'Récepteur non connecté'}
        <strong>${TEXTES_COULEURS[couleur]}</strong></p>
      ${lignes.length > 0 ? `<dl>${lignes.map(([titre, texte]) => `<dt>${titre}</dt><dd>${echapper(texte)}</dd>`).join('')}</dl>` : ''}`;
    // Les boutons ne changent que si la connexion change (le doigt peut être dessus).
    const voulu = connecte ? 'connecte' : `deconnecte:${etat?.dernierRecepteur ?? ''}`;
    if (zoneActions.dataset.etat !== voulu) {
      zoneActions.dataset.etat = voulu;
      zoneActions.innerHTML = connecte
        ? '<button type="button" class="bouton-secondaire bouton-couper" data-action="deconnecter">Couper le récepteur</button>'
        : `${etat?.dernierRecepteur ? `<button type="button" class="bouton bouton-large" data-action="reconnecter">Connecter ${echapper(etat.dernierRecepteur)}</button>` : ''}
           <button type="button" class="${etat?.dernierRecepteur ? 'bouton-lien bouton-lien-neutre' : 'bouton bouton-large'}" data-action="choisirRecepteur">${etat?.dernierRecepteur ? 'autre récepteur' : 'Connecter le récepteur'}</button>`;
    }
  }

  /**
   * Essai à 2 récepteurs : état du 2e RX2 (position, précision) et écart avec le 1er (distance en
   * plan, différence d'altitude : sur un engin, elle doit rester à peu près constante).
   */
  function rafraichir2() {
    const zoneEtat = fenetre?.querySelector('[data-vivant="etat-recepteur2"]');
    const zoneActions = fenetre?.querySelector('[data-vivant="actions-recepteur2"]');
    if (!zoneEtat || !zoneActions) return;
    const connecte = Boolean(etat2?.connecte);
    const couleur = couleurRecepteur(etat2);
    const lignes = [];
    const p1 = etat?.connecte && etat.recu ? etat.position : null;
    const p2 = connecte && etat2.recu ? etat2.position : null;
    if (p2) {
      const statut = { 4: 'RTK FIXE', 5: 'RTK FLOTTANT' }[etat2.qualite] ?? `GNSS : ${etat2.libelleQualite ?? '?'}`;
      lignes.push(['Position', `${statut}${etat2.nbSatellites != null ? ` · ${etat2.nbSatellites} sat.` : ''}`]);
      lignes.push(['E / N / H', `${formaterNombre(p2.est)} / ${formaterNombre(p2.nord)} / ${formaterNombre(p2.altitude)}`]);
      lignes.push(['Précision', `H ${formaterNombre(etat2.precisionH)} · V ${formaterNombre(etat2.precisionV)}`]);
      if (p1) lignes.push(['Écart 1 → 2', `${formaterNombre(Math.hypot(p2.est - p1.est, p2.nord - p1.nord))} m en plan · dH ${formaterNombre(p2.altitude - p1.altitude)} m`]);
    } else if (connecte) lignes.push(['Position', 'en attente du récepteur…']);
    if (connecte) lignes.push(['Corrections', mode2 === 'ntrip' ? `2e connexion : ${etatCorrections(etat2?.corrections).texte}` : 'copie de celles du récepteur 1']);
    zoneEtat.innerHTML = `<p class="pastille-etat-recepteur couleur-${couleur}"><span></span>${connecte ? echapper(etat2.bluetooth ?? 'connecté') : 'non connecté'}
        <strong>${TEXTES_COULEURS[couleur]}</strong></p>
      ${lignes.length > 0 ? `<dl>${lignes.map(([titre, texte]) => `<dt>${titre}</dt><dd>${echapper(texte)}</dd>`).join('')}</dl>` : ''}`;
    // Les boutons ne changent que si la connexion, le mode ou la roue changent (le doigt peut être dessus).
    const voulu = `${connecte}:${mode2}:${reglages2Ouverts}`;
    if (zoneActions.dataset.etat === voulu) return;
    zoneActions.dataset.etat = voulu;
    const puce = (valeur, titre) => `<button type="button" class="puce-choix ${mode2 === valeur ? 'actif' : ''}" data-action="modeCorrections2" data-valeur="${valeur}">${titre}</button>`;
    zoneActions.innerHTML = `
      <div class="ligne-choix"><span>Corrections</span>${puce('copie', 'Copie du récepteur 1')}${puce('ntrip', '2e connexion NTRIP')}
        ${mode2 === 'ntrip' ? `<button type="button" class="bouton-retour ${reglages2Ouverts ? 'actif' : ''}" data-action="reglages2" title="Réglages NTRIP du récepteur 2" aria-label="Réglages NTRIP du récepteur 2" aria-expanded="${reglages2Ouverts}">⚙</button>` : ''}</div>
      <div class="ligne-outils">${connecte
        ? '<button type="button" class="bouton-lien" data-action="deconnecter2">couper le récepteur 2</button>'
        : '<button type="button" class="bouton-secondaire" data-action="choisirRecepteur2">Connecter un 2e récepteur</button>'}</div>`;
  }

  return {
    /** Nouvel état du 2e récepteur (essai) : la fenêtre si elle est ouverte. */
    mettreAJour2(nouvelEtat, mode) {
      etat2 = nouvelEtat;
      const nouveauMode = mode === 'ntrip' ? 'ntrip' : 'copie';
      // Le mode vient de l'appli Android (retenu sur la tablette) : on le suit.
      if (mode && nouveauMode !== mode2) {
        mode2 = nouveauMode;
        if (fenetre) dessiner();
        return;
      }
      rafraichir2();
    },
    /** Nouvel état du récepteur : couleur du bouton, et la fenêtre si elle est ouverte. */
    mettreAJour(nouvelEtat) {
      // Le récepteur vient de se connecter : la fenêtre se ferme toute seule (sauf pendant les
      // réglages NTRIP, on peut être en train de taper).
      if (fenetre && !reglagesOuverts && !etat?.connecte && nouvelEtat?.connecte) fenetre.close();
      etat = nouvelEtat;
      const couleur = couleurRecepteur(etat);
      bouton.className = `bouton-recepteur couleur-${couleur}`;
      bouton.title = `Récepteur : ${TEXTES_COULEURS[couleur]}`;
      rafraichir();
    },
    ouvrir,
  };
}
