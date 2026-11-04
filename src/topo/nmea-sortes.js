// Journal NMEA (0.119.0) : résumé des sortes de phrases reçues du récepteur, pour savoir s'il
// envoie autre chose que la position (par exemple l'état de sa batterie).

/**
 * Sortes de phrases d'un journal NMEA (une ligne par phrase) : [{ sorte, nombre }], la plus
 * fréquente en premier. Sorte : « GGA » pour « $GNGGA », ou le nom entier d'une phrase propre au
 * fabricant (« PEMLID… », commençant par P).
 */
export function sortesDePhrases(texte) {
  const comptes = new Map();
  for (const ligne of String(texte ?? '').split(/\r?\n/)) {
    const nom = ligne.trim().match(/^[$!]([A-Z0-9]+)[,*]/)?.[1];
    if (!nom) continue;
    // Phrase standard : 2 lettres d'émetteur (GN, GP…) puis la sorte ; phrase « P… » : nom entier.
    const sorte = nom.startsWith('P') || nom.length <= 3 ? nom : nom.slice(2);
    comptes.set(sorte, (comptes.get(sorte) ?? 0) + 1);
  }
  return [...comptes].map(([sorte, nombre]) => ({ sorte, nombre })).sort((a, b) => b.nombre - a.nombre);
}

/** Lignes du journal qui parlent peut-être de batterie (BAT, BATT, BATTERY, POWER), 5 au plus. */
export function lignesBatterie(texte) {
  return String(texte ?? '').split(/\r?\n/).filter((ligne) => /BAT|POWER|PWR/i.test(ligne)).slice(0, 5);
}
