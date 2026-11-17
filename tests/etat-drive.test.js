import { describe, it, expect } from 'vitest';
import { nuageDriveRouge } from '../src/topo/etat-drive.js';

describe('nuage de Drive rouge (pastille « Hors ligne »)', () => {
  it('rouge sans internet, même si Google n\'est pas connecté', () => {
    expect(nuageDriveRouge({ horsLigne: true, connecte: false, etat: null })).toBe(true);
    expect(nuageDriveRouge({ horsLigne: true, connecte: true, etat: 'a-jour' })).toBe(true);
  });
  it('rouge quand Drive est connecté mais en erreur ou en attente (le navigateur se croit en ligne)', () => {
    expect(nuageDriveRouge({ horsLigne: false, connecte: true, etat: 'erreur' })).toBe(true);
    expect(nuageDriveRouge({ horsLigne: false, connecte: true, etat: 'attente' })).toBe(true);
  });
  it('pas rouge : à jour, envoi, main rendue, Google non connecté', () => {
    for (const etat of ['a-jour', 'envoi', 'connexion', 'rendu', 'repris']) expect(nuageDriveRouge({ horsLigne: false, connecte: true, etat })).toBe(false);
    expect(nuageDriveRouge({ horsLigne: false, connecte: false, etat: null })).toBe(false);
  });
});
