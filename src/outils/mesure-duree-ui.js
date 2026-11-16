// Mesure de durée, côté écran (0.214.0, maquette 5 B du 12.11) : un appui long sur un bouton « Enreg. » ouvre le choix 5 / 15 / 30 s ;
// pendant la mesure, un anneau fait le décompte (« Annuler » arrête tout). En Contrôle, la mesure dure 5 s d'office.
// À la fin, le point moyen est rangé (pont.js) puis le bouton est touché de nouveau : l'appli le prend comme un point normal.
import { demarrerMesure, DUREES_MESURE } from '../topo/mesure-duree.js';
import { lirePointRecepteur, preparerPointMoyenne, pointMoyenPret, viderPointPrepare } from '../android/pont.js';

// Boutons qui prennent un point : ceux de l'écran (Lever, Implanter, Contrôle) et ceux de la bande du bas (+ Mesure rapide, Annotation).
const BOUTONS = [
  '#leve-direct .bouton-prendre',
  '#leve-direct [data-action="enregistrerImplantation"]',
  '[data-nav="action"][data-cle="prendre"]',
  '[data-nav="action"][data-cle="enregistrer"]',
  '[data-nav="action"][data-cle="mesure-gnss"]',
  '[data-nav="action"][data-cle="annotation-gnss"]',
].join(', ');
const DELAI_APPUI_LONG = 600; // ms

/** Montre la fenêtre de choix (5 / 15 / 30 s) ; renvoie une promesse : la durée choisie, ou null (annulé). */
function choisirDuree() {
  return new Promise((fin) => {
    const fond = document.createElement('div');
    fond.className = 'fond-mesure-duree';
    fond.innerHTML = `<div class="fenetre-mesure-duree" role="dialog" aria-label="Mesure de durée">
        <p class="titre-mesure-duree">Mesure de durée</p>
        <div class="boutons-duree">${DUREES_MESURE.map((d) => `<button type="button" class="bouton-duree" data-duree="${d}">${d} s</button>`).join('')}</div>
        <p class="aide-mesure-duree">La position est moyennée ; si le RTK fixe se perd, le point est refusé.</p>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-duree="0">Annuler</button>
      </div>`;
    // Seuls les boutons ferment la fenêtre (le doigt qui se relève après l'appui long tombe sur le fond : il ne doit rien fermer).
    fond.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('[data-duree]');
      if (!bouton) return;
      fond.remove();
      fin(Number(bouton.dataset.duree) || null);
    });
    document.body.append(fond);
  });
}

/** Valeur en m à 3 décimales, point décimal. */
const m3 = (v) => (v == null ? '–' : v.toFixed(3));

/**
 * Fenêtre de résultat (0.229.0) : moyenne, plus petite et plus grande lecture de E / N / H, écart (mm), précision la moins bonne.
 * Renvoie une promesse : 'valider', 'refaire' ou null (annulé).
 */
function montrerResultat(point) {
  const info = point.mesureDuree;
  const ligne = (nom, moy, lim) => `<tr><th>${nom}</th><td>${m3(moy)}</td><td>${m3(lim?.min)}</td><td>${m3(lim?.max)}</td><td>${lim ? Math.round((lim.max - lim.min) * 1000) : '–'}</td></tr>`;
  return new Promise((fin) => {
    const fond = document.createElement('div');
    fond.className = 'fond-mesure-duree';
    fond.innerHTML = `<div class="fenetre-mesure-duree resultat-mesure-duree" role="dialog" aria-label="Résultat de la mesure">
        <p class="titre-mesure-duree">Mesure de ${info.dureeS} s · ${info.lectures} lectures</p>
        <table class="tableau-mesure-duree">
          <thead><tr><th></th><th>Moyenne</th><th>Mini</th><th>Maxi</th><th>Écart (mm)</th></tr></thead>
          <tbody>${ligne('E', point.est, info.limites.est)}${ligne('N', point.nord, info.limites.nord)}${ligne('H', point.altitude, info.limites.altitude)}</tbody>
        </table>
        <p class="aide-mesure-duree">Écart max au plan : ${Math.round(info.ecartMaxPlan * 1000)} mm${point.precisionH != null ? ` · Préc. H ${m3(point.precisionH)}` : ''}${point.precisionV != null ? ` · V ${m3(point.precisionV)}` : ''}</p>
        <div class="boutons-duree">
          <button type="button" class="bouton" data-fin="valider">Valider</button>
          <button type="button" class="bouton-secondaire" data-fin="refaire">Refaire</button>
        </div>
        <button type="button" class="bouton-lien bouton-lien-neutre" data-fin="annuler">Annuler</button>
      </div>`;
    fond.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('[data-fin]');
      if (!bouton) return;
      fond.remove();
      fin(bouton.dataset.fin === 'annuler' ? null : bouton.dataset.fin);
    });
    document.body.append(fond);
  });
}

/** Montre le décompte pendant la mesure ; renvoie { maj(restant), fermer() }. */
function montrerDecompte(dureeS, annuler) {
  const fond = document.createElement('div');
  fond.className = 'fond-mesure-duree';
  fond.innerHTML = `<div class="fenetre-mesure-duree decompte-mesure-duree" role="status">
      <div class="anneau-mesure-duree"><b data-vivant="restant">${dureeS}</b></div>
      <div><p class="titre-mesure-duree">Mesure de ${dureeS} s</p><p class="aide-mesure-duree">Ne bouge pas la canne.</p></div>
      <button type="button" class="bouton-secondaire" data-action="annuler-mesure-duree">Annuler</button>
    </div>`;
  fond.querySelector('[data-action="annuler-mesure-duree"]').addEventListener('click', annuler);
  document.body.append(fond);
  const anneau = fond.querySelector('.anneau-mesure-duree');
  return {
    maj(restant) {
      fond.querySelector('[data-vivant="restant"]').textContent = String(restant);
      anneau.style.setProperty('--avancement', `${Math.round(((dureeS - restant) / dureeS) * 360)}deg`);
    },
    fermer: () => fond.remove(),
  };
}

/**
 * Branche la mesure de durée. options : { disponible() (vrai dans l'APK avec un récepteur), dureeParDefaut(bouton) (secondes ; 0 = mesure normale),
 * refuser(texte) (message de refus, comme un point refusé) }.
 */
export function installerMesureDuree({ disponible, dureeParDefaut = () => 0, refuser }) {
  let enCours = false;

  function lancer(bouton, dureeS, avecResultat = false) {
    enCours = true;
    let ecran = null;
    const mesure = demarrerMesure({
      dureeS,
      prendre: lirePointRecepteur,
      quandTic: (restant) => ecran?.maj(restant),
      quandFin: (resultat) => {
        ecran?.fermer();
        enCours = false;
        if (resultat.annule) return;
        if (!resultat.ok) {
          refuser?.(`Mesure refusée : ${resultat.raison}`);
          return;
        }
        // Le bouton est touché de nouveau : l'appli prend le point moyen comme un point normal.
        const prendre = () => {
          preparerPointMoyenne(resultat.point);
          bouton.click();
          viderPointPrepare();
        };
        if (!avecResultat) {
          prendre();
          return;
        }
        // 0.229.0 : appui long (dès Intermédiaire) : on montre le résultat avant de valider.
        montrerResultat(resultat.point).then((choix) => {
          if (choix === 'valider') prendre();
          else if (choix === 'refaire') lancer(bouton, dureeS, true);
        });
      },
    });
    if (enCours) ecran = montrerDecompte(dureeS, () => mesure.annuler());
    ecran?.maj(dureeS);
  }

  // Appui long : le choix de durée.
  let minuterie = null;
  const arreter = () => {
    clearTimeout(minuterie);
    minuterie = null;
  };
  document.addEventListener('pointerdown', (evenement) => {
    const bouton = evenement.target.closest?.(BOUTONS);
    if (!bouton || bouton.disabled || enCours || !disponible()) return;
    arreter();
    minuterie = setTimeout(async () => {
      minuterie = null;
      const duree = await choisirDuree();
      if (duree) lancer(bouton, duree, true);
    }, DELAI_APPUI_LONG);
  }, true);
  for (const nom of ['pointerup', 'pointercancel', 'pointerleave']) document.addEventListener(nom, arreter, true);

  // Clic : en Contrôle, la mesure de 5 s est lancée d'office.
  document.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest?.(BOUTONS);
    if (!bouton) return;
    if (pointMoyenPret() || bouton.disabled || enCours || !disponible()) return;
    const duree = dureeParDefaut(bouton);
    if (!duree) return;
    evenement.stopImmediatePropagation();
    evenement.preventDefault();
    lancer(bouton, duree, true); // 0.233 : en Contrôle aussi, on montre le récapitulatif de la mesure avant de valider
  }, true);
}
