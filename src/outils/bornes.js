// Plus petite et plus grande valeur d'une liste de nombres, par une boucle (0.106.1).
// Math.min(...liste) passe chaque valeur comme argument : avec une grande liste (des dizaines de
// milliers de points), le navigateur de la tablette dépasse sa pile et le plan se fige.

/** Plus petite valeur de la liste (Infinity si elle est vide). */
export function mini(liste) {
  let resultat = Infinity;
  for (const v of liste) if (v < resultat) resultat = v;
  return resultat;
}

/** Plus grande valeur de la liste (-Infinity si elle est vide). */
export function maxi(liste) {
  let resultat = -Infinity;
  for (const v of liste) if (v > resultat) resultat = v;
  return resultat;
}

/** Ajoute les éléments de « ajout » au bout de « liste » (sans dépasser la pile, contrairement à push(...ajout)). */
export function ajouterTous(liste, ajout) {
  for (const element of ajout) liste.push(element);
  return liste;
}
