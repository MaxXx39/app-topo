import { describe, it, expect } from 'vitest';
import { archiver, restaurer, supprimerArchive, resumeArchive } from '../src/projet/archives.js';
import { creerProjet } from '../src/projet/projet.js';
import { projetVersFichiers, fichiersVersProjet } from '../src/partage/fichiers.js';
import { creerHistorique, reinitialiser, memoriser, annuler } from '../src/projet/historique.js';

function projetDEssai() {
  const p = creerProjet('Essai');
  p.leves = [
    { id: 'l1', nom: 'LV-Stock 1', direct: true, points: [{ nom: 'C-1', est: 1, nord: 2, altitude: 3 }, { nom: 'C-2', est: 2, nord: 2, altitude: 3 }] },
    { id: 'l2', nom: 'LV-Terrain 1', direct: true, points: [{ nom: 'T-1', est: 1, nord: 1, altitude: 1 }] },
  ];
  p.leveActifId = 'l1';
  p.surfaces = [
    { id: 's1', nom: 'LV-Stock 1', nature: 'stock', leveId: 'l1', photos: [{ id: 'ph1', point: 'C-1', image: 'data:img', miniature: 'data:mini' }] },
    { id: 's2', nom: 'LV-Terrain 1', nature: 'terrain', leveId: 'l2' },
  ];
  p.calculs = [{ id: 'c1', surface1Id: 's1', surface2Id: 's2' }];
  p.mesures = [{ id: 'm1', leveId: 'l1' }];
  p.plansDxf = [{ id: 'd1', nom: 'Plan', contenu: { traitsDxf: [1, 2, 3] }, calques: [] }];
  return p;
}

describe('archives', () => {
  it('archive un levé avec sa surface, son volume et ses mesures, puis le restaure', () => {
    const p = projetDEssai();
    const { archive } = archiver(p, 'leve', 'l1');
    expect(archive.nom).toBe('LV-Stock 1');
    expect(p.leves.map((l) => l.id)).toEqual(['l2']);
    expect(p.surfaces.map((s) => s.id)).toEqual(['s2']);
    expect(p.calculs).toEqual([]);
    expect(p.mesures).toEqual([]);
    expect(p.leveActifId).toBe('l2');
    expect(resumeArchive(archive)).toBe('2 points, 1 volume, 1 mesure');
    expect(restaurer(p, archive.id)).toEqual({ nom: 'LV-Stock 1' });
    expect(p.leves.map((l) => l.id).sort()).toEqual(['l1', 'l2']);
    expect(p.calculs.map((c) => c.id)).toEqual(['c1']);
    expect(p.archives).toEqual([]);
  });

  it('archive un plan DXF et supprime l\'archive pour de bon', () => {
    const p = projetDEssai();
    const { archive } = archiver(p, 'plan', 'd1');
    expect(p.plansDxf).toEqual([]);
    expect(supprimerArchive(p, archive.id)).toEqual({ nom: 'Plan' });
    expect(p.archives).toEqual([]);
  });

  it('refuse un élément inconnu', () => {
    expect(archiver(projetDEssai(), 'leve', 'xx').erreur).toBeTruthy();
    expect(restaurer(projetDEssai(), 'xx').erreur).toBeTruthy();
  });

  it('Drive : photos et plans archivés partent dans leurs propres fichiers et reviennent', () => {
    const p = projetDEssai();
    archiver(p, 'leve', 'l1');
    archiver(p, 'plan', 'd1');
    const fichiers = projetVersFichiers(p);
    const leger = fichiers.get('projet.json.gz');
    expect(JSON.stringify(leger)).not.toContain('data:img');
    expect(JSON.stringify(leger)).not.toContain('traitsDxf');
    expect(fichiers.get('photo-ph1.json.gz')).toEqual({ image: 'data:img', miniature: 'data:mini' });
    expect(fichiers.get('plan-d1.json.gz')).toEqual({ traitsDxf: [1, 2, 3] });
    const relu = fichiersVersProjet(fichiers);
    expect(relu.archives[0].contenu.surfaces[0].photos[0].image).toBe('data:img');
    expect(relu.archives[1].contenu.plansDxf[0].contenu).toEqual({ traitsDxf: [1, 2, 3] });
  });

  it('historique : annuler un archivage remet le levé avec sa photo', () => {
    const h = creerHistorique();
    const p = projetDEssai();
    reinitialiser(h, p);
    archiver(p, 'leve', 'l1');
    memoriser(h, p);
    const avant = annuler(h);
    expect(avant.leves.map((l) => l.id)).toContain('l1');
    expect(avant.surfaces.find((s) => s.id === 's1').photos[0].image).toBe('data:img');
  });
});
