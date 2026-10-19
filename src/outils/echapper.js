/** Protège un texte (venant d'un fichier ou tapé) avant de l'afficher dans la page. */
export function echapper(texte) {
  return String(texte)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
