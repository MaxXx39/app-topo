using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

namespace Topo
{
    // Clavier tactile de Windows (0.256.4, audit Windows : « le clavier ne sort pas tout seul »).
    // Dans une fenêtre d'appli (pas en « mode tablette »), Windows ne sort pas toujours son clavier quand on touche
    // un champ de texte de la page. La page (pont-windows.js) prévient donc Windows : « un champ a été touché du doigt »
    // → Montrer(), « plus aucun champ » → Cacher().
    // Moyens utilisés (ceux de Windows 10 et 11, sans bibliothèque) :
    // - ITipInvocation.Toggle : ouvre / ferme le clavier (c'est une bascule : on regarde d'abord s'il est déjà là) ;
    // - IFrameworkInputPane.Location : position du clavier à l'écran (vide = caché) ;
    // - TabTip.exe : le programme du clavier, lancé s'il ne tourne pas (sinon Toggle échoue).
    // Jamais essayé sur un vrai Windows (pas de Windows ici) : à vérifier sur la tablette.
    static class ClavierTactile
    {
        [ComImport, Guid("37c994e7-432b-4834-a2f7-dce1f13b834b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface ITipInvocation
        {
            void Toggle(IntPtr fenetre);
        }

        [ComImport, Guid("4ce576fa-83dc-4F88-951c-9d0782b4e376")]
        class UIHostNoLaunch { }

        [StructLayout(LayoutKind.Sequential)]
        struct Rectangle
        {
            public int Gauche, Haut, Droite, Bas;
        }

        [ComImport, Guid("5752238B-24F0-495A-82F1-2FD593056796"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IFrameworkInputPane
        {
            [PreserveSig] int Advise([MarshalAs(UnmanagedType.IUnknown)] object fenetre, [MarshalAs(UnmanagedType.IUnknown)] object suivi, out int cle);
            [PreserveSig] int AdviseWithHWND(IntPtr fenetre, [MarshalAs(UnmanagedType.IUnknown)] object suivi, out int cle);
            [PreserveSig] int Unadvise(int cle);
            [PreserveSig] int Location(out Rectangle position);
        }

        [ComImport, Guid("D5120AA3-46BA-44C5-822D-CA8092C1FC72")]
        class FrameworkInputPane { }

        [DllImport("user32.dll")]
        static extern IntPtr GetDesktopWindow();

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr FindWindow(string classe, string titre);

        [DllImport("user32.dll")]
        static extern bool IsWindowVisible(IntPtr fenetre);

        /// <summary>Vrai si le clavier tactile est affiché à l'écran.</summary>
        public static bool EstAffiche()
        {
            object volet = null;
            try
            {
                volet = new FrameworkInputPane();
                Rectangle r;
                if (((IFrameworkInputPane)volet).Location(out r) == 0) return r.Droite - r.Gauche > 0 && r.Bas - r.Haut > 0;
            }
            catch (Exception) { /* Windows plus ancien : on regarde la fenêtre du clavier */ }
            finally
            {
                if (volet != null) Marshal.ReleaseComObject(volet);
            }
            IntPtr clavier = FindWindow("IPTip_Main_Window", null);
            return clavier != IntPtr.Zero && IsWindowVisible(clavier);
        }

        /// <summary>Sort le clavier s'il n'est pas déjà là. Lève une erreur claire si Windows refuse.</summary>
        public static void Montrer()
        {
            if (EstAffiche()) return;
            LancerTabTip();
            try
            {
                Basculer();
            }
            catch (COMException)
            {
                // TabTip vient de démarrer : il lui faut un instant avant d'accepter la demande.
                Thread.Sleep(300);
                Basculer();
            }
        }

        /// <summary>Range le clavier s'il est affiché.</summary>
        public static void Cacher()
        {
            if (EstAffiche()) Basculer();
        }

        static void Basculer()
        {
            object hote = null;
            try
            {
                hote = new UIHostNoLaunch();
                ((ITipInvocation)hote).Toggle(GetDesktopWindow());
            }
            finally
            {
                if (hote != null) Marshal.ReleaseComObject(hote);
            }
        }

        /// <summary>Lance TabTip.exe (programme du clavier tactile) s'il ne tourne pas encore.</summary>
        static void LancerTabTip()
        {
            if (Process.GetProcessesByName("TabTip").Length > 0) return;
            // Dossier « Common Files » 64 bits même si Topo.exe tourne en 32 bits.
            string communs = Environment.GetEnvironmentVariable("CommonProgramW6432");
            if (string.IsNullOrEmpty(communs)) communs = Environment.GetFolderPath(Environment.SpecialFolder.CommonProgramFiles);
            string chemin = Path.Combine(communs, "microsoft shared", "ink", "TabTip.exe");
            if (!File.Exists(chemin)) throw new InvalidOperationException("clavier tactile de Windows introuvable (" + chemin + ")");
            Process.Start(new ProcessStartInfo(chemin) { UseShellExecute = true });
            Thread.Sleep(300);
        }
    }
}
