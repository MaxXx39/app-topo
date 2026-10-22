# CLAUDE.md - Application topo (PWA personnelle)

Ce fichier est lu par Claude Code au début de chaque session. Il décrit le projet, la personne avec qui tu travailles et tes règles de travail. Le cahier des charges complet est dans le document « Cahier des charges - Application topo V1 (volumes de stocks) » ; ce fichier en reprend l'essentiel.

## 1. Qui est l'utilisateur et comment travailler avec lui

- Géomètre topo / projeteur dans une entreprise de gros œuvre (bâtiment / génie civil), en Suisse. Il construit cette application seul, pour son usage personnel.
- **Il est débutant en développement.** Explique simplement, sans jargon, par petites étapes. Si un terme technique est nécessaire, définis-le en une phrase.
- **Tout se fait sur le web**, rien n'est installé sur son ordinateur (Windows). Le code est écrit et testé par Claude Code dans le cloud, gardé sur GitHub et publié par GitHub Pages. L'utilisateur n'utilise que son navigateur (ordinateur ou téléphone).
- Réponds toujours **en français**. L'interface de l'appli est aussi en français.
- **Pose-lui des questions avant de décider** d'un point important ou ambigu.
- Propose des solutions **simples et très répandues**. Pas de technologie exotique.
- **Ne devine jamais une formule ou une norme de topographie.** Si tu n'es pas sûr, dis-le et demande-lui de valider.
- Une seule fonctionnalité à la fois. Après chaque fonctionnalité : lance les tests, explique ce qui marche, dis-lui comment l'essayer lui-même, puis attends son accord avant la suivante.

## 2. But de l'application

Calculer le volume de stocks de terre à partir de points levés au GNSS, sur téléphone et ordinateur. Version 1 = « volumes de stocks ». Rien d'autre en V1.

Matériel et logiciels de l'utilisateur : GNSS Emlid RX2 et RS4 (levé avec Emlid Flow), station totale Leica iCON 70, Mensura, Excel.

## 3. Données et conventions

- Tout est en **MN95** (système suisse), en mètres. **Aucune conversion** de coordonnées ni d'altitude dans l'appli web. Exception : le levé avec le récepteur (APK), où l'appli Android convertit la position GNSS en MN95 / altitude **RAN95** (méthode validée dans Emlid Stock, `android/noyau/`) avant de la donner à la page.
- Système d'altitude (RAN95 ou NF02) : **non confirmé**. Ne rien supposer, demander si cela devient utile.
- Les noms de points ne suivent **aucune règle fixe** (« b », « h » ou autre). Ne jamais déduire le rôle d'un point de son nom : c'est l'utilisateur qui choisit.

Formats à lire :

| Format | Contenu | Ordre des coordonnées |
| --- | --- | --- |
| CSV Emlid | 41 colonnes par point. Utiliser au minimum : Name, Easting, Northing, Elevation | Est, Nord, altitude |
| TXT | Séparé par tabulations : nom, Est, Nord, altitude | Est, Nord, altitude |
| LandXML 1.1 (export Mensura) | Surface TIN : points, triangles, lignes de rupture, contour | **Nord, Est, altitude** |

Pièges du LandXML :
- Les triangles (`<F>`) désignent les points par leur **numéro interne `id`**, pas par leur position dans la liste.
- Un fichier peut contenir plusieurs surfaces : l'utilisateur choisit.
- Ne prendre que les surfaces de type TIN.
- Attention à l'inversion Nord/Est entre le LandXML et les fichiers CSV/TXT. Toujours convertir vers « Est, Nord, altitude » à l'import.

## 4. Fonctionnalités de la V1

1. **Importer** les points (CSV Emlid ou TXT). Afficher le nombre de points lus et signaler les lignes illisibles avec leur numéro. Accepter plusieurs stocks dans un fichier.
2. **Choisir les points et leurs rôles**, par stock, sans règle de nom :
   - *Contour* : points du bord du stock, dans un ordre choisi, polygone fermé automatiquement.
   - *Surface de base* : points du pied.
   - *Lignes de rupture* : points du haut et des arêtes.
   - Trois méthodes de sélection : plage de noms (ex. « b100 à b116 »), cases à cocher, toucher les points sur le plan.
3. **Calculer le volume**, à l'intérieur du contour, y compris pour les formes concaves (en « L ») :
   - *Mode A, base mesurée* : surface de base (points du pied) comparée à la surface formée par tous les points, lignes de rupture comprises.
   - *Mode B, base LandXML* : une surface importée remplace la surface de base.
   - Résultat par stock : surface en plan, volume de remblai et volume de déblai (séparés). Afficher aussi des valeurs intermédiaires : nombre de triangles, volume au-dessus et au-dessous.
   - Si le LandXML ne couvre pas tout le contour : avertir et indiquer la surface non couverte.
4. **Importer un LandXML** (voir pièges ci-dessus).
5. **Afficher le plan** : points avec leur nom, contour, triangles, zoom et déplacement au doigt.
6. **Exporter** : un CSV (stock, surface, remblai, déblai) et un PDF (plan + volumes + cartouche simple : affaire, date, dessiné par).

Hors V1 (ne pas construire sans demande) : Google Drive, contrôle de qualité des points, profils. (Implantation : demandée ensuite, voir « mode Contrôler » plus bas.)

Ajouts demandés par l'utilisateur après la V1 :
- **Projets** enregistrés sur l'appareil (IndexedDB), avec plusieurs **levés** (fichiers de points) par projet ; fichier projet `.topo.json` pour passer d'un appareil à l'autre.
- **Surfaces** créées à partir des points d'un levé (lignes de rupture, contour optionnel, suppression de triangles au doigt) ou importées d'un LandXML ; une surface peut servir de base en mode B.
- **Comparaison** de deux surfaces (deux levés) : volume ajouté / enlevé, sur toute la surface ou dans le contour d'un stock.
- **Exports** DXF (R12) et LandXML, en plus du CSV et du PDF ; **calques** au choix dans le PDF (triangles, noms, courbes, couleurs, photo aérienne, cadastre).
- Plan : calques, couleurs selon l'altitude, courbes de niveau, fonds swisstopo. Couleurs de l'interface : Perrin Groupe (bleu nuit #1b2b36, ambre #f6ab07).
- **Organisation (octobre 2026)** : onglets 1. Importer (points), 2. Surfaces, 3. Volumes (+ export), 4. Comparer. Plus de notion de « stock » : une **surface** générique (stock, terrassement, terrain…) créée à partir des points (contour, lignes de rupture, points) ou importée (LandXML, **DXF** faces 3D / polyface). La **base du volume** se choisit dans 3. Volumes : A = points du contour, B = une autre surface, ou pas de volume.
- Remblai en rouge / déblai en jaune par paliers de hauteur (plan et PDF) ; boutons Annuler / Rétablir ; bulles d'aide activables (textes dans `src/aide/textes.js`).
- **Volumes et Comparer réunis (octobre 2026)** : onglets 1. Importer, 2. Surfaces, 3. Volumes. Une surface est un **stock**, un **terrain naturel** ou un **terrassement** (nature : « + Nouvelle surface » crée un stock, on change ensuite avec « C'est : » ; le nom automatique et le calcul automatique suivent). Dans 3. Volumes, chaque **calcul** a une surface 1 (dessus / après) et soit « une seule surface » (volume sur la ligne basse = points du contour), soit une surface 2 (dessous / avant), sur toute la surface 1 ou dans le contour d'une surface. Résultats toujours en remblai / déblai. Calcul prérempli : un stock → une seule surface ; un terrassement → par rapport au dernier terrain naturel (calcul `auto`, jamais modifié par l'appli une fois retouché à la main).
- Saisie des surfaces : contour (rouge), lignes de rupture (orange), « Points isolés / caractéristiques » (vert), mêmes couleurs que le plan ; « Terminé » (barre du bas) ou la touche Entrée prend la liste tapée et ferme la saisie (plus de bouton « Valider »). Les anciens projets sont convertis (fichier projet version 2, `src/volumes/calculs.js`).
- Photos HEIC (Android, iPhone) converties en JPEG sur l'appareil (bibliothèque `heic-to`, chargée seulement quand il le faut).
- Photos des surfaces : case « dans le PDF » par photo ; dans le PDF, les photos cochées sont dans la colonne de droite sous la légende (feuilles à part seulement si elles n'y tiennent pas).
- **Logo Perrin** (`src/assets/logo-perrin.jpg`) : dans l'en-tête de l'appli (sur fond blanc) et en haut du cartouche du PDF.
- Export : options du PDF toujours visibles (« Contenu du PDF »), case « Altitudes des points » (sous le nom, en gris) ; DXF avec un calque ALTITUDES. Carte « Triangles en trop » en violet, cachée quand la surface a un contour fermé.
- **Organisation (octobre 2026, suite)** : onglet **Projet** en premier (sans numéro), l'appli s'ouvre dessus (bouton « Continuer ») ; le cartouche (affaire, dessiné par, date) se remplit dans Projet.
- **Nouvelle surface** : on choisit d'abord stock / terrain naturel / terrassement (nature `null` tant que pas choisi), puis le nom suit ; même choix pour une surface importée. Boutons « + Nouvelle surface » et « + Nouvelle surface depuis LandXML ou DXF » (discret) en haut. Encadrés et barre de modification à la couleur du rôle ; photos en bleu nuit clair.
- **Volumes** : « + Ajouter un volume », puis « Stock seul » (base : ligne du contour, ou plan horizontal à une altitude, mode Z ; seulement pour les surfaces « Stock ») ou « Comparaison de 2 surfaces » (1re = référence = `surface2Id`, 2e = comparée = `surface1Id` ; nom « Volume N »). Plus de choix de zone (les anciens calculs « dans un contour » restent calculés). Seuls les stocks ont un volume automatique. Volumes d'abord, récapitulatif ensuite.
- **PDF** : échelle imposée → A4 si le plan tient, sinon A3, sinon avertissement (plan coupé) ; plan centré sur les surfaces ; « Photo aérienne atténuée (50 %) » ; cadastre = plan cadastral swisstopo en couleurs (WMTS `ch.kantone.cadastralwebmap-farbe`) dont on ne garde que les traits sombres (`garderLesTraits`, `src/plan/fond.js`), le reste transparent, à l'écran et dans le PDF (l'ancien essai WMS « Mensuration officielle » ne marchait pas chez l'utilisateur). Chaque fond est indépendant (si le cadastre échoue, la photo reste). La photo aérienne du PDF est toujours atténuée à 50 % (plus de case). Cases de l'export : Triangles, Noms, Altitudes, Courbes, Photo aérienne, Cadastre, Photos (toutes les photos des surfaces, plus de case par photo) ; « Couleurs : Déblai / remblai, Altitude ou Aucune » sur une ligne (boutons ronds) ; on écrit « déblai / remblai » dans cet ordre. Numéro de version (package.json) affiché en bas de l'onglet Projet : l'augmenter à chaque livraison.
- **Coupes** (`src/topo/coupe.js`, `src/coupes/`) : 2 au maximum (A – A', B – B'), tracées en touchant le plan (accroche aux points levés), coordonnées corrigeables ; toutes les surfaces affichées traversées (couleur selon la nature) ; hauteurs ×1 ou ×2 ; petite échelle des hauteurs (point bas, point haut, 3 entre) et longueur divisée en 5 ; dans le PDF (case décochée par défaut) : trait sur le plan et feuille « Coupes ».
- **Organisation (octobre 2026, mesures)** : onglets Projet · 1. Importer · [ 2.1 Surfaces · 2.2 Volumes ] (même cadre gris, discret) · 3. Mesures · Plan ; titres courts « 2.1 Surf. », « 2.2 Vol. » sur petit téléphone. **Mesures** (fait, version 0.31.0 : `src/topo/mesure.js`, `src/mesures/`, `src/export/pdf-mesures.js`, `src/export/ecran-mesures.js`) : tout à fait séparées des surfaces et des volumes. On dit « aire » (jamais « surface ») pour une mesure. Deux sortes : *Longueur* (suite de points importés, 2D et 3D = distance inclinée par morceau ; par morceau et au total : longueur, différence d'altitude, pente % = ΔH ÷ longueur 2D × 100, total = premier → dernier point) et *Aire* (contour + points isolés choisis comme pour une surface ; 2D = aire du contour, 3D = aire des triangles, périmètre). Points choisis comme à la création de surface (seulement des points importés ; outils communs dans `src/surfaces/choix-points.js`), lignes de rupture aussi pour une aire. Chaque valeur (2D, 3D, dénivelé, pente, aire, périmètre, morceaux) a sa case « Plan et PDF » par mesure. Couleur des mesures : cyan #0891b2, trait pointillé. Mesures enregistrées dans le projet, nommées par l'utilisateur. Plan de l'onglet Mesures : calques au choix (sans ceux des surfaces), aucune surface ni coupe. Export à part, dans 3. Mesures (PDF : cases Noms, Altitudes, Valeurs sur le plan, Courbes, Photo aérienne 50 %, Cadastre ; CSV avec toutes les valeurs puis chaque morceau ; DXF calque MESURES), sans aucun volume ; l'export des volumes ne contient pas les mesures.
- **Écran Mesures simplifié (version 0.32.0)** : une ligne par mesure (nom, valeur principale = 1re valeur cochée) à toucher pour l'ouvrir ; la mesure ouverte montre nom, points (« Modifier ») et valeurs ; « Plus d'options » (fermé) range lignes de rupture, points isolés, cases « Plan et PDF » et détail des morceaux ; pendant la saisie, seule la liste de noms est visible, séries et cases dans « Plus de choix » ; export des mesures replié. Sur le plan, petite étiquette (nom + valeur principale), le détail seulement pour la mesure choisie. Carte « Triangles en trop » cachée quand la surface a un contour fermé. Bouton PDF des exports au même style que CSV / DXF (pas de fond ambre). **Couleur par mesure** (`mesure.couleur`, palette `COULEURS_MESURES` dans `src/mesures/valeurs.js`, cyan au départ) : choisie dans « Plus d'options », utilisée à l'écran, sur le plan, dans le PDF et le DXF (couleur AutoCAD par entité).
- **Onglet Projet mis en forme (version 0.33.0)** : blocs séparés : projet ouvert (bandeau bleu nuit avec le nom, « Où en est le projet » = 4 tuiles 1. Importer / 2.1 Surfaces / 2.2 Volumes / 3. Mesures avec coche verte et nombre, à toucher pour aller à l'onglet, puis « Continuer »), Cartouche du PDF, Fichier projet (exporter / ouvrir), Mes projets sur cet appareil ; dupliquer / supprimer le projet ouvert et version en bas. Liens qui ne suppriment rien (modifier, dupliquer) en bleu nuit souligné (`bouton-lien-neutre`), le rouge seulement pour supprimer.
- **Tous les onglets uniformisés (version 0.34.0)** : même style que l'onglet Projet : blocs `carte-section` (trait bleu nuit à gauche) avec un titre et une petite icône (`titreSection`, `src/outils/section.js`) ; élément en cours dans un bloc « ouvert » à bandeau bleu nuit (`bloc-ouvert`, `bloc-entete`, `bloc-corps` : projet ouvert, surface affichée). 1. Importer : « Importer un fichier de points », « Mes levés » (levé affiché marqué en ambre). 2.1 Surfaces : « Ajouter une surface », puis la surface affichée (liste de choix dans le bandeau). 2.2 Volumes : un bloc par volume (titre = nom du volume, entouré d'ambre quand il est montré sur le plan), « Récapitulatif », « Coupes », « Exporter ». 3. Mesures : « Ajouter une mesure », « Mes mesures », « Exporter les mesures ».
- **Appli Android « Topo » (APK, version 0.36.0)** : la même appli web, rangée dans un APK (dossier `android/`, Kotlin sans bibliothèque, comme Emlid Stock) et affichée dans une WebView (fenêtre de navigateur intégrée). `npm run build:android` range l'appli dans `android/app/src/main/assets/app-topo` (sans la partie PWA) ; l'APK la sert à l'adresse `https://appassets.androidplatform.net/app-topo/` (`ServeurAppli.kt`). Pont web ↔ Android : `src/android/pont.js` (objet `window.AppliAndroid`, `PontAndroid.kt`) ; les exports passent par Android (choix du dossier, Google Drive possible), les fichiers et photos par le sélecteur d'Android (galerie ou appareil photo), les questions (`confirm`, `prompt`) par des fenêtres Android. Fabrication par GitHub Actions (`.github/workflows/apk.yml`) : à chaque envoi (toutes les branches, demande de l'utilisateur qui ne trouvait pas l'APK dans « Actions »), l'APK est publié dans la release « APK Android - dernière version » (tag `apk-derniere-version`), lien direct https://github.com/MaxXx39/app-topo/releases/download/apk-derniere-version/Topo.apk. Clé de signature fixe `android/app/cle-signature.jks` (mot de passe dans `android/app/build.gradle.kts`, usage personnel). Les projets de l'APK sont séparés de ceux du navigateur : passer par le fichier projet `.topo.json`. Emlid Stock s'arrête à son étape 8 (décision du 21.10.2026) : la suite se fait ici.
- **Levé avec le récepteur Emlid RX2 (APK seulement, version 0.37.0)** : onglet 1 renommé **« 1. Points »** ; dans l'APK, bloc « Lever avec le récepteur » au-dessus de l'import (`src/leve/ecran.js`, absent du site web). Côté Android, repris d'Emlid Stock avec leurs tests : module `android/noyau/` (lecture NMEA GGA / ETC, conversion MN95 / RAN95 avec la grille CHGeo2004, règle `autoriserPriseDePoint` = RTK fixe **et** ETC état 30, données de moins de 2 s), `RecepteurBluetooth.kt` (SPP), `EtatRecepteur.kt` (état en JSON envoyé à la page 2 fois par seconde par `window.recevoirEtatRecepteur`, point par `AppliAndroid.prendrePoint()`, vérifié côté Kotlin au moment du toucher). Choix du récepteur dans la liste des appareils appairés (le dernier est retenu : « Reconnecter »), écran allumé pendant la connexion. Décisions de l'utilisateur (21.10.2026) : on choisit le **rôle avant de prendre le point** (Contour, Ligne de rupture, Point isolé ; gros boutons aux couleurs du plan), **lignes ouvertes ou fermées** (« Fermer la ligne »), « + Nouvelle ligne » (pas de ligne vide). Un **levé** (`leve.direct = true`, nom « Levé RX2 AAAA-MM-JJ ») contient un ou plusieurs **stocks** (surfaces « Stock N », `tousLesPoints: false`, avec leur calcul de volume automatique) ; noms proposés comme Emlid Stock, modifiables avant la prise : **B1…** (contour), **H1-1…** (lignes), **C1…** (points isolés), numéro suivant = plus grand du levé + 1 (`src/topo/leve-direct.js`, test `leve-direct.test.js` : le stock 2 de référence rangé point par point redonne 648.979 m³). Chaque point garde `gnss` (qualité, satellites, HDOP, âge des corrections, inclinaison, heure). « Annuler le dernier point » (avec confirmation) ; Annuler / Rétablir de l'en-tête marche aussi. Bandeaux **RTK** et **Inclinaison** sous l'en-tête dans tous les onglets pendant la connexion (`body.avec-recepteur`, `--hauteur-entete` passe à 86 px) ; position en direct sur le plan (bleue, grise si l'inclinaison n'est pas prête ; bouton « Ma position ») ; sur téléphone, le plan reste en haut de l'onglet 1 pendant le levé (`body.mode-leve`). Petite vibration à chaque point.
- **Organisation en 4 onglets (version 0.38.0, demande de l'utilisateur, 22.10.2026)** : **Projet · Terrain · Calculs · Plan** (onglets internes inchangés : `projets`, `terrain`, `surfaces` / `volumes` / `mesures`, `plan`). **Projet** (bouton en bleu nuit, couleur à part, et trait bleu nuit en haut du panneau) = le chantier : projet ouvert et tuiles Levés / Surfaces / Volumes / Mesures, puis **import des fichiers de points et « Mes levés »** (`#importer`), puis cartouche, fichier projet et autres projets (`#projets-suite`, 2e conteneur de `creerEcranProjet`). **Terrain** = seulement le levé RX2 (onglet absent du site web) : écran épuré (`src/leve/ecran.js`) avec le plan en haut, gros bouton « Connecter <récepteur> » tant qu'il n'est pas connecté, ligne repliable « Levé · Stock » (changer, nouveau levé / stock, couper le récepteur), 3 boutons de rôle, nom du point et position sur une ligne, PRENDRE LE POINT, « Annuler <nom> » et un résumé court (points par rôle et remblai). **Calculs** = Surfaces · Volumes · Mesures, une seule partie affichée à la fois, choisie par des boutons en haut (`.parties-calculs`, la dernière partie est retenue). **Plan** reste un onglet à part. Textes « onglet 2.1 Surfaces »… devenus « onglet Calculs › Surfaces »….
- **Onglet Projet épuré (version 0.39.0)** : projet ouvert (tuiles, « Continuer »), puis un seul bloc **« Levés »** (liste des levés, bouton « + Importer un fichier de points », résultat de l'import, points du levé repliés), puis **« Cartouche du PDF »** et **« Autres projets et fichier projet »** repliés (`details.bloc-replie`, résumé à droite : affaire / nombre de projets ; ouverture gardée d'un dessin à l'autre), version en bas.
- **Terrain : Lever | Contrôler (version 0.40.0, demande du 22.10.2026)** : deux modes en haut de l'onglet Terrain. **Contrôler** : « Implanter : Point · Ligne · Surface » (Point et Ligne grisés, prévus plus tard) ; on choisit une surface du projet (elle devient la surface affichée) ; en grand et en direct **« ↑ Monter x.xxx m » / « ↓ Descendre x.xxx m »** (écart = altitude de la surface sous le récepteur − altitude du bout de canne ; surface = plan du triangle qui contient le point, comme pour les volumes, méthode validée par l'utilisateur) avec les couleurs choisies par l'utilisateur : **vert clair** de −2 à +2 cm, **jaune orangé** de 2 à 5 cm (dessus ou dessous ; d'abord vert foncé, changé à la demande de l'utilisateur en 0.40.1), **rouge** au-delà de +5 cm (monter), **bleu** au-delà de −5 cm (descendre) ; écart donné seulement si la règle de prise de point l'accepte (RTK fixe + inclinaison prête), sinon la raison ; « Hors surface ». **Coupes en direct** (`src/leve/coupe-directe.js`, SVG, hauteurs agrandies avec le facteur écrit) : perpendiculaire (gauche → droite) et dans l'axe (derrière → devant) de la direction regardée, « Les 2 » (écran partagé, par défaut) ou une seule ; 5 m de chaque côté par défaut (10 ou 20 m au choix). Réglages retenus sur l'appareil (`localStorage` « topo-terrain »). **Orientation** (`src/leve/orientation.js`) : source « Cap RX2 » (ETC champ 4, lu côté Kotlin dans `EtatCompensation.capDeg`, seulement à l'état 30 ; **sens à confirmer sur le terrain**) ou « Marche » (direction entre les positions des 5 dernières secondes, au moins 1 m) ; sans cap, on prend la marche ; dernière orientation gardée 10 s ; sans orientation, coupes ouest-est et sud-nord. Valeurs brutes affichées (« cap RX2 …° · marche …° ») pour le test terrain. **Flèche** à côté de la position sur le plan (comme Google Maps). État du récepteur envoyé 5 fois par seconde. Calculs : `src/topo/implantation.js` (test `implantation.test.js`).

## 5. Vérification : cas de référence

L'utilisateur compare lui-même avec Mensura. Tolérance : **0,5 %**. Fichiers d'exemple à placer dans le dossier `exemples/` : `stock.csv`, `stock_export.txt`, le PDF Mensura et un LandXML.

Levé du 20/05/2026 (affaire 10 203), 115 points, 3 stocks, volumes de remblai Mensura :

| Stock | Points (dans stock_export.txt) | Volume Mensura (m³) | Écart accepté (± m³) |
| --- | --- | --- | --- |
| Stock 1 | b1 à b17 et h1 à h31 | 1636.197 | 8,2 |
| Stock 2 | b100 à b116 et h100 à h114 | 648.979 | 3,2 |
| Stock 3 | b200 à b217 et h200 à h216 | 372.201 | 1,9 |

Dans cet exemple, le contour et la surface de base sont les points « b » du stock. Ce n'est pas une règle de l'appli.

- Le LandXML d'exemple « 3D SUR Tapis AC11 » ne recouvre pas ces stocks (altitudes 474 à 484 m contre environ 427 m). Il sert à tester la **lecture** du format. Pour tester le mode B, il faut un LandXML qui recouvre un stock : le demander.
- **Méthode de calcul du volume** : ne pas choisir seul. Présenter les options en mots simples, recommander une méthode, et la faire valider par l'utilisateur sur ce cas de référence avant d'aller plus loin. La triangulation doit respecter le contour et les lignes de rupture (stocks 1 et 3 en forme de « L »).
- Écrire des tests automatiques sur ce cas de référence dès que la méthode est validée.

## 6. Choix techniques (par défaut, à valider avec l'utilisateur)

Rester sur des outils très répandus :

- Application web en **JavaScript**, avec **Vite**, sans framework lourd au début.
- **PWA** (installable sur téléphone et ordinateur) : plugin `vite-plugin-pwa`.
- Calculs de topo dans des fichiers séparés de l'interface, faciles à tester.
- Tests avec **Vitest**.
- Plan dessiné en SVG. Fonds swisstopo en option (photo aérienne SWISSIMAGE, cadastre), demandés par l'utilisateur : tuiles WMTS en MN95, connexion internet nécessaire, mention « © swisstopo » obligatoire.
- PDF avec une bibliothèque courante (ex. jsPDF).
- Triangulation avec contraintes (contour, lignes de rupture) : proposer une bibliothèque existante plutôt que l'écrire soi-même, et expliquer le choix.
- Les données de l'utilisateur **restent sur son appareil** (pas de serveur, pas de compte).
- Hébergement gratuit avec **GitHub Pages**, pour ouvrir l'appli sur le téléphone et l'installer.

Avant d'ajouter une bibliothèque : dire ce qu'elle fait, pourquoi elle est nécessaire, et demander l'accord.

## 7. Git et GitHub

L'utilisateur n'a pas l'habitude de Git ni de GitHub. Explique chaque notion en une phrase la première fois :
- **Git** : un historique du projet, pour pouvoir revenir en arrière.
- **GitHub** : un site qui garde une copie du projet et peut le publier gratuitement sur une adresse web.

Guide-le pas à pas pour : activer GitHub Pages, valider les modifications (pull request) sur github.com, puis installer l'appli sur son téléphone. Ne fais jamais de publication ni d'envoi vers GitHub sans qu'il l'ait demandé. Ne lui demande jamais son mot de passe ni de jeton dans le chat : il les saisit lui-même.

Fais un « commit » (une sauvegarde dans l'historique) après chaque fonctionnalité qui marche, avec un message clair en français.

## 8. Règles de code

- Code et commentaires simples, en français, pour qu'un débutant puisse relire.
- Noms de variables clairs (`estPoint`, `nordPoint`, `altitude`...). Toujours écrire les coordonnées dans l'ordre Est, Nord, altitude dans le code, sauf à la lecture du LandXML.
- Chaque calcul de topo : une fonction courte, avec un commentaire qui dit ce qu'elle fait, ses unités (mètres, m², m³) et un test.
- Afficher les nombres avec 3 décimales pour les coordonnées et les volumes, comme dans Mensura. Séparateur décimal : le point.
- Messages d'erreur compréhensibles pour l'utilisateur (« ligne 12 illisible »), jamais de plantage silencieux.
- Ne pas modifier ni supprimer les fichiers du dossier `exemples/`.
- En fin de tâche : dire en deux ou trois phrases ce qui a été fait, comment le tester, et proposer la suite.
