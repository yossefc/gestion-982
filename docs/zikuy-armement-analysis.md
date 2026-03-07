# Analyse du flux זיכוי armement

Date: 2026-03-07

## Resume

Analyse du flux de retour/credit armement (`CombatReturn`) de bout en bout:
- ecran de retour
- service transactionnel
- mise a jour `assignments`
- mise a jour `soldier_holdings`
- synchronisation inventaire armes

## Findings (ordre de severite)

1. Critique - le זיכוי peut echouer en fin de retour a cause de `soldier_equipment` (legacy)
- Le flux `returnEquipment` / `creditEquipment` ecrit encore dans `soldier_equipment` via `extraRef`.
- Les regles Firestore bloquent toute ecriture sur cette collection (`allow write: if false`).
- Une transaction complete peut etre annulee au moment d'un retour total.
- References:
  - `src/services/transactionalAssignmentService.ts:661`
  - `src/services/transactionalAssignmentService.ts:717`
  - `src/services/transactionalAssignmentService.ts:731`
  - `src/services/transactionalAssignmentService.ts:888`
  - `src/services/transactionalAssignmentService.ts:941`
  - `src/services/transactionalAssignmentService.ts:954`
  - `firestore.rules:173`

2. Critique - perte d'historique `assignments` sur retour complet
- Le code annonce une architecture `assignments` append-only, mais supprime les `issue` quand le solde passe a 0.
- Impact: perte d'historique/signatures/verifications.
- References:
  - `src/services/transactionalAssignmentService.ts:8`
  - `src/services/transactionalAssignmentService.ts:705`
  - `src/services/transactionalAssignmentService.ts:930`

3. Majeur - pas de selection reelle des numeros de serie dans l'ecran armement
- `selectedSerials` existe mais n'est pas pilote par une UI de selection.
- En retour partiel, le code prend automatiquement les premiers serials.
- Risque: mauvaise arme creditee par rapport a l'arme reellement rendue.
- References:
  - `src/screens/arme/CombatReturnScreen.tsx:35`
  - `src/screens/arme/CombatReturnScreen.tsx:113`
  - `src/screens/arme/CombatReturnScreen.tsx:139`
  - `src/screens/arme/CombatReturnScreen.tsx:199`
  - `src/screens/arme/CombatReturnScreen.tsx:493`

4. Majeur - clearance armurerie non auto-validee apres dernier retour
- Le `clearance` est valide seulement si l'ecran arrive deja vide (`items.length === 0`).
- Si le dernier retour est fait pendant la session courante, le flux succes ferme l'ecran sans `updateClearance`.
- Risque: soldat bloque "pas zikuye armory" tant qu'une action manuelle n'est pas relancee.
- References:
  - `src/screens/arme/CombatReturnScreen.tsx:538`
  - `src/screens/arme/CombatReturnScreen.tsx:297`

## Observation additionnelle

- Dans la navigation standard depuis la recherche soldat, `CombatReturn` est appele avec `soldierId` uniquement (pas `isClearance`).
- Reference:
  - `src/screens/common/SoldierSearchScreen.tsx:214`

## Notes techniques

- Le service `transactionalAssignmentService` reste la source principale utilisee par le module armement.
- Le service `assignmentService` legacy (`src/services/firebaseService.ts`) contient encore des methodes historiques, mais non prioritaires dans ce flux critique.

## Corrections appliquees (2026-03-07)

1. Probleme 1 (critique) corrige - suppression des ecritures legacy `soldier_equipment`
- Retrait des operations transactionnelles `set/update/delete` sur `soldier_equipment` dans:
  - `returnEquipment(...)` (plus de bloc cleanup legacy)
  - `creditEquipment(...)` (plus de `extraRef`, plus de cleanup legacy)
- Le flux transactionnel n'ecrit maintenant que dans:
  - `assignments`
  - `soldier_holdings`

2. Probleme 2 (critique) corrige - conservation de l'historique `assignments`
- Suppression de la logique qui supprimait les docs `issue` quand le solde passait a zero.
- Le mode append-only est respecte:
  - retour partiel/complet = creation d'un nouvel assignment `action: 'credit'`
  - aucune suppression physique des assignments historiques

3. Probleme 4 (majeur) corrige - auto-clearance apres dernier retour
- Dans `CombatReturnScreen`, apres transaction de retour:
  - recalcul du solde reel via somme des quantites restantes
  - si `isClearance === true` et solde total = 0:
    - appel automatique `soldierService.updateClearance(soldierId, 'armory', true)`
    - en cas d'echec: erreur explicite "retour reussi, clearance auto echoue"

## Verification

- `npm run typecheck` execute avec succes (`tsc --noEmit`).
