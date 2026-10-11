/* ═══════════════════════════════════════════════════════════════
   Natty — code Velo de la page d'accueil Wix (à coller dans le panneau
   « Code de la page », élément Custom Element nommé #nattySite).

   RÔLE UNIQUE : fournir aux moteurs de recherche le texte de <natty-site>,
   qu'ils ne lisent pas seuls (contenu en JavaScript, Shadow DOM).
   Documentation : dev.wix.com/docs/velo/api-reference/$w/custom-element/seo-markup
   (propriété GA, vérifiée le 11/10/2026).

   Volontairement AUCUN prix ni AUCUNE valeur nutritionnelle ici : ils
   vivent dans data/plats.json et nulle part ailleurs. Une copie dans ce
   fichier finirait par diverger — exactement l'erreur de la PR #3.
   Si un texte change dans wix/natty-site.src.js, le reporter ici.
   ═══════════════════════════════════════════════════════════════ */

const SEO = `
<h1>Natty — le déjeuner de chef qui se compte tout seul</h1>
<p>Des plats écrits au gramme par un chef, livrés au bureau à Paris et à La Défense, et enregistrés automatiquement dans votre suivi nutritionnel.</p>

<h2>Pourquoi Natty</h2>
<h3>Un chef, pas une usine</h3>
<p>Chaque plat part d'une fiche technique écrite ingrédient par ingrédient par Francis D'Almeida, passé par le Cheval Blanc.</p>
<h3>Un suivi qui se remplit seul</h3>
<p>Le jour de la livraison, le plat entre dans votre journée avec ses calories et ses macros. Rien à peser, rien à photographier.</p>
<h3>Une portion à votre mesure</h3>
<p>Votre barquette est calibrée sur vos besoins, et un nutritionniste ajuste vos objectifs au fil des semaines.</p>

<h2>Comment ça marche</h2>
<ol>
  <li>Vous composez votre semaine, de un à dix plats.</li>
  <li>On cuisine et on livre au bureau.</li>
  <li>Le suivi se remplit seul dans l'application Natty.</li>
</ol>

<h2>Tarifs</h2>
<p>Un prix au plat, livraison incluse, à l'unité ou en abonnement sans engagement.</p>

<h2>Natty pour les entreprises</h2>
<p>Déjeuners livrés au bureau, une seule facture mensuelle, prise en charge employeur partielle ou totale. Contact : contact@natty-nutrition.com</p>

<h2>Questions fréquentes</h2>
<h3>Où livrez-vous ?</h3><p>À Paris et à La Défense, directement au bureau.</p>
<h3>D'où viennent les valeurs nutritionnelles ?</h3><p>Elles sont calculées depuis la fiche technique du chef, ingrédient par ingrédient, avec la table Ciqual de l'ANSES.</p>
<h3>Comment arrêter l'abonnement ?</h3><p>Depuis votre compte, sans appel ni courrier.</p>
`;

$w.onReady(function () {
  $w('#nattySite').seoMarkup = SEO;
});
