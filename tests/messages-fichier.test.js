import { describe, it, expect } from 'vitest';
import { messagePdf, messageMauvaisBouton } from '../src/topo/messages-fichier.js';

describe('messages d\'import', () => {
  it('traduit les erreurs de pdf.js', () => {
    expect(messagePdf({ name: 'PasswordException', message: 'No password given' })).toContain('mot de passe');
    expect(messagePdf({ name: 'InvalidPDFException', message: 'Invalid PDF structure.' })).toContain('pas un PDF');
    expect(messagePdf(new Error('aucun trait ni image sur cette page'))).toBe('aucun trait ni image sur cette page');
  });
  it('dit où importer un fichier donné au mauvais bouton', () => {
    expect(messageMauvaisBouton('plan.dxf')).toContain('Plan DXF');
    expect(messageMauvaisBouton('a.pdf')).toContain('Plan PDF');
    expect(messageMauvaisBouton('s.xml')).toContain('Surface');
    expect(messageMauvaisBouton('points.txt', '0\nSECTION\n2\nHEADER')).toContain('Plan DXF');
    expect(messageMauvaisBouton('points.txt', 'p1 1 2 3')).toBe('');
  });
});
