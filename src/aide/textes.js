// Textes des bulles d'aide, rangés au même endroit pour être faciles à relire et à corriger.
// Chaque bulle est désignée par une clé (ex. 'contour'), utilisée par bulle('contour').

// 0.163.0 : chaque bulle tient en 4 lignes au plus (demande du 09.11).
export const TEXTES_AIDE = {
  annotation:
    'Annotation : pose un point (Manuel = loupe sur le plan, GNSS, ou GPS tablette à 3 m ou mieux). En bas : photo (on peut dessiner dessus), ↶ efface le dernier, ID et remarque, Enreg. point. Liste « Annot-date ».',
  mesureRapide:
    'Mesure rapide : touche des points sur le plan (accroche en bas, ou GNSS). 2 points : longueur, Δh, pente. 3 et plus : case « Figure fermée » (périmètre, surface) ou ligne ouverte (longueur du chemin), angles en degrés (colonne Angle, et sur le plan si la case est cochée). « Enregistrer » ou « Exporter » (PDF, DXF).',
  applications:
    'Menu de départ : touche une tuile (ou sa sous-application en petit) pour ouvrir l\'application. Appui long = déplacer la tuile ; ★ = favori. L\'épingle à gauche de « Ouvrir » ouvre la carte de tous les projets (touche un projet, puis « Ouvrir »). Réglages et « Fermer l\'appli » en bas.',
  projets:
    'Projets enregistrés sur cet appareil (📱) ou sur Drive (☁). « Ouvrir » les liste, « ＋ » en crée un, ⋮ renomme (projet ouvert), exporte, duplique ou supprime. Réglages de l\'appareil : tuile Réglages du menu.',
  lame:
    'Guidage (Expert) : choisis la machine puis la surface à suivre. Au-dessus de chaque règle : MONTER (rouge) ou DESCENDRE (bleu) ; OK (vert) dans la tolérance ; entre les deux, seule la valeur (orange) pour que l\'affichage ne saute pas ; vert ≤ 2 cm, orange ≤ 5 cm. Réglages dans ⚙ (1 ou 2 GNSS, G / D, distances, vues).',
  partage:
    'Projets sur Google Drive. Une seule main par projet : verte = tu enregistres, grise ou rouge = lecture seule. Prendre la main à un autre appareil : Expert et code. Nuage en tête d\'écran : vert = à jour, rouge barré = hors ligne, gris barré = Google non connecté ; touche-le pour ouvrir les réglages Drive.',
  cartouche:
    'Écrits dans le cartouche du PDF : affaire, désignation, dessiné par et date (vide = date du jour).',
  imports:
    'Points : CSV Emlid ou TXT en MN95 ; liste de points ou levé. Plans DXF / PDF vectoriels (DWG à enregistrer en DXF), puis recalage. LandXML, surfaces Swisstopo et cadastre : choisis-les ici.',
  lever:
    'Choisis le rôle (Contour, Ligne, Point) et le libellé, puis Enreg. (ou touche volume −), seulement en RTK fixe avec inclinaison prête. Son et vibration = point enregistré ; son grave = refusé. Ligne : « Continuer une ligne » (Intermédiaire) reprend une ligne déjà levée pour l\'allonger. Appui long sur Enreg. (Intermédiaire) : mesure de 5, 15 ou 30 s, avec moyenne, mini et maxi avant de valider.',
  corrections:
    'Corrections RTK : par Emlid Flow, ou par l\'appli (NTRIP : roue ⚙ de la barre du récepteur, code de sécurité). Ferme Emlid Flow avant. Le mot de passe reste sur la tablette.',
  talusSurface:
    'Talus d\'une surface (Expert) : « + Talus », touche les côtés sur le plan, règle pente H/V, sens et fin (terrain, longueur, altitude), « Appliquer ». À implanter dans Implanter › Talus.',
  talusDessin:
    'Le talus a ses barbules (haut vers bas) et sa pente écrite sur chaque côté. Coche « talus jusqu\'au terrain », choisis terrain et pentes ; tout se recalcule.',
  hauteurCanne:
    'Hauteur de canne : celle d\'Emlid Flow, montrée pour contrôle seulement. L\'appli ne s\'en sert pas dans ses calculs. Modifiable en Expert.',
  implanter:
    'Touche un point, une ligne ou une surface sur le plan (accroche dans la barre), puis « Implanter » et suis la cible. ← change de point. Manuel : loupe pour viser sans accroche.',
  autocontrole:
    'Remesure un point de contrôle connu. Vert ≤ 2 cm, orange ≤ 4 cm, rouge au-delà. Un contrôle est demandé chaque jour puis toutes les 4 h. Roue ⚙ (code) : tolérances et points.',
  talus:
    'Talus : choisis la ligne (haut ou bas du talus), la pente H/V, le côté et le terrain. Le guidage dit « éloigne-toi / rapproche-toi » jusqu\'à l\'entrée en terre, puis monter ou descendre.',
  importer:
    'Fichier de points : CSV Emlid ou TXT (nom, Est, Nord, altitude), en MN95. Les lignes illisibles sont signalées avec leur numéro.',
  leves:
    'Pages du projet (boutons de la page Applications). « Liste de points » : touche des boutons de catégories (Stock, Terrain, Chantier, Contrôle, Importés…), puis les listes à montrer ; touche un titre de colonne pour trier ; « ⇄ Colonnes » : des flèches ◀ ▶ (et ⏮ « tout à gauche ») déplacent les colonnes ; « Nom » reste toujours à gauche et l\'ordre est gardé sur cette tablette. « Exporter la sélection » donne un CSV (toujours dans le même ordre). « Gérer » (à droite du titre de chaque page) : toutes les lignes avec un ⚙ pour renommer, changer la couleur, exporter, archiver ou supprimer. « Plans » : plans DXF et PDF, cadastre, dessins. « Surfaces importées » (Expert). « Archives » : ce qui a été archivé, avec « restaurer ».',
  surfaces:
    'Une surface (stock, terrain, terrassement) se crée avec les points d\'un levé (contour, lignes de rupture, points) ou s\'importe (LandXML, DXF). Touche-la sur le plan pour la choisir.',
  nature:
    'Ce que représente le levé : Stock, Terrain, Chantier… À choisir d\'abord ; il donne le nom automatique. Modifiable plus tard (« C\'est : »).',
  contour:
    'Bord de la surface, dans l\'ordre ; le polygone se ferme tout seul. Seul l\'intérieur est gardé. Sans contour, le bord suit les points extérieurs.',
  ligne:
    'Haut de talus, arêtes : les triangles ne traversent jamais ces lignes. Une série = une ligne ; sépare-les par « ; ». Ligne fermée : le dernier point rejoint le premier.',
  pointsSurface:
    'Points isolés ou caractéristiques, ni sur le contour ni sur une ligne. Par défaut, tous ceux du contour sont pris ; décoche pour les choisir un par un.',
  choisirPoints:
    'Choisis les points : une série proposée, une liste tapée (« b100 à b116, b120 »), le plan (retoucher = retirer) ou la liste cochée.',
  lignesLevee:
    'Contour, lignes et points isolés du levé en cours : touche un nom pour voir ses points. ✕ supprime un point ; ✂ coupe une ligne entre deux points.',
  journalNmea:
    'Expert. Enregistre 1 minute de ce que le GNSS envoie (NMEA) pour vérifier hauteur de canne, inclinaison ou batterie. Un résumé des messages reçus s\'affiche à la fin.',
  chantier:
    'Levé chantier : choisis le libellé (Chambre, Tuyau…) et la nature (EU, EC…). Tuyau : lève le dessus (le Ø est obligatoire, le fil d\'eau est calculé) ou le fil d\'eau. Chambre / grille : 1 point (ronde) ou 3 coins (rectangle), Ø du tuyau qui arrive facultatif.',
  trianglesEnTrop:
    'Expert. Sans contour, le levé peut créer des triangles en trop : « Supprimer au doigt », touche un triangle (retoucher = le remettre), puis « Terminer ».',
  photos:
    'Une photo attend le prochain point enregistré et prend son nom ; 📷 sur le plan = l\'ouvrir ; « ✎ Dessiner » pour annoter. L\'appareil du bandeau photographie tout le levé.',
  photosMesure:
    'Prends ou choisis une photo : elle est réduite et rangée avec la mesure. Ajoute une légende. Imprimée dans le PDF si la case est cochée.',
  importerSurface:
    'LandXML : toutes les surfaces du fichier sont réunies en une seule. DXF : faces 3D (X Est, Y Nord, Z altitude en MN95). Utilisable comme stock ou comme terrain de référence.',
  volumes:
    'Ajoute un volume : « Stock seul » ou « Comparaison de 2 surfaces ». Remblai = dessus au-dessus de la base, déblai = au-dessous. « Détail » : valeurs intermédiaires.',
  base:
    'Stock seul : volume au-dessus de sa base (le contour, ou une altitude donnée). Comparaison : 1re surface = référence, 2e = comparée ; remblai en rouge, déblai en jaune sur le plan.',
  coupes:
    'Coupe : touche le début puis la fin sur le plan, puis glisse A, A\', B, B\' pour la déplacer ; le profil se met à jour. Deux coupes au plus. « dans le PDF » l\'ajoute au compte rendu.',
  exporterProjet:
    'Tous les exports ici : 1. Quoi ? (Plan, Points, Contrôles, Autres) 2. Lesquels ? 3. Format (PDF, DXF ; CSV et LandXML en Expert). Options retenues sur la tablette ; 👁 Aperçu des PDF.',
  exporter:
    'Coche ce que tu exportes (comme « Afficher »), puis Enregistrer, Mail ou Envoyer autrement. PDF : papier et échelle auto ou choisis, annoncés au-dessus d\'Exporter.',
  mesures:
    'Mesures de longueurs et d\'aires sur des points importés (« + Longueur », « + Aire », « + Nombre »). Elles ne créent ni surface ni volume. Touche une mesure sur le plan pour la choisir.',
  valeursMesure:
    'Longueur 2D à plat, 3D inclinée ; pente = dénivelé ÷ longueur 2D × 100 ; aire 2D à plat, 3D en triangles. Les valeurs cochées vont sur le plan et dans le PDF.',
  exporterMesures:
    'Export des mesures à part : PDF (plan et tableau), CSV pour Excel ou DXF. Coche les mesures à exporter et les valeurs à écrire sur le plan.',
  dessin:
    'DAO (Expert) : « ✏ DAO » pose une barre sur le plan : dessiner, accrocher, calques, sélectionner (déplacer, copier, tourner…), outils topo (Δ Z, pente, projeter). Exporté en DXF.',
  plan:
    'Pince pour zoomer, glisse pour déplacer. Fond (photo aérienne, carte nationale cochable par-dessus la photo avec sa transparence, cadastre ; au-delà de 2 km de large la photo devient la carte), Plan (plans DXF, PDF et cadastre), Points, Surface (si une surface est importée), Seul, Coupe, 3D, ▲ ▼ (taille). Appui long sur Plan, Points ou Surface : tout montrer ou tout cacher (le bouton est pâli quand tout est caché). Plan › première ligne (Intermédiaire) : ❄ Geler (cache le calque des éléments touchés), ◎ Isoler (ne garde que leurs calques), ↺ Tout réafficher ; le menu se ferme, on touche un ou plusieurs éléments (orange, retoucher = retirer), puis « Valider ». La flèche du nord remet le nord en haut.',
};
