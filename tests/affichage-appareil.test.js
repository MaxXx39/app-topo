import { describe, it, expect } from 'vitest';
import { creerProjet, completerProjet } from '../src/projet/projet.js';
import { noterAffichage, appliquerAffichage, CLE_AFFICHAGE } from '../src/projet/affichage-appareil.js';

// Faux stockage d'une tablette (comme localStorage).
function tablette() {
  const donnees = {};
  return { getItem: (cle) => donnees[cle] ?? null, setItem: (cle, valeur) => { donnees[cle] = String(valeur); }, donnees };
}

const pt = (nom) => ({ nom, est: 0, nord: 0, altitude: 0 });

function projetEssai() {
  const projet = completerProjet(creerProjet('Essai'));
  projet.id = 'projet-essai'; // même projet à chaque ouverture
  projet.leves.push(
    { id: 'f', nom: 'points.csv', points: [pt('a'), pt('b')] },
    { id: 'c1', nom: 'Cadastre 1', cadastre: true, points: [pt('CAD-1')] },
  );
  projet.plansDxf.push({ id: 'd1', nom: 'Bordures', visible: true, calques: [{ nom: '0', visible: true }, { nom: 'TEXTE', visible: true }] });
  return projet;
}

describe('Affichage gardé par tablette (0.128)', () => {
  it('jamais vu sur la tablette : tout montré sauf le cadastre', () => {
    const projet = projetEssai();
    projet.listesCachees = ['f'];
    projet.plansDxf[0].visible = false;
    appliquerAffichage(projet, tablette());
    expect(projet.listesCachees).toEqual(['c1']);
    expect(projet.plansDxf[0].visible).toBe(true);
  });

  it('le masquage est gardé au redémarrage sur la même tablette', () => {
    const t = tablette();
    const projet = projetEssai();
    appliquerAffichage(projet, t);
    projet.listesCachees = ['c1', 'f'];
    projet.plansDxf[0].calques[1].visible = false;
    noterAffichage(projet, t);
    const rouvert = projetEssai();
    appliquerAffichage(rouvert, t);
    expect(rouvert.listesCachees.sort()).toEqual(['c1', 'f']);
    expect(rouvert.plansDxf[0].calques.map((c) => c.visible)).toEqual([true, false]);
  });

  it('une autre tablette (ou Drive) ne change pas l\'affichage de celle-ci', () => {
    const a = tablette();
    const b = tablette();
    const projet = projetEssai();
    appliquerAffichage(projet, a);
    noterAffichage(projet, a); // A : rien de masqué sauf cadastre
    const recu = projetEssai(); // B masque « f » et le plan, puis envoie sur Drive
    recu.listesCachees = ['f'];
    recu.plansDxf[0].visible = false;
    noterAffichage(recu, b);
    appliquerAffichage(recu, a); // A reçoit la version de Drive
    expect(recu.listesCachees).toEqual(['c1']);
    expect(recu.plansDxf[0].visible).toBe(true);
  });

  it('cadastre : nouveau = caché ; affiché par l\'utilisateur = reste affiché', () => {
    const t = tablette();
    const projet = projetEssai();
    appliquerAffichage(projet, t);
    projet.listesCachees = []; // l'utilisateur affiche Cadastre 1
    noterAffichage(projet, t);
    const ensuite = projetEssai();
    ensuite.leves.push({ id: 'c2', nom: 'Cadastre 2', cadastre: true, points: [pt('CAD-1')] });
    appliquerAffichage(ensuite, t);
    expect(ensuite.listesCachees).toEqual(['c2']);
  });

  it('stockage abîmé : retour à l\'affichage de départ, sans erreur', () => {
    const t = tablette();
    t.setItem(CLE_AFFICHAGE, '{pas du json');
    const projet = projetEssai();
    expect(() => appliquerAffichage(projet, t)).not.toThrow();
    expect(projet.listesCachees).toEqual(['c1']);
  });

  it('0.231 : une surface importée arrive cachée ; celle que l\'utilisateur a montrée reste montrée', () => {
    const projet = projetEssai();
    projet.surfaces.push({ id: 's1', nom: 'Surf-A', type: 'landxml', nomFichier: 'a.xml', points: [pt('a')], faces: [] });
    const surfaceImportee = (projet.surfaces[0]);
    const stockage = tablette();
    appliquerAffichage(projet, stockage);
    const cachee = projet.listesCachees.includes('s1');
    // Montrée à la main puis retenue par la tablette : elle reste montrée à l'ouverture suivante.
    projet.listesCachees = projet.listesCachees.filter((id) => id !== 's1');
    noterAffichage(projet, stockage);
    const autre = projetEssai();
    autre.surfaces.push(surfaceImportee);
    appliquerAffichage(autre, stockage);
    expect(cachee).toBe(true);
    expect(autre.listesCachees.includes('s1')).toBe(false);
  });
});
