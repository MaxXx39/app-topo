// Corrections RTK par internet (swipos), reçues directement par l'appli Android au lieu
// d'Emlid Flow (voir android/noyau/.../ntrip/ClientNtrip.kt). Ici : le texte court de leur état.

/**
 * Texte et couleur de l'état des corrections, à partir de etat.corrections envoyé par Android :
 * { etat ('arrete', 'connexion', 'recoit', 'attente', 'erreur'), message, octets, age (s) }.
 * Renvoie { texte, classe ('neutre', 'ok', 'attente', 'erreur') }.
 */
export function etatCorrections(corrections) {
  if (!corrections || corrections.etat === 'arrete') return { texte: 'par Emlid Flow', classe: 'neutre' };
  if (corrections.etat === 'recoit') {
    const age = corrections.age ?? 0;
    // Plus de 10 s sans corrections : le RTK fixe va se perdre.
    if (age > 10) return { texte: `swipos : plus rien depuis ${Math.round(age)} s`, classe: 'attente' };
    return { texte: `swipos direct · ${formaterOctets(corrections.octets)}`, classe: 'ok' };
  }
  if (corrections.etat === 'erreur') return { texte: corrections.message, classe: 'erreur' };
  return { texte: corrections.message, classe: 'attente' };
}

/** Quantité reçue : « 850 o », « 12 ko », « 1.4 Mo ». */
export function formaterOctets(octets = 0) {
  if (octets < 1000) return `${octets} o`;
  if (octets < 1e6) return `${Math.round(octets / 1000)} ko`;
  return `${(octets / 1e6).toFixed(1)} Mo`;
}
