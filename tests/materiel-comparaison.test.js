import { describe, it, expect } from 'vitest';
import { parcVide, ajouterCategorie, ajouterArticle, ajouterChantier } from '../src/materiel/donnees.js';
import { poserAffectation } from '../src/materiel/planning.js';
import {
  reunirJournaux, lireVus, comparer, resultatDuJour, ecartsAVerifier, texteEcart, propositionsDePrerempli, appliquerPropositions,
} from '../src/materiel/comparaison.js';

/** Parc d'essai : cannes 953 et 954 (liées à des tablettes), station 811 (pas de tablette), 3 chantiers. */
function essai() {
  const parc = parcVide();
  const gps = ajouterCategorie(parc, 'Canne GPS');
  const a953 = ajouterArticle(parc, { numero: '953', categorieId: gps.id });
  const a954 = ajouterArticle(parc, { numero: '954', categorieId: gps.id });
  const a811 = ajouterArticle(parc, { numero: '811', categorieId: gps.id });
  const pab = ajouterChantier(parc, { numero: '10203', nom: 'OFROU PAB' });
  const nyon = ajouterChantier(parc, { numero: '10245', nom: 'Gare Nyon' });
  const poser = (a, c, d, f) => poserAffectation(parc, { articleId: a.id, chantierId: c.id, debut: d, fin: f });
  return { parc, a953, a954, a811, pab, nyon, poser };
}
const ligne = (article, jour, projet, plus = {}) => ({ jour, projet, appareil: `Tab-${article}`, utilisateur: '', article, points: 3, implantations: 0, ...plus });
const journal = (...jours) => ({ appareilId: 'a1', appareil: 'Tab', jours });
// « Aujourd'hui » = jeudi 12.11.2026 ; lundi 2 → vendredi 6, lundi 9 → mercredi 11 sont passés.
const JOUR = '2026-11-12';

describe('journaux', () => {
  it('le journal de cet appareil remplace sa copie de Drive', () => {
    const drive = [{ appareilId: 'a1', jours: [1] }, { appareilId: 'a2', jours: [2] }, null, { appareilId: 'a3' }];
    const local = { appareilId: 'a1', jours: [3] };
    expect(reunirJournaux(drive, local).map((j) => j.jours[0])).toEqual([2, 3]);
    expect(reunirJournaux(drive, null)).toHaveLength(2);
    expect(reunirJournaux(null, local)).toEqual([local]);
  });
  it('relie article et chantier ; sans article du parc : compté à part', () => {
    const { parc, a953, pab } = essai();
    const { vus, sansArticle } = lireVus(parc, [journal(ligne('953', '2026-11-02', '10 203 OFROU'), ligne('999', '2026-11-02', '10 203'), ligne('', '2026-11-03', '10 203', { appareil: 'Tab-vieux' }), ligne('953', '2026-11-04', 'Essai'))]);
    expect(vus).toHaveLength(2);
    expect(vus[0]).toMatchObject({ articleId: a953.id, chantierId: pab.id });
    expect(vus[1].chantierId).toBeNull(); // projet « Essai » : pas de n° de chantier
    expect(sansArticle).toEqual(['Tab-999', 'Tab-vieux']);
  });
  it('l\'article du journal sert quand la ligne n\'en a pas, majuscules ignorées', () => {
    const { parc, a811 } = essai();
    parc.articles[2].numero = 'PLT400';
    const l = { jour: '2026-11-02', projet: '10203', appareil: 'T', points: 2 };
    expect(lireVus(parc, [{ article: 'plt400', jours: [l] }]).vus[0].articleId).toBe(a811.id);
  });
});

describe('comparer', () => {
  it('vu comme prévu, vu ailleurs, vu sans planning, prévu pas vu', () => {
    const { parc, a953, a954, pab, nyon, poser } = essai();
    poser(a953, pab, '2026-11-02', '2026-11-10');
    poser(a954, pab, '2026-11-02', '2026-11-06');
    const c = comparer(parc, [journal(
      ligne('953', '2026-11-02', '10 203'), // comme prévu
      ligne('953', '2026-11-03', '10 245 Gare'), // ailleurs
      ligne('953', '2026-11-11', '10 203'), // sans planning (l'affectation finit le 10)
      ligne('954', '2026-11-02', '10 203'),
    )], JOUR);
    expect(resultatDuJour(c, a953.id, '2026-11-02').statut).toBe('ok');
    expect(resultatDuJour(c, a953.id, '2026-11-03').statut).toBe('ecart');
    expect(resultatDuJour(c, a953.id, '2026-11-11').statut).toBe('sans');
    // 953 prévu du 2 au 10 : mercredi 4, jeudi 5, vendredi 6, lundi 9, mardi 10 → pas vu ; samedi 7 et dimanche 8 : rien
    expect(resultatDuJour(c, a953.id, '2026-11-04').statut).toBe('absent');
    expect(resultatDuJour(c, a953.id, '2026-11-06').statut).toBe('absent');
    expect(resultatDuJour(c, a953.id, '2026-11-07')).toBeNull(); // samedi
    expect(resultatDuJour(c, a953.id, '2026-11-08')).toBeNull(); // dimanche
    expect(resultatDuJour(c, a953.id, '2026-11-10').statut).toBe('absent');
    expect(c.premierJour).toBe('2026-11-02');
    expect(nyon.id).toBeTruthy();
  });
  it('pas d\'orange pour un article sans tablette, ni pour le futur, ni avant le début du journal', () => {
    const { parc, a953, a811, pab, poser } = essai();
    poser(a811, pab, '2026-11-02', '2026-11-30'); // station : jamais vue
    poser(a953, pab, '2026-10-01', '2026-11-30');
    const c = comparer(parc, [journal(ligne('953', '2026-11-04', '10 203'))], JOUR);
    expect([...c.jours.keys()].filter((k) => k.startsWith(a811.id))).toEqual([]);
    expect(resultatDuJour(c, a953.id, '2026-10-15')).toBeNull(); // avant le journal
    expect(resultatDuJour(c, a953.id, '2026-11-03')).toBeNull(); // avant le premier jour vu
    expect(resultatDuJour(c, a953.id, '2026-11-05').statut).toBe('absent');
    expect(resultatDuJour(c, a953.id, '2026-11-12')).toBeNull(); // aujourd'hui : pas encore fini
    expect(resultatDuJour(c, a953.id, '2026-11-13')).toBeNull(); // futur
  });
  it('une simple ouverture du projet (rien levé) ne compte pas comme « vu »', () => {
    const { parc, a953, pab, poser } = essai();
    poser(a953, pab, '2026-11-02', '2026-11-03');
    const c = comparer(parc, [journal(ligne('953', '2026-11-02', '10 203'), ligne('953', '2026-11-03', '10 203', { points: 0, implantations: 0, controles: 0 }), ligne('953', '2026-11-04', '10 203', { points: 0, controles: 1 }))], JOUR);
    expect(resultatDuJour(c, a953.id, '2026-11-03').statut).toBe('absent'); // ouverte seulement : pas vue
    expect(resultatDuJour(c, a953.id, '2026-11-04').statut).toBe('sans'); // un contrôle = du travail
  });
  it('« prévu pas vu » commence au premier jour vu de CET article', () => {
    const { parc, a953, a954, pab, poser } = essai();
    poser(a953, pab, '2026-11-02', '2026-11-11');
    poser(a954, pab, '2026-11-02', '2026-11-11');
    const c = comparer(parc, [journal(ligne('953', '2026-11-02', '10 203'), ligne('954', '2026-11-09', '10 203'))], JOUR);
    expect(resultatDuJour(c, a953.id, '2026-11-05').statut).toBe('absent');
    expect(resultatDuJour(c, a954.id, '2026-11-05')).toBeNull(); // avant le premier jour vu de 954
    expect(resultatDuJour(c, a954.id, '2026-11-10').statut).toBe('absent');
  });
  it('une tablette sur deux chantiers le même jour : « comme prévu » si l\'un est le bon', () => {
    const { parc, a953, pab, poser } = essai();
    poser(a953, pab, '2026-11-02', '2026-11-02');
    const c = comparer(parc, [journal(ligne('953', '2026-11-02', '10 245'), ligne('953', '2026-11-02', '10 203'))], JOUR);
    expect(resultatDuJour(c, a953.id, '2026-11-02').statut).toBe('ok');
  });
  it('sans journal : rien à signaler', () => {
    const { parc, a953, pab, poser } = essai();
    poser(a953, pab, '2026-11-02', '2026-11-10');
    const c = comparer(parc, [], JOUR);
    expect(c.jours.size).toBe(0);
    expect(c.premierJour).toBeNull();
  });
});

describe('À vérifier', () => {
  it('regroupe les jours qui se suivent (week-end compris) et écrit des phrases', () => {
    const { parc, a953, pab, nyon, poser } = essai();
    poser(a953, pab, '2026-11-02', '2026-11-11');
    const c = comparer(parc, [journal(
      ligne('953', '2026-11-02', '10 203'),
      ligne('953', '2026-11-05', '10 245'), ligne('953', '2026-11-06', '10 245'), ligne('953', '2026-11-09', '10 245'),
    )], JOUR);
    const ecarts = ecartsAVerifier(c);
    const court = (iso) => `${iso.slice(8)}.${iso.slice(5, 7)}`;
    expect(ecarts.map((e) => `${e.statut} ${e.debut}→${e.fin}`)).toEqual([
      'absent 2026-11-03→2026-11-04',
      'ecart 2026-11-05→2026-11-09', // jeudi, vendredi, puis lundi (week-end entre les deux)
      'absent 2026-11-10→2026-11-11',
    ]);
    expect(texteEcart(parc, ecarts[1], court)).toBe('953 du 05.11 au 09.11 : prévu 10 203 – OFROU PAB, vu 10 245 – Gare Nyon');
    expect(texteEcart(parc, ecarts[0], court)).toBe('953 du 03.11 au 04.11 : prévu 10 203 – OFROU PAB, pas vu');
    expect(nyon.id).toBeTruthy();
  });
  it('un projet sans chantier est écrit par son nom', () => {
    const { parc } = essai();
    const c = comparer(parc, [journal(ligne('953', '2026-11-02', 'Essai terrain'))], JOUR);
    expect(texteEcart(parc, ecartsAVerifier(c)[0], (i) => i)).toBe('953 le 2026-11-02 : vu Essai terrain, rien de prévu');
  });
});

describe('Préremplir', () => {
  it('une affectation par suite de jours vus, sur le bon chantier', () => {
    const { parc, a953, a954, pab, nyon } = essai();
    const c = comparer(parc, [journal(
      ligne('953', '2026-11-05', '10 203'), ligne('953', '2026-11-06', '10 203'), ligne('953', '2026-11-09', '10 203'), // jeu, ven, lun
      ligne('953', '2026-11-11', '10 245'), // un autre chantier, un autre jour
      ligne('954', '2026-11-02', '10 203'), ligne('954', '2026-11-04', '10 203'), // trou d'un jour ouvré : deux affectations
      ligne('954', '2026-11-03', 'Essai'), // projet sans chantier : compté à part
    )], JOUR);
    const { propositions, sansChantier } = propositionsDePrerempli(parc, c);
    expect(sansChantier).toBe(1);
    const tri = (liste) => [...liste].sort((a, b) => a.articleId.localeCompare(b.articleId) || a.debut.localeCompare(b.debut));
    expect(tri(propositions)).toEqual(tri([
      { articleId: a953.id, chantierId: pab.id, debut: '2026-11-05', fin: '2026-11-09' },
      { articleId: a953.id, chantierId: nyon.id, debut: '2026-11-11', fin: '2026-11-11' },
      { articleId: a954.id, chantierId: pab.id, debut: '2026-11-02', fin: '2026-11-02' },
      { articleId: a954.id, chantierId: pab.id, debut: '2026-11-04', fin: '2026-11-04' },
    ]));
    expect(propositions.map((p) => p.debut)).toEqual(['2026-11-02', '2026-11-04', '2026-11-05', '2026-11-11']); // par date
  });
  it('les poser change le planning sans rien couper, puis plus rien à proposer', () => {
    const { parc, a953, pab, nyon, poser } = essai();
    poser(a953, nyon, '2026-11-02', '2026-11-04'); // déjà prévu ailleurs : « vu ailleurs », pas préremplissable
    const c = comparer(parc, [journal(ligne('953', '2026-11-03', '10 203'), ligne('953', '2026-11-05', '10 203'), ligne('953', '2026-11-06', '10 203'))], JOUR);
    const { propositions } = propositionsDePrerempli(parc, c);
    expect(propositions).toEqual([{ articleId: a953.id, chantierId: pab.id, debut: '2026-11-05', fin: '2026-11-06' }]);
    expect(appliquerPropositions(parc, propositions)).toEqual({ posees: 1, jours: 2 });
    expect(parc.affectations.map((x) => `${x.debut}/${x.fin}`).sort()).toEqual(['2026-11-02/2026-11-04', '2026-11-05/2026-11-06']);
    expect(parc.affectations.at(-1).remarque).toContain('recap');
    const apres = comparer(parc, [journal(ligne('953', '2026-11-03', '10 203'), ligne('953', '2026-11-05', '10 203'), ligne('953', '2026-11-06', '10 203'))], JOUR);
    expect(propositionsDePrerempli(parc, apres).propositions).toEqual([]);
  });
});
