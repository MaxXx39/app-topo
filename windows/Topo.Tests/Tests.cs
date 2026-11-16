using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Topo;

// Tests des calculs de l'appli Windows (sans fenêtre) : mêmes cas de référence que les tests Kotlin de l'APK
// (android/noyau/src/test). Lancés par GitHub avant de fabriquer le .exe ; un seul échec arrête la fabrication.
static class Tests
{
    static int echecs;

    static void Verifier(bool condition, string nom)
    {
        if (condition) Console.WriteLine("  ok     " + nom);
        else { echecs++; Console.WriteLine("  ÉCHEC  " + nom); }
    }

    static void Proche(double attendu, double obtenu, double tolerance, string nom)
    {
        Verifier(Math.Abs(attendu - obtenu) <= tolerance, nom + " (attendu " + attendu + ", obtenu " + obtenu + ")");
    }

    static string Phrase(string contenu) { return "$" + contenu + "*" + Nmea.SommeDeControle(contenu); }

    static int Main(string[] arguments)
    {
        // Chemin de la grille du géoïde (le même fichier que l'APK).
        string cheminGrille = arguments.Length > 0 ? arguments[0] : "../../android/noyau/src/main/resources/geoide/chgeo2004_lhn95.grille";
        GrilleGeoide grille;
        using (FileStream flux = File.OpenRead(cheminGrille)) grille = GrilleGeoide.Lire(flux);

        Console.WriteLine("Coordonnées MN95 / RAN95 (points calculés par Emlid Flow)");
        PositionSuisse p1 = Mn95.VersPositionSuisse(46.41530610, 6.26153669, 464.985, grille);
        Proche(2509500.921, p1.Est, 0.003, "point 1 : Est");
        Proche(1141119.690, p1.Nord, 0.003, "point 1 : Nord");
        Proche(414.856, p1.Altitude, 0.001, "point 1 : altitude");
        PositionSuisse p2 = Mn95.VersPositionSuisse(46.42611403, 6.27007312, 402.281, grille);
        Proche(2510175.098, p2.Est, 0.003, "base swipos : Est");
        Proche(1142311.197, p2.Nord, 0.003, "base swipos : Nord");
        Proche(352.129, p2.Altitude, 0.001, "base swipos : altitude");
        Verifier(grille.HauteurGeoide(48.85, 2.35) == null, "hors de Suisse : la grille ne répond pas");
        Verifier(Mn95.VersPositionSuisse(48.85, 2.35, 100.0, grille) == null, "hors de Suisse : pas de position");
        Proche(50.129, grille.HauteurGeoide(46.41530610, 6.26153669).Value, 0.001, "valeur de la grille à Gland");

        Console.WriteLine("NMEA");
        string texteGga = "GNGGA,134400.60,4624.9183660,N,00615.6922014,E,4,25,0.6,417.751,M,47.234,M,0.8,1935";
        PositionGga gga = Nmea.LireGga(Nmea.LirePhrase(Phrase(texteGga)));
        PositionSuisse p3 = Mn95.VersPositionSuisse(gga, grille);
        Proche(2509500.921, p3.Est, 0.003, "depuis un GGA : Est");
        Proche(1141119.690, p3.Nord, 0.003, "depuis un GGA : Nord");
        Proche(414.856, p3.Altitude, 0.001, "depuis un GGA : altitude");
        Verifier(gga.Qualite == 4 && gga.EstRtkFixe && gga.NbSatellites == 25, "GGA : qualité et satellites");
        Proche(0.8, gga.AgeCorrectionsS.Value, 1e-9, "GGA : âge des corrections");
        Verifier(Nmea.LirePhrase("$GNGGA,1,2*00").SommeOk == false, "somme de contrôle fausse reconnue");
        Verifier(Nmea.LirePhrase("bonjour") == null, "ligne qui n'est pas du NMEA");
        Verifier(Nmea.SommeDeControle("GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,") == "47", "somme de contrôle connue (47)");
        PositionGga vide = Nmea.LireGga(Nmea.LirePhrase(Phrase("GNGGA,134400.60,,,,,0,00,,,M,,M,,")));
        Verifier(vide.LatitudeDeg == null && vide.HauteurEllipsoidaleM == null && Mn95.VersPositionSuisse(vide, grille) == null, "GGA vide : aucune valeur inventée");
        Proche(-33.5, Nmea.DegresDepuisNmea("3330.000", "S").Value, 1e-9, "latitude sud négative");
        EtatCompensation etc = Nmea.LireEtc(Nmea.LirePhrase(Phrase("GNETC,134400.60,30,0,123.4,200.5,2.75")));
        Verifier(etc.EstActive && etc.InclinaisonDeg == 2.75 && etc.CapDeg == 123.4 && etc.DirectionInclinaisonDeg == 200.5, "ETC : état 30, inclinaison, cap, direction");
        PrecisionGst gst = Nmea.LireGst(Nmea.LirePhrase(Phrase("GNGST,134400.60,0.01,0.01,0.01,0,0.003,0.004,0.010")));
        Proche(0.005, gst.HorizontaleM.Value, 1e-9, "GST : précision horizontale");
        Proche(0.010, gst.VerticaleM.Value, 1e-9, "GST : précision verticale");
        DilutionGsa gsa = Nmea.LireGsa(Nmea.LirePhrase(Phrase("GNGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.2,0.6,1.0,1")));
        Proche(1.2, gsa.Pdop.Value, 1e-9, "GSA : PDOP");
        Verifier(Nmea.LireGsa(Nmea.LirePhrase(Phrase("GNGSA,A,1,,,,,,,,,,,,,,,,1"))) == null, "GSA sans position ignoré");

        Console.WriteLine("Règle de prise de point");
        Verifier(!PriseDePoint.Autoriser(null, null, null, null).Autorise, "rien reçu : refusé");
        Verifier(PriseDePoint.Autoriser(gga, 500, etc, 500).Autorise, "fixe + inclinaison prête : accepté");
        Verifier(PriseDePoint.Autoriser(gga, 2500, etc, 500).Raison == "Pas de position récente du récepteur", "position trop ancienne : refusé");
        Verifier(PriseDePoint.Autoriser(vide, 100, etc, 100).Raison == "RTK pas fixe", "pas fixe : refusé");
        Verifier(PriseDePoint.Autoriser(gga, 100, null, null).Raison == "État de l'inclinaison inconnu", "inclinaison inconnue : refusé");
        var etcNonPret = new EtatCompensation { Etat = 10 };
        Verifier(!PriseDePoint.Autoriser(gga, 100, etcNonPret, 100).Autorise, "inclinaison non prête : refusé");

        Console.WriteLine("État du récepteur (texte JSON envoyé à la page)");
        var etat = new EtatRecepteur(() => grille);
        Dictionary<string, object> avant = Json.LireObjet(etat.EnJson(null));
        Verifier(!Json.Vrai(avant, "connecte") && !Json.Vrai(avant, "recu") && !Json.Vrai(avant, "autorise"), "avant toute donnée : rien reçu, rien autorisé");
        Verifier(Json.Vrai(Json.LireObjet(etat.PointEnJson()), "ok") == false, "avant toute donnée : point refusé");
        etat.DemarrerJournal(5000);
        etat.SurLigneNmea(Phrase(texteGga));
        etat.SurLigneNmea(Phrase("GNETC,134400.60,30,0,123.4,200.5,2.75"));
        etat.SurLigneNmea(Phrase("GNGST,134400.60,0.01,0.01,0.01,0,0.003,0.004,0.010"));
        etat.SurLigneNmea(Phrase("GNGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.2,0.6,1.0,1"));
        etat.SurLigneNmea("$GNGGA,faux*00");
        Dictionary<string, object> apres = Json.LireObjet(etat.EnJson("Reach RX2"));
        Verifier(Json.Vrai(apres, "recu") && Json.Vrai(apres, "autorise") && Json.Vrai(apres, "inclinaisonPrete"), "après GGA + ETC : reçu, autorisé");
        Verifier(Json.Texte(apres, "libelleQualite") == "RTK FIXE" && Json.Texte(apres, "dernierRecepteur") == "Reach RX2", "libellé de qualité et nom du récepteur");
        var position = apres["position"] as Dictionary<string, object>;
        Proche(2509500.921, (double)position["est"], 0.003, "position de l'état : Est");
        Proche(1.2, (double)apres["pdop"], 1e-9, "PDOP dans l'état");
        Verifier(apres["corrections"] is Dictionary<string, object> && Json.Texte((Dictionary<string, object>)apres["corrections"], "etat") == "arrete", "corrections arrêtées au départ");
        Dictionary<string, object> point = Json.LireObjet(etat.PointEnJson());
        Verifier(Json.Vrai(point, "ok"), "point accepté");
        var lePoint = (Dictionary<string, object>)point["point"];
        Proche(414.856, (double)lePoint["altitude"], 0.001, "point : altitude");
        Proche(0.005, (double)lePoint["precisionH"], 1e-9, "point : précision H");
        Verifier(Json.Texte(lePoint, "heureUtc") == "134400.60", "point : heure UTC");
        string journal = etat.SuiteDuJournal();
        Verifier(journal.Split('\n').Length == 6 && etat.SuiteDuJournal() == "", "journal NMEA : 5 lignes, puis plus rien de nouveau");
        etat.Oublier("non connecté");
        Verifier(!Json.Vrai(Json.LireObjet(etat.EnJson(null)), "recu"), "après déconnexion : position oubliée");

        Console.WriteLine("JSON");
        var objet = (Dictionary<string, object>)Json.Lire("{\"a\": [1, 2.5, -3e2], \"b\": \"x\\\"\\n\\u00e9\", \"c\": true, \"d\": null, \"e\": {}}");
        Verifier(((List<object>)objet["a"]).Count == 3 && (double)((List<object>)objet["a"])[2] == -300, "lecture d'une liste de nombres");
        Verifier((string)objet["b"] == "x\"\né" && (bool)objet["c"] && objet["d"] == null, "lecture de texte, vrai, null");
        string ecrit = Json.Ecrire(new Dictionary<string, object> { { "t", "a\"b</script>" + (char)0x2028 }, { "n", 1234567.891 }, { "i", 42 }, { "v", null }, { "l", new List<object> { true, "x" } } });
        Verifier(ecrit == "{\"t\":\"a\\\"b\\u003c/script>\\u2028\",\"n\":1234567.891,\"i\":42,\"v\":null,\"l\":[true,\"x\"]}", "écriture : " + ecrit);
        Verifier(Json.Ecrire(double.NaN) == "null", "nombre impossible écrit null");
        Verifier(Json.LireObjet("pas du json") == null && Json.LireObjet("{\"a\":1} x") == null, "texte illisible : null, sans erreur");
        Verifier(Json.Entier(Json.LireObjet("{\"port\":2101}"), "port") == 2101 && Json.Texte(Json.LireObjet("{}"), "x", "d") == "d", "valeurs avec défaut");

        Console.WriteLine("NTRIP");
        var reglages = new ReglagesNtrip { Hote = "www.swipos.ch", Port = 2101, PointDeMontage = "/MSM_GISGEO_LV95LHN95", Utilisateur = "u", MotDePasse = "p" };
        string requete = Ntrip.Requete(reglages);
        Verifier(requete.StartsWith("GET /MSM_GISGEO_LV95LHN95 HTTP/1.0\r\n") && requete.Contains("Authorization: Basic dTpw\r\n") && requete.EndsWith("\r\n\r\n"), "requête");
        Verifier(Ntrip.LireReponse("ICY 200 OK", null).Acceptee, "ICY 200 OK accepté");
        Verifier(Ntrip.LireReponse("HTTP/1.1 401 Unauthorized", null).Definitif, "401 : refus définitif");
        Verifier(Ntrip.LireReponse("SOURCETABLE 200 OK", null).Definitif, "SOURCETABLE : point de montage inconnu");
        Verifier(Ntrip.LireReponse("HTTP/1.1 200 OK", new List<string> { "Transfer-Encoding: chunked" }).Decoupe, "corrections par morceaux reconnues");
        Verifier(new ReglagesNtrip().Manque() != null && reglages.Manque() == null, "réglages incomplets signalés");
        Verifier(Ntrip.GgaPourServeur(" $GNGGA,1,2*00 ") == "$GNGGA,1,2*00\r\n" && Ntrip.GgaPourServeur("$GNRMC,1") == null, "GGA pour le serveur");
        var remonteur = new Remonteur();
        byte[] morceaux = Encoding.ASCII.GetBytes("3\r\nabc\r\n2;x\r\nde\r\n");
        var recu = new List<byte>();
        foreach (byte b in morceaux) recu.AddRange(remonteur.Ajouter(new[] { b }, 1));   // octet par octet : le pire découpage
        Verifier(Encoding.ASCII.GetString(recu.ToArray()) == "abcde", "morceaux remis bout à bout");

        Console.WriteLine("Drive (connexion Google)");
        Verifier(Drive.DefiPkce("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk") == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", "défi PKCE (exemple de la norme RFC 7636)");
        Dictionary<string, string> parametres = Drive.ParametresDeLaRequete("GET /?code=4%2Fabc&state=xyz+1 HTTP/1.1");
        Verifier(parametres["code"] == "4/abc" && parametres["state"] == "xyz 1", "lecture du retour de Google");
        Verifier(Drive.ParametresDeLaRequete("GET /favicon.ico HTTP/1.1").Count == 0, "autre demande du navigateur ignorée");

        Console.WriteLine("Appli web rangée dans le .exe");
        Verifier(ServeurAppli.TypeDuFichier("assets/index-abc.js") == "text/javascript" && ServeurAppli.TypeDuFichier("index.html") == "text/html", "types des fichiers");
        Verifier(ServeurAppli.CheminDuFichier("https://topo.appli/app-topo/") == "index.html", "accueil = index.html");
        Verifier(ServeurAppli.CheminDuFichier("https://topo.appli/app-topo/assets/a.js?v=2#x") == "assets/a.js", "adresse -> fichier");
        Verifier(ServeurAppli.CheminDuFichier("https://topo.appli/autre/a.js") == null && ServeurAppli.CheminDuFichier("https://ailleurs.ch/app-topo/a.js") == null, "autres adresses refusées");
        Verifier(MiseAJour.AdresseAutorisee("https://github.com/MaxXx39/app-topo/releases/download/windows-derniere-version/Topo-0.237.0.exe"), "mise à jour : adresse GitHub acceptée");
        Verifier(!MiseAJour.AdresseAutorisee("https://exemple.com/Topo.exe") && !MiseAJour.AdresseAutorisee("http://github.com/MaxXx39/app-topo/releases/download/x/Topo.exe"), "mise à jour : autres adresses refusées");

        Console.WriteLine(echecs == 0 ? "\nTous les tests passent." : "\n" + echecs + " test(s) en échec.");
        return echecs == 0 ? 0 : 1;
    }
}
