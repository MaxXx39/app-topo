// Lecture des fichiers LandXML 1.1 (export Mensura) : surfaces TIN.
//
// Pièges de ce format :
// - Les coordonnées sont dans l'ordre Nord, Est, altitude (et non Est, Nord).
//   On les remet toujours dans l'ordre Est, Nord, altitude à la lecture.
// - Les triangles (<F>) désignent les points par leur numéro interne "id",
//   pas par leur position dans la liste.
// - Un fichier peut contenir plusieurs surfaces : l'utilisateur choisit.
// - Seules les surfaces de type TIN sont lues.
// - Un triangle marqué i="1" est invisible (exclu de la surface) : on l'ignore.

/**
 * Lit le texte d'un fichier LandXML.
 * Renvoie { surfaces, erreurs, avertissements } où chaque surface vaut :
 * { nom, description, points, triangles, lignesRupture, contours, trianglesInvisibles,
 *   surfaceAnnoncee }
 * - points : liste de { id, nom, est, nord, altitude } (m)
 * - triangles : liste de 3 points
 * - lignesRupture, contours : listes de lignes, chaque ligne = liste de { est, nord, altitude }
 * - surfaceAnnoncee : surface en plan écrite dans le fichier (m²), ou null
 */
export function lireLandXML(texte) {
  const erreurs = [];
  const avertissements = [];
  const surfaces = [];

  // On remplace les commentaires par des espaces (même longueur) pour garder les numéros de ligne.
  const contenu = texte.replace(/<!--[\s\S]*?-->/g, (commentaire) => commentaire.replace(/[^\n]/g, ' '));

  if (!/<LandXML[\s>]/.test(contenu)) {
    return { surfaces, erreurs: ['ce fichier n\'est pas un fichier LandXML'], avertissements };
  }

  const blocsSurface = [...contenu.matchAll(/<Surface\b([^>]*)>([\s\S]*?)<\/Surface>/g)];
  if (blocsSurface.length === 0) erreurs.push('aucune surface trouvée dans le fichier');

  for (const bloc of blocsSurface) {
    const attributsSurface = lireAttributs(bloc[1]);
    const nom = attributsSurface.name ?? `Surface ${surfaces.length + 1}`;
    const debutBloc = bloc.index + bloc[0].indexOf(bloc[2]);
    const corps = bloc[2];

    const definition = corps.match(/<Definition\b([^>]*)>/);
    const type = definition ? lireAttributs(definition[1]).surfType : undefined;
    if (type !== 'TIN') {
      avertissements.push(`surface « ${nom} » ignorée : type ${type ?? 'inconnu'} (seul le type TIN est lu)`);
      continue;
    }
    const attributsDefinition = lireAttributs(definition[1]);
    const erreursSurface = [];
    const signaler = (position, message) =>
      erreursSurface.push(`surface « ${nom} », ligne ${numeroDeLigne(contenu, debutBloc + position)} : ${message}`);

    // --- Points : <P id="12" name="44">Nord Est altitude</P> ---
    const pointsParId = new Map();
    for (const balise of corps.matchAll(/<P\b([^>]*)>([^<]*)<\/P>/g)) {
      const attributs = lireAttributs(balise[1]);
      const valeurs = lireNombres(balise[2]);
      if (attributs.id === undefined) {
        signaler(balise.index, 'point sans numéro « id »');
        continue;
      }
      if (valeurs === null || valeurs.length < 3) {
        signaler(balise.index, `point id ${attributs.id} : 3 nombres attendus (Nord, Est, altitude)`);
        continue;
      }
      const [nord, est, altitude] = valeurs;
      pointsParId.set(attributs.id, { id: attributs.id, nom: attributs.name ?? attributs.id, est, nord, altitude });
    }

    // --- Triangles : <F>id1 id2 id3</F>, avec i="1" pour un triangle invisible ---
    const triangles = [];
    let trianglesInvisibles = 0;
    for (const balise of corps.matchAll(/<F\b([^>]*)>([^<]*)<\/F>/g)) {
      if (lireAttributs(balise[1]).i === '1') {
        trianglesInvisibles++;
        continue;
      }
      const ids = balise[2].trim().split(/\s+/);
      if (ids.length < 3) {
        signaler(balise.index, 'triangle avec moins de 3 points');
        continue;
      }
      const sommets = ids.slice(0, 3).map((id) => pointsParId.get(id));
      const manquant = ids.slice(0, 3).find((id) => !pointsParId.has(id));
      if (manquant !== undefined) {
        signaler(balise.index, `triangle qui utilise le point id ${manquant}, absent de la liste des points`);
        continue;
      }
      triangles.push(sommets);
    }

    // --- Lignes de rupture et contours (pour information et pour le plan) ---
    const lignesRupture = lireListesDePoints(corps, 'Breakline');
    const contours = lireListesDePoints(corps, 'Boundary');

    if (erreursSurface.length > 0) erreurs.push(...erreursSurface);
    if (triangles.length === 0) {
      erreurs.push(`surface « ${nom} » : aucun triangle lisible`);
      continue;
    }

    const surfaceAnnoncee = Number(attributsDefinition.area2DSurf);
    surfaces.push({
      nom,
      description: attributsSurface.desc ?? '',
      points: [...pointsParId.values()],
      triangles,
      lignesRupture,
      contours,
      trianglesInvisibles,
      surfaceAnnoncee: Number.isFinite(surfaceAnnoncee) ? surfaceAnnoncee : null,
    });
  }

  return { surfaces, erreurs, avertissements };
}

/**
 * Résumé chiffré d'une surface : surface en plan (m²), altitudes min et max (m),
 * et étendue en plan (Est et Nord min et max, en m).
 */
export function resumerSurface(surface) {
  let surfacePlan = 0;
  for (const [a, b, c] of surface.triangles) {
    surfacePlan += Math.abs((b.est - a.est) * (c.nord - a.nord) - (c.est - a.est) * (b.nord - a.nord)) / 2;
  }
  const sommets = surface.triangles.flat();
  const valeurs = (cle) => sommets.map((p) => p[cle]);
  return {
    surfacePlan,
    altitudeMin: Math.min(...valeurs('altitude')),
    altitudeMax: Math.max(...valeurs('altitude')),
    estMin: Math.min(...valeurs('est')),
    estMax: Math.max(...valeurs('est')),
    nordMin: Math.min(...valeurs('nord')),
    nordMax: Math.max(...valeurs('nord')),
  };
}

/**
 * Lit les balises <Breakline> ou <Boundary> et leur liste de points
 * (<PntList3D> : Nord Est altitude ; <PntList2D> : Nord Est).
 */
function lireListesDePoints(corps, nomBalise) {
  const listes = [];
  const expression = new RegExp(`<${nomBalise}\\b[^>]*>([\\s\\S]*?)<\\/${nomBalise}>`, 'g');
  for (const balise of corps.matchAll(expression)) {
    const liste3D = balise[1].match(/<PntList3D\b[^>]*>([^<]*)<\/PntList3D>/);
    const liste2D = balise[1].match(/<PntList2D\b[^>]*>([^<]*)<\/PntList2D>/);
    const pas = liste3D ? 3 : 2;
    const valeurs = lireNombres((liste3D ?? liste2D)?.[1] ?? '');
    if (!valeurs) continue;
    const points = [];
    for (let i = 0; i + pas <= valeurs.length; i += pas) {
      points.push({ nord: valeurs[i], est: valeurs[i + 1], altitude: pas === 3 ? valeurs[i + 2] : null });
    }
    if (points.length >= 2) listes.push(points);
  }
  return listes;
}

/** Lit les attributs d'une balise : ' id="12" name="a" ' -> { id: '12', name: 'a' }. */
function lireAttributs(texte) {
  const attributs = {};
  for (const [, nom, valeur1, valeur2] of texte.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributs[nom] = decoderEntites(valeur1 ?? valeur2);
  }
  return attributs;
}

/** Remplace les codes XML (&amp; ...) par les caractères qu'ils représentent. */
function decoderEntites(texte) {
  return texte
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

/** Lit une suite de nombres séparés par des espaces. Renvoie null si un élément n'est pas un nombre. */
function lireNombres(texte) {
  const morceaux = texte.trim().split(/\s+/).filter((m) => m !== '');
  const nombres = morceaux.map(Number);
  return nombres.every(Number.isFinite) ? nombres : null;
}

/** Numéro de ligne (à partir de 1) d'une position dans le texte. */
function numeroDeLigne(texte, position) {
  let ligne = 1;
  for (let i = 0; i < position; i++) if (texte.charCodeAt(i) === 10) ligne++;
  return ligne;
}

/**
 * Écrit un fichier LandXML 1.1 contenant une ou plusieurs surfaces TIN.
 * - surfaces : liste de { nom, triangles } (triangles = 3 points { nom?, est, nord, altitude })
 * Les points identiques (au mm près) sont partagés entre triangles. Comme dans tout
 * fichier LandXML, les coordonnées sont écrites dans l'ordre Nord, Est, altitude.
 */
export function ecrireLandXML(surfaces, nomProjet = 'Topo') {
  const date = new Date().toISOString();
  const blocs = surfaces.map(({ nom, triangles }) => {
    const ids = new Map();
    const lignesPoints = [];
    const idDuPoint = (p) => {
      const cle = `${p.est.toFixed(3)} ${p.nord.toFixed(3)} ${p.altitude.toFixed(3)}`;
      if (!ids.has(cle)) {
        const id = ids.size + 1;
        ids.set(cle, id);
        const attributNom = p.nom ? ` name="${encoderEntites(p.nom)}"` : '';
        lignesPoints.push(`          <P id="${id}"${attributNom}>${p.nord.toFixed(3)} ${p.est.toFixed(3)} ${p.altitude.toFixed(3)}</P>`);
      }
      return ids.get(cle);
    };
    const faces = triangles.map((t) => `          <F>${t.map(idDuPoint).join(' ')}</F>`);
    let aire = 0;
    for (const [a, b, c] of triangles) aire += Math.abs((b.est - a.est) * (c.nord - a.nord) - (c.est - a.est) * (b.nord - a.nord)) / 2;
    return `    <Surface name="${encoderEntites(nom)}">
      <Definition surfType="TIN" area2DSurf="${aire.toFixed(3)}">
        <Pnts>
${lignesPoints.join('\n')}
        </Pnts>
        <Faces>
${faces.join('\n')}
        </Faces>
      </Definition>
    </Surface>`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>
<LandXML xmlns="http://www.landxml.org/schema/LandXML-1.1" version="1.1" date="${date.slice(0, 10)}" time="${date.slice(11, 19)}">
  <Application name="Topo - Volumes de stocks" />
  <Project name="${encoderEntites(nomProjet)}" />
  <Units>
    <Metric areaUnit="squareMeter" linearUnit="meter" volumeUnit="cubicMeter" />
  </Units>
  <Surfaces>
${blocs.join('\n')}
  </Surfaces>
</LandXML>
`;
}

/** Protège les caractères spéciaux du XML (&, <, >, "). */
function encoderEntites(texte) {
  return String(texte).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
