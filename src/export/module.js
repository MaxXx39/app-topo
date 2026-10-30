// Bloc « Exporter » de l'onglet Projet (0.92.1, demande du 29.10.2026 : tous les exports au même
// endroit, sous Import et les listes). En trois temps :
// 1. Quoi ? : plan et volumes, mesures / métrés, listes de points, contrôles, implantations, plans
//    DXF recalés, fichier projet (chacun selon le mode, voir SORTES) ;
// 2. le format et ses réglages (PDF, DXF, CSV, LandXML, TXT…) ;
// 3. la fenêtre « Exporter » : Enregistrer, Envoyer par mail ou autrement (voir fenetre-export.js).
// « Plan et volumes » et « Mesures » gardent leurs formulaires (export/ecran.js, export/ecran-mesures.js),
// posés dans les zones data-panneau="plan" et "mesures" ; les autres parties sont dessinées ici.
import { echapper } from '../outils/echapper.js';
import { titreSection } from '../outils/section.js';
import { bulle } from '../aide/bulles.js';
import { aAcces } from '../reglages/reglages.js';

// [clé, titre, mode minimum (classe seulement-…), ou '' pour tous les modes].
const SORTES = [
  ['plan', 'Plan et volumes', 'intermediaire'],
  ['mesures', 'Mesures / métrés', 'intermediaire'],
  ['listes', 'Listes de points', 'intermediaire'],
  ['controles', 'Contrôles', ''],
  ['implantations', 'Implantations', 'expert'],
  ['dxf', 'Plans DXF recalés', 'expert'],
  ['projet', 'Fichier projet', 'expert'],
];

/**
 * Crée le bloc dans "conteneur". actions : exporterListe(type, id), exporterControles(format),
 * exporterImplantations(), exporterPlanRecale(id), exporterProjet().
 * Renvoie { zone(cle) (zone d'une partie, pour y poser un formulaire), afficher(projet) }.
 */
export function creerModuleExport(conteneur, actions) {
  // Au départ : « Plan et volumes » (Intermédiaire et Expert), « Contrôles » en Base.
  let sorte = aAcces('intermediaire') ? 'plan' : 'controles';
  let derniers = null;
  conteneur.innerHTML = `
    <details class="carte-section bloc-repliable module-export" data-bloc="export">
      <summary>${titreSection('exporter', 'Exporter', bulle('exporterProjet'))}</summary>
      <p class="titre-choix">1. Quoi ?</p>
      <div class="choix-sorte-export" role="group" aria-label="Quoi exporter">
        ${SORTES.map(([cle, titre, niveau]) => `<button type="button" class="puce-choix ${niveau ? `seulement-${niveau}` : ''}" data-sorte="${cle}">${titre}</button>`).join('')}
      </div>
      <p class="titre-choix">2. Format</p>
      ${SORTES.map(([cle]) => `<div class="panneau-export" data-panneau="${cle}" hidden></div>`).join('')}
    </details>`;
  const panneau = (cle) => conteneur.querySelector(`[data-panneau="${cle}"]`);

  conteneur.addEventListener('click', (evenement) => {
    const choix = evenement.target.closest('button[data-sorte]');
    if (choix) {
      sorte = choix.dataset.sorte;
      montrerSorte();
      return;
    }
    const bouton = evenement.target.closest('[data-panneau] button[data-export]');
    if (!bouton) return;
    const { export: quoi, type, id, format } = bouton.dataset;
    if (quoi === 'liste') actions.exporterListe(type, id);
    else if (quoi === 'controles') actions.exporterControles(format);
    else if (quoi === 'implantations') actions.exporterImplantations();
    else if (quoi === 'dxf') actions.exporterPlanRecale(id);
    else if (quoi === 'projet') actions.exporterProjet();
  });

  /** Montre la partie choisie (bouton allumé, sa zone visible) ; une partie d'un mode plus haut → Contrôles. */
  function montrerSorte() {
    const niveau = SORTES.find(([cle]) => cle === sorte)?.[2];
    if (niveau && !aAcces(niveau)) sorte = 'controles';
    for (const bouton of conteneur.querySelectorAll('button[data-sorte]')) bouton.classList.toggle('actif', bouton.dataset.sorte === sorte);
    for (const zone of conteneur.querySelectorAll('[data-panneau]')) zone.hidden = zone.dataset.panneau !== sorte;
  }

  /** Bouton d'export (data-export et ses précisions). */
  const bouton = (texte, attributs) => `<button type="button" class="bouton-secondaire" ${attributs}>${texte}</button>`;

  function afficher(projet) {
    derniers = projet;
    // Listes de points : fichiers importés, levés, points ajoutés, dessins, points de contrôle.
    const lignes = [
      ...projet.leves.filter((l) => l.points.length > 0).map((l) => [l.nom, `${l.points.length} points`, `data-export="liste" data-type="leve" data-id="${l.id}"`]),
      ...projet.dessins.filter((d) => d.sommets.length > 0).map((d) => [d.nom, 'dessin', `data-export="liste" data-type="dessin" data-id="${d.id}"`]),
      ...(projet.pointsControle.length > 0 ? [['Points de contrôle', `${projet.pointsControle.length} points`, 'data-export="liste" data-type="controle" data-id=""']] : []),
    ];
    panneau('listes').innerHTML = lignes.length > 0
      ? `<div class="lignes-export">${lignes.map(([nom, detail, attributs]) => `<div class="ligne-export"><span><strong>${echapper(nom)}</strong> <span class="aide">${echapper(detail)}</span></span>${bouton('TXT · CSV · DXF', attributs)}</div>`).join('')}</div>`
      : '<p class="vide">Aucune liste de points.</p>';
    const nbControles = projet.controles.length;
    panneau('controles').innerHTML = nbControles > 0
      ? `<p class="aide">${nbControles} contrôle(s) et refus notés dans le projet</p>
        <div class="ligne-outils">${bouton('CSV', 'data-export="controles" data-format="csv"')}${bouton('PDF', 'data-export="controles" data-format="pdf"')}</div>`
      : '<p class="vide">Aucun contrôle dans ce projet.</p>';
    const nbImplantations = projet.implantations.length;
    panneau('implantations').innerHTML = nbImplantations > 0
      ? `<p class="aide">${nbImplantations} implantation(s) enregistrée(s)</p><div class="ligne-outils">${bouton('CSV', 'data-export="implantations"')}</div>`
      : '<p class="vide">Aucune implantation enregistrée.</p>';
    const recales = (projet.plansDxf ?? []).filter((p) => p.recalage?.applique);
    panneau('dxf').innerHTML = recales.length > 0
      ? `<div class="lignes-export">${recales.map((p) => `<div class="ligne-export"><span><strong>${echapper(p.nom)}</strong> <span class="aide">recalé en MN95</span></span>${bouton('DXF', `data-export="dxf" data-id="${p.id}"`)}</div>`).join('')}</div>`
      : '<p class="vide">Aucun plan DXF recalé.</p>';
    panneau('projet').innerHTML = `<p class="aide">tout le projet, pour l'ouvrir sur un autre appareil sans Drive</p>
      <div class="ligne-outils">${bouton('Fichier projet (.topo.json)', 'data-export="projet"')}</div>`;
    montrerSorte();
  }

  montrerSorte();
  return {
    zone: panneau,
    afficher,
    /** Redessine avec le dernier projet (après un changement de mode). */
    rafraichir: () => derniers && afficher(derniers),
  };
}
