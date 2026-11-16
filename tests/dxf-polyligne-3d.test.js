// 16.11 : une polyligne 3D d'un DXF (POLYLINE + VERTEX, comme « PERRIN - Dessin » du fichier Ter_100G_MGO) garde son Z à
// l'import et sert à implanter une ligne 3D : altitude voulue le long de la ligne et pente (monter / descendre).
import { describe, expect, it } from 'vitest';
import { lirePlanDxf } from '../src/topo/dxf-plan.js';
import { sourcesDesPlans, accrocherTrait } from '../src/topo/accroche.js';
import { altitudeSurLigne, penteDuSegment, longueurPolyligne } from '../src/topo/ligne-implantation.js';

const paires = (...p) => p.map(([c, v]) => `${c}\n${v}`).join('\n');
const DXF = paires(
  [0, 'SECTION'], [2, 'ENTITIES'],
  [0, 'POLYLINE'], [8, 'PERRIN - Dessin'], [66, 1], [70, 8],
  [0, 'VERTEX'], [8, 'PERRIN - Dessin'], [10, 2510227.761], [20, 1141768.499], [30, 414.0], [70, 32],
  [0, 'VERTEX'], [8, 'PERRIN - Dessin'], [10, 2510243.479], [20, 1141790.884], [30, 415.0], [70, 32],
  [0, 'SEQEND'], [8, 'PERRIN - Dessin'],
  [0, 'ENDSEC'], [0, 'EOF'],
);

describe('polyligne 3D d\'un DXF', () => {
  const { plan } = lirePlanDxf(DXF, 'essai.dxf');
  const lignes = sourcesDesPlans([{ ...plan, visible: true, calques: plan.calques }], { est: 2510235, nord: 1141780 }, 20).lignes;

  it('garde le Z des sommets à l\'import', () => {
    expect(plan.contenu.traits[0].z).toEqual([414, 415]);
  });

  it('la ligne touchée a ses altitudes, la pente et l\'altitude voulue le long de la ligne', () => {
    const trouve = accrocherTrait({ est: 2510235, nord: 1141780 }, 5, lignes);
    const sommets = trouve.sommets;
    expect(sommets.map((s) => s.altitude)).toEqual([414, 415]);
    const longueur = longueurPolyligne(sommets);
    expect(penteDuSegment(0, sommets)).toBeCloseTo((1 / longueur) * 100, 6);
    expect(altitudeSurLigne(longueur / 2, sommets)).toBeCloseTo(414.5, 6);
  });
});
