// Application « Test laser » (0.269.0, Expert, APK, demande du 17.11) : GNSS sur la canne + Leica D510 fixé
// dessus (distance et angle vertical tapés à la main). Quatre parties :
// - « Cap » : point visé avec le cap du RX2 (corrigé par l'essai A) ;
// - « Essai A » : le cap du RX2 est-il juste ? (cap lu en A, laser visant B, comparé à l'azimut GNSS A → B) ;
// - « Essai B » : point visé depuis deux stations, sans cap (intersection de deux cercles) ;
// - « Montage » : hauteur du laser au-dessus de la pointe, décalages, correction du cap (gardés sur la tablette).
// Chaque lecture du récepteur dure 5 s (moyenne), seulement en FIXE avec l'inclinaison prête.
// Les calculs sont dans topo/laser.js ; ici seulement l'écran et les lectures.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { fixe3 } from '../topo/format.js';
import { correctionsTropAnciennes } from '../topo/age-corrections.js';
import {
  azimut, distance2d, moyenneAngles, statistiquesEcarts, ecartAngle, erreurLaterale,
  origineLaser, pointParCap, pointParDeuxStations, ecartsPoints,
} from '../topo/laser.js';

export const CLE_MONTAGE_LASER = 'topo-laser';
export const DUREE_LECTURE_MS = 5000;
const PAS_LECTURE_MS = 200;
const LECTURES_MINI = 10;
// uniteAngle : unité de l'inclinaison envoyée par le D510 en Bluetooth ('rad' au départ, à vérifier avec son écran).
const MONTAGE_DEPART = { hauteur: 0, droite: 0, avant: 0, correctionCap: 0, corrigerInclinaison: true, uniteAngle: 'rad' };
// Distance et inclinaison du laser arrivent l'une après l'autre : elles vont ensemble si moins de 2 s les séparent.
export const ECART_MESURE_LASER_MS = 2000;

/** Inclinaison reçue du laser (valeur brute) en degrés, selon l'unité réglée ('rad' ou 'deg'). */
export function angleLaserEnDegres(valeur, unite = 'rad') {
  if (!Number.isFinite(valeur)) return null;
  return unite === 'deg' ? valeur : (valeur * 180) / Math.PI;
}

/** Réglages du montage gardés sur la tablette (tout à 0 tant que le montage n'est pas fait). */
export function lireMontage(stockage = globalThis.localStorage) {
  try {
    const lu = JSON.parse(stockage?.getItem(CLE_MONTAGE_LASER) ?? 'null');
    if (lu && typeof lu === 'object') return { ...MONTAGE_DEPART, ...lu };
  } catch {
    // Mémoire illisible : réglages de départ.
  }
  return { ...MONTAGE_DEPART };
}

export function ecrireMontage(montage, stockage = globalThis.localStorage) {
  try {
    stockage?.setItem(CLE_MONTAGE_LASER, JSON.stringify(montage));
  } catch {
    // Mémoire indisponible : réglages non retenus.
  }
}

/** Nombre tapé (virgule acceptée), ou null. */
export function lireNombre(texte) {
  const t = String(texte ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Moyenne de lectures du récepteur sur 5 s : [{ position, cap, inclinaison, directionInclinaison }].
 * Renvoie { station, cap, ecartTypeCap, inclinaison: { angle, direction } | null, n } ou { erreur }.
 */
export function moyenneLectures(lectures) {
  const bonnes = lectures.filter((l) => l?.position && Number.isFinite(l.position.est));
  if (bonnes.length < LECTURES_MINI) return { erreur: `trop peu de positions FIXE avec l'inclinaison prête (${bonnes.length} en 5 s)` };
  const moy = (f) => bonnes.reduce((t, l) => t + f(l), 0) / bonnes.length;
  const station = {
    est: moy((l) => l.position.est),
    nord: moy((l) => l.position.nord),
    altitude: moy((l) => l.position.altitude ?? 0),
  };
  const caps = moyenneAngles(bonnes.map((l) => l.cap));
  const avecIncl = bonnes.filter((l) => Number.isFinite(l.inclinaison) && Number.isFinite(l.directionInclinaison));
  const inclinaison = avecIncl.length > 0
    ? { angle: avecIncl.reduce((t, l) => t + l.inclinaison, 0) / avecIncl.length, direction: moyenneAngles(avecIncl.map((l) => l.directionInclinaison)).moyenne }
    : null;
  return { station, cap: caps?.moyenne ?? null, ecartTypeCap: caps?.ecartType ?? null, inclinaison, n: bonnes.length };
}

/**
 * Azimut vrai de la visée de l'essai A : du laser (origine, qui dépend elle-même de la visée) vers le point B.
 * Quelques tours suffisent (décalages de quelques cm).
 */
export function azimutVraiVers(station, cible, montage, inclinaison) {
  let az = azimut(station, cible);
  for (let i = 0; i < 6; i += 1) az = azimut(origineLaser(station, montage, az, inclinaison), cible);
  return az;
}

const nb = (v) => (Number.isFinite(v) ? fixe3(v) : '—');
const deg = (v, d = 2) => (Number.isFinite(v) ? `${v.toFixed(d)}°` : '—');
const cm = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)} cm` : '—');

/**
 * Crée l'application. dependances : { conteneur, lireEtat () → état du récepteur, message (texte, durée, options),
 * enregistrerPoint (point) → nom ou null, exporterCsv (lignes), estExpert () }.
 */
export function creerAppliLaser({ conteneur, lireEtat, message, enregistrerPoint, exporterCsv, laser = null }) {
  const etat = {
    partie: 'cap',
    montage: lireMontage(),
    lecture: null, // { quoi, valeurs, minuterie, fin }
    cap: { mesure: null, distance: '', angle: '', verite: null },
    essaiA: { cible: null, distance: '', serie: [] },
    essaiB: { mesures: [null, null], distances: ['', ''], angles: ['', ''], cote: null, verite: null },
    seance: [], // lignes du CSV
    // Laser en Bluetooth : état reçu de l'APK, dernière mesure (pour assembler distance et angle), station visée (essai B).
    laser: { etat: 'deconnecte', nom: null, peutMesurer: false, distance: null, tDistance: 0, brut: null, tBrut: 0 },
    cibleB: null,
  };

  const montageCalcul = () => ({ hauteur: etat.montage.hauteur, droite: etat.montage.droite, avant: etat.montage.avant });
  const inclinaisonUtilisee = (mesure) => (etat.montage.corrigerInclinaison ? mesure?.inclinaison ?? null : null);
  const heure = () => new Date().toLocaleTimeString('fr-CH');

  // --- Lecture de 5 s ---

  function etatPret() {
    const e = lireEtat();
    if (!e?.connecte) return { raison: 'récepteur non connecté' };
    if (!e.recu || !e.position) return { raison: 'en attente de la position du récepteur' };
    if (e.qualite !== 4) return { raison: 'il faut le RTK FIXE' };
    if (!e.inclinaisonPrete) return { raison: 'inclinaison pas prête (bouger un peu la canne)' };
    if (correctionsTropAnciennes(e.ageCorrections)) return { raison: 'corrections trop anciennes' };
    return { etat: e };
  }

  function lire(quoi, quandFini) {
    if (etat.lecture) return;
    const pret = etatPret();
    if (pret.raison) {
      message(`Lecture impossible : ${pret.raison}.`, 4000);
      return;
    }
    const lecture = { quoi, valeurs: [], fin: Date.now() + DUREE_LECTURE_MS };
    etat.lecture = lecture;
    lecture.minuterie = setInterval(() => {
      const { etat: e } = etatPret();
      if (e) lecture.valeurs.push({ position: e.position, cap: e.cap, inclinaison: e.inclinaison, directionInclinaison: e.directionInclinaison });
      if (Date.now() >= lecture.fin) {
        clearInterval(lecture.minuterie);
        etat.lecture = null;
        const resultat = moyenneLectures(lecture.valeurs);
        if (resultat.erreur) message(`Lecture refusée : ${resultat.erreur}.`, 5000);
        else quandFini(resultat);
        afficher();
      } else {
        const reste = conteneur.querySelector('.laser-reste');
        if (reste) reste.textContent = `${Math.ceil((lecture.fin - Date.now()) / 1000)} s`;
      }
    }, PAS_LECTURE_MS);
    afficher();
  }

  function arreter() {
    if (etat.lecture) clearInterval(etat.lecture.minuterie);
    etat.lecture = null;
  }

  // --- Calculs pour l'écran ---

  function resultatCap() {
    const m = etat.cap.mesure;
    if (!m) return null;
    return pointParCap({
      station: m.station, cap: m.cap, inclinaison: inclinaisonUtilisee(m),
      distance: lireNombre(etat.cap.distance), angleVertical: lireNombre(etat.cap.angle) ?? 0,
    }, montageCalcul(), etat.montage.correctionCap);
  }

  function mesuresB() {
    return etat.essaiB.mesures.map((m, i) => (m ? {
      station: m.station, inclinaison: inclinaisonUtilisee(m), cap: m.cap,
      distance: lireNombre(etat.essaiB.distances[i]), angleVertical: lireNombre(etat.essaiB.angles[i]) ?? 0,
    } : null));
  }

  function resultatsB() {
    const mesures = mesuresB();
    if (!mesures[0] || !mesures[1]) return null;
    const gauche = pointParDeuxStations(mesures, montageCalcul(), 'gauche');
    if (gauche.erreur) return { erreur: gauche.erreur };
    const droite = pointParDeuxStations(mesures, montageCalcul(), 'droite');
    // Le cap de chaque station (s'il y en a un) dit de quel côté est le point.
    const parCap = mesures.map((m) => (Number.isFinite(m.cap) ? pointParCap(m, montageCalcul(), etat.montage.correctionCap) : null)).filter((p) => p && !p.erreur);
    let suggere = null;
    if (parCap.length > 0) {
      const dist = (p) => parCap.reduce((t, q) => t + ecartsPoints(p, q).d2d, 0);
      suggere = dist(gauche) <= dist(droite) ? 'gauche' : 'droite';
    }
    return { gauche, droite, parCap, suggere };
  }

  // --- Écran ---

  function htmlLecture(quoi, texte) {
    const enCours = etat.lecture?.quoi === quoi;
    return `<button type="button" class="bouton bouton-lecture-laser" data-action="laser-lire" data-quoi="${quoi}" ${etat.lecture && !enCours ? 'disabled' : ''}>
      ${enCours ? `Lecture… <span class="laser-reste">5 s</span>` : texte}</button>`;
  }

  function htmlStation(m) {
    if (!m) return '<p class="laser-vide">Pas encore lue</p>';
    return `<table class="tableau-laser"><tbody>
      <tr><th>Est / Nord</th><td>${nb(m.station.est)} / ${nb(m.station.nord)}</td></tr>
      <tr><th>Altitude</th><td>${nb(m.station.altitude)}</td></tr>
      <tr><th>Cap lu</th><td>${deg(m.cap)} ${Number.isFinite(m.ecartTypeCap) ? `(± ${deg(m.ecartTypeCap)})` : ''}</td></tr>
      <tr><th>Canne</th><td>${m.inclinaison ? `${deg(m.inclinaison.angle, 1)} vers ${deg(m.inclinaison.direction, 0)}` : '—'}</td></tr>
    </tbody></table>`;
  }

  function champ(action, valeur, titre, unite, indice = '') {
    return `<label class="champ-laser"><span>${titre}</span>
      <input type="text" inputmode="text" data-champ="${action}" ${indice !== '' ? `data-indice="${indice}"` : ''} value="${echapper(valeur)}" placeholder="0.000" /> ${unite}</label>`;
  }

  function htmlResultat(p, titre = 'Point visé') {
    if (!p) return '';
    if (p.erreur) return `<p class="laser-attente">⚠ ${echapper(p.erreur)}</p>`;
    return `<div class="resultat-laser"><strong>${titre}</strong>
      <table class="tableau-laser"><tbody>
        <tr><th>Est</th><td>${nb(p.est)}</td></tr><tr><th>Nord</th><td>${nb(p.nord)}</td></tr><tr><th>Altitude</th><td>${nb(p.altitude)}</td></tr>
        ${Number.isFinite(p.azimut) ? `<tr><th>Azimut utilisé</th><td>${deg(p.azimut)}</td></tr>` : ''}
        ${Number.isFinite(p.horizontale) ? `<tr><th>Dist. horizontale</th><td>${nb(p.horizontale)}</td></tr>` : ''}
      </tbody></table></div>`;
  }

  function htmlVerite(verite, p, quoi) {
    let comparaison = '';
    if (verite && p && !p.erreur) {
      const e = ecartsPoints(verite.station, p);
      comparaison = `<table class="tableau-laser"><tbody>
        <tr><th>Écart 2D</th><td class="${e.d2d <= 0.03 ? 'laser-ok' : 'laser-pas-ok'}">${cm(e.d2d)}</td></tr>
        <tr><th>dEst / dNord</th><td>${cm(e.dEst)} / ${cm(e.dNord)}</td></tr>
        <tr><th>Écart altitude</th><td>${cm(e.dAlt)}</td></tr></tbody></table>`;
    }
    return `<details class="verite-laser" ${verite ? 'open' : ''}><summary>Contrôle : point pris au GNSS ${bulle('laserVerite')}</summary>
      ${htmlLecture(quoi, verite ? 'Reprendre le point au GNSS (5 s)' : 'Prendre le point visé au GNSS (5 s)')}
      ${comparaison}</details>`;
  }

  function htmlCap() {
    const p = resultatCap();
    const statA = statistiquesEcarts(etat.essaiA.serie.map((s) => s.ecart));
    const incertitude = p && !p.erreur && statA && statA.n >= 2 ? erreurLaterale(p.horizontale, statA.ecartType) : null;
    return `<div class="partie-laser">
      <p class="laser-correction">Correction du cap : <strong>${deg(etat.montage.correctionCap)}</strong>${etat.montage.correctionCap === 0 ? ' (essai A pas fait)' : ''}</p>
      ${htmlLecture('cap', 'Lire station et cap (5 s)')}
      ${htmlStation(etat.cap.mesure)}
      <div class="champs-laser">${champ('cap-distance', etat.cap.distance, 'Distance', 'm')}${champ('cap-angle', etat.cap.angle, 'Angle', '°')}</div>
      <div class="zone-calcul-laser">
      ${etat.cap.mesure ? htmlResultat(p) : ''}
      ${incertitude != null ? `<p class="laser-incertitude">Erreur de côté probable (dispersion de l'essai A) : ± ${cm(incertitude)}</p>` : ''}
      ${htmlVerite(etat.cap.verite, p, 'verite-cap')}
      <div class="boutons-laser">
        <button type="button" class="bouton" data-action="laser-enregistrer" data-partie="cap" ${p && !p.erreur ? '' : 'disabled'}>Enreg.</button>
        <button type="button" class="bouton-secondaire" data-action="laser-nouveau" data-partie="cap">Nouvelle mesure</button>
      </div></div>
    </div>`;
  }

  function htmlEssaiA() {
    const a = etat.essaiA;
    const stats = statistiquesEcarts(a.serie.map((s) => s.ecart));
    const lignes = a.serie.map((s, i) => `<tr><td>${i + 1}</td><td>${deg(s.cap)}</td><td>${deg(s.azimut)}</td><td><strong>${deg(s.ecart)}</strong></td><td>${nb(s.distanceGnss)}</td><td>${s.ecartDistance != null ? cm(s.ecartDistance) : '—'}</td>
      <td><button type="button" class="bouton-lien" data-action="laser-retirer-a" data-indice="${i}" aria-label="Retirer la station ${i + 1}">✕</button></td></tr>`).join('');
    return `<div class="partie-laser">
      <p class="laser-etape"><strong>1.</strong> Point visé B ${bulle('laserEssaiA')}</p>
      ${htmlLecture('cible-a', a.cible ? 'Reprendre B (5 s)' : 'Prendre B au GNSS (5 s)')}
      ${a.cible ? `<p class="laser-info">B : ${nb(a.cible.station.est)} / ${nb(a.cible.station.nord)}</p>` : ''}
      <p class="laser-etape"><strong>2.</strong> En A, laser sur B, au moins 20 m</p>
      ${champ('a-distance', a.distance, 'Distance laser (facultatif)', 'm')}
      ${a.cible ? htmlLecture('station-a', 'Lire station A et cap (5 s)') : ''}
      ${a.serie.length > 0 ? `<table class="tableau-laser tableau-serie-laser"><thead><tr><th>N°</th><th>Cap</th><th>Azimut</th><th>Écart</th><th>A → B</th><th>Δ dist.</th><th></th></tr></thead><tbody>${lignes}</tbody></table>` : ''}
      ${stats ? `<div class="resultat-laser"><strong>Série : ${stats.n} station${stats.n > 1 ? 's' : ''}</strong>
        <table class="tableau-laser"><tbody>
          <tr><th>Écart moyen</th><td>${deg(stats.moyenne)}</td></tr>
          <tr><th>Écart-type</th><td>${stats.n > 1 ? deg(stats.ecartType) : '—'}</td></tr>
          <tr><th>Mini / maxi</th><td>${deg(stats.mini)} / ${deg(stats.maxi)}</td></tr>
          <tr><th>À 10 m (± écart-type)</th><td>${stats.n > 1 ? cm(erreurLaterale(10, stats.ecartType)) : '—'}</td></tr>
        </tbody></table>
        <div class="boutons-laser">
          <button type="button" class="bouton" data-action="laser-utiliser-correction" ${stats.n >= 3 ? '' : 'disabled'}>Utiliser ${deg(stats.moyenne)} comme correction</button>
          <button type="button" class="bouton-secondaire" data-action="laser-vider-a">Effacer la série</button>
        </div></div>` : ''}
    </div>`;
  }

  function htmlEssaiB() {
    const b = etat.essaiB;
    const r = resultatsB();
    const avecLaser = etat.laser.etat === 'connecte';
    const stations = [0, 1].map((i) => `<div class="station-laser ${avecLaser && cibleB() === i ? 'station-cible-laser' : ''}"><p class="laser-etape"><strong>Station ${i + 1}</strong>
      ${avecLaser ? `<button type="button" class="puce-choix ${cibleB() === i ? 'actif' : ''}" data-action="laser-cible" data-valeur="${i}">${cibleB() === i ? '◀ laser ici' : 'laser ici'}</button>` : ''}</p>
      ${htmlLecture(`station-b${i}`, b.mesures[i] ? `Relire station ${i + 1} (5 s)` : `Lire station ${i + 1} (5 s)`)}
      ${htmlStation(b.mesures[i])}
      <div class="champs-laser">${champ('b-distance', b.distances[i], 'Distance', 'm', i)}${champ('b-angle', b.angles[i], 'Angle', '°', i)}</div></div>`).join('');
    let resultat = '';
    const choisi = b.cote ?? r?.suggere ?? null;
    if (r?.erreur) resultat = `<p class="laser-attente">⚠ ${echapper(r.erreur)}</p>`;
    else if (r) {
      const p = choisi ? r[choisi] : null;
      const angleMauvais = r.gauche.angle < 30 || r.gauche.angle > 150;
      resultat = `<div class="resultat-laser">
        <p class="laser-etape">Côté du point (de la station 1 vers la 2) ${bulle('laserEssaiB')}</p>
        <div class="choix-cote-laser">
          ${['gauche', 'droite'].map((c) => `<button type="button" class="puce-choix ${choisi === c ? 'actif' : ''}" data-action="laser-cote" data-valeur="${c}">${c === 'gauche' ? 'À gauche' : 'À droite'}${r.suggere === c ? ' (cap)' : ''}</button>`).join('')}
        </div>
        <table class="tableau-laser"><tbody>
          <tr><th>Angle d'intersection</th><td class="${angleMauvais ? 'laser-pas-ok' : 'laser-ok'}">${deg(r.gauche.angle, 0)}${angleMauvais ? ' ⚠ trop aigu' : ''}</td></tr>
          ${p ? `<tr><th>Altitude st. 1 / st. 2</th><td>${nb(p.altitude1)} / ${nb(p.altitude2)}</td></tr>
          <tr><th>Écart d'altitude</th><td>${cm(p.ecartAltitude)}</td></tr>` : ''}
        </tbody></table>
        ${p ? htmlResultat(p, 'Point visé (2 stations)') : '<p class="laser-attente">Choisis le côté</p>'}
        ${p && r.parCap.length > 0 ? `<table class="tableau-laser"><tbody>${r.parCap.map((q, i) => {
          const e = ecartsPoints(p, q);
          return `<tr><th>Par le cap ${r.parCap.length > 1 ? `(st. ${i + 1})` : ''}</th><td>${cm(e.d2d)} en plan, ${cm(e.dAlt)} en alt.</td></tr>`;
        }).join('')}</tbody></table>` : ''}
      </div>`;
    }
    const p = r && !r.erreur && choisi ? r[choisi] : null;
    return `<div class="partie-laser">${stations}<div class="zone-calcul-laser">${resultat}
      ${htmlVerite(b.verite, p, 'verite-b')}
      <div class="boutons-laser">
        <button type="button" class="bouton" data-action="laser-enregistrer" data-partie="b" ${p ? '' : 'disabled'}>Enreg.</button>
        <button type="button" class="bouton-secondaire" data-action="laser-nouveau" data-partie="b">Nouvelle mesure</button>
      </div></div></div>`;
  }

  /** Station de l'essai B qui reçoit la mesure du laser : choisie, sinon la 1re sans distance. */
  const cibleB = () => etat.cibleB ?? (lireNombre(etat.essaiB.distances[0]) == null ? 0 : 1);

  function htmlLaser() {
    if (!laser?.disponible()) return '';
    const l = etat.laser;
    const textes = { deconnecte: 'non connecté', recherche: 'recherche…', connexion: 'connexion…', connecte: `connecté${l.nom ? ` (${echapper(l.nom)})` : ''}` };
    const connecte = l.etat === 'connecte';
    return `<div class="barre-laser ${connecte ? 'laser-connecte' : ''}">
      <span>Laser : <strong>${textes[l.etat] ?? echapper(l.etat)}</strong></span>
      ${connecte
        ? `${l.peutMesurer ? '<button type="button" class="bouton" data-action="laser-mesurer">Mesurer</button>' : ''}
           <button type="button" class="bouton-secondaire" data-action="laser-deconnecter">Déconnecter</button>`
        : `<button type="button" class="bouton-secondaire" data-action="laser-connecter" ${l.etat === 'deconnecte' ? '' : 'disabled'}>Connecter le laser</button>`}
    </div>`;
  }

  function htmlMontage() {
    const m = etat.montage;
    return `<div class="partie-laser">
      <p class="laser-etape">Montage du laser sur la canne ${bulle('laserMontage')}</p>
      <div class="champs-laser champs-montage-laser">
        ${champ('m-hauteur', String(m.hauteur), 'Hauteur au-dessus de la pointe', 'm')}
        ${champ('m-droite', String(m.droite), 'Décalage à droite', 'm')}
        ${champ('m-avant', String(m.avant), 'Décalage vers l\'avant', 'm')}
        ${champ('m-correction', String(m.correctionCap), 'Correction du cap', '°')}
      </div>
      <button type="button" class="bouton-secondaire" data-action="laser-incl" role="switch" aria-checked="${m.corrigerInclinaison}">${m.corrigerInclinaison ? '✓' : '○'} Corriger la canne penchée</button>
      ${laser?.disponible() ? `<p class="laser-etape">Angle reçu du laser en Bluetooth ${bulle('laserBluetooth')}</p>
      <div class="choix-cote-laser">${[['rad', 'Radians'], ['deg', 'Degrés']].map(([c, t]) => `<button type="button" class="puce-choix ${m.uniteAngle === c ? 'actif' : ''}" data-action="laser-unite" data-valeur="${c}">${t}</button>`).join('')}</div>
      <p class="laser-info">Dernière valeur reçue : ${etat.laser.brut != null ? `${etat.laser.brut.toFixed(5)} → ${deg(angleLaserEnDegres(etat.laser.brut, m.uniteAngle), 2)}` : '—'}</p>` : ''}
    </div>`;
  }

  const htmlPartie = () => ({ cap: htmlCap, a: htmlEssaiA, b: htmlEssaiB, montage: htmlMontage }[etat.partie]());

  /** Pendant la frappe : seulement la zone du résultat est refaite (le champ et le clavier restent). */
  function majCalcul() {
    const provisoire = document.createElement('div');
    provisoire.innerHTML = htmlPartie();
    const neuf = provisoire.querySelector('.zone-calcul-laser');
    const vieux = conteneur.querySelector('.zone-calcul-laser');
    if (neuf && vieux) vieux.replaceWith(neuf);
  }

  function afficher() {
    const parties = [['cap', 'Cap'], ['a', 'Essai A'], ['b', 'Essai B'], ['montage', 'Montage']];
    conteneur.innerHTML = `<div class="ecran-laser">
      <div class="titre-laser"><h2>Test laser ${bulle('testLaser')}</h2>
        <button type="button" class="bouton-secondaire" data-action="laser-csv" ${etat.seance.length ? '' : 'disabled'}>CSV (${etat.seance.length})</button></div>
      ${htmlLaser()}
      <div class="onglets-laser" role="tablist">${parties.map(([c, t]) => `<button type="button" role="tab" class="puce-choix ${etat.partie === c ? 'actif' : ''}" data-action="laser-partie" data-valeur="${c}" aria-selected="${etat.partie === c}">${t}</button>`).join('')}</div>
      ${htmlPartie()}
    </div>`;
  }

  // --- Actions ---

  function ligneSeance(essai, nom, p, mesure, extra = {}) {
    return {
      heure: heure(), essai, nom, est: p?.est, nord: p?.nord, altitude: p?.altitude,
      stationEst: mesure?.station?.est, stationNord: mesure?.station?.nord, stationAltitude: mesure?.station?.altitude,
      cap: mesure?.cap, ecartTypeCap: mesure?.ecartTypeCap, inclinaison: mesure?.inclinaison?.angle, ...extra,
    };
  }

  function quandLu(quoi, r) {
    if (quoi === 'cap') etat.cap.mesure = r;
    else if (quoi === 'verite-cap') etat.cap.verite = r;
    else if (quoi === 'verite-b') etat.essaiB.verite = r;
    else if (quoi === 'cible-a') etat.essaiA.cible = r;
    else if (quoi === 'station-b0' || quoi === 'station-b1') {
      etat.essaiB.mesures[Number(quoi.at(-1))] = r;
      etat.essaiB.cote = null;
    } else if (quoi === 'station-a') ajouterStationA(r);
    if (!['station-a'].includes(quoi)) message('Lecture faite (moyenne de 5 s)', 2500, { ok: true });
  }

  function ajouterStationA(r) {
    const a = etat.essaiA;
    if (!Number.isFinite(r.cap)) {
      message('Pas de cap reçu du RX2 pendant la lecture : station non comptée.', 5000);
      return;
    }
    const incl = inclinaisonUtilisee(r);
    const az = azimutVraiVers(r.station, a.cible.station, montageCalcul(), incl);
    const distanceGnss = distance2d(origineLaser(r.station, montageCalcul(), az, incl), a.cible.station);
    if (distanceGnss < 5) {
      message(`A et B sont à ${fixe3(distanceGnss)} m : trop près (20 m au moins).`, 5000);
      return;
    }
    const d = lireNombre(a.distance);
    const ecart = ecartAngle(r.cap, az);
    a.serie.push({ cap: r.cap, azimut: az, ecart, distanceGnss, ecartDistance: d ? d - distanceGnss : null });
    etat.seance.push(ligneSeance('A', `A${a.serie.length}`, null, r, { azimut: az, ecart, distance: d, remarque: `A → B ${fixe3(distanceGnss)} m` }));
    message(`Station ${a.serie.length} : écart ${ecart.toFixed(2)}°${distanceGnss < 20 ? ' (moins de 20 m : peu sûr)' : ''}`, 4000, { ok: distanceGnss >= 20 });
  }

  function enregistrer(partie) {
    if (partie === 'cap') {
      const p = resultatCap();
      if (!p || p.erreur) return;
      const nom = enregistrerPoint({ ...p, methode: 'cap' });
      if (!nom) return;
      const v = etat.cap.verite ? ecartsPoints(etat.cap.verite.station, p) : {};
      etat.seance.push(ligneSeance('Cap', nom, p, etat.cap.mesure, {
        distance: lireNombre(etat.cap.distance), angle: lireNombre(etat.cap.angle) ?? 0, correction: etat.montage.correctionCap, azimut: p.azimut,
        dEst: v.dEst, dNord: v.dNord, d2d: v.d2d, dAlt: v.dAlt,
      }));
    } else {
      const r = resultatsB();
      const cote = etat.essaiB.cote ?? r?.suggere;
      const p = r && !r.erreur && cote ? r[cote] : null;
      if (!p) return;
      const nom = enregistrerPoint({ ...p, methode: 'deux stations' });
      if (!nom) return;
      const v = etat.essaiB.verite ? ecartsPoints(etat.essaiB.verite.station, p) : {};
      etat.essaiB.mesures.forEach((m, i) => etat.seance.push(ligneSeance('B', nom, p, m, {
        distance: lireNombre(etat.essaiB.distances[i]), angle: lireNombre(etat.essaiB.angles[i]) ?? 0,
        dEst: v.dEst, dNord: v.dNord, d2d: v.d2d, dAlt: v.dAlt,
        remarque: `station ${i + 1}, côté ${cote}, angle ${p.angle.toFixed(0)}°, écart alt. st. ${fixe3(p.ecartAltitude)} m`,
      })));
    }
    afficher();
  }

  function nouveau(partie) {
    if (partie === 'cap') etat.cap = { mesure: null, distance: '', angle: '', verite: null };
    else etat.essaiB = { mesures: [null, null], distances: ['', ''], angles: ['', ''], cote: null, verite: null };
    afficher();
  }

  conteneur.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('[data-action]');
    if (!bouton || !conteneur.contains(bouton)) return;
    const action = bouton.dataset.action;
    if (bouton.disabled) return;
    if (action === 'laser-partie') {
      etat.partie = bouton.dataset.valeur;
      afficher();
    } else if (action === 'laser-lire') {
      const quoi = bouton.dataset.quoi;
      lire(quoi, (r) => quandLu(quoi, r));
    } else if (action === 'laser-enregistrer') enregistrer(bouton.dataset.partie);
    else if (action === 'laser-nouveau') nouveau(bouton.dataset.partie);
    else if (action === 'laser-cote') {
      etat.essaiB.cote = bouton.dataset.valeur;
      afficher();
    } else if (action === 'laser-retirer-a') {
      etat.essaiA.serie.splice(Number(bouton.dataset.indice), 1);
      afficher();
    } else if (action === 'laser-vider-a') {
      if (!confirm('Effacer toutes les stations de l\'essai A ?')) return;
      etat.essaiA.serie = [];
      afficher();
    } else if (action === 'laser-utiliser-correction') {
      const stats = statistiquesEcarts(etat.essaiA.serie.map((s) => s.ecart));
      if (!stats) return;
      etat.montage.correctionCap = Math.round(stats.moyenne * 1000) / 1000;
      ecrireMontage(etat.montage);
      message(`Correction du cap : ${stats.moyenne.toFixed(2)}° (gardée sur la tablette)`, 4000, { ok: true });
      afficher();
    } else if (action === 'laser-incl') {
      etat.montage.corrigerInclinaison = !etat.montage.corrigerInclinaison;
      ecrireMontage(etat.montage);
      afficher();
    } else if (action === 'laser-csv') exporterCsv(etat.seance);
    else if (action === 'laser-connecter') laser?.choisir();
    else if (action === 'laser-deconnecter') laser?.deconnecter();
    else if (action === 'laser-mesurer') {
      if (!laser?.mesurer()) message('Le laser n\'a pas pris la commande : appuie sur son bouton DIST.', 4000);
    } else if (action === 'laser-cible') {
      etat.cibleB = Number(bouton.dataset.valeur);
      afficher();
    } else if (action === 'laser-unite') {
      etat.montage.uniteAngle = bouton.dataset.valeur;
      ecrireMontage(etat.montage);
      afficher();
    }
  });

  // Saisie : la valeur est gardée à chaque touche ; seul le résultat est refait (le champ garde la main).
  conteneur.addEventListener('input', (evenement) => {
    const champSaisi = evenement.target.closest('[data-champ]');
    if (!champSaisi) return;
    const { champ: cle, indice } = champSaisi.dataset;
    const v = champSaisi.value;
    if (cle === 'cap-distance') etat.cap.distance = v;
    else if (cle === 'cap-angle') etat.cap.angle = v;
    else if (cle === 'a-distance') {
      etat.essaiA.distance = v;
      return; // rien à recalculer
    } else if (cle === 'b-distance') etat.essaiB.distances[Number(indice)] = v;
    else if (cle === 'b-angle') etat.essaiB.angles[Number(indice)] = v;
    else if (cle.startsWith('m-')) {
      const n = lireNombre(v);
      if (n == null) return;
      const nomReglage = { 'm-hauteur': 'hauteur', 'm-droite': 'droite', 'm-avant': 'avant', 'm-correction': 'correctionCap' }[cle];
      etat.montage[nomReglage] = n;
      ecrireMontage(etat.montage);
      return;
    }
    majCalcul();
  });

  // --- Laser en Bluetooth ---

  /** Écrit une valeur du laser dans le champ de la partie ouverte (sans retaper l'écran). */
  function remplir(quoi, valeur, indiceB = cibleB()) {
    const texte = quoi === 'distance' ? valeur.toFixed(3) : valeur.toFixed(2);
    let cle = null;
    let indice = '';
    if (etat.partie === 'cap') {
      cle = quoi === 'distance' ? 'cap-distance' : 'cap-angle';
      etat.cap[quoi === 'distance' ? 'distance' : 'angle'] = texte;
    } else if (etat.partie === 'a' && quoi === 'distance') {
      cle = 'a-distance';
      etat.essaiA.distance = texte;
    } else if (etat.partie === 'b') {
      const i = indiceB;
      indice = String(i);
      cle = quoi === 'distance' ? 'b-distance' : 'b-angle';
      etat.essaiB[quoi === 'distance' ? 'distances' : 'angles'][i] = texte;
    }
    if (!cle) return false;
    const champ = conteneur.querySelector(`[data-champ="${cle}"]${indice !== '' ? `[data-indice="${indice}"]` : ''}`);
    if (champ) champ.value = texte;
    return true;
  }

  /** Mesure reçue du laser : la distance, puis l'angle s'il arrive à moins de 2 s (ou juste avant). */
  function recevoirMesure({ quoi, valeur, heure } = {}) {
    if (!Number.isFinite(valeur)) return;
    const t = Number.isFinite(heure) ? heure : Date.now();
    const l = etat.laser;
    if (quoi === 'distance') {
      if (!(valeur > 0)) return;
      l.distance = valeur;
      l.tDistance = t;
      l.indiceB = cibleB(); // la distance et son angle vont à la même station
      if (!remplir('distance', valeur, l.indiceB)) {
        message(`Laser : ${valeur.toFixed(3)} m (ouvre Cap, Essai A ou Essai B pour l'utiliser)`, 3000);
        return;
      }
      const angleProche = l.brut != null && Math.abs(t - l.tBrut) <= ECART_MESURE_LASER_MS;
      if (angleProche) remplir('angle', angleLaserEnDegres(l.brut, etat.montage.uniteAngle), l.indiceB);
      else if (etat.partie !== 'a') remplir('angle', 0, l.indiceB);
      message(`Laser : ${valeur.toFixed(3)} m${angleProche ? ` · ${angleLaserEnDegres(l.brut, etat.montage.uniteAngle).toFixed(2)}°` : ''}`, 2500, { ok: true });
    } else if (quoi === 'inclinaison') {
      l.brut = valeur;
      l.tBrut = t;
      if (Math.abs(t - l.tDistance) <= ECART_MESURE_LASER_MS && l.distance != null) remplir('angle', angleLaserEnDegres(valeur, etat.montage.uniteAngle), l.indiceB);
      if (etat.partie === 'montage') afficher();
    }
    // Essai B : l'écran est refait pour montrer quelle station recevra la prochaine mesure.
    if (etat.partie === 'b') afficher();
    else if (etat.partie !== 'montage') majCalcul();
  }

  function recevoirEtatLaser(e = {}) {
    const avant = etat.laser.etat;
    Object.assign(etat.laser, { etat: e.etat ?? 'deconnecte', nom: e.nom ?? null, peutMesurer: Boolean(e.peutMesurer) });
    if (e.message) message(e.message, 5000);
    if (avant !== etat.laser.etat && e.etat === 'connecte') message(`Laser connecté${e.nom ? ` : ${e.nom}` : ''}`, 3000, { ok: true });
    afficher();
  }

  return {
    afficher,
    arreter,
    recevoirMesure,
    recevoirEtatLaser,
    /** Pour les essais : état interne (lecture seule). */
    etat: () => etat,
  };
}
