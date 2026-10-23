// Lecture des fichiers de points : CSV Emlid et TXT (nom, Est, Nord, altitude, code facultatif ;
// séparés par des tabulations, des points-virgules, des espaces ou des virgules ; décimales avec
// un point ou une virgule).
// Chaque point lu a la forme : { nom, est, nord, altitude, ligne }
// - est, nord, altitude : en mètres, MN95, sans aucune conversion
// - ligne : numéro de la ligne dans le fichier (pour les messages)

/**
 * Lit le contenu d'un fichier de points et reconnaît son format tout seul.
 * - CSV Emlid : la première ligne contient les titres (Name, Easting, ...)
 * - TXT : chaque ligne contient nom, Est, Nord, altitude (puis un code, pas utilisé), séparés
 *   par des tabulations, des points-virgules, des espaces ou des virgules
 * Renvoie { format, points, erreurs, avertissements }.
 * Une ligne illisible ne bloque pas la lecture : elle est signalée dans "erreurs".
 */
export function lirePoints(texte) {
  const lignes = decouperLignes(texte);
  const premiereLigne = lignes.find((ligne) => ligne.trim() !== '') ?? '';

  let resultat;
  if (/easting/i.test(premiereLigne)) {
    resultat = lireCsvEmlid(lignes);
  } else {
    resultat = lireTxt(lignes);
  }

  resultat.avertissements = chercherNomsEnDouble(resultat.points);
  return resultat;
}

/**
 * Découpe le texte en lignes, quelle que soit la fin de ligne
 * (Windows "\r\n" ou autre "\n"). Enlève aussi le caractère
 * invisible (BOM) que certains logiciels ajoutent au début du fichier.
 */
function decouperLignes(texte) {
  return texte.replace(/^﻿/, '').split(/\r\n|\r|\n/);
}

/**
 * Lit un fichier CSV exporté par Emlid Flow.
 * On repère les colonnes Name, Easting, Northing, Elevation par leur titre,
 * pour ne pas dépendre de leur position.
 */
function lireCsvEmlid(lignes) {
  const points = [];
  const erreurs = [];

  const indexTitres = lignes.findIndex((ligne) => ligne.trim() !== '');
  const titres = decouperLigneCsv(lignes[indexTitres]).map((titre) => titre.trim().toLowerCase());
  const colonnes = {
    nom: titres.indexOf('name'),
    est: titres.indexOf('easting'),
    nord: titres.indexOf('northing'),
    altitude: titres.indexOf('elevation'),
  };

  const manquantes = Object.entries({
    Name: colonnes.nom,
    Easting: colonnes.est,
    Northing: colonnes.nord,
    Elevation: colonnes.altitude,
  })
    .filter(([, index]) => index === -1)
    .map(([titre]) => titre);
  if (manquantes.length > 0) {
    erreurs.push({
      ligne: indexTitres + 1,
      message: `colonne(s) introuvable(s) : ${manquantes.join(', ')}`,
    });
    return { format: 'CSV Emlid', points, erreurs };
  }

  for (let i = indexTitres + 1; i < lignes.length; i++) {
    if (lignes[i].trim() === '') continue;
    const champs = decouperLigneCsv(lignes[i]);
    const point = creerPoint(
      champs[colonnes.nom],
      champs[colonnes.est],
      champs[colonnes.nord],
      champs[colonnes.altitude],
      i + 1,
    );
    if (point.erreur) erreurs.push({ ligne: i + 1, message: point.erreur });
    else points.push(point);
  }

  return { format: 'CSV Emlid', points, erreurs };
}

/**
 * Lit un fichier TXT : nom, Est, Nord, altitude, puis éventuellement un code (pas utilisé).
 * Séparateur au choix (voir decouperLigneTxt), décimales avec un point ou une virgule.
 * Une première ligne de titres (« Nom ; Est ; Nord ; H ») est sautée sans erreur.
 */
function lireTxt(lignes) {
  const points = [];
  const erreurs = [];
  let premiere = true;

  for (let i = 0; i < lignes.length; i++) {
    if (lignes[i].trim() === '') continue;
    const champs = decouperLigneTxt(lignes[i]);
    const titres = premiere && champs.length >= 3 && lireNombre(champs[1]) === null && lireNombre(champs[2]) === null;
    premiere = false;
    if (titres) continue;
    if (champs.length < 4) {
      erreurs.push({
        ligne: i + 1,
        message: '4 valeurs attendues (nom, Est, Nord, altitude)',
      });
      continue;
    }
    const point = creerPoint(champs[0], champs[1], champs[2], champs[3], i + 1);
    if (point.erreur) erreurs.push({ ligne: i + 1, message: point.erreur });
    else points.push(point);
  }

  return { format: 'TXT', points, erreurs };
}

/**
 * Découpe une ligne de fichier TXT en champs :
 * - tabulation ou point-virgule s'il y en a (cases vides gardées) ;
 * - sinon un ou plusieurs espaces ;
 * - sinon (moins de 4 valeurs) la virgule : « p1,2500000.1,1200000.2,450.3 ».
 */
export function decouperLigneTxt(ligne) {
  const propre = ligne.trim();
  if (propre.includes('\t')) return propre.split('\t').map((champ) => champ.trim());
  if (propre.includes(';')) return propre.split(';').map((champ) => champ.trim());
  const parEspaces = propre.split(/\s+/);
  if (parEspaces.length >= 4 || !propre.includes(',')) return parEspaces;
  return propre.split(',').map((champ) => champ.trim());
}

/**
 * Découpe une ligne CSV en champs, séparés par des virgules.
 * Gère les champs entre guillemets, qui peuvent contenir une virgule
 * (par exemple une description "tas, côté nord").
 */
function decouperLigneCsv(ligne) {
  const champs = [];
  let champ = '';
  let entreGuillemets = false;

  for (let i = 0; i < ligne.length; i++) {
    const caractere = ligne[i];
    if (entreGuillemets) {
      if (caractere === '"' && ligne[i + 1] === '"') {
        champ += '"'; // deux guillemets = un guillemet dans le texte
        i++;
      } else if (caractere === '"') {
        entreGuillemets = false;
      } else {
        champ += caractere;
      }
    } else if (caractere === '"') {
      entreGuillemets = true;
    } else if (caractere === ',') {
      champs.push(champ);
      champ = '';
    } else {
      champ += caractere;
    }
  }
  champs.push(champ);
  return champs;
}

/**
 * Crée un point à partir des textes lus dans le fichier.
 * Renvoie { erreur } si le nom manque ou si une coordonnée n'est pas un nombre.
 */
function creerPoint(texteNom, texteEst, texteNord, texteAltitude, ligne) {
  const nom = (texteNom ?? '').trim();
  if (nom === '') return { erreur: 'nom du point manquant' };

  const est = lireNombre(texteEst);
  const nord = lireNombre(texteNord);
  const altitude = lireNombre(texteAltitude);
  const illisibles = [];
  if (est === null) illisibles.push('Est');
  if (nord === null) illisibles.push('Nord');
  if (altitude === null) illisibles.push('altitude');
  if (illisibles.length > 0) {
    return { erreur: `point « ${nom} » : ${illisibles.join(', ')} illisible(s)` };
  }

  return { nom, est, nord, altitude, ligne };
}

/**
 * Transforme un texte en nombre (séparateur décimal : le point ou la virgule).
 * Renvoie null si le texte n'est pas un nombre valable.
 */
function lireNombre(texte) {
  const propre = (texte ?? '').trim().replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(propre)) return null;
  return Number(propre);
}

/**
 * Signale les noms de points présents plusieurs fois dans le fichier.
 * Les points sont tous gardés : c'est à l'utilisateur de décider.
 */
function chercherNomsEnDouble(points) {
  const lignesParNom = new Map();
  for (const point of points) {
    if (!lignesParNom.has(point.nom)) lignesParNom.set(point.nom, []);
    lignesParNom.get(point.nom).push(point.ligne);
  }
  const avertissements = [];
  for (const [nom, lignesDuNom] of lignesParNom) {
    if (lignesDuNom.length > 1) {
      avertissements.push(`le nom « ${nom} » apparaît plusieurs fois (lignes ${lignesDuNom.join(', ')})`);
    }
  }
  return avertissements;
}
