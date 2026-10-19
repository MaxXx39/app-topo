// Textes des bulles d'aide, rangés au même endroit pour être faciles à relire et à corriger.
// Chaque bulle est désignée par une clé (ex. 'contour'), utilisée par bulle('contour').

export const TEXTES_AIDE = {
  // --- Mes projets ---
  projets:
    'Les projets sont enregistrés automatiquement sur cet appareil, rien n\'est envoyé sur internet. Pour passer du téléphone à l\'ordinateur : « Exporter le fichier projet », envoie-le-toi (mail, Drive…), puis « Ouvrir un fichier projet » sur l\'autre appareil.',

  // --- 1. Importer ---
  importer:
    'Fichier de points : CSV Emlid ou TXT (nom, Est, Nord, altitude, séparés par des tabulations), en MN95. Les lignes illisibles sont signalées avec leur numéro. Surface LandXML : export Mensura ; chaque surface TIN du fichier devient une surface du projet (onglet Comparer).',
  leves:
    'Un levé = un fichier de points. Les stocks se rattachent au levé coché. Avec plusieurs levés (deux dates), tu peux comparer les surfaces dans l\'onglet Comparer.',

  // --- 2. Stocks ---
  stocks:
    'Un stock se définit par son contour, sa surface de base et ses lignes de rupture. Le rôle d\'un point ne dépend jamais de son nom : c\'est toi qui choisis. Touche un stock sur le plan pour le sélectionner.',
  contour:
    'Bord du stock, dans l\'ordre. Le polygone est fermé automatiquement. Seul l\'intérieur du contour est compté, même pour une forme en « L ».',
  base:
    'Mode A : la base est formée par les points du pied (par défaut, les mêmes que le contour). Mode B : la base est une surface du projet, créée dans l\'onglet Comparer ou importée d\'un LandXML. Si elle ne couvre pas tout le contour, la partie non couverte n\'est pas comptée et un avertissement l\'indique.',
  ligne:
    'Haut de talus, arêtes : les triangles ne traversent jamais ces lignes. Une série = une ligne indépendante ; dans la liste tapée, sépare les lignes par « ; ». Ligne fermée : le dernier point est relié au premier.',
  dessus: 'Points isolés sur le dessus du stock, qui ne font partie d\'aucune ligne de rupture.',
  choisirPoints:
    'Pour choisir les points : touche une série proposée, tape une liste (ex. « b100 à b116, b120 »), touche les points sur le plan (toucher à nouveau un point le retire), ou coche-les dans la liste.',

  // --- 3. Volumes ---
  volumes:
    'Remblai : volume où le dessus du stock est au-dessus de la base. Déblai : volume où il est au-dessous. Surface : surface en plan à l\'intérieur du contour (m²). Ouvre « Détail » pour les valeurs intermédiaires (nombre de triangles, surface non couverte…).',
  exporter:
    'PDF : plan à l\'échelle, volumes et cartouche. CSV : tableau des volumes pour Excel. DXF (R12) : points, contours, lignes de rupture, triangles en faces 3D, surfaces et courbes. LandXML : dessus de chaque stock et surfaces du projet.',

  // --- Comparer ---
  contourSurface:
    'Optionnel. Bord de la surface, dans l\'ordre. Sans contour, le bord suit les points extérieurs ; supprime ensuite les triangles en trop.',
  pointsSurface: 'Points utilisés pour la surface, en plus de ceux des lignes de rupture et du contour.',
  surfaces:
    'Une surface (modèle de terrain) se crée à partir des points d\'un levé, ou s\'importe d\'un LandXML (onglet 1. Importer). Elle peut servir de base à un stock (mode B) ou être comparée à une autre surface.',
  trianglesEnTrop:
    'Sans contour, la surface relie les points extérieurs et peut créer des triangles en trop. Active le mode suppression, puis touche un triangle sur le plan pour le supprimer ; le toucher à nouveau le rétablit.',
  comparer:
    'Choisis la surface « avant » et la surface « après » (par exemple le même stock levé à deux dates). Volume ajouté : là où le terrain est monté. Volume enlevé : là où il est descendu. La zone peut limiter le calcul au contour d\'un stock. « Voir sur le plan » colorie le remblai en rouge et le déblai en jaune.',

  // --- Plan ---
  plan:
    'Pince avec deux doigts pour zoomer, glisse pour te déplacer. Touche un stock pour le choisir ; pendant une modification, touche un point pour l\'ajouter ou le retirer. « Calques » choisit ce qui est affiché. Rouge = remblai, jaune = déblai : plus la couleur est foncée, plus l\'épaisseur est grande (palier réglable dans « Calques »).',
};
