// Carte des projets (0.216.0, demande du 12.11, Base) : tous les projets (cet appareil et Google Drive) sur le fond swisstopo de l'appli
// (photo aérienne, puis carte nationale au-delà de 2 km de large, comme le plan). Chaque projet est une petite étiquette à son centre
// (le centre de la boîte qui entoure son contenu, voir topo/centre-projet.js) ; on la touche pour le choisir, puis « Ouvrir ».
// Un filtre par dossier. Les projets sans position (rien en Suisse, ou projet Drive jamais ouvert depuis la mise à jour) sont comptés à part.
import { echapper } from '../outils/echapper.js';
import { verrouActif } from '../partage/synchro.js';
import { FONDS, niveauDeZoom, tuilesPourZone } from '../plan/fond.js';
import { lireDossiers, dossierDuProjet, SANS_DOSSIER } from './dossiers.js';
import { deplacerVue, fondSelonLargeur, vueSurCentres, versEcran, zoneVisible, zoomerVue } from './carte-vue.js';

const MAX_TUILES = 300;

/**
 * Ouvre la carte par-dessus l'appli. projets : liste de projetsReunis ({ id, titre, modifieLe, centre, local, drive }) ;
 * options : { ouvertId (projet ouvert), appareilId (cet appareil : un projet verrouillé par un autre est marqué 🔒), quandOuvrir(projet)
 * (l'utilisateur touche « Ouvrir ») }. Renvoie { fermer(), miseAJour(projets) } (miseAJour : la liste de Drive vient d'être relue).
 */
export function ouvrirCarteProjets(projets, { ouvertId = null, appareilId = null, quandOuvrir }) {
  const dossiers = lireDossiers();
  const fond = document.createElement('div');
  fond.className = 'carte-projets';
  const liste = dossiers.liste ?? [];
  fond.innerHTML = `<div class="entete-carte-projets">
      <button type="button" class="bouton-retour" data-action="fermer-carte" aria-label="Retour" title="Retour">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
      <h2>Carte des projets</h2>
      ${liste.length > 0 ? `<select data-champ="dossier-carte" aria-label="Dossier">
        <option value="">Tous les dossiers</option>
        ${liste.map((d) => `<option value="${echapper(d.id)}">${echapper(d.nom)}</option>`).join('')}
        <option value="${SANS_DOSSIER}">Sans dossier</option></select>` : ''}
    </div>
    <div class="zone-carte-projets" data-vivant="zone">
      <div class="tuiles-carte-projets" data-vivant="tuiles"></div>
      <div class="etiquettes-carte-projets" data-vivant="etiquettes"></div>
      <div class="commandes-carte-projets">
        <button type="button" data-action="zoom-plus-carte" aria-label="Zoom avant">+</button>
        <button type="button" data-action="zoom-moins-carte" aria-label="Zoom arrière">−</button>
        <button type="button" data-action="tout-voir-carte" aria-label="Tout voir" title="Tout voir">⤢</button>
      </div>
      <p class="attribution-carte-projets" data-vivant="attribution">© swisstopo</p>
    </div>
    <div class="fiche-carte-projets" data-vivant="fiche" hidden></div>
    <p class="sans-position-carte" data-vivant="sans-position"></p>`;
  document.body.append(fond);
  const zone = fond.querySelector('[data-vivant="zone"]');
  const calqueTuiles = fond.querySelector('[data-vivant="tuiles"]');
  const calqueEtiquettes = fond.querySelector('[data-vivant="etiquettes"]');
  const fiche = fond.querySelector('[data-vivant="fiche"]');
  let filtre = '';
  let choisi = null; // id du projet choisi
  let vue = null;
  let tuiles = new Map(); // adresse → image
  let fondIndisponible = false;

  // Nom de l'appareil qui a la main sur ce projet (Drive), si ce n'est pas celui-ci ; sinon null (0.217.0).
  const ouvertAilleurs = (p) => {
    const verrou = p.drive?.verrou;
    return verrou && verrou.appareilId !== appareilId && verrouActif(verrou) ? verrou.nom ?? '?' : null;
  };
  const visibles = () => projets.filter((p) => p.centre && (filtre === '' || dossierDuProjet(dossiers, p.id) === filtre));
  const taille = () => ({ largeur: zone.clientWidth || 1, hauteur: zone.clientHeight || 1 });

  function dessinerTuiles() {
    const { largeur, hauteur } = taille();
    const couche = fondSelonLargeur(vue, largeur);
    const z = niveauDeZoom(1 / vue.echelle, window.devicePixelRatio || 1);
    const liste = tuilesPourZone(zoneVisible(vue, largeur, hauteur), z);
    const voulues = new Set();
    if (liste.length <= MAX_TUILES) {
      for (const tuile of liste) {
        const adresse = FONDS[couche].url(tuile.z, tuile.colonne, tuile.ligne);
        voulues.add(adresse);
        let image = tuiles.get(adresse);
        if (!image) {
          image = new Image();
          image.alt = '';
          image.draggable = false;
          image.className = 'tuile-carte-projets';
          image.onerror = () => {
            image.style.visibility = 'hidden'; // pas d'icône d'image cassée
            fondIndisponible = true;
            fond.querySelector('[data-vivant="attribution"]').textContent = '© swisstopo · fond indisponible (pas de connexion ?)';
          };
          image.src = adresse;
          tuiles.set(adresse, image);
          calqueTuiles.append(image);
        }
        const coin = versEcran(vue, largeur, hauteur, tuile.est, tuile.nord);
        const cote = tuile.cote * vue.echelle;
        image.style.left = `${Math.floor(coin.x)}px`;
        image.style.top = `${Math.floor(coin.y)}px`;
        image.style.width = `${Math.ceil(cote) + 1}px`;
        image.style.height = `${Math.ceil(cote) + 1}px`;
      }
    }
    for (const [adresse, image] of tuiles) {
      if (!voulues.has(adresse)) {
        image.remove();
        tuiles.delete(adresse);
      }
    }
    if (!fondIndisponible) fond.querySelector('[data-vivant="attribution"]').textContent = '© swisstopo';
  }

  function dessinerEtiquettes() {
    const { largeur, hauteur } = taille();
    calqueEtiquettes.innerHTML = visibles().map((p) => {
      const { x, y } = versEcran(vue, largeur, hauteur, p.centre.est, p.centre.nord);
      if (x < -150 || y < -40 || x > largeur + 150 || y > hauteur + 40) return '';
      return `<button type="button" class="etiquette-carte-projet ${p.id === choisi ? 'choisie' : ''} ${p.id === ouvertId ? 'ouvert' : ''}" data-projet="${echapper(p.id)}"
        style="left: ${x.toFixed(1)}px; top: ${y.toFixed(1)}px"><span class="repere-carte-projet"></span><span class="nom-carte-projet">${ouvertAilleurs(p) ? '🔒 ' : ''}${echapper(p.titre)}</span></button>`;
    }).join('');
  }

  function dessinerFiche() {
    const p = projets.find((q) => q.id === choisi);
    fiche.hidden = !p;
    if (!p) return;
    const dossier = dossierDuProjet(dossiers, p.id);
    const nomDossier = dossier === SANS_DOSSIER ? '' : (liste.find((d) => d.id === dossier)?.nom ?? '');
    const date = p.modifieLe ? new Date(p.modifieLe).toLocaleDateString('fr-CH') : '';
    fiche.innerHTML = `<div class="texte-fiche-carte"><strong>${echapper(p.titre)}</strong>
        <span class="aide">${[nomDossier ? `📁 ${echapper(nomDossier)}` : '', date, `${p.local ? '📱' : ''}${p.drive ? '☁' : ''}`].filter(Boolean).join(' · ')}</span>
        ${ouvertAilleurs(p) ? `<span class="verrou-drive">🔒 Ouvert sur ${echapper(ouvertAilleurs(p))}</span>` : ''}</div>
      <button type="button" class="bouton" data-action="ouvrir-carte" ${p.id === ouvertId ? 'disabled' : ''}>${p.id === ouvertId ? 'Projet ouvert' : 'Ouvrir'}</button>`;
  }

  function dessiner() {
    dessinerTuiles();
    dessinerEtiquettes();
    const sans = projets.filter((p) => !p.centre && (filtre === '' || dossierDuProjet(dossiers, p.id) === filtre)).length;
    fond.querySelector('[data-vivant="sans-position"]').textContent = sans > 0
      ? `${sans} projet${sans > 1 ? 's' : ''} sans position (rien en Suisse, ou projet Drive à ouvrir une fois pour être placé)` : '';
  }

  function toutVoir() {
    const { largeur, hauteur } = taille();
    vue = vueSurCentres(visibles().map((p) => p.centre), largeur, hauteur);
    dessiner();
  }

  // Déplacer au doigt, pincer pour zoomer, molette.
  const pointeurs = new Map();
  let distanceAvant = null;
  zone.addEventListener('pointerdown', (evenement) => {
    if (evenement.target.closest('.etiquette-carte-projet, .commandes-carte-projets')) return;
    zone.setPointerCapture(evenement.pointerId);
    pointeurs.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
    distanceAvant = pointeurs.size === 2 ? distanceEntre(...pointeurs.values()) : null;
  });
  zone.addEventListener('pointermove', (evenement) => {
    const avant = pointeurs.get(evenement.pointerId);
    if (!avant || !vue) return;
    const apres = { x: evenement.clientX, y: evenement.clientY };
    const { largeur, hauteur } = taille();
    if (pointeurs.size === 1) {
      vue = deplacerVue(vue, apres.x - avant.x, apres.y - avant.y);
    } else if (pointeurs.size === 2) {
      pointeurs.set(evenement.pointerId, apres);
      const [a, b] = [...pointeurs.values()];
      const distance = distanceEntre(a, b);
      if (distanceAvant) {
        const rect = zone.getBoundingClientRect();
        vue = zoomerVue(vue, distance / distanceAvant, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, largeur, hauteur);
      }
      distanceAvant = distance;
    }
    pointeurs.set(evenement.pointerId, apres);
    dessiner();
  });
  const finDuGeste = (evenement) => {
    pointeurs.delete(evenement.pointerId);
    distanceAvant = pointeurs.size === 2 ? distanceEntre(...pointeurs.values()) : null;
  };
  zone.addEventListener('pointerup', finDuGeste);
  zone.addEventListener('pointercancel', finDuGeste);
  zone.addEventListener('wheel', (evenement) => {
    evenement.preventDefault();
    const rect = zone.getBoundingClientRect();
    const { largeur, hauteur } = taille();
    vue = zoomerVue(vue, evenement.deltaY < 0 ? 1.25 : 1 / 1.25, evenement.clientX - rect.left, evenement.clientY - rect.top, largeur, hauteur);
    dessiner();
  }, { passive: false });

  fond.addEventListener('click', (evenement) => {
    const etiquette = evenement.target.closest('.etiquette-carte-projet');
    if (etiquette) {
      choisi = etiquette.dataset.projet;
      dessinerEtiquettes();
      dessinerFiche();
      return;
    }
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const { largeur, hauteur } = taille();
    if (bouton.dataset.action === 'fermer-carte') fermer();
    else if (bouton.dataset.action === 'zoom-plus-carte') { vue = zoomerVue(vue, 1.6, largeur / 2, hauteur / 2, largeur, hauteur); dessiner(); }
    else if (bouton.dataset.action === 'zoom-moins-carte') { vue = zoomerVue(vue, 1 / 1.6, largeur / 2, hauteur / 2, largeur, hauteur); dessiner(); }
    else if (bouton.dataset.action === 'tout-voir-carte') toutVoir();
    else if (bouton.dataset.action === 'ouvrir-carte') {
      const p = projets.find((q) => q.id === choisi);
      if (p) {
        fermer();
        quandOuvrir(p);
      }
    }
  });
  fond.addEventListener('change', (evenement) => {
    if (evenement.target.dataset.champ !== 'dossier-carte') return;
    filtre = evenement.target.value;
    choisi = null;
    dessinerFiche();
    toutVoir();
  });

  function fermer() {
    window.removeEventListener('resize', auRedimensionnement);
    for (const image of tuiles.values()) image.remove();
    tuiles = new Map();
    fond.remove();
  }

  requestAnimationFrame(() => {
    // Le projet ouvert (s'il a une position) est choisi au départ.
    if (projets.some((p) => p.id === ouvertId && p.centre)) choisi = ouvertId;
    toutVoir();
    dessinerFiche();
  });
  const auRedimensionnement = () => vue && dessiner();
  window.addEventListener('resize', auRedimensionnement);
  return {
    fermer,
    miseAJour(nouveaux) {
      projets = nouveaux;
      if (!vue) return;
      dessinerEtiquettes();
      dessinerFiche();
    },
  };
}

const distanceEntre = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
