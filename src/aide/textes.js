// Textes des bulles d'aide, rangés au même endroit pour être faciles à relire et à corriger.
// Chaque bulle est désignée par une clé (ex. 'contour'), utilisée par bulle('contour').

// 0.163.0 : chaque bulle tient en 4 lignes au plus (demande du 09.11).
export const TEXTES_AIDE = {
  comparateur:
    'Comparer des PDF (Expert, site et Topo Bureau) : deux indices d\'un plan (A = ancien, B = nouveau), ou deux dossiers (plans appariés par leur nom sans indice, pages par leurs textes). Superposition : rouge = supprimé, bleu = ajouté, gris = identique ; Rideau (glisser la poignée), Clignotement, Côte à côte. Recalage de B : Auto, 2 points (A puis B, deux fois), À la main (glisser, flèches). Détection : tolérance et regroupement en mm du papier, « Zone à ignorer » (cartouche : reprise pour l\'indice suivant du même plan), Textes / cotes = « 2.50 → 2.65 ». Chaque modification : ✓ validée, Ignorer, 💬 commentaire (avec qui et quand). Annoter : nuage, flèche, note, distance, surface (en m après « Étalonner »). Rapport PDF : plan B net + différences + nuages numérotés + liste A3. Rangé dans le projet (Drive).',
  calage:
    'Calage de plans (Expert, site et Topo Bureau) : caler un plan reçu (architecte, ingénieur : cm, mm, origine et rotation à lui) sur un plan MN95 du projet. 1 « Le plan » : le DXF reçu et la référence. 2 « Caler » : cliquez un point (ou un trait = axe) sur le plan reçu, puis le même sur la référence ; 2 points de calage + 1 point de vérification suffisent (ou 1 point + 1 axe, ou 3 axes). Vérification : vert ≤ 2 mm, orange ≤ 4 mm, rouge au-delà (faux : pas d\'enregistrement). Échelle arrondie à 0,01 / 0,001 si à moins de 0,5 %. « Affichage » : une vue en grand, ou « Calé » (le plan posé sur la référence). 3 « Nettoyer » (outils en haut) : cliquez un calque sur le plan ou dans la liste, il passe en rose (survol d\'un objet = nom de son calque) ; choisissez-en plusieurs puis « Écarter la sélection » (Suppr aussi) ; la case d\'un calque le garde ou l\'écarte ; la référence est cachée (bouton « Référence » pour la voir) ; gelés / éteints déjà écartés ; couleur d\'un calque, types à retirer, hachures, zone à garder (traits coupés au bord ; textes, cercles, hachures qui la touchent gardés entiers), préfixe des calques ; ↶ Annuler (Ctrl+Z). Le plan calé et nettoyé devient un plan du projet (accroches, implantation, export DXF, Drive), avec sa recette. Xrefs : choisir le plan ET ses xrefs ensemble (Ctrl + clic) ; Topo Bureau convertit les DWG par ODA File Converter (à installer sur le PC) et trouve seul les xrefs posés à côté du plan. « Caler auto » : Topo compare le plan reçu à la référence et aux plans déjà calés du projet (confiance forte / moyenne / faible) ; il marche surtout quand un plan calé ressemble au nouveau (autre indice, même architecte) ; contre la seule référence, il se trompe souvent : vérifiez toujours par un point. « Nouvel indice… » : si au moins 50 % des repères sont retrouvés à 2 mm (même origine), la recette est rejouée ; si le plan a bougé, il est recalé tout seul quand c\'est sûr (orange : à vérifier), sinon calage à la main. « Ce qui a changé » (au nettoyage) : vert = ajouté, rouge = supprimé depuis l\'indice d\'avant. Cotations et lignes de repère : lues ici, retirées au nettoyage si coché. Chaque indice est gardé : le dernier est dans le projet, les anciens vont dans les Archives (liste des plans calés : « Afficher cet indice » le sort des Archives et y met l\'indice affiché, « Comparer… » deux indices au choix) ; « Ce qui a changé » peut se faire avec n\'importe quel indice. « Vérifier » (liste) : rouvre un plan enregistré pour ajouter des points de vérification. Vérification : elle se fait en « Côte à côte » (clic 1 = plan reçu, clic 2 = référence) ; un clic sur la vue « Calé » y passe tout seul. « ＋ Ajouter une référence » (étape 1) : DWG / DXF déjà en MN95, nettoyé puis rangé comme plan du projet. Le dossier du projet (TER., CANA…) se choisit dès l\'étape 1. La référence peut être un plan en MN95 ou LOCAL (le plan calé reste dans ce repère local), ou « Points du projet » (levés : bornes, axes implantés ; à implanter ; contrôle) : cliquez un point du plan reçu puis le point levé ; pour un AXE du plan reçu, cliquez l\'axe puis 2 points levés ou plus SUR cet axe (n\'importe où le long de l\'axe), puis « Terminer l\'axe » : Topo ajuste la droite qui passe au mieux par eux et affiche l\'écart des points.',
  materiel:
    'Matériel (Expert, sur le site) : le parc de l\'entreprise, le même pour tous les projets. « Planning » : glisser sur des jours vides = affecter un article à un chantier ; tirer un bord = allonger ; glisser une barre = la déplacer ; toucher une barre = modifier, rendre au dépôt, changer de chantier, modifier le chantier (n°, nom, responsable, archivé), couper. Chevauchement : couper ou remplacer. « Réel » et « Comparer » : ce que le recap des tablettes a vu (une tablette = un article, réglé dans Réglages › Drive ; le projet doit commencer par le n° du chantier) : rond vert = comme prévu, rouge = autre chantier, bleu = rien de prévu, orange = prévu mais pas vu ; « Préremplir » ajoute les jours vus sans planning (rien n\'est corrigé tout seul). ↶ Annuler (Ctrl+Z), « Prolonger » le mois d\'avant, PDF et Excel du mois pour la compta (AAAA_MM). « Parc », « Chantiers » (un projet dont le nom commence par le n° du chantier lui est relié ; « Archiver les anciens… » cache les chantiers finis depuis 3, 6 ou 12 mois, « Voir les archivés » les ramène ; le planning ne change pas), « Sauvegarde » (.zip complet). Copié sur Drive (App Topo › Matériel).',
  articleTablette:
    'Article du parc : la tablette et sa canne GNSS portent le même n° (liste lue sur Drive, App Topo › Matériel). « Autre… » = taper un n° qui n\'est pas dans la liste. Noté au journal du recap : le planning du matériel saura quel appareil était sur quel chantier.',
  testLaser:
    'Test laser (Expert, essai) : GNSS sur la canne + laser D510 fixé dessus ; distance et angle du laser tapés à la main (angle + = vers le haut). Chaque lecture du récepteur = moyenne de 5 s, en FIXE avec l\'inclinaison prête. « Cap » : point visé avec le cap du RX2 ; « Essai A » : le cap est-il juste ? ; « Essai B » : même point depuis 2 stations, sans cap ; « Montage » : réglages du laser. Enreg. = point TL-n dans « LV-Test laser » ; CSV = toute la séance. Formules à valider sur le terrain.',
  laserEssaiA:
    'Essai A : prends B au GNSS (une canne posée), puis en A (20 m au moins) vise B avec le laser et lis station et cap : l\'appli compare le cap lu à l\'azimut GNSS A → B. Refais-le à plusieurs endroits et dans plusieurs directions ; avec 3 stations ou plus, l\'écart moyen peut servir de correction du cap (il comprend le Nord du RX2 et la position du laser sur la canne). L\'écart-type dit si le cap est fiable (0,17° ≈ 3 cm à 10 m).',
  laserEssaiB:
    'Essai B : vise le même point depuis 2 stations ; chaque distance donne un cercle autour de la station, le point est à leur croisement (2 solutions : à gauche ou à droite en allant de la station 1 vers la 2 ; le cap, s\'il est lu, propose le côté). Angle d\'intersection idéal vers 90° (moins de 30° : peu sûr). L\'écart d\'altitude entre les 2 stations contrôle les angles du laser.',
  laserVerite:
    'Contrôle : si le point visé est accessible, pose la canne dessus et prends-le au GNSS : l\'appli affiche l\'écart avec le point calculé au laser (vert ≤ 3 cm).',
  laserBluetooth:
    'Laser en Bluetooth (APK) : « Connecter le laser » cherche le D510 (allumé, Bluetooth actif, Chrome fermé). Chaque mesure remplit Distance et Angle de la partie ouverte (Essai B : la station marquée « laser ici »). Vérifie l\'angle avec l\'écran du D510 : s\'il est faux, change Radians / Degrés ici.',
  laserMontage:
    'Montage (gardé sur cette tablette) : hauteur = de la pointe de la canne à l\'arrière du laser (d\'où le D510 mesure), le long de la canne ; décalages en regardant la cible (+ = à droite, + = vers la cible). Correction du cap : donnée par l\'essai A. « Corriger la canne penchée » : la hauteur suit la canne d\'après l\'inclinaison du RX2.',
  annotation:
    'Annotation : pose un point (Manuel = loupe sur le plan, GNSS, ou GPS tablette à 3 m ou mieux). En bas : photo (on peut dessiner dessus), ↶ efface le dernier, ID et remarque, Enreg. point. Liste « Annot-date ».',
  reseaux:
    'Réseaux (Expert, test) : « Créer » = touche une polyligne du DXF (son Z = fil d\'eau, le FE est le bas extérieur du tuyau) ou des points un à un avec leur FE (barre d\'accroches : Point, Sommet, Milieu, Sur ligne, Croisement, Centre), ou « Par calque » (toucher une ligne : toutes les lignes de son calque, un réseau par tronçon ; Ø et type lus dans le nom du calque, ex. perrin-ec-200 = EC Ø 200, à vérifier ; FE = Z du DXF 3D). Pour chaque point après le 1er : taper le FE OU la pente en % depuis le point d\'avant (−2 = descend dans le sens du tracé, longueur en plan) ; « = » reprend la pente du segment d\'avant ; un FE vide entre deux FE connus est interpolé selon la longueur (gris italique, « interpolé »). Nom proposé EU-1, EU-2… (suit le type tant qu\'il n\'est pas tapé) ; Ø tapé ou choisi dans la liste (celle du Levé chantier, Ø extérieur) ; type, nom, Ø ext., surface de référence, tranchée (bords droits = blindage). « Voir » : coupe perpendiculaire ou dans l\'axe, tranchées et bords G / D du fond sur le plan. « Implanter » : suit l\'axe ou un bord du fond (FE, dessus du tuyau ou fond) dans Implanter › Ligne, avec un profil en long à moins de 1 m. Implanter › Surface : case « Cana ».',
  mesureRapide:
    'Mesure rapide : touche des points sur le plan (accroche en bas, ou GNSS). 2 points : longueur, Δh, pente. 3 et plus : case « Figure fermée » (périmètre, surface) ou ligne ouverte (longueur du chemin), angles en degrés (colonne Angle, et sur le plan si la case est cochée). « Enregistrer » ou « Exporter » (PDF, DXF).',
  applications:
    'Menu de départ : touche une tuile (ou sa sous-application en petit) pour ouvrir l\'application. Appui long = déplacer la tuile ; ★ = favori. L\'épingle à gauche de « Ouvrir » ouvre la carte de tous les projets (touche un projet, puis « Ouvrir »). Réglages et « Fermer l\'appli » en bas.',
  projets:
    'Projets enregistrés sur cet appareil (📱) ou sur Drive (☁). « Ouvrir » les liste, « ＋ » en crée un, ⋮ renomme (projet ouvert), exporte, duplique ou supprime. Réglages de l\'appareil : tuile Réglages du menu.',
  lame:
    'Guidage (Expert) : choisis la machine puis la surface à suivre. Au-dessus de chaque règle : grosse flèche ▲ (monter, rouge) ou ▼ (descendre, bleu) avec la valeur ; OK (vert) dans la tolérance ; entre les deux, seule la valeur (orange) pour que l\'affichage ne saute pas ; vert ≤ 2 cm, orange ≤ 5 cm. « 2 coupes » : l\'une sous l\'autre (téléphone : une seule coupe, G – D ou Arr – Av). Réglages dans ⚙ (1 ou 2 GNSS, G / D, distances, vues).',
  partage:
    'Projets sur Google Drive. Une seule main par projet : verte = tu enregistres, grise ou rouge = lecture seule. Prendre la main à un autre appareil : Expert et code. Nuage en tête d\'écran : vert = à jour, rouge barré = hors ligne, gris barré = Google non connecté ; touche-le pour ouvrir les réglages Drive.',
  cartouche:
    'Écrits dans le cartouche du PDF : affaire, désignation, dessiné par et date (vide = date du jour).',
  imports:
    'Points : CSV Emlid ou TXT en MN95 ; liste de points ou levé. Plans DXF (DWG à enregistrer en DXF) ; plan PDF : tu tapes son nom puis tu choisis « Convertir en DXF » (traits, textes, calques) ou « En image » (la page telle quelle) ; puis recalage. LandXML, surfaces Swisstopo et cadastre : choisis-les ici. Maquette IFC (bâtiment, structure) : elle doit être en MN95 (coordonnées partagées) ; on la voit en plan coupée à une altitude (Plan › Coupe IFC) et dans les coupes d\'Implanter, de Réseaux et du Guidage. Pas en MN95 : « Recalage › Recaler maintenant » (Expert), en accrochant les coins de la coupe en plan. Blocs des DXF : leurs attributs visibles (numéro, cote…) sont écrits sur le plan.',
  lever:
    'Choisis le rôle (Contour, Ligne, Point) et le libellé, puis Enreg. (ou touche volume −, sur Android seulement), seulement en RTK fixe avec inclinaison prête. Son et vibration = point enregistré ; son grave = refusé. Ligne : « Continuer une ligne » (Intermédiaire) reprend une ligne déjà levée pour l\'allonger. Appui long sur Enreg. (Intermédiaire) : mesure de 5, 15 ou 30 s, avec moyenne, mini et maxi avant de valider.',
  corrections:
    'Corrections RTK : par Emlid Flow, ou par l\'appli (NTRIP : roue ⚙ de la barre du récepteur, code de sécurité). Ferme Emlid Flow avant. Le mot de passe reste sur la tablette.',
  messagesEntiers:
    'Essai pour les récepteurs Stonex S800 / S900 : les corrections sont envoyées au récepteur message par message, jamais coupées en deux. Laisse décoché avec un Emlid. Fonctionne avec des corrections RTCM 3 (swipos).',
  talusSurface:
    'Talus d\'une surface (Expert) : « + Talus », touche les côtés sur le plan, règle pente H/V, sens et fin (terrain, longueur, altitude), « Appliquer ». À implanter dans Implanter › Talus.',
  talusDessin:
    'Le talus a ses barbules (haut vers bas) et sa pente écrite sur chaque côté. Coche « talus jusqu\'au terrain », choisis terrain et pentes ; tout se recalcule.',
  hauteurCanne:
    'Hauteur de canne : celle d\'Emlid Flow, montrée pour contrôle seulement. L\'appli ne s\'en sert pas dans ses calculs. Modifiable en Expert.',
  implanter:
    'Touche un point, une ligne ou une surface sur le plan (accroche dans la barre), puis « Implanter » et suis la cible. ← change de point. Coin d\'une maquette IFC (Intermédiaire, accroche Sommet, Milieu… sur la coupe en plan) : la fiche donne l\'objet touché et « Dessus / Dessous » = altitude du haut ou du bas de cet objet pile à cet endroit (Dessus au départ). Manuel : loupe pour viser sans accroche. Ligne : « ↗ +1.70 % » à gauche de « fin » = pente du segment où tu es (en %, positive en montant). Ligne : à moins de 1 m de la ligne, le profil en long s\'affiche (terrain de la surface choisie, altitude et pente de la ligne, canne) ; case « Cana » (Intermédiaire) : les réseaux qui croisent la ligne.',
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
  dossiers:
    'Dossiers du projet (Terrassement, Canalo, Bâtiment…) : touche un dossier dans l\'encadré du projet pour ne voir que ce qui y est rangé (plan, listes, surfaces) ; « Tout » remet l\'affichage de départ (tout coché sauf les points du cadastre et les surfaces importées). Le dossier choisi s\'affiche en pastille dans l\'en-tête. Expert : « ＋ » crée un dossier, la roue ⚙ d\'une ligne (Gérer) coche ses dossiers (un plan ou une liste peut être dans plusieurs), et à l\'import le champ « Dossier » est proposé. Ce que tu crées va dans le dossier choisi. PIC = plan d\'installation de chantier. Les levés et les annotations n\'ont pas de dossier de base ; Intermédiaire / Expert : touche la pastille d\'une liste (ou « + dossier ») dans « Plan » ou « Points » pour lui choisir ses dossiers. Choisir un dossier coche ce qui y est rangé et décoche le reste dans « Plan », « Points » et « Surface » (en haut du plan) : tout reste listé, tu peux cocher à la main un plan ou une liste d\'un autre dossier ; rechoisis le dossier pour revenir à ses seuls éléments. Dans les applications (Lever, Implanter, Calculs…), le mode Base ne propose que le dossier choisi ; Intermédiaire et Expert proposent tout, avec le nom du dossier à côté.',
  chantier:
    'Levé chantier : « Libre » est proposé en premier (sans nature ni attribut : seulement une remarque et des photos). Sinon choisis le libellé (Chambre, Tuyau…) et la nature (EU, EC…). Tuyau : lève le dessus (le Ø est obligatoire, le fil d\'eau est calculé) ou le fil d\'eau. Chambre / grille : 1 point (ronde) ou 3 coins (rectangle), Ø du tuyau qui arrive facultatif.',
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
    'Pince pour zoomer, glisse pour déplacer. Fond (photo aérienne, carte nationale cochable par-dessus la photo avec sa transparence, cadastre ; au-delà de 2 km de large la photo devient la carte), Plan (plans DXF, PDF et cadastre), Points, Surface (si une surface est importée), Seul, Coupe, 3D (levés, surfaces et maquettes IFC montrés ; IFC aux couleurs de ses types, case « Couper l\'IFC » = rien au-dessus de l\'altitude de la coupe IFC ; pendant qu\'on tourne, un dessin simplifié, le dessin complet revient au doigt levé), ▲ ▼ (taille). Appui long sur Plan, Points ou Surface : tout montrer ou tout cacher (le bouton est pâli quand tout est caché). Plan › première ligne (Intermédiaire) : ❄ Geler (cache le calque des éléments touchés), ◎ Isoler (ne garde que leurs calques), ↺ Tout réafficher ; le menu se ferme, on touche un ou plusieurs éléments (orange, retoucher = retirer), puis « Valider ». La flèche du nord remet le nord en haut. Plan › flèche ▾ d\'une maquette IFC › Coupe IFC : altitude où les maquettes IFC sont coupées (la même pour toutes), sur cette tablette : un niveau du fichier (coupe 1 m au-dessus du sol fini), une altitude tapée, ou le bout de canne du récepteur (la coupe suit la canne, au cm).',
};
