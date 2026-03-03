re# Analyse `טבלת מלאי` - Module `arme` (2026-03-03)

## Portee
- Ecran analyse: `src/screens/arme/CombatStockScreen.tsx`
- Service principal: `src/services/combatStockService.ts`
- Sources de donnees: `weaponInventoryService`, `transactionalAssignmentService`, `soldier_holdings`

## Constats critiques

1. `CRITIQUE` - אפסון partiel mal refléte dans les holdings
- `CombatStorageScreen` permet de stocker une quantite partielle via `storageQuantity`.
- `transactionalAssignmentService.applyOperationToHoldings(..., 'storage')` ne scinde pas la ligne: il bascule juste le statut complet a `stored`.
- References:
  - `src/screens/arme/CombatStorageScreen.tsx:134`
  - `src/services/transactionalAssignmentService.ts:207`
  - `src/services/transactionalAssignmentService.ts:909`
- Impact:
  - Un stockage partiel peut etre comptabilise comme stockage total dans la table.
  - Les colonnes `השאלות` / `אפסון` deviennent inexactes.

2. `ELEVE` - Fallback offline inverse sur attribution arme
- En cas d'erreur reseau pendant assignation, `setWeaponAssignedStatusOnlyOffline` queue `weaponReturn` au lieu de `weaponAssign`.
- References:
  - `src/services/weaponInventoryService.ts:557`
  - `src/screens/arme/CombatAssignmentScreen.tsx:488`
- Impact:
  - Des armes peuvent revenir en `available` apres sync alors qu'elles ont ete attribuees.
  - La table de stock devient incoherente.

3. `ELEVE` - Incoherence `stored` vs ancien statut `storage`
- Le stock service compte `stored`.
- D'autres ecrans/services acceptent encore `storage` pour compatibilite legacy.
- References:
  - `src/services/combatStockService.ts:90`
  - `src/screens/arme/CombatRetrieveScreen.tsx:64`
  - `src/services/weaponInventoryService.ts:419`
  - `src/services/weaponInventoryService.ts:460`
- Impact:
  - Les anciennes donnees `storage` peuvent etre sous-comptees dans `אפסון`.
  - `total` peut sembler decale vs detail par colonnes.

## Constats moyens

4. `MOYEN` - Rapport global sans deduplication systematique des holdings
- `getAllHoldings` retourne `soldier_holdings` brut pour le mode online.
- La logique de dedup existe, mais n'est pas appliquee a ce flux global.
- References:
  - `src/services/transactionalAssignmentService.ts:1105`
  - `src/services/transactionalAssignmentService.ts:1117`
  - `src/services/transactionalAssignmentService.ts:1001`
- Impact:
  - Risque de doublons historiques visibles dans la table.

5. `MOYEN` - Colonnes `תקן` et `מדף` partiellement fonctionnelles
- `תקן` est hardcode a `'-'`.
- `מדף` depend surtout de l'inventaire armes; pour equipement non-serialise, `available` reste souvent 0.
- References:
  - `src/screens/arme/CombatStockScreen.tsx:129`
  - `src/screens/arme/CombatStockScreen.tsx:130`
  - `src/services/combatStockService.ts:148`
- Impact:
  - Tableau incomplet pour une partie du materiel combat.

## Risques metier
- Decision logistique basee sur des chiffres faux (pret, stockage, dispo).
- Erreurs de restitution/re-attribution d'armes.
- Perte de confiance dans `טבלת מלאי`.

## Priorisation de correction recommandee
1. Corriger la logique `storage` partielle dans `applyOperationToHoldings`.
2. Corriger le fallback offline `weaponAssign`/`weaponReturn`.
3. Uniformiser `stored`/`storage` (migration + lecture tolerant legacy).
4. Appliquer deduplication sur le flux global de holdings.
5. Definir la logique metier de `תקן` et `מדף` pour les items non-serialises.

## Notes de verification apres correctifs
- Scenario stockage partiel: 10 items, stockage de 3 -> `issued=7`, `stored=3`.
- Scenario reseau instable pendant attribution arme -> statut final `assigned` apres sync.
- Donnees legacy `storage` visibles correctement dans `אפסון`.
- Pas de doublons visibles sur un soldat/equipement dans la table.
