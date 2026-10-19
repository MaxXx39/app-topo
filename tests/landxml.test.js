// Tests de la lecture des fichiers LandXML.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lireLandXML, resumerSurface } from '../src/topo/landxml.js';

describe('lireLandXML - fichier d\'exemple « 3D SUR Tapis AC11 »', () => {
  const texte = readFileSync(new URL('../exemples/3D SUR Tapis AC11.xml', import.meta.url), 'utf-8');
  const { surfaces, erreurs, avertissements } = lireLandXML(texte);
  const surface = surfaces[0];

  it('lit la surface TIN sans erreur', () => {
    expect(erreurs).toEqual([]);
    expect(avertissements).toEqual([]);
    expect(surfaces).toHaveLength(1);
    expect(surface.nom).toBe('TAPIS AC11');
  });

  it('lit les 508 points et les 506 triangles', () => {
    expect(surface.points).toHaveLength(508);
    expect(surface.triangles).toHaveLength(506);
    expect(surface.trianglesInvisibles).toBe(0);
  });

  it('remet les coordonnées dans l\'ordre Est, Nord, altitude', () => {
    // Dans le fichier : <P id="1" name="44">1130617.246 2499609.547 476.33</P> (Nord Est altitude)
    const point = surface.points.find((p) => p.id === '1');
    expect(point).toEqual({ id: '1', nom: '44', est: 2499609.547, nord: 1130617.246, altitude: 476.33 });
  });

  it('relie les triangles aux points par leur id (pas par leur position)', () => {
    // Premier triangle du fichier : <F>8 262 7</F>
    expect(surface.triangles[0].map((p) => p.id)).toEqual(['8', '262', '7']);
  });

  it('retrouve la surface et les altitudes annoncées par Mensura', () => {
    const resume = resumerSurface(surface);
    expect(resume.surfacePlan).toBeCloseTo(surface.surfaceAnnoncee, 2); // 16807.696 m²
    expect(resume.altitudeMin).toBeCloseTo(473.79, 6);
    expect(resume.altitudeMax).toBeCloseTo(483.88, 6);
  });

  it('lit les 4 lignes de rupture et le contour', () => {
    expect(surface.lignesRupture).toHaveLength(4);
    expect(surface.contours).toHaveLength(1);
    expect(surface.lignesRupture[0][0]).toEqual({ est: 2499609.547, nord: 1130617.246, altitude: 476.33 });
  });
});

describe('lireLandXML - cas particuliers', () => {
  const fichier = (surfaces) => `<?xml version="1.0"?>\n<LandXML version="1.1"><Surfaces>${surfaces}</Surfaces></LandXML>`;
  const tin = (nom, faces) => `
    <Surface name="${nom}"><Definition surfType="TIN">
      <Pnts>
        <P id="10">200 100 5</P><P id="20">200 110 5</P><P id="30">210 100 6</P><P id="40">210 110 7</P>
      </Pnts>
      <Faces>${faces}</Faces>
    </Definition></Surface>`;

  it('propose toutes les surfaces TIN et ignore les autres types', () => {
    const texte = fichier(
      tin('Terrain', '<F>10 20 30</F>') +
        tin('Projet', '<F>20 40 30</F>') +
        '<Surface name="Grille"><Definition surfType="grid"></Definition></Surface>',
    );
    const { surfaces, avertissements } = lireLandXML(texte);
    expect(surfaces.map((s) => s.nom)).toEqual(['Terrain', 'Projet']);
    expect(avertissements[0]).toContain('Grille');
  });

  it('ignore les triangles invisibles (i="1")', () => {
    const { surfaces } = lireLandXML(fichier(tin('T', '<F>10 20 30</F><F i="1">20 40 30</F>')));
    expect(surfaces[0].triangles).toHaveLength(1);
    expect(surfaces[0].trianglesInvisibles).toBe(1);
  });

  it('signale un triangle qui utilise un point absent, avec le numéro de ligne', () => {
    const { erreurs, surfaces } = lireLandXML(fichier(tin('T', '<F>10 20 30</F>\n<F>10 20 99</F>')));
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toMatch(/ligne \d+ : triangle qui utilise le point id 99/);
    expect(surfaces[0].triangles).toHaveLength(1);
  });

  it('ignore les commentaires et décode les noms', () => {
    const texte = fichier('<!-- <Surface name="faux"></Surface> -->' + tin('Tas &amp; talus', '<F>10 20 30</F>'));
    expect(lireLandXML(texte).surfaces.map((s) => s.nom)).toEqual(['Tas & talus']);
  });

  it('refuse un fichier qui n\'est pas du LandXML', () => {
    expect(lireLandXML('b1\t1\t2\t3').erreurs[0]).toContain('pas un fichier LandXML');
  });
});
