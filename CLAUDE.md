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
src/main.js          point d'entrée, état de l'appli, liaison des écrans
src/topo/            calculs de topo (volume, coupe, mesure, implantation, talus, accroche, recalage, DXF…)
src/import/          lecture CSV Emlid, TXT, LandXML, DXF
src/plan/            plan SVG/canvas (vue, fonds swisstopo, DXF, barbules, listes de points)
src/surfaces/ volumes/ mesures/ coupes/ photos/   écrans et logique par onglet
src/leve/            onglet Terrain (lever, implanter, récepteur, guidage, croquis)
src/recalage/        recalage d'un plan DXF
src/export/          CSV, PDF, DXF, LandXML, cartouche
src/projet/          projets (IndexedDB), fichier .topo.json
src/partage/         synchro Google Drive (drive, fichiers, synchro, verrou)
src/android/pont.js  pont web ↔ Android (window.AppliAndroid)
src/aide/textes.js   bulles d'aide ; src/reglages/ réglages ; src/outils/ utilitaires
tests/               tests Vitest (*.test.js)
android/             app Kotlin ; android/noyau/ = NMEA, MN95/RAN95, NTRIP (avec tests)
exemples/            fichiers de référence (NE PAS modifier ni supprimer)
```

## Commandes
- `npm run dev` : serveur de développement ; `npm run preview -- --port 4173` : aperçu (base `/app-topo/`).
- `npm run build` : site / PWA ; `npm run build:android` : range l'appli dans `android/app/src/main/assets/app-topo`.
- `npm test` : tous les tests (tests dans `tests/`, pas dans `src/`).
- Essais visuels : Playwright (Chromium préinstallé).

## Conventions de code
- Code et commentaires **simples, en français**, noms clairs (`estPoint`, `nordPoint`, `altitude`).
- Coordonnées toujours **Est, Nord, altitude** (sauf à la lecture du LandXML : Nord, Est, altitude). Tout en **MN95**, mètres ; aucune conversion dans l'appli web (l'APK convertit le GNSS en MN95 / RAN95).
- Une fonction de calcul = courte, commentée (rôle, unités m / m² / m³), **avec un test**. Calculs dans `src/topo/`, séparés de l'interface.
- Nombres : point décimal, 3 décimales pour coordonnées et volumes.
- Messages d'erreur compréhensibles (« ligne 12 illisible »), jamais d'échec silencieux.
- Pas de phrases d'explication dans les écrans : l'aide est dans les bulles (`src/aide/textes.js`).
- Noms de points jamais interprétés (le rôle est choisi par l'utilisateur). Noms levés : contour `C-Stock-n-m`, ligne `L-lib-n-m`, point `P-lib-n`, aire `A-lib-n-m`.
- LandXML : triangles par `id` interne, surfaces TIN seulement, inversion Nord/Est à l'import.
- Version dans `package.json` (affichée dans Projet) : l'augmenter à chaque livraison.
- Données sur l'appareil (IndexedDB) ; seule exception : partage Drive, accepté par l'utilisateur. Le mot de passe NTRIP n'est jamais mis dans le projet ni renvoyé à la page.

## Référence de calcul
Levé du 20/05/2026 (affaire 10 203), tolérance **0,5 %** : Stock 1 = 1636.197 m³, Stock 2 = 648.979 m³, Stock 3 = 372.201 m³ (remblai Mensura). Tests automatiques sur ce cas.

## État d'avancement (version 0.73.0)
**Fait**
- Import points (CSV Emlid, TXT), LandXML, DXF (surfaces et fond de plan) ; recalage Helmert d'un plan DXF.
- Surfaces (stock, terrain naturel, terrassement), volumes (remblai / déblai, comparaison), coupes, mesures / métrés.
- Plan : calques, courbes, fonds swisstopo, rotation, menu « Afficher ».
- Exports : CSV, PDF (cartouche), DXF, LandXML.
- Projets locaux + partage Google Drive (verrou, envoi auto).
- APK : levé RX2 (Bluetooth), corrections swipos (NTRIP), contrôle de surface, implantation point / ligne / talus, libellés et couleurs.
- Modes Base / Confirmé (0.57.0, réglages ⚙, étoile ☆ / ★ dans l'en-tête, Confirmé par défaut, retenu par l'appareil). En Base, éléments `.seulement-confirme` cachés et `estModeBase()` dans le code. Base = projets, import points, Drive, point tapé, récepteur, lever « Levé libre » (« autres » dans le code), rôles et libellés existants, implanter point / ligne simple, accroches DXF, contrôle de surface, réglages du guidage, plan (fonds, cadastre, points, noms, altitudes). Tout le reste (onglet Calculs, DXF, talus, NTRIP, libellés à modifier, options de ligne, triangles / courbes…) = Confirmé.
- Terrain (0.57.1) : « Levé en cours » = liste des levés écrits à la couleur de leur nature, « + Nouveau levé » en haut de la liste.
- Réglages protégés par le « Code de sécurité » (0.58.1, `src/outils/code.js`, code 1196, dans les deux modes) : modification du nom de l'appareil et réglages NTRIP ; redemandé à chaque ouverture de la fenêtre. Le passage Base → Confirmé reste libre. Simple barrière, pas une vraie sécurité ; ne jamais écrire le code dans les bulles d'aide.
- Terrain › **Contrôle** (0.59.0, mode Base ; bouton plus petit et rouge depuis 0.59.2 ; les 3 modes Terrain ont un liseré de leur couleur, plein quand choisi) : autocontrôle sur les points de contrôle du projet (`projet.pointsControle`, liste à part et triangles rouges sur le plan), guidage comme l'implantation d'un point, écarts E / N / plan / hauteur, couleurs selon `projet.tolerancesControle` (vert ≤ 2 cm, orange ≤ 4 cm, rouge au-delà, plan et hauteur, réglables), remarque, historique `projet.controles`, export CSV et PDF. Rappel « Faire le contrôle ? » à la connexion du RX2 si aucun contrôle réussi (vert / orange) aujourd'hui ou depuis 4 h ; « Non » = refus noté dans le projet. Tolérances et points protégés par le code de sécurité. Calculs : `src/topo/controle.js` ; écran : `src/leve/controle-ecran.js` ; PDF : `src/export/pdf-controles.js`. Projet sans point de contrôle : le rappel s'affiche quand même, avec OK seulement (rien n'est noté).
- Onglet Projet (0.59.1) : « + Nouveau projet » (ambre) et « Gestion de projets » (sombre) en évidence ; 3 blocs « Import » (bouton rouge « Points de contrôle », code de sécurité demandé après le choix du fichier), « Listes de points du projet » (on dit « liste de points », plus « levé » ; « Voir les points » sous chaque liste ; points de contrôle dans une liste à part en rouge), « DXF importés ».
- Calculs › **Dessin** étape 1 (0.60.0, mode Confirmé) : plateformes, bâtiments, lignes, points (`projet.dessins`) avec l'outil « pilote » inspiré de Leica iCON : départ (toucher le plan avec accroche, coordonnées, RX2), puis direction (toucher le plan, gisement en gon 0 = Nord sens horaire, vers le RX2, ±90°) + distance ; rectangle (longueur, largeur à gauche / droite) ; altitude fixe + pente % le long d'un côté (positive = monte) ou par sommet. Dessins violets sur le plan, cotes des côtés. Calculs `src/topo/dessin.js`, écran `src/dessin/ecran.js`, plan `src/plan/dessins.js`.
- Dessin étape 2 (0.61.0) : un dessin terminé s'implante comme le reste, dans les deux modes. Sommets nommés PF1-1 (plateforme), BAT1-1 (bâtiment), LI1-1 (ligne), PT1-1 (points) — `numero` gardé à la création —, avec l'altitude du dessin ; une liste par dessin (violet) dans la fenêtre « Liste » et le menu « Afficher » ; chaque côté = une ligne (Implanter › Ligne › Ligne DXF : toucher le côté).
- Dessin étape 3 (0.62.0) : plateforme ou bâtiment → « Créer la surface » = surface `type: 'dessin'` (nature terrassement, `dessinId`, points PF1-1… + faces par la méthode des oreilles), remise à jour avec le dessin (`synchroniserSurfacesDessins` dans `modifie`), supprimée avec lui ; volume par Calculs › Volumes › Comparaison de 2 surfaces. Dessins cochés dans « Afficher » : DXF (calques DESSINS, DESSINS_NOMS) et plan du PDF.
- 0.62.1 : couleur au choix par liste de points (`projet.couleursListes`, menu « Afficher » et Projet › Listes de points ; rouge réservé, points de contrôle toujours rouges ; couleur du libellé prioritaire) ; altitudes des points de contrôle sur le plan ; Dessin : barre d'accroche (Point, Sommet, Milieu, Sur ligne, Centre ; rien sous le doigt = rien de pris), puces « Point de départ » / « Direction ».
- Essai à 2 récepteurs (0.63.0, Confirmé, sans guidage) : APK `recepteur2` (2e `EtatRecepteur`, `choisirRecepteur2` / `deconnecterRecepteur2`, état envoyé par `window.recevoirEtatRecepteur2`) ; corrections du 2e au choix (0.63.1, retenu sur la tablette) : « copie » du flux du 1er (`copieCorrections`, GGA du 1er envoyée au caster) ou « 2e connexion NTRIP » avec son propre jeu de réglages (préférences `corrections2`, protégés par le code de sécurité, sa propre GGA) ; fenêtre du récepteur : bloc « Récepteur 2 (essai) » avec position, précision et écart 1 → 2 (plan, dH). Essai réussi (les 2 en RTK fixe).
- 0.64.0 (retouches) : rappel du contrôle « Non » avec « ⚠ le géomètre sera averti » ; après un contrôle orange → fenêtre d'avertissement, rouge → « Hors tolérance, contacte le géomètre » ; point de contrôle choisi en le touchant sur le plan. Projet : « Nom » retiré, « Lieu » devient « Désignation » (aussi dans le cartouche PDF) ; bloc Import caché en Base. Implanter : ordre Point, Ligne, Surface, Talus ; « début x m · fin y m » ; drapeau damier au lieu du texte sous 1 m. Mode téléphone plus compact (textes −15 %, icônes et gros boutons −25 %). Calques par familles (Fonds, Points, Surfaces, Volumes, Mesures, nouveau calque `mesures`) : ce qui est coché vaut dans tous les onglets (volumes et mesures aussi dans Terrain, surfaces dans Calculs › Mesures ; plus de pastille de volume). Métrés : seules les mesures cochées dans « Afficher » sont dessinées (plus de métré en cours forcé). Mesures : seules les valeurs cochées dans la carte (`valeursCochees`), photos par mesure (`mesure.photos`, fichiers Drive `photo-<id>` comme les surfaces, pages photos à la fin du PDF des mesures). Projet › Listes de points : une liste par dessin (violet, « Voir les points »).
- 0.65.0 (mise en page Terrain, téléphone) : plan en haut (1/3 de l'écran, 1/2 avec la flèche sous le plan, classe `plan-terrain-grand` retenue sur l'appareil), bandeau Lever / Implanter / Contrôle sous le plan, puis la barre d'accroche ; contenu encadré à la couleur du mode. Lever : en-tête du levé en cours (nature en petit, nom en grand à sa couleur, crayon = renommer via `demanderTexte` de `src/outils/choix.js`, « Changer » = reprendre un autre levé, « + Nouveau »).
- 0.66.0 (Dessin simplifié) : un seul « + Dessin » (type `dessin`, nom « Dessin n », sommets D1-1…) ; étapes en évidence : 1. Point de départ (toucher le plan avec accroche, ou « Point au RX2 »), 2. Direction du 1er côté (toucher un objet ou « Direction vers le RX2 ») + distance, 3. côtés suivants : « Tourner de » x° (degrés, 0 = tout droit, 90 = d'équerre) à gauche ou à droite du côté précédent (`directionTournee`), ou toucher le plan, + distance ; plus de gisement en gon tapé ni de coordonnées tapées. « Fermer la figure » (`dessin.ferme`, `estFerme`) → surface possible ; rectangle = figure fermée ; « Rouvrir et dessiner ». Altitude au-dessus du pilote ; « ← Retour » en haut de la carte. Les anciens dessins (plateforme, bâtiment, ligne, points) gardent leur type et leurs noms PF / BAT / LI / PT. Angle validé : déviation par rapport au prolongement du côté précédent.
- 0.67.0 (Drive) : « Prise de main protégée » (réglages ⚙, `priseProtegee` dans `topo-reglages`, changée avec le code de sécurité) : le verrou Drive porte `verrouProtege = 'oui'` ; un autre appareil doit taper le code pour prendre la main (`accordPriseDeMain` dans `partage.js`). « Rendre la main » (Partage, `rendreLaMain`) : envoi puis verrou enlevé, état `rendu` (main grise dans l'en-tête) ; sur le site (pas l'APK), fait tout seul après 5 min sans toucher l'écran ; la prochaine modification (ou la main grise) la reprend via `apresOuverture`.
- 0.68.0 (Dessin, retouches) : en-tête compact (← , nom, résumé sur une ligne) ; altitude sur une ligne (Fixe / Par sommet, altitude, pente, côté et sommet seulement si pente) ; « Départ » (nom accroché ou RX2, E, N ; `dessin.nomDepart`) dans la carte et rond plein « Départ » sur le plan ; pendant un dessin, seule sa carte est montrée ; tourner cumulé (chaque clic ↰ / ↱ ajoute l'angle inscrit, `pilote.tourne` depuis le prolongement du côté précédent) + « ↑ Tout droit » ; « OK » à côté de la distance = aperçu sur le plan ; case altitude du prochain sommet (`altitudeProchainSommet`, passage « par sommet » avec `passerParSommet`) ; altitude modifiable dans « Voir les sommets » (tableau gardé ouvert).
- 0.69.0 : Calculs › Mesures montre aussi les points des listes cochées (hors modification d'une mesure). Terrain › Lever › « Changer » : fenêtre `src/leve/fenetre-levees.js`, croix rouge en Confirmé = supprimer le levé (surface, métré ou levé libre) et ses points après confirmation (`supprimerLevee` / `pointsDeLaLevee` dans `topo/leve-direct.js` ; points gardés s'ils servent ailleurs ; levé du jour vide supprimé ; pas d'annulation : le bouton Annuler n'existe plus, seulement Ctrl+Z). Exports : « Quoi exporter ? » (`src/export/choix-export.js`) par catégories (volumes, stocks, terrain naturel, terrassement, dessins, listes de points ; métrés et mesures pour l'export des mesures), pré-coché comme « Afficher » ; barre « Envoyer » après chaque export (`src/export/partager.js`) : APK `partagerFichier` → `FichiersPartages.kt` (ContentProvider fait main, cache/partage, lecture seule) + partage Android ; site : `navigator.share`. DWG : non (format fermé), DXF seulement.
- 0.70.0 : Terrain › **Lame** (4e mode, bleu, Confirmé) : guidage de lame de grader avec 2 RX2 (mât au-dessus de chaque coin, hauteur du mât = hauteur de canne dans Emlid Flow, compensation d'inclinaison). Surface suivie (terrassement d'abord), « ⇄ G / D » (inverser, retenu dans `terrain.lame`, `topo-terrain`), tolérances ⚙ (vert ≤ 2 cm, orange ≤ 5 cm). Formules validées (`src/topo/lame.js`) : écart coin = altitude surface − altitude coin (positif = monter) ; dévers = (H droite − H gauche) ÷ largeur à plat × 100 (positif = droite plus haute) ; dévers voulu = idem avec la surface. Nombres seulement si les 2 RX2 sont prêts (`autorise`). Écran `src/leve/lame-ecran.js` (écarts, dévers, coupe vue de derrière), lame sur le plan (`plan.afficherLame`). **À essayer sur la machine.**
- 0.71.0 : Terrain (téléphone) : flèches ▲ / ▼ sous le plan, ±15 % de l'écran par appui (20–80 %, 35 % au départ, `--part-plan-terrain`, `topo-plan-terrain-part`) ; « Ma position » zoome pour voir environ 50 m (`METRES_AUTOUR_DE_MOI`). Projet : blocs Import / Listes de points / DXF repliables (flèche, `topo-projet-replies`) ; import « Surface » (LandXML, DXF 3D) dans Projet › Import avec choix de la nature, retiré de Calculs › Surfaces. Mesures en trait plein (plan et PDF), comme dessins et contours.
- 0.72.0 : GPS de la tablette (APK seulement, Base et Confirmé) quand aucun RX2 n'est connecté : `PositionTablette.kt` (LocationManager GPS + réseau, permission demandée une fois par lancement, arrêté si le RX2 est connecté ou l'appli en pause), MN95 par `etrs89VersMn95` (WGS84 pris comme ETRS89, < 1 m), envoyé par `window.recevoirPositionTablette` ({ est, nord, precision }) ; plan : rond gris + cercle de précision ; bandeau « GPS TABLETTE ± x m » / « RX2 non connecté ». Seulement pour se localiser : jamais points, implantation, contrôle, lame.
- 0.73.0 : Lame, profil en long : point gauche / milieu / droite (`pointDeProfil`), sens de marche (`directionDeMarche` sur les positions du milieu de la lame, 10 s gardées ; à l'arrêt `avantDeLaLame` = perpendiculaire, vers l'avant), « devant » et « derrière » en m (`terrain.lame.devant` 20, `derriere` 5), tronçons et ruptures de pente > 0.5 % (`tronconsProfil`) ; petit dessin de niveleuse (de côté dans le profil, de derrière dans la coupe).

**Reste / à valider**
- Essai terrain du talus (0.56.1) et question ouverte : arrondi (cône) aux angles saillants, est-ce voulu ?
- Précision H / V (message GST) à comparer avec Emlid Flow ; vérifier que le RX2 envoie bien du GST.
- DWG non pris en charge (enregistrer en DXF).
- Google Cloud en mode Test (réautorisation environ tous les 7 jours) : publier l'écran de consentement si besoin.

**À développer**
- Guidage de lame (0.70.0) : à valider sur la machine (hauteur de mât, signes, vitesse d'affichage).
- Dessin, étape suivante (en suspens) : 4. plateforme avec talus jusqu'au terrain naturel (entrées en terre, volume).
