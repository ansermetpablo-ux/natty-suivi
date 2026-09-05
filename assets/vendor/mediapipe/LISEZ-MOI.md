# MediaPipe, vendorisé — d'où viennent ces fichiers, et pourquoi ils sont ici

Segmentation du sujet pour la **photo de progression** (`assets/progression-photo.js`,
et son banc `_test-photo-progression.html`). Rien d'autre du dépôt ne s'en sert.

| Fichier | Origine | Poids |
|---|---|---|
| `vision_bundle.js` | `@mediapipe/tasks-vision@1.0.1` (npm), IIFE, expose le global `Vision` | 152 Ko |
| `wasm/vision_wasm_internal.js` + `.wasm` | le même paquet, dossier `wasm/` | 11,8 Mo |
| `models/selfie_segmenter.tflite` | `storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/` | 244 Ko |

## Régénérer

```
npm i -D @mediapipe/tasks-vision
for ROOT in assets www/assets; do
  mkdir -p "$ROOT/vendor/mediapipe/wasm" "$ROOT/vendor/mediapipe/models"
  sed 's|^//# sourceMappingURL=.*$||' node_modules/@mediapipe/tasks-vision/vision_bundle.js \
    > "$ROOT/vendor/mediapipe/vision_bundle.js"
  cp node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.{js,wasm} "$ROOT/vendor/mediapipe/wasm/"
done
curl -sL -o assets/vendor/mediapipe/models/selfie_segmenter.tflite \
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite"
cp assets/vendor/mediapipe/models/selfie_segmenter.tflite www/assets/vendor/mediapipe/models/
```

## Ce qu'il faut savoir avant d'y toucher

⚠️ **Pas de CDN, et c'est le point.** Sous Capacitor l'app doit fonctionner hors ligne ;
un `<script src="https://cdn…">` rendrait la photo de progression indisponible dès que le
réseau tombe, sur le seul écran dont la donnée est déjà dans la main de l'utilisateur.

⚠️ **DEUX COPIES, et elles doivent rester identiques.** `assets/` sert le web, `www/assets/`
sert le bundle natif. C'est la règle de tout le dépôt (voir §11 de `CLAUDE.md`), et ici elle
coûte 12 Mo de plus. Une divergence entre les deux ne se verrait qu'en natif.

⚠️ **La variante `nosimd` n'est PAS vendorisée.** `FilesetResolver.forVisionTasks()` choisit
`vision_wasm_internal` ou `vision_wasm_nosimd_internal` selon que l'appareil sait faire du
WebAssembly SIMD ; le second n'est pas là, donc un appareil sans SIMD — **iOS antérieur à
16.4**, alors que `MinimumOSVersion` vaut 15.0 — n'aura pas de segmentation. Il retombe sur le
masque de repli (une ellipse), ce qui est un manque visible et non un plantage. L'ajouter
coûterait 11 Mo × 2 copies.

⚠️ **`vision_wasm_module_internal.*` n'est pas là non plus, et n'a pas à l'être** : c'est la
variante pour le chargement en module ES, que `forVisionTasks(path)` ne demande jamais tant
qu'on ne lui passe pas `true` en second argument.

⚠️ **Le commentaire `sourceMappingURL` est retiré à la copie** : il pointe vers
`vision_bundle_iife.js.map`, qui n'est pas livré sous ce nom — il ne produirait qu'un 404 en
console, à chaque ouverture.

⚠️ **Le serveur doit rendre `application/wasm`.** `WebAssembly.instantiateStreaming()` refuse
tout autre type, et MediaPipe échoue alors sur un message qui parle de réseau. Ajouté à
`scripts/serveur-local.js` ; Vercel le fait déjà.

⚠️ **Le premier `segment()` coûte ~4,3 s** (compilation des shaders, mise en route du délégué
GPU) — mesuré. Il faut PRÉCHAUFFER : un appel sur une vignette vide juste après
`createFromOptions()` ramène le premier vrai appel à ~90-160 ms. Sans ce préchauffage, le
budget de 1,5 s entre le tap et l'aperçu est dépassé d'un facteur trois.

⚠️ **`@mediapipe/tasks-vision` est en `devDependencies`** : rien du code livré ne l'importe,
c'est la SOURCE de la copie ci-dessus. Ne pas le passer en `dependencies` — les dépendances de
ce projet sont les plugins natifs Capacitor, et `npx cap sync` les parcourt.
