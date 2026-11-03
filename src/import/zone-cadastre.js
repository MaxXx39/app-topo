// Cadastre autour d'un point (0.112.0, Projet › Import, mode Expert) : on touche le plan (un point),
// on donne un rayon en mètres, « Valider » : l'appli demande au service du canton les points
// limites et les parcelles dans le cercle, puis crée une liste de points « Cadastre N » (points
// CAD-n, sans altitude) et un plan DXF « Cadastre N » (les limites, pour l'accroche Sommet / Milieu /
// Sur ligne). Calculs : topo/cadastre.js ; téléchargement : import/cadastre.js.
import { echapper } from '../outils/echapper.js';
import { telechargerCadastre } from './cadastre.js';
import { lirePlanDxf } from '../topo/dxf-plan.js';
import { garderDansLeCercle, pointsDuCadastre, dxfDuCadastre, nomDeLaListe, lireRayon, RAYON_DEPART, RAYON_MIN, RAYON_MAX } from '../topo/cadastre.js';

/**
 * outils : { plan, cadre, afficherMessage(texte, duree), allerAuPlan(), avantDeCommencer(),
 * nomsPris() (noms des listes de points), ajouterCadastre({ nom, points, planDxf }), chercher }.
 * Renvoie { commencer(), arreter(), changerZone(sommets), actif() }.
 */
export function creerCadastreAutour(outils) {
  let centre = null; // { est, nord } touché
  let actif = false;
  let occupe = false;
  let rayonTape = String(RAYON_DEPART);
  let barre = null;

  function dessinerBarre() {
    if (!barre) {
      barre = document.createElement('div');
      barre.className = 'barre-pointage barre-swisstopo';
      barre.addEventListener('click', (evenement) => {
        const action = evenement.target.closest('button[data-action]')?.dataset.action;
        if (action === 'fermer') arreter();
        else if (action === 'valider') valider();
      });
      barre.addEventListener('input', (evenement) => {
        if (evenement.target.matches('[data-champ="rayon"]')) rayonTape = evenement.target.value;
      });
      outils.cadre.append(barre);
    }
    barre.innerHTML = `<div class="ligne-barre-pointage">
        <span class="titre-pointage">Cadastre autour d'un point</span>
        <button type="button" class="bouton-lien" data-action="fermer" ${occupe ? 'disabled' : ''}>fermer</button>
      </div>
      <div class="ligne-barre-pointage">
        <label>Rayon (m) <input type="text" inputmode="decimal" data-champ="rayon" value="${echapper(rayonTape)}" size="4" ${occupe ? 'disabled' : ''} /></label>
        <button type="button" class="bouton" data-action="valider" ${!centre || occupe ? 'disabled' : ''}>${occupe ? 'Patiente…' : 'Valider'}</button>
      </div>
      ${centre ? '' : `<p class="aide-pointage">${echapper('Touche le plan')}</p>`}`;
  }

  function commencer() {
    outils.avantDeCommencer?.();
    centre = null;
    actif = true;
    occupe = false;
    outils.plan.tracerZone({ sommets: [] });
    dessinerBarre();
    outils.allerAuPlan?.();
  }

  function arreter() {
    actif = false;
    centre = null;
    occupe = false;
    barre?.remove();
    barre = null;
    outils.plan.tracerZone(null);
  }

  /** Point touché ou glissé sur le plan : seul le dernier compte. */
  function changerZone(sommets) {
    if (!actif || occupe || sommets.length === 0) return;
    centre = { est: sommets[sommets.length - 1].est, nord: sommets[sommets.length - 1].nord };
    if (sommets.length > 1) outils.plan.tracerZone({ sommets: [centre] });
    dessinerBarre();
  }

  async function valider() {
    const rayon = lireRayon(rayonTape);
    if (rayon === null) {
      outils.afficherMessage(`Cadastre : rayon de ${RAYON_MIN} à ${RAYON_MAX} m`, 6000);
      return;
    }
    occupe = true;
    dessinerBarre();
    try {
      const recu = await telechargerCadastre(centre, rayon, 'VD', (texte) => outils.afficherMessage(texte, null), outils.chercher);
      const dedans = garderDansLeCercle(recu, centre, rayon);
      const points = pointsDuCadastre(dedans);
      if (points.length === 0) throw new Error('aucun point limite dans ce cercle (le service ne couvre peut-être pas cet endroit)');
      const nom = nomDeLaListe(outils.nomsPris());
      const { plan: planDxf } = dedans.lignes.length > 0 ? lirePlanDxf(dxfDuCadastre(dedans.lignes), nom) : {};
      arreter();
      outils.ajouterCadastre({ nom, points, planDxf: planDxf ?? null });
      outils.afficherMessage(`${nom} : ${points.length} point(s) limite(s), ${dedans.lignes.length} ligne(s)`, 6000);
    } catch (erreur) {
      occupe = false;
      if (actif) dessinerBarre();
      outils.afficherMessage(`Cadastre : ${erreur.message}`, 12000);
    }
  }

  return { commencer, arreter, changerZone, actif: () => actif };
}
