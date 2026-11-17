using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Topo
{
    // Boutons + et − de la tablette Windows (0.266.0, demande du 17.11) : au lieu de changer la luminosité (gardée à fond),
    // ils font passer d'un programme Windows à l'autre (comme Alt+Tab ; − = Alt+Maj+Tab).
    //
    // Les boutons de chaque tablette envoient des codes différents (et parfois rien du tout aux programmes) : on les
    // « apprend » depuis Réglages (le prochain bouton appuyé est retenu). Écoute des touches de toute la tablette par un
    // crochet clavier bas niveau (WH_KEYBOARD_LL), tant que Topo est ouvert ; une touche apprise est avalée (Windows ne la
    // voit plus : la luminosité ne bouge plus si elle passait par le clavier).
    // Jamais essayé sur la vraie tablette : si « Apprendre » ne voit rien, les boutons ne passent pas par le clavier.
    public class BoutonsTablette : IDisposable
    {
        const int WH_KEYBOARD_LL = 13;
        const int WM_KEYDOWN = 0x0100, WM_KEYUP = 0x0101, WM_SYSKEYDOWN = 0x0104, WM_SYSKEYUP = 0x0105;
        const int LLKHF_INJECTED = 0x10;
        const ushort VK_TAB = 0x09, VK_SHIFT = 0x10, VK_MENU = 0x12;
        const uint KEYEVENTF_KEYUP = 0x0002;
        const int INPUT_KEYBOARD = 1;

        [StructLayout(LayoutKind.Sequential)]
        struct KBDLLHOOKSTRUCT { public int vkCode; public int scanCode; public int flags; public int time; public IntPtr dwExtraInfo; }

        [StructLayout(LayoutKind.Sequential)]
        struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

        [StructLayout(LayoutKind.Sequential)]
        struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

        // INPUT : type + union (souris / clavier) ; la souris est le plus grand membre et donne la bonne taille en 32 et 64 bits
        // (Windows refuse SendInput si la taille annoncée n'est pas exacte).
        [StructLayout(LayoutKind.Explicit)]
        struct UNION_INPUT { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }

        [StructLayout(LayoutKind.Sequential)]
        struct INPUT { public int type; public UNION_INPUT u; }

        delegate IntPtr ProcClavier(int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true)]
        static extern IntPtr SetWindowsHookEx(int idHook, ProcClavier lpfn, IntPtr hMod, uint dwThreadId);
        [DllImport("user32.dll", SetLastError = true)]
        static extern bool UnhookWindowsHookEx(IntPtr hhk);
        [DllImport("user32.dll")]
        static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr GetModuleHandle(string lpModuleName);
        [DllImport("user32.dll", SetLastError = true)]
        static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        readonly Reglages reglages;
        readonly Action<Action> surFenetre; // exécute une action sur le fil de la fenêtre (hors du crochet)
        readonly ProcClavier proc; // gardé ici : sinon le ramasse-miettes le libère et Windows plante en l'appelant
        IntPtr crochet = IntPtr.Zero;
        string aApprendre; // "plus", "moins" ou null
        int vkPlus, vkMoins;
        int vkTenu; // touche apprise en cours d'appui (pour avaler aussi son relâchement)

        // Appelé quand l'état change (bouton appris, erreur) : texte JSON pour la page.
        public Action<string> QuandChange;
        public string Erreur { get; private set; }

        public BoutonsTablette(Reglages reglages, Action<Action> surFenetre)
        {
            this.reglages = reglages;
            this.surFenetre = surFenetre;
            proc = Recevoir;
            vkPlus = reglages.Entier("bouton_plus_vk", 0);
            vkMoins = reglages.Entier("bouton_moins_vk", 0);
        }

        // Pose le crochet (à appeler depuis le fil de la fenêtre, qui a une boucle de messages).
        public void Demarrer()
        {
            if (crochet != IntPtr.Zero) return;
            using (var processus = Process.GetCurrentProcess())
            using (var module = processus.MainModule)
                crochet = SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(module.ModuleName), 0);
            Erreur = crochet == IntPtr.Zero ? "écoute des boutons refusée par Windows (" + new Win32Exception(Marshal.GetLastWin32Error()).Message + ")" : null;
        }

        // "plus" ou "moins" : le prochain bouton appuyé est retenu ; "oublier" : plus aucun bouton ; "annuler" : arrête d'apprendre.
        public void Apprendre(string quoi)
        {
            if (quoi == "oublier")
            {
                vkPlus = vkMoins = 0;
                reglages.Ecrire("bouton_plus_vk", null);
                reglages.Ecrire("bouton_moins_vk", null);
                aApprendre = null;
            }
            else aApprendre = quoi == "plus" || quoi == "moins" ? quoi : null;
            Signaler();
        }

        // État pour la page : { plus (code ou 0), moins, apprend ("plus" / "moins" / ""), erreur }.
        public string EnJson()
        {
            return "{\"plus\":" + vkPlus + ",\"moins\":" + vkMoins + ",\"apprend\":" + Json.Ecrire(aApprendre ?? "") + ",\"erreur\":" + Json.Ecrire(Erreur ?? "") + "}";
        }

        void Signaler() { var q = QuandChange; if (q != null) q(EnJson()); }

        IntPtr Recevoir(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                int message = wParam.ToInt32();
                var touche = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
                bool appui = message == WM_KEYDOWN || message == WM_SYSKEYDOWN;
                bool relache = message == WM_KEYUP || message == WM_SYSKEYUP;
                // Nos propres Alt+Tab (touches « injectées ») passent tels quels.
                if ((touche.flags & LLKHF_INJECTED) == 0)
                {
                    if (appui && aApprendre != null)
                    {
                        if (aApprendre == "plus") { vkPlus = touche.vkCode; reglages.Ecrire("bouton_plus_vk", vkPlus); }
                        else { vkMoins = touche.vkCode; reglages.Ecrire("bouton_moins_vk", vkMoins); }
                        aApprendre = null;
                        vkTenu = touche.vkCode;
                        surFenetre(Signaler);
                        return (IntPtr)1; // avalée
                    }
                    if (appui && touche.vkCode != 0 && (touche.vkCode == vkPlus || touche.vkCode == vkMoins))
                    {
                        bool arriere = touche.vkCode == vkMoins;
                        vkTenu = touche.vkCode;
                        surFenetre(() => ChangerDeProgramme(arriere)); // jamais d'envoi de touches dans le crochet lui-même
                        return (IntPtr)1;
                    }
                    if (relache && touche.vkCode == vkTenu && vkTenu != 0) { vkTenu = 0; return (IntPtr)1; }
                }
            }
            return CallNextHookEx(crochet, nCode, wParam, lParam);
        }

        // Alt+Tab (ou Alt+Maj+Tab) appuyés et relâchés tout de suite : Windows passe au programme précédent.
        static void ChangerDeProgramme(bool arriere)
        {
            var touches = new System.Collections.Generic.List<INPUT>();
            Action<ushort, bool> ajouter = (vk, haut) => touches.Add(new INPUT { type = INPUT_KEYBOARD, u = new UNION_INPUT { ki = new KEYBDINPUT { wVk = vk, dwFlags = haut ? KEYEVENTF_KEYUP : 0 } } });
            ajouter(VK_MENU, false);
            if (arriere) ajouter(VK_SHIFT, false);
            ajouter(VK_TAB, false);
            ajouter(VK_TAB, true);
            if (arriere) ajouter(VK_SHIFT, true);
            ajouter(VK_MENU, true);
            SendInput((uint)touches.Count, touches.ToArray(), Marshal.SizeOf(typeof(INPUT)));
        }

        public void Dispose()
        {
            if (crochet != IntPtr.Zero) { UnhookWindowsHookEx(crochet); crochet = IntPtr.Zero; }
        }
    }
}
