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
