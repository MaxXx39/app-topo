import { describe, it, expect } from 'vitest';
import { sortesDePhrases, lignesBatterie } from '../src/topo/nmea-sortes.js';

describe('journal NMEA : sortes de phrases', () => {
  const journal = '$GNGGA,1,2*00\r\n$GNGGA,1,2*00\r\n$GPGST,1*00\r\n$PEMLID,BAT,87*00\r\nbruit\r\n';
  it('compte les sortes de phrases', () => {
    expect(sortesDePhrases(journal)).toEqual([
      { sorte: 'GGA', nombre: 2 },
      { sorte: 'GST', nombre: 1 },
      { sorte: 'PEMLID', nombre: 1 },
    ]);
  });
  it('trouve les lignes qui parlent de batterie', () => {
    expect(lignesBatterie(journal)).toEqual(['$PEMLID,BAT,87*00']);
    expect(lignesBatterie('$GNGGA,1*00')).toEqual([]);
  });
});
