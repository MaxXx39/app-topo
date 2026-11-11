// « Contenu du projet » (0.186.1) : doit s'écrire sans erreur (une variable utilisée trop tôt l'avait laissé vide).
import { describe, it, expect } from 'vitest';
import { blocContenu } from '../src/import/ecran.js';
import { creerProjet } from '../src/projet/projet.js';

describe('blocContenu', () => {
  it('0.193.0 : plus de catégories Contrôle / Levés / Points importés en double ; la gestion est dans « Gérer »', () => {
    const projet = creerProjet('t');
    const pt = { nom: 'P1', est: 1, nord: 2, altitude: 3 };
    projet.leves.push(
      { id: 'a', nom: 'A', direct: true, importeLe: '2026-11-01T10:00:00Z', points: [pt] },
      { id: 'b', nom: 'B', direct: true, importeLe: '2026-11-02T10:00:00Z', points: [{ ...pt, nom: 'P3' }] },
      { id: 'c', nom: 'C', importeLe: '2026-11-03T10:00:00Z', points: [{ ...pt, nom: 'P2' }] },
    );
    projet.couleursListes = { a: '#ff0000' };
    const html = blocContenu(projet, new Set(), new Set());
    expect(html).not.toContain('data-categorie="leves"');
    expect(html).not.toContain('data-categorie="points"');
    expect(html).not.toContain('data-categorie="controle"');
    expect(html).toContain('Liste de points');
    expect(html).toContain('data-action="gerer-ouvrir"');
    expect(html).not.toContain('Gérer les listes choisies');
    expect(html).toContain('--couleur-liste: #ff0000'); // la liste garde sa couleur
  });

  it('0.191.0 : propose le tableau « Points » (catégories, jour, tri, export)', () => {
    const projet = creerProjet('t');
    projet.leves.push({ id: 'a', nom: 'A', direct: true, importeLe: '2026-11-01T10:00:00Z', points: [{ nom: 'P1', est: 1, nord: 2, altitude: 3, gnss: { prisLe: '2026-11-01T10:00:00Z' } }] });
    const html = blocContenu(projet, new Set(), new Set());
    expect(html).toContain('Liste de points');
    expect(html).toContain('Natures');
    expect(html).toContain('Listes');
    expect(html).toContain('Levé libre');
    expect(html).not.toContain('LV-Libre');
    expect(html).toContain('data-action="tp-categorie"');
    expect(html).toContain('data-champ="tp-jour"');
    expect(html).toContain('data-action="tp-tri"');
    expect(html).toContain('data-action="tp-exporter"');
    expect(html).toContain('>P1<');
  });

  it('0.197.0 : une page par bouton (Plans, Surfaces importées, Archives), plus rien de mélangé', () => {
    const projet = creerProjet('t');
    projet.leves.push({ id: 'a', nom: 'A', direct: true, importeLe: '2026-11-01T10:00:00Z', points: [{ nom: 'P1', est: 1, nord: 2, altitude: 3 }] });
    const tableau = { categories: null, listesDecochees: new Set(), colonne: 'date', asc: false, jour: '' };
    const filtre = { ordre: 'recent', jour: '' };
    const plans = blocContenu(projet, new Set(), new Set(), filtre, tableau, 'plans');
    expect(plans).toContain('Plans');
    expect(plans).not.toContain('data-action="tp-categorie"');
    expect(blocContenu(projet, new Set(), new Set(), filtre, tableau, 'surfaces')).toContain('Rien ici');
    expect(blocContenu(projet, new Set(), new Set(), filtre, tableau, 'archives')).toContain('Archives');
    expect(blocContenu(projet, new Set(), new Set(), filtre, tableau, 'points')).toContain('data-action="tp-categorie"');
  });

  it('0.198.0 : colonnes déplaçables, « Nom » toujours en premier', () => {
    const projet = creerProjet('t');
    projet.leves.push({ id: 'a', nom: 'A', direct: true, importeLe: '2026-11-01T10:00:00Z', points: [{ nom: 'P1', est: 1, nord: 2, altitude: 3 }] });
    const filtre = { ordre: 'recent', jour: '' };
    const etat = { categories: null, listesDecochees: new Set(), colonne: 'date', asc: false, jour: '', ordre: ['photos', 'est'], organiser: true };
    const html = blocContenu(projet, new Set(), new Set(), filtre, etat, 'points');
    expect(html).toContain('data-action="tp-colonne"');
    expect(html).toContain('Terminé');
    const titres = [...html.matchAll(/<th[^>]*>.*?<\/th>/g)].map((m) => m[0].replace(/<[^>]+>/g, '').trim());
    expect(titres[0]).toMatch(/^Nom/);
    expect(titres[1]).toMatch(/^Photo/);
    expect(titres[2]).toMatch(/^E/);
    const normal = blocContenu(projet, new Set(), new Set(), filtre, { ...etat, organiser: false }, 'points');
    expect(normal).toContain('data-action="tp-tri"');
    expect(normal).toContain('⇄ Colonnes');
  });

  it('0.205.0 : page « Gérer » : une ligne par liste avec son ⚙, menu déplié au toucher', () => {
    const projet = creerProjet('t');
    projet.pointsControle = [{ id: 'c1', nom: 'C1', est: 1, nord: 2, altitude: 3 }];
    projet.leves.push(
      { id: 'a', nom: 'LV-Stock 1', direct: true, importeLe: '2026-11-01T10:00:00Z', points: [{ nom: 'P1', est: 1, nord: 2, altitude: 3 }] },
      { id: 'i', nom: 'points.csv', importeLe: '2026-11-02T10:00:00Z', points: [{ nom: 'I1', est: 1, nord: 2, altitude: 3 }] },
    );
    projet.surfaces.push({ id: 's1', nom: 'LV-Stock 1', leveId: 'a', nature: 'stock', points: [], faces: [] });
    const tableau = { categories: null, listesDecochees: new Set(), colonne: 'date', asc: false, jour: '' };
    const filtre = { ordre: 'recent', jour: '' };
    const ferme = blocContenu(projet, new Set(), new Set(), filtre, tableau, 'points', { gerer: true, menusOuverts: new Set() });
    expect(ferme).toContain('Gérer · Liste de points');
    expect(ferme).toContain('data-action="gerer-fermer"');
    expect(ferme.match(/data-action="gerer-menu"/g)).toHaveLength(3); // contrôle, levé, liste importée
    expect(ferme).not.toContain('menu-ligne-gerer');
    expect(ferme).not.toContain('Voir les points');
    const ouvert = blocContenu(projet, new Set(), new Set(), filtre, tableau, 'points', { gerer: true, menusOuverts: new Set(['points:a']) });
    expect(ouvert).toContain('menu-ligne-gerer');
    expect(ouvert).toContain('data-champ="nom-leve"');
    expect(ouvert).toContain('data-action="exporter-liste" data-type="leve" data-id="a"');
    expect(ouvert).toContain('data-action="archiver"');
    expect(ouvert).not.toContain('Dupliquer');
    // En bas du tableau normal, plus de gestion.
    expect(blocContenu(projet, new Set(), new Set(), filtre, tableau, 'points')).not.toContain('data-action="archiver"');
  });

  it('0.205.0 : « Gérer » aussi pour Plans, Surfaces importées et Archives', () => {
    const projet = creerProjet('t');
    projet.plansDxf = [{ id: 'p1', nom: 'plan.dxf', visible: true, calques: [], compte: { objets: 4 } }];
    projet.surfaces.push({ id: 'f1', nom: 'Surf-ter', faces: [1, 2], nomFichier: 'ter.xml', origine: 'fichier', points: [] });
    projet.archives = [{ id: 'z1', type: 'leve', nom: 'vieux', archiveLe: '2026-11-01T10:00:00Z', donnees: {} }];
    const tableau = { categories: null, listesDecochees: new Set(), colonne: 'date', asc: false, jour: '' };
    const filtre = { ordre: 'recent', jour: '' };
    const gerer = (vue, ouverts) => blocContenu(projet, new Set(), new Set(), filtre, tableau, vue, { gerer: true, menusOuverts: new Set(ouverts) });
    const plans = gerer('plans', ['plans:p1']);
    expect(plans).toContain('Gérer · Plans');
    expect(plans).toContain('data-champ="plan-nom"');
    expect(plans).toContain('data-action="voir-plan"');
    expect(plans).toContain('data-action="recaler-plan"');
    expect(blocContenu(projet, new Set(), new Set(), filtre, tableau, 'plans')).not.toContain('data-action="recaler-plan"');
    expect(gerer('archives', ['archives:z1'])).toContain('data-action="restaurer-archive"');
    for (const vue of ['plans', 'surfaces', 'archives']) {
      expect(blocContenu(projet, new Set(), new Set(), filtre, tableau, vue)).toContain('data-action="gerer-ouvrir"');
    }
  });
});
