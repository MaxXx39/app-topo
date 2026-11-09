// Surface Swisstopo (0.109.0, Projet › Import, mode Expert) : on trace la zone sur le plan (un
// toucher = un sommet, on glisse un sommet pour le déplacer), « Valider », l'appli télécharge
// swissALTI3D (0,5 m), montre le nombre de points de chaque choix (grille 0,5 / 1 / 2 / 5 m ou
// « Intelligent » 5 / 10 / 20 cm), puis crée la surface « SWISSTOP … » (rangée avec les surfaces
// importées). Calculs : topo/swisstopo.js ; téléchargement : import/swisstopo.js.
import { echapper } from '../outils/echapper.js';
import { demanderChoix, demanderTexte } from '../outils/choix.js';
import { telechargerAltitudes } from './swisstopo.js';
import {
  erreurDuContour, grilleDeLaZone, nombreEnGrille, nombreIntelligent, pointsDuChoix, surfaceSwisstopo,
  PAS_GRILLE, TOLERANCES, POINTS_LOURDS, PREFIXE_SWISSTOP,
} from '../topo/swisstopo.js';
import { sansPrefixe } from '../topo/surface.js';

/**
 * outils : { plan, cadre (cadre du plan, pour la barre), afficherMessage(texte, duree),
 * allerAuPlan(), avantDeCommencer() (arrête les autres tracés), nomsPris() (noms des surfaces),
 * ajouterSurface(surface), chercher (fetch, facultatif) }.
 * Renvoie { commencer(), arreter(), changerZone(sommets), actif() }.
 */
export function creerSurfaceSwisstopo(outils) {
  let sommets = null; // null : pas de tracé en cours
  let occupe = false; // téléchargement / calcul en cours
  let barre = null;

  function dessinerBarre() {
    if (!barre) {
      barre = document.createElement('div');
      barre.className = 'barre-pointage barre-swisstopo';
      barre.addEventListener('click', (evenement) => {
        const action = evenement.target.closest('button[data-action]')?.dataset.action;
        if (action === 'fermer') arreter();
        else if (action === 'enlever') {
          sommets.pop();
          outils.plan.tracerZone({ sommets });
          dessinerBarre();
        } else if (action === 'valider') valider();
      });
      outils.cadre.append(barre);
    }
    barre.innerHTML = `<div class="ligne-barre-pointage">
        <span class="titre-pointage">Surface Swisstopo</span>
        <button type="button" class="bouton-lien" data-action="fermer" ${occupe ? 'disabled' : ''}>fermer</button>
      </div>
      <div class="ligne-barre-pointage">
        <span>${sommets.length} sommet(s)</span>
        <button type="button" class="bouton-secondaire" data-action="enlever" ${sommets.length === 0 || occupe ? 'disabled' : ''}>Enlever le dernier</button>
        <button type="button" class="bouton" data-action="valider" ${sommets.length < 3 || occupe ? 'disabled' : ''}>${occupe ? 'Patiente…' : 'Valider'}</button>
      </div>
      ${sommets.length === 0 ? `<p class="aide-pointage">${echapper('Touche le plan')}</p>` : ''}`;
  }

  function commencer() {
    outils.avantDeCommencer?.();
    sommets = [];
    occupe = false;
    outils.plan.tracerZone({ sommets });
    dessinerBarre();
    outils.allerAuPlan?.();
  }

  function arreter() {
    sommets = null;
    occupe = false;
    barre?.remove();
    barre = null;
    outils.plan.tracerZone(null);
  }

  /** Sommet ajouté ou glissé sur le plan. */
  function changerZone(nouveaux) {
    if (!sommets || occupe) return;
    sommets = nouveaux;
    dessinerBarre();
  }

  /** Laisse l'écran se redessiner (message) avant un long calcul. */
  const souffler = () => new Promise((resoudre) => setTimeout(resoudre, 30));

  async function valider() {
    const erreur = erreurDuContour(sommets);
    if (erreur) {
      outils.afficherMessage(`Surface Swisstopo : ${erreur}`, 6000);
      return;
    }
    occupe = true;
    dessinerBarre();
    const zone = sommets.map((s) => ({ est: s.est, nord: s.nord }));
    try {
      const { rasters, fichiers } = await telechargerAltitudes(zone, (texte) => outils.afficherMessage(texte, null), outils.chercher);
      outils.afficherMessage('Calcul des points…', null);
      await souffler();
      const grille = grilleDeLaZone(zone, rasters);
      if (grille.valides < 3) throw new Error('aucune altitude swissALTI3D dans la zone');
      const choix = [];
      for (const pas of PAS_GRILLE) choix.push({ cle: `g${pas}`, sorte: 'grille', pas, texte: `Grille ${String(pas).replace('.', ',')} m`, nombre: nombreEnGrille(grille, pas) });
      for (const tolerance of TOLERANCES) {
        outils.afficherMessage(`Calcul « Intelligent » ${Math.round(tolerance * 100)} cm…`, null);
        await souffler();
        choix.push({ cle: `i${tolerance}`, sorte: 'intelligent', tolerance, texte: `Intelligent ${Math.round(tolerance * 100)} cm`, nombre: nombreIntelligent(grille, tolerance) });
      }
      outils.afficherMessage('', 1);
      const annees = [...new Set(fichiers.map((f) => f.annee))].sort().join(', ');
      const cle = await demanderChoix({
        titre: 'Surface Swisstopo',
        texte: `swissALTI3D ${annees} · ${fichiers.length} carré(s) de 1 km`,
        boutons: [
          ...choix.map((c, n) => ({
            cle: c.cle,
            texte: c.texte,
            detail: `${c.nombre.toLocaleString('fr-CH')} points${c.nombre > POINTS_LOURDS ? ' · lourd (plan et calculs lents)' : ''}`,
            principal: n === 0,
          })),
          { cle: 'annuler', texte: 'Ne rien créer' },
        ],
      });
      const choisi = choix.find((c) => c.cle === cle);
      if (!choisi) {
        occupe = false;
        dessinerBarre();
        return;
      }
      const propose = prochainNom(outils.nomsPris());
      const tape = await demanderTexte({ titre: 'Nom de la surface', valeur: propose, prefixe: PREFIXE_SWISSTOP });
      if (tape === null) {
        occupe = false;
        dessinerBarre();
        return;
      }
      const suite = sansPrefixe(tape, PREFIXE_SWISSTOP.trim());
      outils.afficherMessage('Création de la surface…', null);
      await souffler();
      const points = pointsDuChoix(grille, choisi);
      const surface = surfaceSwisstopo(suite || sansPrefixe(propose, PREFIXE_SWISSTOP.trim()), points, zone, `${annees}, ${choisi.texte}`);
      arreter();
      outils.ajouterSurface(surface);
      outils.afficherMessage(`${surface.nom} créée : ${points.length.toLocaleString('fr-CH')} points, ${surface.faces.length.toLocaleString('fr-CH')} triangles`, 5000);
    } catch (erreur) {
      occupe = false;
      if (sommets) dessinerBarre();
      outils.afficherMessage(`Surface Swisstopo : ${erreur.message}`, 8000);
    }
  }

  return { commencer, arreter, changerZone, actif: () => sommets !== null };
}

/** Nom proposé (0.176.0) : « SWISSTOP MNT3D », puis « SWISSTOP MNT3D 2 », 3… s'il est déjà pris. */
export function prochainNom(noms) {
  const pris = new Set(noms.map((n) => String(n).toUpperCase()));
  let nom = `${PREFIXE_SWISSTOP}MNT3D`;
  for (let numero = 2; pris.has(nom); numero++) nom = `${PREFIXE_SWISSTOP}MNT3D ${numero}`;
  return nom;
}
