// Barre du contrôle d'un plan (0.218.0), posée en bas du plan comme celle du recalage. Deux étapes écrites :
// 1. touche un point du plan (accroche sur ce plan) ; 2. touche le point connu qui lui correspond (levé, contrôle…).
// Puis le résultat : écart en mm (vert ≤ 2 mm, orange ≤ 15 mm, rouge au-delà). Les calculs sont dans topo/controle-plan.js.
import { echapper } from '../outils/echapper.js';
import { formaterNombre } from '../topo/format.js';
import { texteEcartMm } from '../topo/controle-plan.js';

const ACCROCHES = [['sommet', 'Sommet'], ['milieu', 'Milieu'], ['ligne', 'Sur ligne'], ['croisement', 'Croisement'], ['centre', 'Centre']];

/**
 * Crée la barre dans "cadre" (le cadre du plan). actions : choisirAccroche(mode), reprendre() (reprendre le point du plan),
 * recommencer(), valider(), recaler(), plusTard(). Renvoie { afficher(etat), enlever() } ;
 * etat : { nomPlan, accroche, pointPlan ({ est, nord } ou null), resultat ({ connu, dEstMm, dNordMm, distanceMm, couleur } ou null) }.
 */
export function creerBarreControlePlan(cadre, actions) {
  const barre = document.createElement('div');
  barre.className = 'barre-pointage barre-recalage barre-controle-plan';
  cadre.append(barre);
  barre.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (bouton) actions[bouton.dataset.action]?.(bouton.dataset.valeur);
  });
  return {
    afficher(etat) {
      const entete = `<div class="ligne-barre-pointage">
          <span class="titre-pointage">Contrôler « ${echapper(etat.nomPlan)} »</span>
          <button type="button" class="bouton-lien" data-action="plusTard">plus tard</button>
        </div>`;
      if (etat.resultat) {
        const r = etat.resultat;
        const rouge = r.couleur === 'rouge';
        barre.innerHTML = `${entete}
          <div class="resultat-controle-plan ${r.couleur}">
            <strong>Écart ${texteEcartMm(r.distanceMm)}</strong>
            <span>sur ${echapper(r.connu || 'le point connu')} · ΔE ${r.dEstMm >= 0 ? '+' : ''}${r.dEstMm.toFixed(1)} mm · ΔN ${r.dNordMm >= 0 ? '+' : ''}${r.dNordMm.toFixed(1)} mm</span>
          </div>
          <div class="ligne-barre-pointage">
            <button type="button" class="${rouge ? 'bouton-secondaire' : 'bouton'}" data-action="valider">${rouge ? 'Garder quand même' : 'Valider le contrôle'}</button>
            ${rouge ? '<button type="button" class="bouton" data-action="recaler">Recaler le plan</button>' : ''}
            <button type="button" class="bouton-lien" data-action="recommencer">recommencer</button>
          </div>`;
        return;
      }
      if (!etat.pointPlan) {
        barre.innerHTML = `${entete}
          <p class="etape-recalage etape-dxf"><span class="numero-etape">Étape 1 / 2</span>Touche un point du plan (une croix le montre)</p>
          <div class="ligne-barre-pointage">
            ${ACCROCHES.map(([cle, titre]) => `<button type="button" class="puce-choix ${etat.accroche === cle ? 'actif' : ''}" data-action="choisirAccroche" data-valeur="${cle}">${titre}</button>`).join('')}
          </div>`;
        return;
      }
      barre.innerHTML = `${entete}
        <p class="etape-recalage etape-cale"><span class="numero-etape">Étape 2 / 2</span>Touche le point connu (levé ou de contrôle) qui correspond</p>
        <div class="choix-pointage">
          <span class="coordonnees-pointage">Point du plan : E ${formaterNombre(etat.pointPlan.est)} · N ${formaterNombre(etat.pointPlan.nord)}
            <button type="button" class="bouton-lien bouton-lien-neutre" data-action="reprendre">en toucher un autre</button></span>
        </div>`;
    },
    enlever() {
      barre.remove();
    },
  };
}
