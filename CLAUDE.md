# CLAUDE.md - Application Topo (PWA + APK Android, usage personnel)

## Utilisateur et manière de travailler
- Géomètre topo suisse, **débutant en développement**. Répondre **en français**, simplement, sans jargon (définir un terme technique en une phrase).
- Poser **toujours** des questions **avant** une décision importante ou ambiguë. Ne **jamais deviner** une formule ou une norme de topo : le dire et faire valider.
- Fonctionnalité : lancer les tests, expliquer, dire comment l'essayer, proposer la suite.
- Nouvelle fonctionnalité : **toujours demander** dans quel mode la mettre (**Base**, **Intermédiaire** ou **Expert**) avant de la coder. Ne jamais la mettre dans un mode sans l'avoir demandé.
- Tout se fait dans le cloud ; l'utilisateur n'utilise que navigateur / tablette.
- **Git** : commit en français après chaque fonctionnalité qui marche. Ne jamais demander mot de passe ni jeton dans le chat. Aucun identifiant de modèle dans commits / PR.
- Avant d'ajouter une bibliothèque : dire ce qu'elle fait, pourquoi, demander l'accord.

## Stack
- JavaScript vanilla (modules ES), **Vite 8**, **vite-plugin-pwa**, **Vitest 5** ; plan en SVG (fond DXF en canvas).
- Bibliothèques : `delaunator` + `@kninnug/constrainautor` (triangulation avec contraintes), `jspdf` (PDF), `heic-to` (photos HEIC).
- APK Android : Kotlin sans bibliothèque (sauf `play-services-auth`), WebView ; la même appli web sert l'APK.
- Hébergement : GitHub Pages (`publier.yml`) ; APK fabriqué par `apk.yml` (release `apk-derniere-version`).
- Partage de projets : Google Drive (API REST, `drive.file`).

## Structure
```
src/main.js          point d'entrée, état de l'appli, liaison des écrans (gros fichier : chercher avec grep)
src/topo/            calculs de topo (volume, coupe, mesure, implantation, talus, accroche, recalage,
                     contrôle, dessin, lame, levé direct, métré, DXF…)
src/import/          lecture CSV Emlid, TXT, LandXML, DXF ; écran de l'onglet Projet (blocs Import, Listes, DXF)
src/plan/            plan SVG/canvas (vue, fonds swisstopo, DXF, barbules, listes de points, dessins)
src/surfaces/ volumes/ mesures/ coupes/ photos/ dessin/   écrans et logique de l'onglet Calculs
src/leve/            onglet Terrain (lever, implanter, contrôle, lame, récepteur, guidage, croquis, fenêtres)
src/recalage/        recalage d'un plan DXF
src/export/          CSV, PDF, DXF, LandXML, cartouche, « Quoi exporter ? », « Envoyer »
src/projet/          projets (IndexedDB), fichier .topo.json, écran Projet (en-tête, gestion de projets)
src/partage/         synchro Google Drive (drive, fichiers, synchro, verrou)
src/android/pont.js  pont web ↔ Android (window.AppliAndroid)
src/aide/textes.js   bulles d'aide ; src/reglages/ réglages ; src/outils/ utilitaires (choix, code, échapper…)
tests/               tests Vitest (*.test.js)
android/             app Kotlin (EcranPrincipal, PontAndroid, EtatRecepteur, RecepteurBluetooth,
                     FichiersPartages, PositionTablette, ServeurAppli) ; android/noyau/ = NMEA, MN95/RAN95, NTRIP (avec tests)
exemples/            fichiers de référence (NE PAS modifier ni supprimer)
```

## Commandes
- `npm run dev` : serveur de développement ; `npm run preview -- --port 4173` : aperçu (base `/app-topo/`).
- `npm run build` : site / PWA ; `npm run build:android` : range l'appli dans `android/app/src/main/assets/app-topo`.
- `npm test` : tous les tests (tests dans `tests/`, pas dans `src/`).
- Essais visuels : Playwright (Chromium préinstallé) sur l'aperçu ; pour l'onglet Terrain, simuler l'APK avec un faux `window.AppliAndroid` (`prendrePoint`, `activerToucheVolume`, `lireReglagesCorrections`, `choisirRecepteur`, `choisirRecepteur2`…) puis appeler `window.recevoirEtatRecepteur(etat)`, `window.recevoirEtatRecepteur2(etat, mode)`, `window.recevoirPositionTablette(position)`. Arrêter l'aperçu avec `pkill -f "[v]ite preview"`.
- Pas de SDK Android ici : le Kotlin est compilé par `apk.yml` à chaque envoi (vérifier le résultat de « Fabriquer l'APK »).

## Livraison et publication
- À chaque livraison : version augmentée dans `package.json` **et** `package-lock.json` (lignes 3 et 9), CLAUDE.md et bulles d'aide à jour, `npm test` et `npm run build` sans erreur, essai Playwright, commit puis envoi sur la branche de travail.
- Publier le site et l'APK (seulement quand l'utilisateur le demande) : PR vers `main`, attendre les vérifications (« construire », « apk ») au vert, fusionner (merge), puis `git fetch origin main && git merge --ff-only origin/main` sur la branche. Jamais de rebase ni de force-push.
- Lien de l'APK : https://github.com/MaxXx39/app-topo/releases/download/apk-derniere-version/Topo.apk

## Conventions de code
- Code et commentaires **simples, en français**, noms clairs (`estPoint`, `nordPoint`, `altitude`).
- Coordonnées toujours **Est, Nord, altitude** (sauf à la lecture du LandXML : Nord, Est, altitude). Tout en **MN95**, mètres ; aucune conversion dans l'appli web (l'APK convertit le GNSS, et le GPS de la tablette, en MN95 / RAN95).
- Une fonction de calcul = courte, commentée (rôle, unités m / m² / m³), **avec un test**. Calculs dans `src/topo/`, séparés de l'interface.
- Nombres : point décimal, 3 décimales pour coordonnées et volumes.
- Messages d'erreur compréhensibles (« ligne 12 illisible »), jamais d'échec silencieux.
- Pas de phrases d'explication dans les écrans : l'aide est dans les bulles (`src/aide/textes.js`). Attention aux apostrophes dans ces textes (`\'`), sinon la fabrication du site casse.
- Texte venant de l'extérieur (noms d'appareils Drive, noms de fichiers, de points…) toujours passé par `echapper()` avant d'aller dans du HTML.
- Noms de points jamais interprétés (le rôle est choisi par l'utilisateur). Noms levés : contour `C-Stock-n-m`, ligne `L-lib-n-m`, point `P-lib-n`, aire `A-lib-n-m`. Sommets de dessins : `D1-1` (anciens : `PF1-1`, `BAT1-1`, `LI1-1`, `PT1-1`).
- LandXML : triangles par `id` interne, surfaces TIN seulement, inversion Nord/Est à l'import.
- Version dans `package.json` (affichée dans Projet) : l'augmenter à chaque livraison.
- Données sur l'appareil (IndexedDB) ; seule exception : partage Drive, accepté par l'utilisateur. Le mot de passe NTRIP n'est jamais mis dans le projet ; l'APK ne le renvoie pas à la page (seule exception : la liste partagée des réglages swipos, sur Drive, acceptée par l'utilisateur).
- Réglages propres à l'appareil (pas dans le projet) dans le stockage du navigateur : `topo-reglages` (téléphone, mode, onglet Lame), `topo-terrain` (réglages Terrain, lame), `topo-calques`, `topo-plan-terrain-part` (hauteur du plan, flèches ▲ / ▼), `topo-plan-guidage-part` (idem pendant le guidage d'une implantation, 0.84.0).
- Pas de bouton « Annuler » visible (seulement Ctrl+Z sur ordinateur) : ne pas promettre d'annulation dans les messages.

## Référence de calcul
Levé du 20/05/2026 (affaire 10 203), tolérance **0,5 %** : Stock 1 = 1636.197 m³, Stock 2 = 648.979 m³, Stock 3 = 372.201 m³ (remblai Mensura). Tests automatiques sur ce cas.

## Fonctions (version 0.86.0)

**Barre du bas et en-tête** (0.86.0, demande du 28.10.2026) : en haut à gauche l'icône dossier = onglet **Projet** (`#bouton-projet`) ; la barre du bas = **Lever, Implanter, Contrôle, Guidage** (APK ; Guidage = l'ancien mode « Lame », Expert seulement ; `MODES_TERRAIN`, `choisirModeTerrain`, `majBoutonsTerrain` dans main) puis Calculs et Plan. Plus de bascule sous le plan ni d'onglet « Terrain » ni de bouton « Récepteur » en bas : la barre d'état du récepteur sous l'en-tête (`#bandeaux-recepteur`, toujours visible dans l'APK, petit icône de récepteur, « Récepteur non connecté · Toucher pour connecter ») ouvre la fenêtre du récepteur (événement `ouvrir-recepteur`). Dans le code, le mode reste `'lame'`.

**Trois modes : Base, Intermédiaire, Expert** (0.85.0, demande du 28.10.2026 ; réglages ⚙, barres comme le signal d'un téléphone dans l'en-tête : Base = 1 barre verte (les 2 autres grises), Intermédiaire = 2 jaunes, Expert = 3 rouges ; retenu par l'appareil ; **Intermédiaire par défaut** au premier lancement ; l'ancien « Confirmé » devient « Expert » à la lecture des réglages). Rien n'est supprimé du projet en changeant de mode.
- **Tableau de référence** : `docs/modes-base-intermediaire-expert.xlsx` (134 fonctions ; une case par mode). Mis à jour par l'utilisateur ; à relire avant de coder une fonction.
- **Règles** : Base coché ⇒ Intermédiaire et Expert cochés ; une fonction principale ou secondaire décochée ⇒ tout ce qui est dessous décoché.
- **Dans le code** (`reglages/reglages.js`) : `modeAppli()`, `aAcces('intermediaire' | 'expert')` (vrai si le mode est au moins celui-là), `estModeBase()`, `lameActive()` (= Expert). Dans le HTML : classes `.seulement-intermediaire` (caché en Base) et `.seulement-expert` (caché en Base et Intermédiaire) ; classes `mode-base` / `mode-intermediaire` / `mode-expert` sur `body`. Calques du plan : propriété `niveau`. **Nouvelle fonction : toujours demander le mode, puis poser la classe ou `aAcces`.**
- **Choix pris en codant le tableau** (à revalider) : plus de case « Onglet Lame » (Lame et 2e récepteur toujours en Expert) ; Journal NMEA seulement dans la fenêtre du récepteur (Expert) ; « Relancer la connexion NTRIP » dans tous les modes, **sans code** (remarque du tableau) ; « Enregistrer » de la fenêtre Exporter reste en Base (sinon le contrôle ne s'exporte plus), mail et « Envoyer autrement » dès Intermédiaire ; options de ligne à l'implantation (segment, décalage, ⇄) en Base (ligne « Implanter une ligne : options » = XXX) ; export CSV / PDF du contrôle en Base (ligne Terrain › Contrôle) ; code de sécurité inchangé (demandé dans tous les modes pour le nom de l'appareil et les tolérances).
- **Base** : ouvrir un projet, Drive (lecture seule), levé libre en points isolés (liste « Points de ce levé »), implanter point / ligne / surface (sans « Enregistrer l'implantation », coupes dans l'axe seulement, sans liste « À implanter »), Terrain › Contrôle, réglages du guidage, plan (fonds, cadastre, points, noms, altitudes, plans DXF, menu « Afficher »), récepteur, GPS de la tablette, NTRIP démarrer / arrêter / relancer.
- **Intermédiaire** en plus : créer un projet, lignes / contours, toutes les natures (stock, terrain naturel, terrassement, métré), libellés, triangles en trop, listes (couleur, dessin, export TXT / CSV / DXF), onglet Calculs (volumes, mesures), exports PDF / DXF, mail / « Envoyer autrement », choix d'un réglage swipos, listes partagées, DXF importés.
- **Expert** en plus : bloc Import du Projet, exporter / dupliquer / supprimer un projet, Surface Projet, export CSV / LandXML, « Quoi exporter ? », prendre la main, talus, « À implanter », coupes (Calculs), Dessin, Lame, 2e récepteur, réglages NTRIP à taper, journal NMEA, suppression d'un levé, triangles du plan.

**Code de sécurité** (`src/outils/code.js`, dans les deux modes ; simple barrière, pas une vraie sécurité ; ne jamais écrire le code dans les bulles d'aide) : nom de l'appareil, réglages NTRIP (des 2 récepteurs), points de contrôle et tolérances, prendre la main à un autre appareil (Drive), listes partagées (adresses mail, réglages swipos). Redemandé à chaque fois.

**Démarrage** (0.84.0, `demarrer` dans main) : fenêtre « Que veux-tu faire ? » : « Continuer sur « X » » (dernier projet ouvert sur cette tablette, `stockage.dernierProjet()`), « Ouvrir un projet » (page Gestion de projets), « Nouveau projet ». Pas de fenêtre au tout premier lancement. Tant que le choix n'est pas fait, `partage.demarrer({ choixEnAttente })` ne compare ni n'envoie rien à Drive (le projet ouvert ensuite le sera).

**Onglet Projet**
- « + Nouveau projet » (ambre) : fenêtre affaire / désignation, projet créé seulement avec OK (`demanderChamps`, `creerNouveauProjet`) ; « Gestion de projets » (sombre), en-tête « Projet ouvert » (affaire - désignation ; 0.84.0 : plus de cases, un crayon à côté du titre ouvre la fenêtre « Renommer le projet » avec affaire et désignation).
- 3 blocs repliables (flèche), tous repliés à chaque ouverture de l'appli :
  - Import (Expert) : fichier de points (« Liste de points » ou levé stock / terrain naturel / terrassement : `leveDepuisFichier`), points de contrôle (code demandé après le choix du fichier), plan DXF, surface (LandXML ou DXF 3D, nature demandée tout de suite), point tapé ou pointé sur le DXF ;
  - « Liste de points - Lever - Dessin - Surface Projet - Contrôle » (`blocListes`) : Liste de points (fichiers, points tapés), Lever (une liste par levé, à son nom, date de création ; nom changé dans Lever), Dessin (violet), Surface Projet (LandXML / DXF 3D importés : renommer, supprimer), Contrôle (rouge) ; couleur au choix, « Voir les points » ;
  - DXF importés (calques, couleur, recalage Helmert).

**Onglet Terrain** (APK)
- Mise en page téléphone : plan en haut (flèches ▲ / ▼ = ±15 % de l'écran, 20–80 %), bandeau des modes sous le plan, contenu encadré à la couleur du mode. « Ma position » = environ 20 m autour de soi (0.84.0 ; `METRES_AUTOUR_DE_MOI` dans plan.js).
- **Lever** (ambre) : cadre du levé en cours (titre « Lever » posé sur le trait du cadre, 0.81.0 ; la nature se voit à la couleur ; nom en grand, crayon = renommer ; 0.84.0 : « Changer de levé » et « + Nouveau levé » sont **sous** le cadre, pas dedans ; croix rouge en Expert = supprimer le levé et ses points après confirmation) ; cadre ambre « Point » (0.84.0) = ID point, position, photo, PRENDRE LE POINT, Annuler ; cadre « Ligne en cours » (« + Nouvelle ligne », « Fermer ligne ») ou « Contour en cours » (sans Fermer), titres sur le trait du cadre ; « ID point » ; en bas, « Lignes du levé » (Base) : contour, lignes, points isolés à dérouler, ✕ supprimer un point, ✂ supprimer un segment (ligne coupée en deux, points gardés). Règles (`topo/lignes-levee.js`, `controlerPlacePoint` dans main) : stock = point de ligne ou isolé hors du contour refusé ; nouveau segment qui croise un autre → fenêtre « Supprimer le segment du dessous » (ligne la plus ancienne) ou « Lever en point isolé » ; dès Intermédiaire, rôle Ligne / Contour : toucher un point levé sur le plan l'ajoute (garde son nom, refusé s'il est déjà dans une ligne ou le contour : un point n'est jamais dans 2 lignes) ; natures : stock, terrain naturel, terrassement, métré, levé libre, Surface (faite dans Dessin) ; rôles, libellés, appareil photo (photo du levé, Base) à gauche de PRENDRE LE POINT (ou touche volume −) ; en bas : triangles en trop (dès Intermédiaire, `suppressionTriangles` de l'éditeur) et photos du levé.
- **Plus de « surface » mais des levés** (0.77.0) : chaque levé a sa propre liste de points (`creerListeDeLevee`, `leve.dediee`, renommée avec le levé par `nommerListeDeLevee`) ; les anciennes listes du jour « Levé RX2 date » restent pour les anciens projets.
- **Implanter** (sarcelle) : point, ligne (guidage : « gauche / droite », « début x m », « fin y m » et « monter / descendre » de la **même taille** que le guidage d'un point, 0.84.0 ; drapeau damier sous 1 m ; sur le plan, les cotes de début, de fin et de l'écart sont écrites même si la distance est courte), surface, talus ; barre d'accroche (Point, Sommet, Milieu, Sur ligne, Centre). Pendant le guidage, les flèches ▲ / ▼ sous le plan marchent aussi (part propre `--part-plan-guidage`, 0.5 au départ ; la cible en haut, près d'un point, les cache).
- **Contrôle** (rouge, Base) : autocontrôle sur `projet.pointsControle` (« Choisir un point sur le plan ou dans la liste »), écarts E / N / plan / hauteur, tolérances `projet.tolerancesControle` (vert ≤ 2 cm, orange ≤ 4 cm), fenêtre d'avertissement si orange, « Hors tolérance, contacte le géomètre » si rouge, historique `projet.controles`, export CSV / PDF. Rappel « Faire le contrôle ? » à la connexion du RX2 (aucun contrôle réussi aujourd'hui ou depuis 4 h) ; « Non » (« ⚠ le géomètre sera averti ») = refus noté. Fichiers : `topo/controle.js`, `leve/controle-ecran.js`, `export/pdf-controles.js`.
- **Guidage** (ex-Lame, bleu, Expert) : guidage de lame de niveleuse avec 2 RX2 (mât au-dessus de chaque coin ; hauteur du mât = hauteur de canne dans Emlid Flow, avec la compensation d'inclinaison). Surface suivie (terrassement d'abord), « ⇄ G / D », tolérances ⚙ (vert ≤ 2 cm, orange ≤ 5 cm). Formules **validées par l'utilisateur** (`topo/lame.js`) :
  - écart d'un coin = altitude de la surface − altitude du coin (positif = monter) ;
  - dévers = (H droite − H gauche) ÷ largeur à plat × 100 (positif = droite plus haute) ; dévers voulu = idem avec la surface.
  - Nombres seulement si les 2 RX2 sont prêts (`autorise`). Coupe vue de derrière, lame sur le plan (`plan.afficherLame`).
  - Bords de la surface (`bordsDeLaLame`) à gauche et à droite de la coupe : dans le prolongement de la lame, distance depuis le coin (négative et rouge si le coin est hors surface : bord le plus proche) et altitude de la surface au bord.
  - Profil en long : depuis le coin gauche, le milieu ou le coin droit ; dans le sens de marche (`directionDeMarche`), à l'arrêt perpendiculaire à la lame ; « devant » (20 m) et « derrière » (5 m) ; pente de chaque tronçon et ruptures de pente > 0.5 % (`tronconsProfil`) ; petite niveleuse dessinée. Écran `leve/lame-ecran.js`.
- **Récepteurs** : RX2 en Bluetooth, corrections swipos (NTRIP) sans Emlid Flow ; 0.84.0 : dans la fenêtre du récepteur (sans code, dès Intermédiaire), menu « Réglage swipos » = liste partagée, un choix lance la connexion ; « Relancer la connexion NTRIP » (tous les modes, sans code, derniers réglages enregistrés) ; « Journal NMEA (1 min) » (Expert, 0.82.0 : `EtatRecepteur.demarrerJournal` / `lireJournal`, `PontAndroid.demarrerJournalNmea` / `lireJournalNmea`, toutes les lignes brutes du RX2 dans un fichier texte, hauteur de canne tapée dans le nom) ; 2e récepteur (avec l'onglet Lame) avec corrections « copie » du 1er ou « 2e connexion NTRIP » (réglages `corrections2`). Bandeaux RTK / inclinaison sous l'en-tête.
- **GPS de la tablette** (APK, sans RX2 connecté, deux modes) : `PositionTablette.kt` (GPS + réseau, MN95 par `etrs89VersMn95`), `window.recevoirPositionTablette({ est, nord, precision })` ; rond gris + cercle de précision, bandeau « GPS TABLETTE ± x m ». **Seulement pour se localiser** : jamais points, implantation, contrôle ni lame. Pas sur le site (choix de l'utilisateur).

**Onglet Calculs** (Intermédiaire et Expert ; Coupes et Dessin : Expert)
- Volumes (remblai / déblai, comparaison de 2 levés ; levés stock, terrain naturel, terrassement, Surface, et surfaces importées), coupes. Plus d'onglet Surfaces (0.77.0) : son éditeur reste caché (`editeurSurfaces` : levé affiché, triangles en trop).
- Mesures / métrés : longueurs, aires, nombres ; seules les valeurs cochées dans la carte ; photos par mesure ; points des listes cochées visibles sur le plan (hors modification).
- **Dessin** : « + Dessin » (sommets D1-1…) ; 1. point de départ (plan avec accroche, ou RX2), 2. direction du 1er côté (toucher un objet, ou vers le RX2) + distance (« OK » = aperçu), 3. côtés suivants : angle en degrés, chaque clic ↰ / ↱ ajoute l'angle (déviation depuis le prolongement du côté précédent, **validé**), « ↑ Tout droit », ou toucher le plan ; altitude du prochain sommet à côté de la distance, ou « = dernier point » / « pente depuis le dernier » + pente en % (0.84.0 : `altitudeSelonChoix` dans `topo/dessin.js` = altitude du dernier sommet + pente ÷ 100 × distance horizontale, positive = monte ; formule standard, **à faire valider**) ; « Fermer la figure », rectangle, « Rouvrir et dessiner ». Altitude fixe + pente, ou par sommet (modifiable dans « Voir les sommets »). Figure fermée → « Créer la surface » = levé « Surface » (`creerLeveeDuDessin` : liste propre avec les sommets = contour, gardés à jour par `synchroniserLeveeDuDessin`, complété au RX2 dans Lever ; anciens projets : surface `type: 'dessin'`). Un dessin s'implante comme le reste (chaque côté = une ligne). Fichiers : `topo/dessin.js`, `dessin/ecran.js`, `plan/dessins.js`.

**Plan** : calques par familles (Fonds, Points, Levés, Volumes, Mesures), valables dans tous les onglets ; menus « Plans » et « Afficher » (tous les modes) ; fonds swisstopo, rotation, suivi de position. Contours, mesures et dessins en trait plein ; dessins violets. Surfaces importées (LandXML, DXF 3D ; 0.83.0, Base) : fond léger et bord en trait plein (`bordDeTriangles`) à la couleur de leur nature, triangles avec la case « Triangles » ; un projet sans point se cadre sur elles.

**Exports** : CSV, PDF (cartouche : affaire, désignation, dessiné par, date), DXF, LandXML ; PDF et DXF des mesures ; « Quoi exporter ? » par catégories (pré-coché comme « Afficher ») ; DWG : non (format fermé), DXF seulement.
- **Fenêtre « Exporter »** (0.79.0, `export/fenetre-export.js`, appelée par `telecharger`) pour tous les exports : format si besoin, « Enregistrer » (`enregistrer`), « Envoyer par mail » (adresse de la liste partagée ; APK : `partagerFichierMail` avec EXTRA_EMAIL ; site : téléchargement + `mailto:`), « Envoyer autrement » (APK : `FichiersPartages.kt` + partage Android ; site : `navigator.share`). Plus de barre « Envoyer ».
- **Exporter une liste de points** (Projet, bouton « exporter », Intermédiaire ; listes, levés, dessins, contrôle ; `export/points.js`) : TXT (nom, E, N, H, tabulations, sans en-tête), CSV (toutes les infos : rôle, date, heure, précisions H / V, qualité RTK, satellites, HDOP, âge des corrections, inclinaison), DXF (points, noms, altitudes).
- **Listes partagées** (`reglages/listes-partagees.js`, `fenetre-listes.js`) : adresses mail et réglages swipos (utilisateur, serveur, port, point de montage, mot de passe), modifiées dans réglages ⚙ avec le code de sécurité, fichier `listes-partagees.json.gz` dans « App Topo » sur Drive (la plus récente gagne : connexion, toutes les 10 min, à chaque modification ; mot de passe sur Drive accepté par l'utilisateur) ; « Réglage swipos enregistré » dans les réglages NTRIP du récepteur remplit les cases.

**Partage Google Drive** (`partage/partage.js`, `synchro.js`) : dossier « App Topo › Configuration Projet » créé par l'appli (l'ancien « Topo - projets » est ignoré), fichiers découpés (projet, plans DXF, photos des surfaces et des mesures), envoi automatique (30 s après une modification). **Une seule main par projet** (0.76.0) :
- verrou par appareil (expire après 15 min sans signe de vie), relu toutes les 30 s (`lireVerrou`) ; signe de vie toutes les 5 min ;
- main de l'en-tête : verte = j'ai la main (toucher = rendre), grise « 🔒 Lecture seule · main rendue » = rendue, lecture seule (toucher = reprendre si libre ; rien d'autre ne la reprend, 0.80.0), rouge « 🔒 X a la main » = lecture seule (toucher = prendre la main) ; sur le site, rendue toute seule après 5 min sans activité ;
- prendre la main à un autre appareil (site ou APK) : mode Expert + code de sécurité, toujours ; on prend la version de Drive (ce que l'autre n'a pas envoyé est perdu, choix de l'utilisateur) ;
- l'appareil qui perd la main : fenêtre d'attente « X a la main » (« Voir en lecture seule », « Ouvrir un autre projet ») ; quand la main est rendue, il reprend tout seul la version de Drive et la main (`mainLiberee`), et une fenêtre « X a rendu la main » avec OK s'affiche (0.84.0 ; en lecture seule : même fenêtre, le projet reste en lecture seule) ;
- projet qu'un autre a en main : « Voir en lecture seule » ou « Prendre la main » ; lecture seule = voir et implanter, rien ne s'enregistre (`lectureSeule()` : `modifie()` défait la modification, boutons d'ajout grisés par `body.lecture-seule`, PRENDRE LE POINT / ENREGISTRER / touche volume refusés) ;
- plus de fenêtre « a changé ici et sur Drive » : la version de Drive l'emporte (message).

**Réglages ⚙** : mode Base / Intermédiaire / Expert, listes partagées (code), mode téléphone (textes −15 %, icônes et gros boutons −25 %), bulles d'aide, partage Drive, « Fermer l'appli » (APK).

## Reste / à valider
- Essais sur le terrain : guidage de lame et profil en long sur la machine (hauteur de mât, signes, vitesse d'affichage, seuil de rupture 0.5 %) ; GPS de la tablette ; « Envoyer par mail » (adresse remplie) et « Envoyer autrement » dans l'APK ; listes partagées entre 2 appareils ; prise de main (code), attente, lecture seule et reprise automatique avec 2 appareils sur Drive (site + APK).
- Essai terrain du talus (0.56.1) et question ouverte : arrondi (cône) aux angles saillants, est-ce voulu ?
- Précision H / V (message GST) à comparer avec Emlid Flow ; vérifier que le RX2 envoie bien du GST.
- Hauteur de canne : **le RX2 ne l'envoie pas** (journaux NMEA du 27.10.2026 à 1.995 m et 0.695 m comparés : champs 4–9 de ETC = cap, direction et mesures d'inclinaison qui varient ; EBP = position de la base, vide sans RTK). Le RX2 envoie déjà la position du bout de la canne. Vérification : Terrain › Contrôle sur un point connu. Proposition en attente : taper la hauteur prévue (affichée dans le bandeau, notée avec chaque point), mode à choisir.
- DWG non pris en charge (enregistrer en DXF).
- Google Cloud en mode Test (réautorisation environ tous les 7 jours) : publier l'écran de consentement si besoin.

## À développer
- Dessin, étape suivante (en suspens) : plateforme avec talus jusqu'au terrain naturel (entrées en terre, volume).

## Historique des versions (résumé)
- 0.57 modes Base / Confirmé (devenus Base / Intermédiaire / Expert en 0.85) · 0.58 code de sécurité · 0.59 Terrain › Contrôle, onglet Projet en 3 blocs · 0.60–0.62 Dessin (pilote, implantation, surface), couleurs des listes · 0.63 2e récepteur · 0.64 retouches (calques par familles, photos des mesures, Désignation) · 0.65 mise en page Terrain · 0.66 Dessin simplifié · 0.67 Drive (prise protégée, rendre la main) · 0.68 retouches Dessin · 0.69 suppression d'un levé, « Quoi exporter ? », « Envoyer » · 0.70 guidage de lame · 0.71 flèches du plan, blocs repliables, import de surface dans Projet · 0.72 GPS de la tablette · 0.73 profil en long de la lame · 0.74 onglet Lame dans les réglages, blocs de Projet repliés, OK du nouveau projet, liserés de Calculs en trait plein · 0.75 bords de la surface à côté de la coupe de la lame · 0.76 Drive : dossier « App Topo › Configuration Projet », une seule main par projet (code, attente, lecture seule, reprise automatique) · 0.77 levés au lieu de surfaces (liste par levé, catégories des listes, import en levé, onglet Surfaces retiré, photo et triangles dans Lever, levé « Surface » du Dessin) · 0.78 écran Lever (cadres, ID point, lignes du levé, croisements, segments, contour du stock, point touché sur le plan) · 0.79 fenêtre « Exporter » (enregistrer, mail, autre), export des listes de points (TXT, CSV complet, DXF), listes partagées (adresses mail, réglages swipos) · 0.80 main rendue = lecture seule · 0.81 titres « Lever » et « Ligne en cours » sur le trait des cadres · 0.82 journal NMEA · 0.83 surfaces importées visibles sur le plan · 0.84 fenêtre de démarrage, crayon du projet, altitude du dessin (= dernier / pente), choix swipos dans le récepteur, fenêtre OK « a rendu la main », Lever en 2 cadres, guidage de ligne (mêmes tailles, flèches du plan), zoom « Ma position » 20 m. · 0.85 trois modes Base / Intermédiaire / Expert (barres dans l'en-tête, tableau des modes, plus de case « Onglet Lame », NTRIP « Relancer » sans code). · 0.86 mode Guidage (ex-Lame), modes de Terrain dans la barre du bas, Projet en haut à gauche, récepteur par la barre d'état.
