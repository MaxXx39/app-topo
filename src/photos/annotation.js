// Dessin sur une photo (0.124.0, Intermédiaire) : cercle, flèche et trait libre en couleur, pour montrer un détail.
//
// Les dessins sont rangés avec la photo (photo.dessins) et la photo d'origine n'est jamais modifiée :
// on peut les rouvrir, en effacer, en ajouter. Chaque dessin a des positions entre 0 et 1
// (0,0 = coin en haut à gauche de la photo, 1,1 = coin en bas à droite), donc ils suivent la photo
// quelle que soit sa taille à l'écran :
// - cercle : { type: 'cercle', couleur, a: centre, b: un point du cercle }
// - flèche : { type: 'fleche', couleur, a: queue, b: pointe }
// - trait  : { type: 'trait', couleur, points: [{ x, y }, ...] }
export const COULEURS_DESSIN = [
  ['rouge', '#ef4444'],
  ['jaune', '#facc15'],
  ['vert', '#22c55e'],
  ['blanc', '#ffffff'],
];

/** Rayon (en pixels) d'un cercle dessiné de a (centre) à b, sur une photo largeur × hauteur. */
export function rayonCercle(a, b, largeur, hauteur) {
  return Math.hypot((b.x - a.x) * largeur, (b.y - a.y) * hauteur);
}

/**
 * Les 3 points de la pointe d'une flèche (en pixels) : [gauche, bout, droite]. longueur : taille
 * de la pointe ; elle est raccourcie si la flèche est courte. Renvoie null si la flèche n'a pas de longueur.
 */
export function pointeFleche(a, b, largeur, hauteur, longueur) {
  const dx = (b.x - a.x) * largeur;
  const dy = (b.y - a.y) * hauteur;
  const total = Math.hypot(dx, dy);
  if (total < 1) return null;
  const l = Math.min(longueur, total * 0.6);
  const angle = Math.atan2(dy, dx);
  const bout = { x: b.x * largeur, y: b.y * hauteur };
  const cote = (decalage) => ({ x: bout.x - l * Math.cos(angle + decalage), y: bout.y - l * Math.sin(angle + decalage) });
  return [cote(Math.PI / 7), bout, cote(-Math.PI / 7)];
}

/** Dessin « assez grand pour compter » (un simple toucher ne crée rien). */
export function dessinValide(forme, largeur, hauteur) {
  if (forme.type === 'trait') return forme.points.length >= 2;
  return Math.hypot((forme.b.x - forme.a.x) * largeur, (forme.b.y - forme.a.y) * hauteur) >= 6;
}

/** Épaisseur du trait (pixels) pour une photo de cette taille : environ 0,6 % du grand côté, au moins 3 px. */
export function epaisseurTrait(largeur, hauteur) {
  return Math.max(3, Math.round(Math.max(largeur, hauteur) * 0.006));
}

/** Dessine les formes sur un canevas (contexte 2D) de la taille de la photo. */
export function dessinerFormes(ctx, formes, largeur, hauteur) {
  const epaisseur = epaisseurTrait(largeur, hauteur);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = epaisseur;
  for (const forme of formes ?? []) {
    ctx.strokeStyle = forme.couleur;
    ctx.fillStyle = forme.couleur;
    // Un fin liseré sombre, pour que le blanc et le jaune se voient aussi sur une photo claire.
    const tracer = (chemin) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = epaisseur + 2;
      chemin();
      ctx.stroke();
      ctx.restore();
      chemin();
      ctx.stroke();
    };
    if (forme.type === 'cercle') {
      const r = rayonCercle(forme.a, forme.b, largeur, hauteur);
      tracer(() => {
        ctx.beginPath();
        ctx.arc(forme.a.x * largeur, forme.a.y * hauteur, r, 0, Math.PI * 2);
      });
    } else if (forme.type === 'fleche') {
      const pointe = pointeFleche(forme.a, forme.b, largeur, hauteur, epaisseur * 5);
      if (!pointe) continue;
      tracer(() => {
        ctx.beginPath();
        ctx.moveTo(forme.a.x * largeur, forme.a.y * hauteur);
        ctx.lineTo(pointe[1].x, pointe[1].y);
        ctx.moveTo(pointe[0].x, pointe[0].y);
        ctx.lineTo(pointe[1].x, pointe[1].y);
        ctx.lineTo(pointe[2].x, pointe[2].y);
      });
    } else if (forme.type === 'trait' && forme.points.length >= 2) {
      tracer(() => {
        ctx.beginPath();
        forme.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * largeur, p.y * hauteur) : ctx.lineTo(p.x * largeur, p.y * hauteur)));
      });
    }
  }
  ctx.restore();
}

function chargerImage(source) {
  return new Promise((resoudre, rejeter) => {
    const image = new Image();
    image.onload = () => resoudre(image);
    image.onerror = () => rejeter(new Error('photo illisible'));
    image.src = source;
  });
}

/**
 * La photo avec ses dessins incrustés (JPEG, texte data:), pour l'écran et le PDF. Sans dessin :
 * l'image d'origine, sans rien refaire.
 */
export async function imageAvecDessins(photo) {
  if (!photo?.dessins?.length) return photo?.image ?? null;
  const image = await chargerImage(photo.image);
  const canevas = document.createElement('canvas');
  canevas.width = image.naturalWidth;
  canevas.height = image.naturalHeight;
  const ctx = canevas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  dessinerFormes(ctx, photo.dessins, canevas.width, canevas.height);
  return canevas.toDataURL('image/jpeg', 0.85);
}

/** Pour le PDF : les photos de la liste, celles qui ont des dessins avec leurs dessins incrustés. */
export async function photosAvecDessins(photos) {
  return Promise.all(photos.map(async (photo) => {
    if (!photo.dessins?.length) return photo;
    try {
      return { ...photo, image: await imageAvecDessins(photo) };
    } catch {
      return photo; // photo illisible : on garde l'image d'origine
    }
  }));
}

/**
 * Écran de dessin plein écran sur une photo. Renvoie la nouvelle liste de dessins (même vide) après
 * « Valider », ou null après « Fermer ». depart : dessins déjà faits.
 */
export function ouvrirEditeurDessin(photo, depart = []) {
  return new Promise((resoudre) => {
    const formes = (depart ?? []).map((f) => JSON.parse(JSON.stringify(f)));
    let outil = 'cercle';
    let couleur = COULEURS_DESSIN[0][1];
    let enCours = null;
    const fenetre = document.createElement('dialog');
    fenetre.className = 'fenetre-dessin-photo';
    fenetre.innerHTML = `
      <div class="barre-dessin-photo">
        <div class="groupe-dessin-photo" role="group" aria-label="Outil">
          <button type="button" class="outil-dessin actif" data-outil="cercle" title="Cercle"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /></svg>Cercle</button>
          <button type="button" class="outil-dessin" data-outil="fleche" title="Flèche"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 19 5M10 5h9v9" /></svg>Flèche</button>
          <button type="button" class="outil-dessin" data-outil="trait" title="Trait libre"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16c3-8 6 4 9-4s5-3 7-4" /></svg>Trait</button>
        </div>
        <div class="groupe-dessin-photo" role="group" aria-label="Couleur">
          ${COULEURS_DESSIN.map(([nom, hex], i) => `<button type="button" class="couleur-dessin ${i === 0 ? 'actif' : ''}" data-couleur="${hex}" style="background:${hex}" title="${nom}" aria-label="${nom}"></button>`).join('')}
        </div>
      </div>
      <div class="zone-dessin-photo"><canvas></canvas></div>
      <div class="barre-dessin-photo">
        <button type="button" class="bouton-secondaire" data-action="effacer-dernier">↶ Effacer le dernier</button>
        <button type="button" class="bouton-secondaire" data-action="tout-effacer">Tout effacer</button>
        <span class="espace-dessin-photo"></span>
        <button type="button" class="bouton-secondaire" data-action="fermer">Fermer</button>
        <button type="button" class="bouton" data-action="valider">Valider</button>
      </div>`;
    const canevas = fenetre.querySelector('canvas');
    const ctx = canevas.getContext('2d');
    const image = new Image();
    // Affichage : la photo à la taille de l'écran ; les positions sont entre 0 et 1 (voir plus haut).
    const redessiner = () => {
      if (!image.naturalWidth) return;
      ctx.clearRect(0, 0, canevas.width, canevas.height);
      ctx.drawImage(image, 0, 0, canevas.width, canevas.height);
      dessinerFormes(ctx, enCours ? [...formes, enCours] : formes, canevas.width, canevas.height);
    };
    const ajuster = () => {
      const zone = fenetre.querySelector('.zone-dessin-photo');
      const max = { l: zone.clientWidth, h: zone.clientHeight };
      if (!image.naturalWidth || max.l === 0 || max.h === 0) return;
      const facteur = Math.min(max.l / image.naturalWidth, max.h / image.naturalHeight);
      // Résolution réelle de la photo, affichée réduite : les traits gardent la même allure à l'écran et dans le PDF.
      canevas.width = image.naturalWidth;
      canevas.height = image.naturalHeight;
      canevas.style.width = `${Math.round(image.naturalWidth * facteur)}px`;
      canevas.style.height = `${Math.round(image.naturalHeight * facteur)}px`;
      redessiner();
    };
    image.onload = ajuster;
    image.src = photo.image;
    const position = (evenement) => {
      const cadre = canevas.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (evenement.clientX - cadre.left) / cadre.width)),
        y: Math.min(1, Math.max(0, (evenement.clientY - cadre.top) / cadre.height)),
      };
    };
    canevas.addEventListener('pointerdown', (evenement) => {
      canevas.setPointerCapture(evenement.pointerId);
      const p = position(evenement);
      enCours = outil === 'trait' ? { type: 'trait', couleur, points: [p] } : { type: outil, couleur, a: p, b: p };
      redessiner();
    });
    canevas.addEventListener('pointermove', (evenement) => {
      if (!enCours) return;
      const p = position(evenement);
      if (enCours.type === 'trait') enCours.points.push(p);
      else enCours.b = p;
      redessiner();
    });
    const finir = () => {
      if (!enCours) return;
      if (dessinValide(enCours, canevas.width, canevas.height)) formes.push(enCours);
      enCours = null;
      redessiner();
    };
    canevas.addEventListener('pointerup', finir);
    canevas.addEventListener('pointercancel', () => {
      enCours = null;
      redessiner();
    });
    fenetre.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button');
      if (!bouton) return;
      if (bouton.dataset.outil) {
        outil = bouton.dataset.outil;
        fenetre.querySelectorAll('.outil-dessin').forEach((b) => b.classList.toggle('actif', b === bouton));
      } else if (bouton.dataset.couleur) {
        couleur = bouton.dataset.couleur;
        fenetre.querySelectorAll('.couleur-dessin').forEach((b) => b.classList.toggle('actif', b === bouton));
      } else if (bouton.dataset.action === 'effacer-dernier') {
        formes.pop();
        redessiner();
      } else if (bouton.dataset.action === 'tout-effacer') {
        formes.length = 0;
        redessiner();
      } else if (bouton.dataset.action === 'valider') {
        fenetre.close();
        resoudre(formes);
      } else if (bouton.dataset.action === 'fermer') {
        fenetre.close();
        resoudre(null);
      }
    });
    fenetre.addEventListener('cancel', (evenement) => {
      evenement.preventDefault();
      fenetre.close();
      resoudre(null);
    });
    window.addEventListener('resize', ajuster);
    fenetre.addEventListener('close', () => {
      window.removeEventListener('resize', ajuster);
      fenetre.remove();
    });
    document.body.append(fenetre);
    fenetre.showModal();
    ajuster();
  });
}
