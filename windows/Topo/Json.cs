using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Topo
{
    // Petit lecteur / écrivain de JSON (le format de texte échangé avec la page web), sans bibliothèque.
    // Objet JSON = Dictionary<string, object> ; liste = List<object> ; nombre = double ; texte = string ;
    // vrai / faux = bool ; null = null.
    public static class Json
    {
        // ---------- Écrire ----------

        public static string Ecrire(object valeur)
        {
            var sortie = new StringBuilder();
            Ecrire(valeur, sortie);
            return sortie.ToString();
        }

        static void Ecrire(object v, StringBuilder s)
        {
            if (v == null) { s.Append("null"); return; }
            if (v is string) { EcrireTexte((string)v, s); return; }
            if (v is bool) { s.Append((bool)v ? "true" : "false"); return; }
            if (v is double || v is float)
            {
                double d = Convert.ToDouble(v, CultureInfo.InvariantCulture);
                // Un nombre impossible (division par zéro…) n'existe pas en JSON : on écrit null.
                if (double.IsNaN(d) || double.IsInfinity(d)) s.Append("null");
                else s.Append(d.ToString("R", CultureInfo.InvariantCulture));
                return;
            }
            if (v is int || v is long || v is short || v is byte)
            {
                s.Append(Convert.ToInt64(v, CultureInfo.InvariantCulture).ToString(CultureInfo.InvariantCulture));
                return;
            }
            var objet = v as IDictionary<string, object>;
            if (objet != null)
            {
                s.Append('{');
                bool premier = true;
                foreach (var paire in objet)
                {
                    if (!premier) s.Append(',');
                    premier = false;
                    EcrireTexte(paire.Key, s);
                    s.Append(':');
                    Ecrire(paire.Value, s);
                }
                s.Append('}');
                return;
            }
            var liste = v as IEnumerable;
            if (liste != null)
            {
                s.Append('[');
                bool premier = true;
                foreach (object element in liste)
                {
                    if (!premier) s.Append(',');
                    premier = false;
                    Ecrire(element, s);
                }
                s.Append(']');
                return;
            }
            EcrireTexte(Convert.ToString(v, CultureInfo.InvariantCulture), s);
        }

        // Texte entre guillemets, sûr aussi à l'intérieur d'un script envoyé à la page.
        static void EcrireTexte(string t, StringBuilder s)
        {
            s.Append('"');
            foreach (char c in t)
            {
                switch (c)
                {
                    case '"': s.Append("\\\""); break;
                    case '\\': s.Append("\\\\"); break;
                    case '\n': s.Append("\\n"); break;
                    case '\r': s.Append("\\r"); break;
                    case '\t': s.Append("\\t"); break;
                    default:
                        // Caractères de commande, « < » (fin de script) et séparateurs de ligne Unicode : écrits en \uXXXX.
                        if (c < ' ' || c == '<' || c == (char)0x2028 || c == (char)0x2029)
                            s.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else s.Append(c);
                        break;
                }
            }
            s.Append('"');
        }

        // ---------- Lire ----------

        // Lit un texte JSON ; lève FormatException s'il est illisible.
        public static object Lire(string texte)
        {
            if (texte == null) throw new FormatException("JSON vide");
            int i = 0;
            object valeur = LireValeur(texte, ref i);
            Blancs(texte, ref i);
            if (i != texte.Length) throw new FormatException("JSON : texte en trop à la position " + i);
            return valeur;
        }

        // Lit un objet JSON, ou null si le texte n'en est pas un (jamais d'erreur).
        public static Dictionary<string, object> LireObjet(string texte)
        {
            try { return Lire(texte) as Dictionary<string, object>; }
            catch (FormatException) { return null; }
        }

        static void Blancs(string t, ref int i)
        {
            while (i < t.Length && (t[i] == ' ' || t[i] == '\n' || t[i] == '\r' || t[i] == '\t')) i++;
        }

        static object LireValeur(string t, ref int i)
        {
            Blancs(t, ref i);
            if (i >= t.Length) throw new FormatException("JSON incomplet");
            char c = t[i];
            if (c == '{') return LireObjetInterne(t, ref i);
            if (c == '[') return LireListe(t, ref i);
            if (c == '"') return LireTexte(t, ref i);
            if (Suit(t, i, "true")) { i += 4; return true; }
            if (Suit(t, i, "false")) { i += 5; return false; }
            if (Suit(t, i, "null")) { i += 4; return null; }
            int debut = i;
            while (i < t.Length && "+-0123456789.eE".IndexOf(t[i]) >= 0) i++;
            double nombre;
            if (i == debut || !double.TryParse(t.Substring(debut, i - debut), NumberStyles.Float, CultureInfo.InvariantCulture, out nombre))
                throw new FormatException("JSON : valeur illisible à la position " + debut);
            return nombre;
        }

        static bool Suit(string t, int i, string mot)
        {
            return string.CompareOrdinal(t, i, mot, 0, mot.Length) == 0;
        }

        static Dictionary<string, object> LireObjetInterne(string t, ref int i)
        {
            var objet = new Dictionary<string, object>();
            i++; // {
            Blancs(t, ref i);
            if (i < t.Length && t[i] == '}') { i++; return objet; }
            while (true)
            {
                Blancs(t, ref i);
                if (i >= t.Length || t[i] != '"') throw new FormatException("JSON : nom attendu à la position " + i);
                string nom = LireTexte(t, ref i);
                Blancs(t, ref i);
                if (i >= t.Length || t[i] != ':') throw new FormatException("JSON : « : » attendu à la position " + i);
                i++;
                objet[nom] = LireValeur(t, ref i);
                Blancs(t, ref i);
                if (i < t.Length && t[i] == ',') { i++; continue; }
                if (i < t.Length && t[i] == '}') { i++; return objet; }
                throw new FormatException("JSON : « , » ou « } » attendu à la position " + i);
            }
        }

        static List<object> LireListe(string t, ref int i)
        {
            var liste = new List<object>();
            i++; // [
            Blancs(t, ref i);
            if (i < t.Length && t[i] == ']') { i++; return liste; }
            while (true)
            {
                liste.Add(LireValeur(t, ref i));
                Blancs(t, ref i);
                if (i < t.Length && t[i] == ',') { i++; continue; }
                if (i < t.Length && t[i] == ']') { i++; return liste; }
                throw new FormatException("JSON : « , » ou « ] » attendu à la position " + i);
            }
        }

        static string LireTexte(string t, ref int i)
        {
            var s = new StringBuilder();
            i++; // "
            while (i < t.Length)
            {
                char c = t[i++];
                if (c == '"') return s.ToString();
                if (c != '\\') { s.Append(c); continue; }
                if (i >= t.Length) break;
                char e = t[i++];
                switch (e)
                {
                    case 'n': s.Append('\n'); break;
                    case 'r': s.Append('\r'); break;
                    case 't': s.Append('\t'); break;
                    case 'b': s.Append('\b'); break;
                    case 'f': s.Append('\f'); break;
                    case 'u':
                        if (i + 4 > t.Length) throw new FormatException("JSON : \\u incomplet");
                        s.Append((char)int.Parse(t.Substring(i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        i += 4;
                        break;
                    default: s.Append(e); break; // \" \\ \/
                }
            }
            throw new FormatException("JSON : texte non fermé");
        }

        // ---------- Lire une valeur dans un objet, sans erreur ----------

        public static string Texte(IDictionary<string, object> objet, string nom, string defaut = "")
        {
            object v;
            if (objet == null || !objet.TryGetValue(nom, out v) || v == null) return defaut;
            if (v is string) return (string)v;
            if (v is double) return ((double)v).ToString("R", CultureInfo.InvariantCulture);
            if (v is bool) return (bool)v ? "true" : "false";
            return defaut;
        }

        public static int Entier(IDictionary<string, object> objet, string nom, int defaut = 0)
        {
            object v;
            if (objet == null || !objet.TryGetValue(nom, out v) || v == null) return defaut;
            if (v is double) return (int)(double)v;
            int lu;
            if (v is string && int.TryParse((string)v, NumberStyles.Integer, CultureInfo.InvariantCulture, out lu)) return lu;
            return defaut;
        }

        public static bool Vrai(IDictionary<string, object> objet, string nom)
        {
            object v;
            return objet != null && objet.TryGetValue(nom, out v) && v is bool && (bool)v;
        }
    }
}
