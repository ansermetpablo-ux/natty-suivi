// Quelle opération une fonction regroupée doit-elle servir ?
//
// Le plan Hobby de Vercel plafonne à 12 fonctions : plusieurs routes vivent
// donc dans une même fonction (voir vercel.json, `rewrites`). L'ancienne
// adresse est réécrite vers la fonction hôte avec `?op=<ancienne route>`.
//
// On lit `op` d'abord ; à défaut, le dernier segment du chemin demandé, au cas
// où la réécriture laisserait passer l'URL d'origine sans sa requête. Seuls les
// noms annoncés par l'appelant sont reconnus : tout le reste rend null, donc le
// comportement d'origine de la fonction hôte.
export function operation(req, connues) {
  const op = req.query && typeof req.query.op === 'string' ? req.query.op : '';
  if (connues.includes(op)) return op;
  const chemin = String(req.url || '').split('?')[0].replace(/\/+$/, '');
  const dernier = chemin.slice(chemin.lastIndexOf('/') + 1);
  return connues.includes(dernier) ? dernier : null;
}
