// Textes des bulles d'aide, rangés au même endroit pour être faciles à relire et à corriger.
// Chaque bulle est désignée par une clé (ex. 'contour'), utilisée par bulle('contour').

export const TEXTES_AIDE = {
  // --- Projet ---
  projets:
    'Les projets sont enregistrés automatiquement sur cet appareil, rien n\'est envoyé sur internet. « Continuer » reprend le travail là où il en est. Pour passer du téléphone à l\'ordinateur : « Exporter le fichier projet », envoie-le-toi (mail, Drive…), puis « Ouvrir un fichier projet » sur l\'autre appareil.',
  cartouche:
    'Affaire, dessinateur et date du plan, écrits dans le cartouche du PDF et dans le nom des fichiers exportés. Date vide : la date du jour de l\'export.',

  // --- 1. Importer ---
  importer:
    'Fichier de points : CSV Emlid ou TXT (nom, Est, Nord, altitude, séparés par des tabulations), en MN95. Les lignes illisibles sont signalées avec leur numéro.',
  leves:
    'Un levé = un fichier de points. Le levé coché est celui affiché sur le plan, avec ses surfaces. Avec plusieurs levés (deux dates), tu peux calculer le volume entre leurs surfaces dans l\'onglet 3. Volumes.',

  // --- 2. Surfaces ---
  surfaces:
    'Une surface peut être un stock, un terrain naturel ou un terrassement. Nomme-la comme tu veux. Elle se crée à partir des points du levé coché (contour, lignes de rupture, points), ou s\'importe d\'un LandXML ou d\'un DXF. Le rôle d\'un point ne dépend jamais de son nom : c\'est toi qui choisis. Touche une surface sur le plan pour la sélectionner.',
  nature:
    'Ce que représente la surface : à choisir avant tout le reste, elle donne son nom automatique (« Stock 2 », « Terrain naturel 1 »…). Un stock reçoit tout de suite son volume (sur sa ligne basse, le contour). Les autres volumes s\'ajoutent dans l\'onglet 3. Volumes. Tu peux changer de nature plus tard (« C\'est : »).',
  contour:
    'Bord de la surface, dans l\'ordre. Le polygone est fermé automatiquement. Seul l\'intérieur du contour est gardé, même pour une forme en « L ». Sans contour, le bord suit les points extérieurs (supprime ensuite les triangles en trop).',
  ligne:
    'Haut de talus, arêtes : les triangles ne traversent jamais ces lignes. Une série = une ligne indépendante ; dans la liste tapée, sépare les lignes par « ; ». Ligne fermée : le dernier point est relié au premier.',
  pointsSurface:
    'Points isolés ou caractéristiques (sommets, creux…), ni sur le contour ni sur une ligne de rupture. Par défaut, tous les points du levé situés dans le contour sont utilisés. Décoche pour choisir les points un par un (en plus de ceux du contour et des lignes de rupture).',
  choisirPoints:
    'Pour choisir les points : touche une série proposée, tape une liste (ex. « b100 à b116, b120 »), touche les points sur le plan (toucher à nouveau un point le retire), ou coche-les dans la liste.',
  trianglesEnTrop:
    'Sans contour, la surface relie les points extérieurs et peut créer des triangles en trop. Active le mode suppression, puis touche un triangle sur le plan pour le supprimer ; le toucher à nouveau le rétablit.',
  photos:
    'Prends une photo du stock (ou choisis-la dans la galerie) : elle est réduite et rangée dans le projet, sur cet appareil. Ajoute une légende. Les photos cochées « dans le PDF » sont imprimées dans la colonne de droite, sous la légende (onglet 3. Volumes).',
  importerSurface:
    'LandXML (export Mensura) : chaque surface TIN du fichier devient une surface. DXF : les faces 3D (3DFACE) ou maillages de chaque calque deviennent une surface, avec X = Est, Y = Nord, Z = altitude (MN95). Tu choisis ensuite ce que c\'est (stock, terrain naturel, terrassement). Une surface importée peut servir de référence dans une comparaison de volumes.',

  // --- 3. Volumes ---
  volumes:
    'Ajoute un volume, puis choisis : « Stock seul » ou « Comparaison de 2 surfaces ». Remblai : le dessus est au-dessus de la base ; déblai : au-dessous. Surface : surface en plan (m²). Ouvre « Détail » pour les valeurs intermédiaires. Le récapitulatif et l\'export sont en dessous.',
  base:
    'Stock seul : volume d\'un stock au-dessus de sa base, prise sur la ligne du contour (les points du pied) ou sur un plan horizontal à l\'altitude que tu donnes. Comparaison : la 1re surface est la référence (terrain naturel, état avant…), la 2e est comparée (terrassement, état après…). Le volume est calculé là où les deux surfaces se recouvrent ; la partie non couverte est signalée. « Voir sur le plan » colorie le remblai en rouge et le déblai en jaune.',
  coupes:
    'Deux coupes au maximum (A – A\' et B – B\'). « + Ajouter une coupe », puis touche le plan au début et à la fin (près d\'un point levé, la coupe s\'accroche à ce point). Corrige ensuite les coordonnées au clavier si besoin. La coupe montre toutes les surfaces affichées qu\'elle traverse, chacune avec sa couleur (stock brun, terrain naturel vert, terrassement bleu). Hauteurs ×2 : le relief est deux fois plus marqué. Coche « dans le PDF » pour l\'ajouter au compte rendu (une feuille Coupes, et le trait de la coupe sur le plan).',
  exporter:
    'PDF : plan à l\'échelle (centré sur les surfaces ; A4, ou A3 si le plan ne tient pas en A4 à l\'échelle choisie), volumes et cartouche. Photo aérienne atténuée : à 50 % pour que le plan se lise mieux. Cadastre : seulement les limites, en traits, sur fond transparent. Coche ce que le PDF doit montrer (noms, altitudes des points, triangles…). CSV : tableau des volumes pour Excel. DXF (R12) : points avec leur nom et leur altitude (calques NOMS et ALTITUDES), contours, lignes de rupture, triangles en faces 3D, surfaces et courbes. LandXML : les surfaces affichées.',

  // --- Plan ---
  plan:
    'Pince avec deux doigts pour zoomer, glisse pour te déplacer. Touche une surface pour la choisir ; pendant une modification, touche un point pour l\'ajouter ou le retirer. « Calques » choisit ce qui est affiché. Rouge = remblai, jaune = déblai : plus la couleur est foncée, plus l\'épaisseur est grande (palier réglable dans « Calques »).',
};
