// Panneau « Exporter » de l'onglet Projet (0.92.1, demande du 29.10.2026 : tous les exports au même
// endroit ; depuis 0.103.0, onglet à côté de « Import », voir main.js montrerOngletProjet). En trois temps :
// 1. Quoi ? : plan et volumes, mesures / métrés, listes de points, contrôles, implantations, plans
//    DXF recalés, fichier projet (chacun selon le mode, voir SORTES) ;
// 2. le format et ses réglages (PDF, DXF, CSV, LandXML, TXT…) ;
// 3. la fenêtre « Exporter » : Enregistrer, Envoyer par mail ou autrement (voir fenetre-export.js).
// « Plan et volumes » et « Mesures » gardent leurs formulaires (export/ecran.js, export/ecran-mesures.js),
// posés dans les zones data-panneau="plan" et "mesures" ; les autres parties sont dessinées ici.
import { echapper } from '../outils/echapper.js';
import { bulle } from '../aide/bulles.js';
import { aAcces } from '../reglages/reglages.js';

// [clé, titre, mode minimum (classe seulement-…), ou '' pour tous les modes].
// 0.146.0 : Plan, Points et Contrôles en grosses tuiles ; le reste derrière « Autres ▾ ».
const PRINCIPALES = { plan: 'levés, volumes', listes: 'listes', controles: 'écarts' };
const SORTES = [
  ['plan', 'Plan et volumes', 'intermediaire'],
  ['listes', 'Listes de points', 'intermediaire'],
  ['reseaux', 'Réseaux (recollement)', 'intermediaire'],
  ['controles', 'Contrôles', ''],
  ['implantations', 'Implantations', 'expert'],
  ['dxf', 'Plans DXF recalés', 'expert'],
  ['paquet', 'Cadastre · Swisstopo · photo', 'expert'],
  ['projet', 'Fichier projet', 'expert'],
];

/**
 * Crée le bloc dans "conteneur". actions : exporterListe(type, id), exporterControles(format), exporterReseaux(format),
 * exporterImplantations(), exporterPlanRecale(id), exporterProjet().
 * Renvoie { zone(cle) (zone d'une partie, pour y poser un formulaire), afficher(projet) }.
 */
export function creerModuleExport(conteneur, actions) {
  // Au départ : « Plan et volumes » (Intermédiaire et Expert), « Contrôles » en Base.
  let sorte = aAcces('intermediaire') ? 'plan' : 'controles';
  let derniers = null;
  let autresOuverts = false;
  conteneur.innerHTML = `
    <div class="carte-section panneau-onglet-projet module-export">
      <p class="titre-panneau-projet">Exporter ${bulle('exporterProjet')}</p>
      <p class="titre-choix titre-etape">Quoi ?</p>
      <div class="tuiles-export" role="group" aria-label="Quoi exporter">
        ${SORTES.filter(([cle]) => PRINCIPALES[cle]).map(([cle, titre, niveau]) => `<button type="button" class="tuile-export ${niveau ? `seulement-${niveau}` : ''}" data-sorte="${cle}"><strong>${cle === 'listes' ? 'Points' : cle === 'plan' ? 'Plan' : titre}</strong><small>${PRINCIPALES[cle]}</small></button>`).join('')}
        <button type="button" class="tuile-export" data-action="autres" aria-expanded="false"><strong>Autres ▾</strong><small>mesures, réseaux…</small></button>
      </div>
      <div class="choix-sorte-export autres-export" role="group" aria-label="Autres exports" hidden>
        ${SORTES.filter(([cle]) => !PRINCIPALES[cle]).map(([cle, titre, niveau]) => `<button type="button" class="puce-choix ${niveau ? `seulement-${niveau}` : ''}" data-sorte="${cle}">${titre}</button>`).join('')}
      </div>
      <p class="titre-choix titre-etape" data-zone="titre-format">Format</p>
      ${SORTES.map(([cle]) => `<div class="panneau-export" data-panneau="${cle}" hidden></div>`).join('')}
    </div>`;
  const panneau = (cle) => conteneur.querySelector(`[data-panneau="${cle}"]`);

  conteneur.addEventListener('click', (evenement) => {
    if (evenement.target.closest('[data-action="autres"]')) {
      autresOuverts = !autresOuverts;
      montrerSorte();
      return;
    }
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
    else if (quoi === 'reseaux') actions.exporterReseaux(format);
    else if (quoi === 'implantations') actions.exporterImplantations();
    else if (quoi === 'dxf') actions.exporterPlanRecale(id);
    else if (quoi === 'projet') actions.exporterProjet();
    else if (quoi === 'paquet') actions.exporterPaquet({ ...choixPaquet }, (texte) => { const zone = panneau('paquet').querySelector('[data-zone="message-paquet"]'); if (zone) zone.textContent = texte; });
  });
  // Choix du paquet (cases, marge, pixel), gardés quand le panneau est redessiné.
  const choixPaquet = { cadastre: true, cadastrePoints: false, swisstopo: true, formatSurface: 'txt', photo: true, marge: 30, resolution: 0.1 };
  conteneur.addEventListener('change', (evenement) => {
    const champ = evenement.target.closest('[data-paquet]');
    if (!champ) return;
    const cle = champ.dataset.paquet;
    if (champ.type === 'checkbox') choixPaquet[cle] = champ.checked;
    else if (cle === 'marge') choixPaquet.marge = Math.min(500, Math.max(0, Number(String(champ.value).replace(',', '.')) || 0));
    else if (cle === 'formatSurface') choixPaquet.formatSurface = champ.value;
    else choixPaquet[cle] = Number(champ.value);
  });

  /** Montre la partie choisie (bouton allumé, sa zone visible) ; une partie d'un mode plus haut → Contrôles. */
  function montrerSorte() {
    const niveau = SORTES.find(([cle]) => cle === sorte)?.[2];
    if (niveau && !aAcces(niveau)) sorte = 'controles';
    for (const bouton of conteneur.querySelectorAll('button[data-sorte]')) bouton.classList.toggle('actif', bouton.dataset.sorte === sorte);
    // « Autres » : ouvert à la demande, ou tant qu'une de ses parties est choisie.
    const dansAutres = !PRINCIPALES[sorte];
    const ouvert = autresOuverts || dansAutres;
    conteneur.querySelector('.autres-export').hidden = !ouvert;
    const tuileAutres = conteneur.querySelector('[data-action="autres"]');
    tuileAutres.classList.toggle('actif', dansAutres);
    tuileAutres.setAttribute('aria-expanded', String(ouvert));
    for (const zone of conteneur.querySelectorAll('[data-panneau]')) zone.hidden = zone.dataset.panneau !== sorte;
    // Plan et volumes, Mesures : leurs étapes « Lesquels ? », « Format », « Options » sont dans leur formulaire.
    conteneur.querySelector('[data-zone="titre-format"]').hidden = ['plan', 'mesures'].includes(sorte);
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
      ? `<div class="lignes-export">${lignes.map(([nom, detail, attributs]) => `<div class="ligne-export"><span><strong>${echapper(nom)}</strong> <span class="aide">${echapper(detail)}</span></span>${bouton('TXT · CSV · DXF · PDF', attributs)}</div>`).join('')}</div>`
      : '<p class="vide">Aucune liste de points.</p>';
    // Recollements de réseaux (0.101.0) : tous ensemble, un calque (DXF) ou un réseau (LandXML) par levé.
    const nbReseaux = (projet.reseaux ?? []).length;
    panneau('reseaux').innerHTML = nbReseaux > 0
      ? `<p class="aide">${nbReseaux} levé(s) de recollement</p>
        <div class="ligne-outils">${['CSV', 'DXF', 'LandXML', 'PDF'].map((f) => bouton(f, `data-export="reseaux" data-format="${f.toLowerCase()}"`)).join('')}</div>`
      : '<p class="vide">Aucun recollement de réseau.</p>';
    const nbControles = projet.controles.length;
    panneau('controles').innerHTML = nbControles > 0
      ? `<p class="aide">${nbControles} contrôle(s) et refus notés dans le projet</p>
        <div class="ligne-outils">${bouton('CSV', 'data-export="controles" data-format="csv"')}${bouton('PDF', 'data-export="controles" data-format="pdf"')}</div>`
      : '<p class="vide">Aucun contrôle dans ce projet.</p>';
    const nbImplantations = projet.implantations.length;
    panneau('implantations').innerHTML = nbImplantations > 0
      ? `<p class="aide">${nbImplantations} implantation(s) enregistrée(s)</p><div class="ligne-outils">${bouton('CSV', 'data-export="implantations"')}</div>`
      : '<p class="vide">Aucune implantation enregistrée.</p>';
    // 0.147.0 : le dessin DAO (déjà en MN95) s'exporte ici aussi.
    const recales = (projet.plansDxf ?? []).filter((p) => p.recalage?.applique || (p.dao && p.dao.objets?.length));
    panneau('dxf').innerHTML = recales.length > 0
      ? `<div class="lignes-export">${recales.map((p) => `<div class="ligne-export"><span><strong>${echapper(p.nom)}</strong> <span class="aide">${p.dao ? 'dessin DAO, MN95' : 'recalé en MN95'}</span></span>${bouton('DXF', `data-export="dxf" data-id="${p.id}"`)}</div>`).join('')}</div>`
      : '<p class="vide">Aucun plan DXF recalé.</p>';
    const nbCadastres = projet.leves.filter((l) => l.cadastre).length;
    const nbSwisstopo = projet.surfaces.filter((x) => x.type === 'swisstopo').length;
    const case1 = (cle, texte) => `<label class="case"><input type="checkbox" data-paquet="${cle}" ${choixPaquet[cle] ? 'checked' : ''} /> ${texte}</label>`;
    panneau('paquet').innerHTML = `<p class="aide">un seul clic : un fichier ZIP avec le cadastre en DXF, la surface Swisstopo (TXT de points ou DXF 3D) et la photo aérienne géoréférencée</p>
      ${case1('cadastre', `Cadastre importé : les lignes <span class="aide">(${nbCadastres})</span>`)}
      ${case1('cadastrePoints', 'Avec les points du cadastre')}
      ${case1('swisstopo', `Surface Swisstopo <span class="aide">(${nbSwisstopo})</span>`)}
      <div class="champs-export">
        <label>Surface Swisstopo en
          <select data-paquet="formatSurface">${[['txt', 'TXT (points)'], ['dxf', 'DXF (faces 3D)']].map(([v, t]) => `<option value="${v}" ${v === choixPaquet.formatSurface ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
      </div>
      ${case1('photo', 'Photo aérienne swisstopo (GeoTIFF, internet nécessaire)')}
      <div class="champs-export">
        <label>Marge de la photo (m)<input type="text" inputmode="decimal" data-paquet="marge" value="${choixPaquet.marge}" /></label>
        <label>Taille du pixel
          <select data-paquet="resolution">${[[0.1, '10 cm'], [0.25, '25 cm'], [0.5, '50 cm'], [1, '1 m']].map(([v, t]) => `<option value="${v}" ${v === choixPaquet.resolution ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
      </div>
      <div class="ligne-outils">${bouton('Exporter en ZIP', 'data-export="paquet"')}</div>
      <p class="aide" data-zone="message-paquet"></p>`;
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
