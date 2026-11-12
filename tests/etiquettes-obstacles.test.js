// 0.208.0 : une étiquette évite les obstacles (icônes 📷 des photos) donnés en plus.
import { describe, expect, it } from 'vitest';
import { placerEtiquettes } from '../src/plan/etiquettes.js';

describe('placerEtiquettes avec obstacles', () => {
  it('sans obstacle, l\'étiquette se met à droite au-dessus du point', () => {
    const [place] = placerEtiquettes([{ x: 100, y: 100, largeur: 20, hauteur: 10 }]);
    expect(place).toEqual({ x: 105, y: 95, aGauche: false }); // y = bas du texte (ligne de base)
  });

  it('une icône à droite au-dessus du point force l\'étiquette à gauche', () => {
    // Boîte de l'icône qui recouvre la place « à droite, au-dessus » (105..125 ; 85..95).
    const icone = { gauche: 104, haut: 84, droite: 126, bas: 96 };
    const [place] = placerEtiquettes([{ x: 100, y: 100, largeur: 20, hauteur: 10 }], 5, [icone]);
    expect(place.aGauche).toBe(true);
    expect(place.x).toBe(95);
  });
});
