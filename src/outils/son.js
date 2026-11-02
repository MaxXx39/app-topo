// Petits sons de l'appli, fabriqués par le navigateur (pas de fichier son) : un « bip-bip » montant
// quand un point est enregistré (levé ou implantation), un son grave quand il est refusé.
let contexte = null;

/** Joue des notes [fréquence (Hz), durée (s)] l'une après l'autre. */
function jouer(notes, volume = 0.25) {
  try {
    contexte ??= new (window.AudioContext || window.webkitAudioContext)();
    if (contexte.state === 'suspended') contexte.resume();
    let debut = contexte.currentTime;
    for (const [frequence, duree] of notes) {
      const oscillateur = contexte.createOscillator();
      const gain = contexte.createGain();
      oscillateur.type = 'sine';
      oscillateur.frequency.value = frequence;
      // Montée et descente rapides : pas de « clic ».
      gain.gain.setValueAtTime(0, debut);
      gain.gain.linearRampToValueAtTime(volume, debut + 0.01);
      gain.gain.linearRampToValueAtTime(0, debut + duree);
      oscillateur.connect(gain).connect(contexte.destination);
      oscillateur.start(debut);
      oscillateur.stop(debut + duree + 0.02);
      debut += duree + 0.03;
    }
  } catch {
    // Pas de son possible (ancien navigateur) : la vibration et le message suffisent.
  }
}

/** Point enregistré : deux notes montantes. */
export const sonValidation = () => jouer([[880, 0.09], [1320, 0.14]]);

/** Point refusé : une note grave. */
export const sonRefus = () => jouer([[220, 0.25]], 0.2);

/** Fix RTK perdu : deux notes descendantes (0.90.0). */
export const sonPerteFix = () => jouer([[660, 0.15], [330, 0.3]], 0.3);

/** Fix RTK retrouvé : trois notes montantes (0.90.0). */
export const sonRetourFix = () => jouer([[660, 0.08], [880, 0.08], [1320, 0.16]], 0.3);

/**
 * Vibration (0.90.0) : durées en ms (nombre ou liste vibration, pause, vibration…). Dans l'APK,
 * c'est Android qui vibre (navigator.vibrate est refusé quand le point vient de la touche volume −).
 */
export function vibrer(motif) {
  const durees = [motif].flat();
  try {
    if (typeof window.AppliAndroid?.vibrer === 'function') window.AppliAndroid.vibrer(durees.join(','));
    else navigator.vibrate?.(durees);
  } catch {
    // Pas de vibreur : le son et le message suffisent.
  }
}

// --- Bip-bip de hauteur (0.107.0, voir topo/bip.js) ---
// Aigu = monter, grave = descendre ; son continu (note du milieu) dans la tolérance.
const NOTE_MONTER = 1320;
const NOTE_DESCENDRE = 660;
const NOTE_DEDANS = 990;
let rythmeEnCours = null; // dernier rythme demandé (voir rythmeBip), ou null
let minuterieBip = null;
let continu = null; // { oscillateur, gain } du son continu, ou null

function arreterContinu() {
  if (!continu) return;
  try {
    continu.gain.gain.setTargetAtTime(0, contexte.currentTime, 0.02);
    continu.oscillateur.stop(contexte.currentTime + 0.1);
  } catch {
    // déjà arrêté
  }
  continu = null;
}

function demarrerContinu() {
  if (continu) return;
  try {
    contexte ??= new (window.AudioContext || window.webkitAudioContext)();
    if (contexte.state === 'suspended') contexte.resume();
    const oscillateur = contexte.createOscillator();
    const gain = contexte.createGain();
    oscillateur.type = 'sine';
    oscillateur.frequency.value = NOTE_DEDANS;
    gain.gain.setValueAtTime(0, contexte.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, contexte.currentTime + 0.03);
    oscillateur.connect(gain).connect(contexte.destination);
    oscillateur.start();
    continu = { oscillateur, gain };
  } catch {
    // Pas de son possible : la règle à l'écran suffit.
  }
}

/** Un bip, puis le suivant après l'intervalle du rythme en cours (qui change en approchant). */
function bipSuivant() {
  minuterieBip = null;
  const rythme = rythmeEnCours;
  if (!rythme || rythme.continu) return;
  jouer([[rythme.monter ? NOTE_MONTER : NOTE_DESCENDRE, 0.07]], 0.25);
  minuterieBip = setTimeout(bipSuivant, rythme.intervalle);
}

/**
 * Pilote le bip-bip : rythme = null (silence), { continu: true } ou { continu: false, monter,
 * intervalle } (voir topo/bip.js rythmeBip). Appelé à chaque position reçue.
 */
export function piloterBip(rythme) {
  rythmeEnCours = rythme;
  if (!rythme) {
    arreterContinu();
    clearTimeout(minuterieBip);
    minuterieBip = null;
    return;
  }
  if (rythme.continu) {
    clearTimeout(minuterieBip);
    minuterieBip = null;
    demarrerContinu();
    return;
  }
  arreterContinu();
  if (minuterieBip == null) bipSuivant();
}
