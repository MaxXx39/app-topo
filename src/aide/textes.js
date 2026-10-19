// Textes des bulles d'aide, rangés au même endroit pour être faciles à relire et à corriger.
// Chaque bulle est désignée par une clé (ex. 'contour'), utilisée par bulle('contour').

export const TEXTES_AIDE = {
  // --- Mes projets ---
  projets:
    'Les projets sont enregistrés automatiquement sur cet appareil, rien n\'est envoyé sur internet. Pour passer du téléphone à l\'ordinateur : « Exporter le fichier projet », envoie-le-toi (mail, Drive…), puis « Ouvrir un fichier projet » sur l\'autre appareil.',

  // --- 1. Importer ---
  importer:
    'Fichier de points : CSV Emlid ou TXT (nom, Est, Nord, altitude, séparés par des tabulations), en MN95. Les lignes illisibles sont signalées avec leur numéro.',
  leves:
    'Un levé = un fichier de points. Le levé coché est celui affiché sur le plan, avec ses surfaces. Avec plusieurs levés (deux dates), tu peux comparer leurs surfaces dans l\'onglet 4. Comparer.',

  // --- 2. Surfaces ---
  surfaces:
    'Une surface peut être un stock, un terrassement, un terrain naturel… Nomme-la comme tu veux. Elle se crée à partir des points du levé coché (contour, lignes de rupture, points), ou s\'importe d\'un LandXML ou d\'un DXF. Le rôle d\'un point ne dépend jamais de son nom : c\'est toi qui choisis. Touche une surface sur le plan pour la sélectionner.',
  contour:
    'Bord de la surface, dans l\'ordre. Le polygone est fermé automatiquement. Seul l\'intérieur du contour est gardé, même pour une forme en « L ». Sans contour, le bord suit les points extérieurs (supprime ensuite les triangles en trop).',
  ligne:
    'Haut de talus, arêtes : les triangles ne traversent jamais ces lignes. Une série = une ligne indépendante ; dans la liste tapée, sépare les lignes par « ; ». Ligne fermée : le dernier point est relié au premier.',
  pointsSurface:
    'Par défaut, tous les points du levé situés dans le contour sont utilisés. Décoche pour choisir les points un par un (en plus de ceux du contour et des lignes de rupture).',
  choisirPoints:
    'Pour choisir les points : touche une série proposée, tape une liste (ex. « b100 à b116, b120 »), touche les points sur le plan (toucher à nouveau un point le retire), ou coche-les dans la liste.',
  trianglesEnTrop:
    'Sans contour, la surface relie les points extérieurs et peut créer des triangles en trop. Active le mode suppression, puis touche un triangle sur le plan pour le supprimer ; le toucher à nouveau le rétablit.',
  photos:
    'Prends une photo du stock (ou choisis-la dans la galerie) : elle est réduite et rangée dans le projet, sur cet appareil. Ajoute une légende ; les photos sont imprimées sur une page « Photos » du PDF (onglet 3. Volumes).',
  importerSurface:
    'LandXML (export Mensura) : chaque surface TIN du fichier devient une surface. DXF : les faces 3D (3DFACE) ou maillages de chaque calque deviennent une surface, avec X = Est, Y = Nord, Z = altitude (MN95). Une surface importée peut servir de base pour un volume ou être comparée.',

  // --- 3. Volumes ---
  volumes:
    'Volume de chaque surface au-dessus de sa base. Remblai : là où la surface est au-dessus de la base. Déblai : là où elle est au-dessous. Surface : surface en plan (m²). Ouvre « Détail » pour les valeurs intermédiaires.',
  base:
    'A : la base passe par les points du contour (le pied), comme pour un stock posé sur le terrain. B : la base est une autre surface (terrain naturel importé, surface « Pied » créée à partir d\'autres points…). Si elle ne couvre pas toute la surface, la partie non couverte n\'est pas comptée et un avertissement l\'indique.',
  exporter:
    'PDF : plan à l\'échelle, volumes et cartouche, plus une feuille par comparaison. CSV : tableau des volumes pour Excel. DXF (R12) : points, contours, lignes de rupture, triangles en faces 3D, surfaces et courbes. LandXML : les surfaces affichées.',

  // --- 4. Comparer ---
  comparer:
    'Choisis la surface « avant » et la surface « après » (par exemple le même stock levé à deux dates). Volume ajouté : là où le terrain est monté. Volume enlevé : là où il est descendu. La zone peut limiter le calcul au contour d\'une surface. « Voir sur le plan » colorie le remblai en rouge et le déblai en jaune.',

  // --- Plan ---
  plan:
    'Pince avec deux doigts pour zoomer, glisse pour te déplacer. Touche une surface pour la choisir ; pendant une modification, touche un point pour l\'ajouter ou le retirer. « Calques » choisit ce qui est affiché. Rouge = remblai, jaune = déblai : plus la couleur est foncée, plus l\'épaisseur est grande (palier réglable dans « Calques »).',
};
