import { describe, it, expect } from 'vitest';
import { rangerMaquette } from '../src/topo/ifc.js';
import {
  niveauxDesIfc, altitudeCoupeIfc, planIfcCoupe, objetsIfcSurCoupe, signatureIfc, svgObjetsIfc, arrondiRecepteur,
} from '../src/plan/coupe-ifc.js';
import { svgCoupeDirecte } from '../src/leve/coupe-directe.js';
import { svgCoupeAxe, svgCoupeEnTravers } from '../src/reseaux/coupe-svg.js';
import { svgCoupeGuidage } from '../src/leve/lame-ecran.js';

const E = 2500000;
const N = 1100000;

// Mur de E+0..E+10 × N+0..N+0.3, altitude 420.5 à 423.5, en triangles.
function mur() {
  const [e0, n0, z0, e1, n1, z1] = [E, N, 420.5, E + 10, N + 0.3, 423.5];
  const c = [[e0, n0, z0], [e1, n0, z0], [e1, n1, z0], [e0, n1, z0], [e0, n0, z1], [e1, n0, z1], [e1, n1, z1], [e0, n1, z1]];
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  const sommets = c.flat();
  const triangles = faces.flatMap(([a, b, cc, d]) => [a, b, cc, a, cc, d]);
  return { type: 'IfcWall', nom: 'Mur', sommets, triangles };
}

function planIfc(id = 'p1', niveaux = [{ nom: 'N0', altitude: 420.5 }, { nom: 'N1', altitude: 424.52 }]) {
  const maquette = rangerMaquette([mur()], niveaux);
  return { id, nom: 'Maquette', ifc: { niveaux: maquette.niveaux }, origine: maquette.origine, calques: [{ nom: 'Murs', couleur: '#dc2626', visible: true }], contenu: { maquette }, bornes: {} };
}

describe('coupe en plan des maquettes IFC (choix de la tablette)', () => {
  it('liste les niveaux de toutes les maquettes sans doublon', () => {
    const niveaux = niveauxDesIfc([planIfc('a'), planIfc('b', [{ nom: 'N0', altitude: 420.5 }, { nom: 'S1', altitude: 417.32 }])]);
    expect(niveaux.map((n) => n.nom)).toEqual(['S1', 'N0', 'N1']);
  });

  it('niveau choisi + 1.00 m, sinon le premier niveau ; récepteur = bout de canne', () => {
    const plans = [planIfc()];
    expect(altitudeCoupeIfc(plans, null, null).altitude).toBeCloseTo(421.5, 6);
    expect(altitudeCoupeIfc(plans, { sorte: 'niveau', niveau: 'N1', altitude: 424.52 }, null).altitude).toBeCloseTo(425.52, 6);
    expect(altitudeCoupeIfc(plans, { sorte: 'recepteur' }, arrondiRecepteur(421.2345)).altitude).toBe(421.23);
    expect(altitudeCoupeIfc(plans, { sorte: 'recepteur' }, null).altitude).toBeNull();
  });

  it('plan coupé : contenu de la coupe, plan du projet inchangé, gardé en mémoire tant que l\'altitude ne change pas', () => {
    const plan = planIfc();
    const coupe = planIfcCoupe(plan, 421.5);
    expect(coupe.contenu.traits).toHaveLength(1);
    expect(coupe.nom).toBe('Maquette'); // lu sur le plan du projet
    expect(plan.contenu.traits).toBeUndefined();
    expect(planIfcCoupe(plan, 421.5)).toBe(coupe);
    expect(planIfcCoupe(plan, 425).contenu.traits).toHaveLength(0); // au-dessus du mur
    expect(planIfcCoupe(plan, null).contenu.traits).toHaveLength(0); // récepteur sans position
  });

  it('coupe verticale : maquette cachée ou calque décoché = rien', () => {
    const plan = planIfc();
    const debut = { est: E + 5, nord: N - 2 };
    const fin = { est: E + 5, nord: N + 2 };
    expect(objetsIfcSurCoupe([plan], debut, fin)).toHaveLength(1);
    const avant = signatureIfc([plan]);
    plan.calques[0].visible = false;
    expect(objetsIfcSurCoupe([plan], debut, fin)).toHaveLength(0);
    expect(signatureIfc([plan])).not.toBe(avant);
    plan.calques[0].visible = true;
    plan.visible = false;
    expect(objetsIfcSurCoupe([plan], debut, fin)).toHaveLength(0);
  });

  it('dessine les objets coupés dans les coupes (Implanter, Réseaux, Guidage)', () => {
    const objets = objetsIfcSurCoupe([planIfc()], { est: E + 5, nord: N - 2 }, { est: E + 5, nord: N + 2 });
    expect(svgObjetsIfc(objets, (x) => x, (z) => z)).toContain('<polygon');
    // Implanter : même sans surface traversée, la maquette est dessinée (pas « Pas de surface ici »).
    const directe = svgCoupeDirecte({ lignes: [], ifc: objets, demiLongueur: 2, altitudeCanne: 421, titre: 'Perpendiculaire', gauche: 'g', droite: 'd' });
    expect(directe).toContain('ifc-coupe');
    expect(directe).not.toContain('Pas de surface ici');
    expect(svgCoupeDirecte({ lignes: [], demiLongueur: 2, altitudeCanne: 421, titre: 'P', gauche: 'g', droite: 'd' })).toContain('Pas de surface ici');
    // Réseaux : en travers et dans l'axe.
    const reseau = { id: 'r', type: '', nom: 'EU', diametre: 0.2, sommets: [{ est: E + 5, nord: N - 2, fe: 419 }, { est: E + 5, nord: N + 2, fe: 418.9 }], tranchee: null };
    expect(svgCoupeAxe({ reseau, ifc: objets }).svg).toContain('ifc-coupe');
    expect(svgCoupeEnTravers({ coupe: { demiLargeur: 2, tuyaux: [] }, ifc: objets })).toContain('ifc-coupe');
    // Guidage : coupe G – D.
    const coupe = { longueur: 4, morceaux: [[{ distance: 0, altitude: 420 }, { distance: 4, altitude: 420 }]], troncons: [], ruptures: [], a: { distance: 1, altitude: 420 }, b: { distance: 3, altitude: 420 }, ifc: objets };
    expect(svgCoupeGuidage(coupe, { gauche: { classe: 'vert' }, droite: { classe: 'vert' } }, ['G', 'D'])).toContain('ifc-coupe');
  });
});
