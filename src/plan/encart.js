// Encart du plan pendant la cible (0.151.0, demande du 06.11) : près du point à implanter, le plan
// est un petit encart en haut à droite (style.css « 0.138.0 »). On ne peut plus y choisir de point
// par erreur : une couche « capture » le recouvre.
// - toucher l'encart (court) : le plan reprend sa place en grand (quandToucher) ;
// - appui long (0,4 s) puis glisser : l'encart se déplace ; sa place est retenue sur l'appareil ;
// - petits boutons + / − : zoom du plan.
// Le bouton « ◎ Cible » (visible quand la cible est cachée par ce toucher) la fait revenir.

const CLE = 'topo-encart-plan';
const APPUI_LONG_MS = 400;
const BOUGE_MAX_PX = 10; // au-delà, le doigt a glissé : pas un simple toucher

function lirePlace() {
  try {
    const place = JSON.parse(localStorage.getItem(CLE) ?? 'null');
    return place && Number.isFinite(place.x) && Number.isFinite(place.y) ? place : null;
  } catch {
    return null;
  }
}

function garderPlace(place) {
  try {
    localStorage.setItem(CLE, JSON.stringify(place));
  } catch {
    // Stockage indisponible : la place n'est simplement pas retenue.
  }
}

/**
 * panneau : section .panneau-plan ; actions : { quandToucher(), quandCible(), zoomer(facteur) }.
 */
export function creerEncartPlan(panneau, { quandToucher, quandCible, zoomer }) {
  const couche = document.createElement('div');
  couche.className = 'encart-capture';
  couche.innerHTML = `
    <div class="encart-zoom">
      <button type="button" data-zoom="plus" aria-label="Zoomer">+</button>
      <button type="button" data-zoom="moins" aria-label="Dézoomer">−</button>
    </div>`;
  panneau.append(couche);
  const boutonCible = document.createElement('button');
  boutonCible.type = 'button';
  boutonCible.className = 'bouton-revenir-cible';
  boutonCible.textContent = '◎ Cible';
  panneau.append(boutonCible);
  boutonCible.addEventListener('click', () => quandCible());

  couche.querySelectorAll('[data-zoom]').forEach((bouton) => {
    bouton.addEventListener('pointerdown', (e) => e.stopPropagation());
    bouton.addEventListener('click', (e) => {
      e.stopPropagation();
      zoomer(bouton.dataset.zoom === 'plus' ? 1.5 : 1 / 1.5);
    });
  });

  // Place de l'encart : décalage depuis sa place d'origine (en haut à droite), en px.
  let place = lirePlace() ?? { x: 0, y: 0 };
  const poser = () => {
    panneau.style.setProperty('--encart-x', `${place.x}px`);
    panneau.style.setProperty('--encart-y', `${place.y}px`);
  };
  poser();

  let geste = null; // { id, x0, y0, depart, minuterie, glisse }
  couche.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-zoom]')) return;
    e.preventDefault();
    couche.setPointerCapture?.(e.pointerId);
    geste = { id: e.pointerId, x0: e.clientX, y0: e.clientY, depart: { ...place }, glisse: false, bouge: false };
    geste.minuterie = setTimeout(() => {
      if (!geste) return;
      geste.glisse = true;
      panneau.classList.add('encart-deplace');
      navigator.vibrate?.(30);
    }, APPUI_LONG_MS);
  });
  couche.addEventListener('pointermove', (e) => {
    if (!geste || e.pointerId !== geste.id) return;
    const dx = e.clientX - geste.x0;
    const dy = e.clientY - geste.y0;
    if (Math.hypot(dx, dy) > BOUGE_MAX_PX) geste.bouge = true;
    if (!geste.glisse) return;
    place = borner({ x: geste.depart.x + dx, y: geste.depart.y + dy });
    poser();
  });
  const finir = (e, annule) => {
    if (!geste || e.pointerId !== geste.id) return;
    clearTimeout(geste.minuterie);
    const { glisse, bouge } = geste;
    geste = null;
    panneau.classList.remove('encart-deplace');
    if (glisse) garderPlace(place);
    else if (!annule && !bouge) quandToucher();
  };
  couche.addEventListener('pointerup', (e) => finir(e, false));
  couche.addEventListener('pointercancel', (e) => finir(e, true));

  // L'encart reste dans l'écran (au moins 40 px visibles).
  function borner(p) {
    const r = panneau.getBoundingClientRect();
    const gaucheOrigine = r.left - (place.x ?? 0);
    const hautOrigine = r.top - (place.y ?? 0);
    const x = Math.min(Math.max(p.x, 40 - r.width - gaucheOrigine), window.innerWidth - 40 - gaucheOrigine);
    const y = Math.min(Math.max(p.y, -hautOrigine), window.innerHeight - 40 - hautOrigine);
    return { x, y };
  }
}
