namespace Topo
{
    // Deux programmes Windows fabriqués avec le MÊME code (0.277.0, décision du 22.11) :
    // - « Topo Tablette » (windows/Topo/Topo.csproj, TopoTablette.exe) : la tablette terrain (récepteur GNSS, NTRIP,
    //   boutons + / −, plein écran, appli agrandie). C'est l'ancien « Topo.exe », renommé : son dossier de données reste
    //   « Topo » (sinon les tablettes perdraient leurs projets) ;
    // - « Topo Bureau » (windows/TopoBureau/TopoBureau.csproj, TopoBureau.exe, constante BUREAU) : le PC du bureau,
    //   la même chose que le site PC mais installée, avec des fonctions avancées (DWG par ODA File Converter, plus tard) ;
    //   pas de récepteur ni de boutons de tablette, fenêtre normale, zoom 100 %.
    // Les deux servent la même appli web à la même adresse (https://topo.appli/app-topo/), chacun dans son dossier.
    public static class Edition
    {
#if BUREAU
        public static readonly bool Bureau = true;
        public const string Nom = "Topo Bureau";
        public const string DossierDonnees = "TopoBureau";   // dans AppData\Local
        public const string DossierEnvois = "Topo Bureau";   // dans Documents (exports enregistrés)
        public const string Verrou = "Topo-bureau";          // une seule fenêtre Topo Bureau à la fois
#else
        public static readonly bool Bureau = false;
        public const string Nom = "Topo Tablette";
        public const string DossierDonnees = "Topo";         // NE JAMAIS CHANGER : données des tablettes déjà en service
        public const string DossierEnvois = "Topo";
        public const string Verrou = "Topo-appli-windows";
#endif
    }
}
