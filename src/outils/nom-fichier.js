// Un seul modèle de nom pour tous les fichiers exportés (0.245.0, décision du 16.11) : « affaire_contenu_date »,
// par exemple « 10_203_Gland_points_2026-11-16.csv ». Caractères interdits remplacés par « _ ».

/** Date du jour en AAAA-MM-JJ (heure locale). */
export function dateDuJour(maintenant = new Date()) {
  const deux = (n) => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
}

/** « affaire_contenu_date » (sans extension). affaire vide → « projet ». */
export function nomFichierExport(affaire, contenu, date = dateDuJour()) {
  const propre = (texte) => String(texte ?? '').trim().replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '');
  return [propre(affaire) || 'projet', propre(contenu), propre(date)].filter(Boolean).join('_');
}
