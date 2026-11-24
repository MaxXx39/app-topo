// Pont entre l'appli web et les appli Windows (Topo Tablette et Topo Bureau, dossiers windows/Topo et windows/TopoBureau).
// Ce script est glissé dans la page par la fenêtre Windows AVANT le reste de l'appli. Il fabrique l'objet
// window.AppliAndroid avec les MÊMES fonctions que l'APK Android (voir src/android/pont.js et PontAndroid.kt) :
// l'appli web marche donc pareil sur les deux, sans rien savoir de Windows.
// - Les ordres (« choisir le récepteur », « enregistrer ce fichier »…) partent vers Windows par un message.
// - Les lectures immédiates (« prendre le point », réglages, journal) sont servies depuis une copie que
//   Windows tient à jour 5 fois par seconde (une page ne peut pas attendre une réponse de Windows).
(function () {
  if (window.top !== window || window.AppliAndroid || !window.chrome || !window.chrome.webview) return;

  var depart = /*DEPART*/ {};
  var copie = {
    point: null, // texte JSON du dernier « point à prendre » calculé par Windows
    pointRecuLe: 0,
    reglages: { 1: depart.reglages1 || '{}', 2: depart.reglages2 || '{}' },
    journal: '',
    // 0.266.0 : boutons + / − de la tablette (codes appris, apprentissage en cours, erreur), voir BoutonsTablette.cs.
    boutons: depart.boutons ? JSON.stringify(depart.boutons) : '{}',
  };

  function envoyer(fonction) {
    window.chrome.webview.postMessage({ fonction: fonction, args: Array.prototype.slice.call(arguments, 1) });
  }

  // Met à jour la copie des réglages NTRIP tout de suite (Windows renvoie ensuite la vraie valeur).
  function retoucherReglages(numero, changements) {
    try {
      var reglages = JSON.parse(copie.reglages[numero]);
      Object.keys(changements).forEach(function (cle) { reglages[cle] = changements[cle]; });
      copie.reglages[numero] = JSON.stringify(reglages);
    } catch (erreur) { /* copie illisible : Windows la renverra */ }
  }

  function demarrerCorrections(numero, texteJson) {
    try {
      var r = JSON.parse(texteJson);
      var changements = { hote: r.hote, port: r.port, pointDeMontage: r.pointDeMontage, utilisateur: r.utilisateur, actives: true };
      if (r.motDePasse) changements.motDePasseEnregistre = true;
      retoucherReglages(numero, changements);
    } catch (erreur) { /* Windows dira que les réglages sont illisibles */ }
    envoyer(numero === 2 ? 'demarrerCorrections2' : 'demarrerCorrections', texteJson);
  }

  // Appelé par Windows (Fenetre.cs).
  window.__topoWindows = {
    // 5 fois par seconde : état des récepteurs, point à prendre, position de la tablette, suite du journal.
    etat: function (etat1, point, etat2, mode2, tablette, suiteJournal) {
      copie.point = point;
      copie.pointRecuLe = Date.now();
      if (suiteJournal) copie.journal += suiteJournal;
      if (window.recevoirEtatRecepteur) window.recevoirEtatRecepteur(etat1);
      if (window.recevoirEtatRecepteur2) window.recevoirEtatRecepteur2(etat2, mode2);
      if (window.recevoirPositionTablette) window.recevoirPositionTablette(tablette);
    },
    reglages: function (numero, texteJson) { copie.reglages[numero] = texteJson; },
    boutons: function (etat) {
      copie.boutons = JSON.stringify(etat);
      if (window.recevoirBoutonsTablette) window.recevoirBoutonsTablette(etat);
    },
  };

  // Clavier tactile (0.256.4) : Windows ne le sort pas toujours tout seul dans une fenêtre d'appli. Un champ de texte touché
  // du DOIGT ou du stylet (pas à la souris : un vrai clavier est là) demande le clavier ; quand plus aucun champ n'a la main,
  // on le range. Voir ClavierTactile.cs.
  var doc = window.document;
  var dernierPointeur = 'mouse';
  var SANS_CLAVIER = { checkbox: 1, radio: 1, button: 1, submit: 1, reset: 1, range: 1, file: 1, color: 1, image: 1, hidden: 1 };
  function estChampTexte(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.tagName === 'TEXTAREA' || el.isContentEditable) return true;
    return el.tagName === 'INPUT' && !SANS_CLAVIER[(el.type || 'text').toLowerCase()];
  }
  var clavierDemande = false;
  if (doc && doc.addEventListener) {
    doc.addEventListener('pointerdown', function (e) { dernierPointeur = e.pointerType || 'mouse'; }, true);
    doc.addEventListener('focusin', function (e) {
      if (!estChampTexte(e.target) || dernierPointeur === 'mouse') return;
      clavierDemande = true;
      envoyer('montrerClavier');
    }, true);
    doc.addEventListener('focusout', function () {
      if (!clavierDemande) return;
      // On attend un instant : le doigt passe peut-être d'un champ à l'autre (le clavier reste alors sorti).
      setTimeout(function () {
        if (estChampTexte(doc.activeElement)) return;
        clavierDemande = false;
        envoyer('cacherClavier');
      }, 150);
    }, true);
  }

  // Commun à Topo Tablette et Topo Bureau.
  var appli = {
    // Vrai seulement dans Topo Tablette : permet à l'appli web d'adapter les rares choses propres à la tablette Windows.
    estWindows: !depart.bureau,
    // 0.277.0 : vrai dans Topo Bureau (PC) : pas de récepteur, l'appli web se comporte comme le site PC (src/android/pont.js).
    estBureau: Boolean(depart.bureau),
    versionWindows: depart.version || '',

    // --- Fichiers ---
    enregistrerFichier: function (nom, type, contenuBase64) { envoyer('enregistrerFichier', nom, type, contenuBase64); },
    partagerFichier: function (nom, type, contenuBase64) { envoyer('partagerFichier', nom, type, contenuBase64, ''); },
    partagerFichierMail: function (nom, type, contenuBase64, adresse) { envoyer('partagerFichier', nom, type, contenuBase64, adresse || ''); },

    // --- Divers ---
    demanderJetonDrive: function (renouveler) { envoyer('demanderJetonDrive', Boolean(renouveler)); },
    fermerAppli: function () { envoyer('fermerAppli'); },
    modeleAppareil: function () { return depart.modele || (depart.bureau ? 'PC Windows' : 'Tablette Windows'); },
    vibrer: function () { /* pas de vibreur sous Windows */ },
    ouvrirAnydesk: function () { envoyer('ouvrirAnydesk'); },
    lireAdresse: function (numero, adresse) { envoyer('lireAdresse', numero, adresse); },
    // Propre à Windows : télécharge le nouveau .exe, le met à la place de celui-ci et relance l'appli.
    installerMiseAJour: function (adresse) { envoyer('installerMiseAJour', adresse); },
  };

  // Seulement Topo Bureau (0.280.0, calage de plans) : plan DWG (et ses xrefs) choisi dans une fenêtre Windows,
  // converti en DXF par ODA File Converter ; réponse par window.recevoirConversionDwg(numero, { fichiers | erreur }).
  // 0.308.0 : aussi dans Topo Tablette (calage complet sur la tablette Windows, si ODA y est installé).
  appli.choisirDwg = function (numero) { envoyer('choisirDwg', numero); };

  // Seulement Topo Tablette : récepteur GNSS, corrections NTRIP, journal NMEA, laser, boutons + / −.
  // (Topo Bureau ne les a pas : l'appli web voit alors « pas de récepteur », comme sur le site.)
  if (!depart.bureau) {
    var tablette = {
      // --- Récepteur ---
      choisirRecepteur: function () { envoyer('choisirRecepteur'); },
      reconnecterRecepteur: function () { envoyer('reconnecterRecepteur'); },
      deconnecterRecepteur: function () { envoyer('deconnecterRecepteur'); },
      choisirRecepteur2: function () { envoyer('choisirRecepteur2'); },
      deconnecterRecepteur2: function () { envoyer('deconnecterRecepteur2'); },

      // --- Laser Leica DISTO en Bluetooth (Test laser) : pas encore sous Windows (APK seulement) ---
      choisirLaser: function () { alert('Laser en Bluetooth : pas encore dans l\'appli Windows (tablette Android seulement).'); },
      deconnecterLaser: function () {},
      mesurerLaser: function () { return false; },
      etatLaser: function () { return 'deconnecte'; },

      // Point à prendre maintenant : la copie a moins d'une seconde, sinon on refuse (jamais de point périmé).
      prendrePoint: function () {
        if (copie.point && Date.now() - copie.pointRecuLe <= 1000) return copie.point;
        return JSON.stringify({ ok: false, raison: 'Pas de position récente du récepteur' });
      },

      demarrerJournalNmea: function (secondes) { copie.journal = ''; envoyer('demarrerJournalNmea', secondes); },
      lireJournalNmea: function () { return copie.journal; },

      // --- Corrections RTK par internet ---
      lireReglagesCorrections: function () { return copie.reglages[1]; },
      demarrerCorrections: function (texteJson) { demarrerCorrections(1, texteJson); },
      arreterCorrections: function () { retoucherReglages(1, { actives: false }); envoyer('arreterCorrections'); },
      lireReglagesCorrections2: function () { return copie.reglages[2]; },
      demarrerCorrections2: function (texteJson) { demarrerCorrections(2, texteJson); },
      arreterCorrections2: function () { retoucherReglages(2, { actives: false }); envoyer('arreterCorrections2'); },
      choisirModeCorrections2: function (mode) { envoyer('choisirModeCorrections2', mode); },

      activerToucheVolume: function () { /* pas de touche « volume » sous Windows */ },
      // Propre à Windows (0.266.0) : boutons + / − de la tablette → changer de programme. quoi : 'plus', 'moins', 'oublier', 'annuler'.
      apprendreBouton: function (quoi) { envoyer('apprendreBouton', quoi); },
      lireBoutonsTablette: function () { return copie.boutons; },
    };
    Object.keys(tablette).forEach(function (cle) { appli[cle] = tablette[cle]; });
  }

  window.AppliAndroid = appli;
})();
