// Messages d'erreur d'import compréhensibles (0.244.0, audit) : pdf.js répond en anglais, et on peut donner
// au mauvais bouton un fichier d'un autre type (plan comme liste de points…).

/** Message en français pour une erreur de lecture de PDF (pdf.js : « Invalid PDF structure », « No password given »…). */
export function messagePdf(erreur) {
  const texte = String(erreur?.message ?? erreur ?? '');
  const nom = erreur?.name ?? '';
  if (/password/i.test(texte) || nom === 'PasswordException') return 'PDF protégé par un mot de passe : enlève la protection puis réessaie';
  if (/invalid pdf|InvalidPDF|missing pdf|header/i.test(texte) || nom === 'InvalidPDFException' || nom === 'MissingPDFException') return 'ce fichier n\'est pas un PDF lisible (abîmé ou d\'un autre type)';
  if (/^[\x00-\x7F]*$/.test(texte) && /[a-z]{4,} [a-z]{3,}/i.test(texte) && /\b(the|is|not|of|file|error|failed|unexpected)\b/i.test(texte)) return `lecture impossible (${texte})`;
  return texte;
}

/** Si le fichier de points est en fait un autre type (DXF, PDF, LandXML…), renvoie le message qui dit où l'importer ; sinon ''. */
export function messageMauvaisBouton(nomFichier, apercu = '') {
  const nom = String(nomFichier ?? '').toLowerCase();
  if (/\.dxf$/.test(nom)) return 'c\'est un plan DXF : utilise « Plan DXF » (ou « Surface » pour un DXF 3D)';
  if (/\.pdf$/.test(nom)) return 'c\'est un PDF : utilise « Plan PDF »';
  if (/\.(xml|landxml)$/.test(nom) || /^\s*<\?xml/i.test(apercu)) return 'c\'est un fichier LandXML : utilise « Surface » (LandXML, DXF 3D)';
  if (/^\s*0\s*\r?\n\s*SECTION/i.test(apercu)) return 'c\'est un plan DXF : utilise « Plan DXF »';
  if (/^%PDF/.test(apercu)) return 'c\'est un PDF : utilise « Plan PDF »';
  return '';
}
