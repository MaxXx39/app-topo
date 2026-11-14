// Pont entre l'appli web et l'appli Windows (Topo.exe, dossier windows/Topo).
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
  };

  window.AppliAndroid = {
    // Vrai seulement ici : permet à l'appli web d'adapter les rares choses propres à Windows (mise à jour).
    estWindows: true,
    versionWindows: depart.version || '',

    // --- Fichiers ---
    enregistrerFichier: function (nom, type, contenuBase64) { envoyer('enregistrerFichier', nom, type, contenuBase64); },
    partagerFichier: function (nom, type, contenuBase64) { envoyer('partagerFichier', nom, type, contenuBase64, ''); },
    partagerFichierMail: function (nom, type, contenuBase64, adresse) { envoyer('partagerFichier', nom, type, contenuBase64, adresse || ''); },

    // --- Récepteur ---
    choisirRecepteur: function () { envoyer('choisirRecepteur'); },
    reconnecterRecepteur: function () { envoyer('reconnecterRecepteur'); },
    deconnecterRecepteur: function () { envoyer('deconnecterRecepteur'); },
    choisirRecepteur2: function () { envoyer('choisirRecepteur2'); },
    deconnecterRecepteur2: function () { envoyer('deconnecterRecepteur2'); },

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

    // --- Divers ---
    demanderJetonDrive: function (renouveler) { envoyer('demanderJetonDrive', Boolean(renouveler)); },
    fermerAppli: function () { envoyer('fermerAppli'); },
    modeleAppareil: function () { return depart.modele || 'Tablette Windows'; },
    activerToucheVolume: function () { /* pas de touche « volume » sous Windows */ },
    vibrer: function () { /* pas de vibreur sous Windows */ },
    ouvrirAnydesk: function () { envoyer('ouvrirAnydesk'); },
    lireAdresse: function (numero, adresse) { envoyer('lireAdresse', numero, adresse); },
    // Propre à Windows : télécharge le nouveau Topo.exe, le met à la place de celui-ci et relance l'appli.
    installerMiseAJour: function (adresse) { envoyer('installerMiseAJour', adresse); },
  };
})();
