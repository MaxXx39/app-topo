// 0.251.0 : sous-dossiers de projet (remplacent le « type » des plans DXF).
import { describe, it, expect } from 'vitest';
import {
  nettoyerSousDossiers, lireSousDossiers, couleurDuSousDossier, SOUS_DOSSIERS_DEPART, SANS_SOUS_DOSSIER,
  typesVersSousDossiers, dansSousDossier, basculerSousDossier, sousDossiersEffectifs, estMontre, idsHorsSousDossier,
  lireChoix, retenirChoix, elementsRangeables,
} from '../src/topo/sous-dossiers.js';
import { nettoyerListes, fusionnerListes } from '../src/reglages/listes-partagees.js';
import { listesDePoints } from '../src/plan/listes-points.js';

const magasin = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

const projet = () => ({
  id: 'p1',
  leves: [
    { id: 'l1', nom: 'LV-Stock', points: [], sousDossiers: ['Terrassement'] },
    { id: 'l2', nom: 'Imp-Regards', points: [], sousDossiers: ['Canalo', 'Terrassement'] },
    { id: 'l3', nom: 'Imp-Libre', points: [] },
  ],
  surfaces: [{ id: 's1', nom: 'Surf-1', leveId: 'l1', nature: 'stock', points: [], faces: [] }],
  autres: [],
  plansDxf: [{ id: 'd1', nom: 'Réseaux', sousDossiers: ['Canalo'] }, { id: 'd2', nom: 'Fond' }],
  dessins: [],
  canalisations: [],
  listesCachees: [],
});

describe('liste des sous-dossiers', () => {
  it('départ : les 12 dossiers du 16.11 + PIC + Autre (en bas), chacun avec une couleur différente', () => {
    const liste = lireSousDossiers(null, {});
    expect(liste.map((d) => d.nom)).toEqual(['TER.', 'CANA', 'TS', 'AMEX', 'BAT', 'SITU', 'PIC', 'PERRIN1', 'PERRIN2', 'GEOOFF', 'GEOPERRIN', 'OLD', 'Autre']);
    expect(liste.map((d) => d.nom)).toEqual(SOUS_DOSSIERS_DEPART);
    expect(new Set(liste.map((d) => d.couleur)).size).toBe(13);
  });
  it('on peut en ajouter ; la liste partagée remplace celle de départ ; un nom inconnu est gris', () => {
    const liste = lireSousDossiers(null, { sousDossiers: ['Voirie', 'Eaux'] });
    expect(liste.map((d) => d.nom)).toEqual(['Voirie', 'Eaux', 'Autre']); // « Autre » toujours en bas
    expect(couleurDuSousDossier('Inconnu', liste)).toBe('#6b7280');
  });
  it('un dossier déjà utilisé par un élément du projet est toujours proposé', () => {
    const p = projet();
    p.plansDxf[0].sousDossiers = ['Géotech'];
    expect(lireSousDossiers(p, { sousDossiers: ['Voirie'] }).map((d) => d.nom)).toContain('Géotech');
  });
  it('nettoyage : virgules ou lignes, sans doublon, jamais le nom réservé', () => {
    expect(nettoyerSousDossiers('Canalo, canalo ;\n Bâtiment,  ,Voirie')).toEqual(['Canalo', 'Bâtiment', 'Voirie']);
    expect(nettoyerSousDossiers([SANS_SOUS_DOSSIER, 'A'])).toEqual(['A']);
  });
  it('partagée par Drive, fusionnée par sa date', () => {
    const local = { sousDossiers: ['A'], dates: { sousDossiers: '2026-11-16T08:00:00Z' } };
    const distant = { sousDossiers: ['A', 'B'], dates: { sousDossiers: '2026-11-16T09:00:00Z' } };
    expect(nettoyerListes(local).sousDossiers).toEqual(['A']);
    expect(fusionnerListes(local, distant).listes.sousDossiers).toEqual(['A', 'B']);
  });
});

describe('anciens types de plans', () => {
  it('le type devient un sous-dossier du même nom et disparaît', () => {
    const p = { plansDxf: [{ id: 'a', type: 'TER' }, { id: 'b', type: '' }, { id: 'c', sousDossiers: ['Canalo'], type: 'CANA' }, { id: 'd' }] };
    expect(typesVersSousDossiers(p)).toBe(2);
    expect(p.plansDxf[0]).toEqual({ id: 'a', sousDossiers: ['TER.'] }); // l'ancien « TER » devient « TER. »
    expect(p.plansDxf[1]).toEqual({ id: 'b' });
    expect(p.plansDxf[2].sousDossiers).toEqual(['Canalo', 'CANA']);
    expect('type' in p.plansDxf[3]).toBe(false);
    expect(typesVersSousDossiers(p)).toBe(0); // rien de plus la 2e fois
    const dejaMigre = { plansDxf: [{ id: 'z', sousDossiers: ['TER', 'Bât Radier', 'Canalo'] }] };
    expect(typesVersSousDossiers(dejaMigre)).toBe(1);
    expect(dejaMigre.plansDxf[0].sousDossiers).toEqual(['TER.', 'BAT-Rad.', 'Canalo']);
  });
});

describe('ce que montre un dossier', () => {
  it('Tout montre tout ; Sans dossier ne montre que ce qui n\'est dans aucun', () => {
    expect(dansSousDossier({ sousDossiers: ['A'] }, '')).toBe(true);
    expect(dansSousDossier({}, SANS_SOUS_DOSSIER)).toBe(true);
    expect(dansSousDossier({ sousDossiers: ['A'] }, SANS_SOUS_DOSSIER)).toBe(false);
  });
  it('un élément peut être dans plusieurs dossiers', () => {
    const l = { sousDossiers: ['Canalo', 'Terrassement'] };
    expect(dansSousDossier(l, 'Canalo')).toBe(true);
    expect(dansSousDossier(l, 'Terrassement')).toBe(true);
    expect(dansSousDossier(l, 'Bâtiment')).toBe(false);
  });
  it('cocher / décocher un dossier', () => {
    expect(basculerSousDossier({ sousDossiers: ['A'] }, 'B', true)).toEqual(['A', 'B']);
    expect(basculerSousDossier({ sousDossiers: ['A', 'B'] }, 'A', false)).toEqual(['B']);
    expect(basculerSousDossier({}, 'A', true)).toEqual(['A']);
  });
  it('une surface suit le dossier de son levé', () => {
    const p = projet();
    expect(sousDossiersEffectifs(p, p.surfaces[0], 'surface')).toEqual(['Terrassement']);
    p.leves[0].sousDossiers = ['Canalo'];
    expect(estMontre(p, p.surfaces[0], 'surface', 'Canalo')).toBe(true);
    expect(estMontre(p, p.surfaces[0], 'surface', 'Terrassement')).toBe(false);
  });
  it('ids cachés par le dossier choisi (vide sous « Tout »)', () => {
    const p = projet();
    expect(idsHorsSousDossier(p, '').size).toBe(0);
    const caches = idsHorsSousDossier(p, 'Canalo');
    expect([...caches].sort()).toEqual(['l1', 's1', 'd2'].sort());
    expect(elementsRangeables(p)).toHaveLength(6);
  });
});

describe('listes du plan (Afficher) avec un dossier choisi (0.258.0)', () => {
  it('toutes les listes restent listées, avec leurs dossiers (le dossier ne fait que cocher)', async () => {
    const { definirSousDossier } = await import('../src/topo/sous-dossiers.js');
    const p = projet();
    definirSousDossier('');
    const toutes = listesDePoints(p).map((l) => l.id);
    expect(toutes).toContain('l2');
    expect(toutes).toContain('s1');
    definirSousDossier('Canalo');
    expect(listesDePoints(p).map((l) => l.id)).toContain('l1');
    expect(listesDePoints(p).find((l) => l.id === 'l2').sousDossiers).toContain('Canalo');
    definirSousDossier('');
  });
});

describe('choix de la tablette', () => {
  it('gardé par projet ; un dossier qui n\'existe plus revient à « Tout »', () => {
    const m = magasin();
    const p = projet();
    expect(lireChoix(p, m)).toBe('');
    retenirChoix('p1', 'CANA', m);
    expect(lireChoix(p, m)).toBe('CANA');
    retenirChoix('p1', 'Disparu', m);
    expect(lireChoix(p, m)).toBe('');
    retenirChoix('p1', SANS_SOUS_DOSSIER, m);
    expect(lireChoix(p, m)).toBe(''); // 0.261.0 : « Sans dossier » n'existe plus
    retenirChoix('p1', '', m);
    expect(lireChoix(p, m)).toBe('');
  });
});

describe('lisibilité des pastilles (0.252.0)', () => {
  it('texte foncé sur un fond clair, blanc sur un fond foncé', async () => {
    const { texteSur, pastilleSousDossier } = await import('../src/topo/sous-dossiers.js');
    expect(texteSur('#eab308')).toBe('#111827'); // jaune
    expect(texteSur('#fdedc4')).toBe('#111827');
    expect(texteSur('#2563eb')).toBe('#ffffff'); // bleu
    expect(texteSur('#7c3aed')).toBe('#ffffff');
    expect(texteSur('n\'importe quoi')).toBe('#ffffff');
    const html = pastilleSousDossier('Voirie <b>', [{ nom: 'Voirie <b>', couleur: '#eab308' }]);
    expect(html).toContain('color: #111827');
    expect(html).toContain('Voirie &lt;b&gt;');
  });
});

describe('points de contrôle (0.254.0)', () => {
  it('sont dans tous les dossiers : le filtre ne les cache jamais', async () => {
    const { definirSousDossier } = await import('../src/topo/sous-dossiers.js');
    const { LISTE_CONTROLE } = await import('../src/plan/listes-points.js');
    const p = { ...projet(), pointsControle: [{ id: 'c1', nom: 'PC1', est: 2538000, nord: 1152000, altitude: null }] };
    for (const choix of ['', 'Canalo', 'Terrassement', SANS_SOUS_DOSSIER]) {
      definirSousDossier(choix);
      expect(listesDePoints(p).map((l) => l.id)).toContain(LISTE_CONTROLE);
      expect(idsHorsSousDossier(p, choix).has(LISTE_CONTROLE)).toBe(false);
    }
    definirSousDossier('');
  });
});

describe('tableau « Liste de points » selon le dossier (0.255.0)', () => {
  it('0.258.0 : le dossier ne filtre plus le tableau (les pastilles disent où est chaque liste)', async () => {
    const { definirSousDossier } = await import('../src/topo/sous-dossiers.js');
    const { listesDuTableau, lignesDuTableau, CATEGORIES_POINTS } = await import('../src/import/tableau-points.js');
    const p = projet();
    p.pointsControle = [{ id: 'c1', nom: 'PC1', est: 1, nord: 2, altitude: null }];
    p.leves = [
      { id: 'a', nom: 'Imp-Regards', points: [{ nom: 'R1', est: 1, nord: 1, altitude: 1 }], sousDossiers: ['Canalo'] },
      { id: 'b', nom: 'Imp-Bordures', points: [{ nom: 'B1', est: 2, nord: 2, altitude: 2 }], sousDossiers: ['Terrassement'] },
      { id: 'c', nom: 'Imp-Libre', points: [{ nom: 'L1', est: 3, nord: 3, altitude: 3 }] },
    ];
    const categories = new Set(CATEGORIES_POINTS.map(([cle]) => cle));
    definirSousDossier('');
    expect(listesDuTableau(p).map((l) => l.id)).toEqual(['controle', 'a', 'b', 'c']);
    definirSousDossier('Canalo');
    expect(listesDuTableau(p).map((l) => l.id)).toEqual(['controle', 'a', 'b', 'c']);
    expect(lignesDuTableau(p, { categories }).map((l) => l.nom)).toEqual(['PC1', 'R1', 'B1', 'L1']);
    definirSousDossier('');
  });
});

describe('applications : listes d\'annotation selon le dossier (0.256.0)', () => {
  it('une liste d\'annotation rangée dans un dossier ne se voit que dans ce dossier', async () => {
    const { definirSousDossier } = await import('../src/topo/sous-dossiers.js');
    const { listesAnnotation } = await import('../src/topo/annotation.js');
    const p = { ...projet(), autres: [
      { id: 'n1', nom: 'Annot-20261116', nature: 'annotation', sousDossiers: ['TER.'] },
      { id: 'n2', nom: 'Annot-20261117', nature: 'annotation', sousDossiers: ['CANA'] },
    ] };
    definirSousDossier('');
    expect(listesAnnotation(p).map((l) => l.id).sort()).toEqual(['n1', 'n2']);
    definirSousDossier('TER.');
    expect(listesAnnotation(p).map((l) => l.id)).toEqual(['n1']);
    definirSousDossier('');
  });
});

describe('applications : filtre par dossier selon le mode (0.259.0)', () => {
  it('Base filtre ; Intermédiaire / Expert listent tout, mais estDansSousDossier reste exact', async () => {
    const { estMontre, estDansSousDossier, definirFiltreApplications } = await import('../src/topo/sous-dossiers.js');
    const el = { id: 'x', sousDossiers: ['CANA'] };
    definirFiltreApplications(true);
    expect(estMontre({}, el, 'plan', 'TER.')).toBe(false);
    definirFiltreApplications(false);
    expect(estMontre({}, el, 'plan', 'TER.')).toBe(true);
    expect(estDansSousDossier({}, el, 'plan', 'TER.')).toBe(false);
    definirFiltreApplications(true);
  });
});

describe('levés sans dossier (0.260.0)', () => {
  it('un levé ou une annotation sans dossier reste montré dans un dossier choisi (Base) ; une surface suit son levé', async () => {
    const { estMontre, definirFiltreApplications } = await import('../src/topo/sous-dossiers.js');
    definirFiltreApplications(true);
    const projet = { leves: [{ id: 'l1' }] };
    expect(estMontre(projet, { id: 'l1' }, 'leve', 'TER.')).toBe(true);
    expect(estMontre(projet, { id: 'a1', nature: 'annotation' }, 'autre', 'TER.')).toBe(true);
    expect(estMontre(projet, { id: 's1', leveId: 'l1' }, 'surface', 'TER.')).toBe(false);
    expect(estMontre(projet, { id: 'p1', sousDossiers: ['CANA'] }, 'plan', 'TER.')).toBe(false);
  });
});

describe('dossier réservé au projet (0.272.1)', () => {
  it("un dossier créé dans un projet n'entre pas dans les listes partagées ni dans un autre projet", async () => {
    const { ajouterSousDossierProjet, lireSousDossiers } = await import('../src/topo/sous-dossiers.js');
    const a = { plansDxf: [], leves: [] };
    const b = { plansDxf: [], leves: [] };
    expect(ajouterSousDossierProjet(a, 'Cana Sous Sol')).toBe('Cana Sous Sol');
    expect(lireSousDossiers(a, {}).map((d) => d.nom)).toContain('Cana Sous Sol');
    expect(lireSousDossiers(b, {}).map((d) => d.nom)).not.toContain('Cana Sous Sol');
    expect(ajouterSousDossierProjet(a, 'cana sous sol')).toBe('Cana Sous Sol');
    expect(a.sousDossiersPropres).toEqual(['Cana Sous Sol']);
  });
});
