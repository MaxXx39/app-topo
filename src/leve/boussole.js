// Boussole de la tablette (onglet Terrain › Implanter) : vers où pointe le haut de l'écran, en
// degrés depuis le nord, pour savoir où est le nord.
// Elle donne le nord magnétique (environ 3° de plus que le nord du plan en Suisse) et peut être
// faussée par du métal ou un aimant proche : c'est une aide pour s'orienter, pas une mesure.
// Lue par le navigateur (événement « deviceorientationabsolute » de la tablette).

/**
 * Commence à écouter la boussole ; "quandChange(cap)" est appelé à chaque nouvelle valeur
 * (cap en degrés, 0 = le haut de la tablette pointe vers le nord, 90 = vers l'est).
 * Renvoie { cap (dernière valeur, ou null), disponible (vrai dès qu'une valeur est arrivée), arreter() }.
 */
export function ecouterBoussole(quandChange) {
  const suivi = { cap: null, disponible: false, arreter };

  function recevoir(evenement) {
    let cap = null;
    // iPhone / iPad : le cap est donné directement.
    if (typeof evenement.webkitCompassHeading === 'number') cap = evenement.webkitCompassHeading;
    // Android : alpha = rotation depuis le nord, comptée dans l'autre sens ; on tient compte de
    // l'écran tourné (tablette en paysage).
    else if ((evenement.absolute || evenement.type === 'deviceorientationabsolute') && typeof evenement.alpha === 'number') {
      cap = 360 - evenement.alpha + angleEcran();
    }
    if (cap == null) return;
    suivi.cap = ((cap % 360) + 360) % 360;
    suivi.disponible = true;
    quandChange(suivi.cap);
  }

  const evenement = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(evenement, recevoir);

  function arreter() {
    window.removeEventListener(evenement, recevoir);
  }
  return suivi;
}

/** Rotation de l'écran (0, 90, 180 ou 270°). */
function angleEcran() {
  return screen.orientation?.angle ?? window.orientation ?? 0;
}
