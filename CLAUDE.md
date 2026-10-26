# CLAUDE.md - Application Topo (PWA + APK Android, usage personnel)

## Utilisateur et manière de travailler
- Géomètre topo suisse, **débutant en développement**. Répondre **en français**, simplement, sans jargon (définir un terme technique en une phrase).
- Poser **toujours** des questions **avant** une décision importante ou ambiguë. Ne **jamais deviner** une formule ou une norme de topo : le dire et faire valider.
- Fonctionnalité : lancer les tests, expliquer, dire comment l'essayer, proposer la suite.
- Nouvelle fonctionnalité : **toujours demander** dans quel mode la mettre (**Base** ou **Confirmé**) avant de la coder.
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
- Données sur l'appareil (IndexedDB) ; seule exception : partage Drive, accepté par l'utilisateur. Le mot de passe NTRIP n'est jamais mis dans le projet ni renvoyé à la page.
- Réglages propres à l'appareil (pas dans le projet) dans le stockage du navigateur : `topo-reglages` (téléphone, mode, prise de main protégée), `topo-terrain` (réglages Terrain, lame), `topo-calques`, `topo-plan-terrain-part`, `topo-projet-replies`.
- Pas de bouton « Annuler » visible (seulement Ctrl+Z sur ordinateur) : ne pas promettre d'annulation dans les messages.

## Référence de calcul
Levé du 20/05/2026 (affaire 10 203), tolérance **0,5 %** : Stock 1 = 1636.197 m³, Stock 2 = 648.979 m³, Stock 3 = 372.201 m³ (remblai Mensura). Tests automatiques sur ce cas.

## Fonctions (version 0.73.0)

**Modes Base / Confirmé** (réglages ⚙, étoile ☆ / ★ dans l'en-tête, Confirmé par défaut, retenu par l'appareil). En Base : éléments `.seulement-confirme` cachés, `estModeBase()` dans le code ; rien n'est supprimé du projet.
- Base = projets, Drive, point tapé, récepteur, GPS de la tablette, lever « Levé libre » (« autres » dans le code), rôles et libellés existants, implanter point / ligne simple, accroches DXF, contrôle de surface, Terrain › Contrôle, réglages du guidage, plan (fonds, cadastre, points, noms, altitudes).
- Confirmé = tout le reste : onglet Calculs, bloc Import du Projet, menus « Plans » et « Afficher » du plan, DXF, talus, NTRIP, libellés à modifier, options de ligne, triangles / courbes, 2e récepteur, Terrain › Lame, suppression d'un levé.

**Code de sécurité** (`src/outils/code.js`, dans les deux modes ; simple barrière, pas une vraie sécurité ; ne jamais écrire le code dans les bulles d'aide) : nom de l'appareil, réglages NTRIP (des 2 récepteurs), points de contrôle et tolérances, « Prise de main protégée ». Redemandé à chaque ouverture de la fenêtre.

**Onglet Projet**
- « + Nouveau projet » (ambre), « Gestion de projets » (sombre), en-tête « Projet ouvert » (affaire, désignation ; plus de « Nom »).
- 3 blocs repliables (flèche, retenu) :
  - Import (Confirmé) : fichier de points, points de contrôle (code demandé après le choix du fichier), plan DXF, surface (LandXML ou DXF 3D, nature demandée tout de suite), point tapé ou pointé sur le DXF ;
  - Listes de points : une par fichier ou levé (couleur au choix, « Voir les points »), une par dessin (violet), points de contrôle à part (rouge) ;
  - DXF importés (calques, couleur, recalage Helmert).

**Onglet Terrain** (APK)
- Mise en page téléphone : plan en haut (flèches ▲ / ▼ = ±15 % de l'écran, 20–80 %), bandeau des modes sous le plan, contenu encadré à la couleur du mode. « Ma position » = environ 50 m autour de soi.
- **Lever** (ambre) : en-tête du levé en cours (nature, nom en grand, crayon = renommer, « Changer » = reprendre un autre levé, croix rouge en Confirmé = supprimer le levé et ses points après confirmation, « + Nouveau ») ; natures : stock, terrain naturel, terrassement, métré, levé libre ; rôles, libellés, PRENDRE LE POINT (ou touche volume −).
- **Implanter** (sarcelle) : point, ligne (« début x m · fin y m », drapeau damier sous 1 m), surface, talus ; barre d'accroche (Point, Sommet, Milieu, Sur ligne, Centre).
- **Contrôle** (rouge, Base) : autocontrôle sur `projet.pointsControle` (choisi dans la liste ou en le touchant sur le plan), écarts E / N / plan / hauteur, tolérances `projet.tolerancesControle` (vert ≤ 2 cm, orange ≤ 4 cm), fenêtre d'avertissement si orange, « Hors tolérance, contacte le géomètre » si rouge, historique `projet.controles`, export CSV / PDF. Rappel « Faire le contrôle ? » à la connexion du RX2 (aucun contrôle réussi aujourd'hui ou depuis 4 h) ; « Non » (« ⚠ le géomètre sera averti ») = refus noté. Fichiers : `topo/controle.js`, `leve/controle-ecran.js`, `export/pdf-controles.js`.
- **Lame** (bleu, Confirmé) : guidage de lame de niveleuse avec 2 RX2 (mât au-dessus de chaque coin ; hauteur du mât = hauteur de canne dans Emlid Flow, avec la compensation d'inclinaison). Surface suivie (terrassement d'abord), « ⇄ G / D », tolérances ⚙ (vert ≤ 2 cm, orange ≤ 5 cm). Formules **validées par l'utilisateur** (`topo/lame.js`) :
  - écart d'un coin = altitude de la surface − altitude du coin (positif = monter) ;
  - dévers = (H droite − H gauche) ÷ largeur à plat × 100 (positif = droite plus haute) ; dévers voulu = idem avec la surface.
  - Nombres seulement si les 2 RX2 sont prêts (`autorise`). Coupe vue de derrière, lame sur le plan (`plan.afficherLame`).
  - Profil en long : depuis le coin gauche, le milieu ou le coin droit ; dans le sens de marche (`directionDeMarche`), à l'arrêt perpendiculaire à la lame ; « devant » (20 m) et « derrière » (5 m) ; pente de chaque tronçon et ruptures de pente > 0.5 % (`tronconsProfil`) ; petite niveleuse dessinée. Écran `leve/lame-ecran.js`.
- **Récepteurs** : RX2 en Bluetooth, corrections swipos (NTRIP) sans Emlid Flow ; 2e récepteur (Confirmé) avec corrections « copie » du 1er ou « 2e connexion NTRIP » (réglages `corrections2`). Bandeaux RTK / inclinaison sous l'en-tête.
- **GPS de la tablette** (APK, sans RX2 connecté, deux modes) : `PositionTablette.kt` (GPS + réseau, MN95 par `etrs89VersMn95`), `window.recevoirPositionTablette({ est, nord, precision })` ; rond gris + cercle de précision, bandeau « GPS TABLETTE ± x m ». **Seulement pour se localiser** : jamais points, implantation, contrôle ni lame. Pas sur le site (choix de l'utilisateur).

**Onglet Calculs** (Confirmé)
- Surfaces (stock, terrain naturel, terrassement ; à partir des points ; l'import de fichiers est dans Projet), volumes (remblai / déblai, comparaison de 2 surfaces), coupes.
- Mesures / métrés : longueurs, aires, nombres ; seules les valeurs cochées dans la carte ; photos par mesure ; points des listes cochées visibles sur le plan (hors modification).
- **Dessin** : « + Dessin » (sommets D1-1…) ; 1. point de départ (plan avec accroche, ou RX2), 2. direction du 1er côté (toucher un objet, ou vers le RX2) + distance (« OK » = aperçu), 3. côtés suivants : angle en degrés, chaque clic ↰ / ↱ ajoute l'angle (déviation depuis le prolongement du côté précédent, **validé**), « ↑ Tout droit », ou toucher le plan ; altitude du prochain sommet à côté de la distance ; « Fermer la figure », rectangle, « Rouvrir et dessiner ». Altitude fixe + pente, ou par sommet (modifiable dans « Voir les sommets »). Figure fermée → « Créer la surface » (terrassement, remise à jour avec le dessin). Un dessin s'implante comme le reste (chaque côté = une ligne). Fichiers : `topo/dessin.js`, `dessin/ecran.js`, `plan/dessins.js`.

**Plan** : calques par familles (Fonds, Points, Surfaces, Volumes, Mesures), valables dans tous les onglets ; menus « Plans » et « Afficher » (Confirmé) ; fonds swisstopo, rotation, suivi de position. Contours, mesures et dessins en trait plein ; dessins violets.

**Exports** : CSV, PDF (cartouche : affaire, désignation, dessiné par, date), DXF, LandXML ; PDF et DXF des mesures ; « Quoi exporter ? » par catégories (pré-coché comme « Afficher ») ; barre « Envoyer » après chaque export (APK : `FichiersPartages.kt` + partage Android ; site : `navigator.share`). DWG : non (format fermé), DXF seulement.

**Partage Google Drive** : dossier « Topo - projets », fichiers découpés (projet, plans DXF, photos des surfaces et des mesures), envoi automatique, verrou par appareil (expire après 15 min sans signe de vie), « prendre la main », « Prise de main protégée » (code de sécurité pour les autres appareils), « Rendre la main » (bouton ; tout seul après 5 min sans activité sur le site), main grise = rendue.

**Réglages ⚙** : mode Base / Confirmé, mode téléphone (textes −15 %, icônes et gros boutons −25 %), bulles d'aide, partage Drive, prise de main protégée, « Fermer l'appli » (APK).

## Reste / à valider
- Essais sur le terrain : guidage de lame et profil en long sur la machine (hauteur de mât, signes, vitesse d'affichage, seuil de rupture 0.5 %) ; GPS de la tablette ; « Envoyer » dans l'APK ; prise de main protégée et main rendue avec 2 appareils sur Drive.
- Essai terrain du talus (0.56.1) et question ouverte : arrondi (cône) aux angles saillants, est-ce voulu ?
- Précision H / V (message GST) à comparer avec Emlid Flow ; vérifier que le RX2 envoie bien du GST.
- DWG non pris en charge (enregistrer en DXF).
- Google Cloud en mode Test (réautorisation environ tous les 7 jours) : publier l'écran de consentement si besoin.

## À développer
- Dessin, étape suivante (en suspens) : plateforme avec talus jusqu'au terrain naturel (entrées en terre, volume).

## Historique des versions (résumé)
- 0.57 modes Base / Confirmé · 0.58 code de sécurité · 0.59 Terrain › Contrôle, onglet Projet en 3 blocs · 0.60–0.62 Dessin (pilote, implantation, surface), couleurs des listes · 0.63 2e récepteur · 0.64 retouches (calques par familles, photos des mesures, Désignation) · 0.65 mise en page Terrain · 0.66 Dessin simplifié · 0.67 Drive (prise protégée, rendre la main) · 0.68 retouches Dessin · 0.69 suppression d'un levé, « Quoi exporter ? », « Envoyer » · 0.70 guidage de lame · 0.71 flèches du plan, blocs repliables, import de surface dans Projet · 0.72 GPS de la tablette · 0.73 profil en long de la lame.
