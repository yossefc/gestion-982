# Changelog - Gestion-982

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

## [2.0.0] - 2024-12-26

### ✨ Ajouté

#### Services
- **Gestion d'erreurs centralisée** (`src/services/errors.ts`)
  - Mapping Firebase → AppError
  - Messages d'erreur en hébreu
  - Logger standardisé
- **Audit logs** (`src/services/logService.ts`)
  - Collection `logs` pour traçabilité complète
  - Before/after snapshots
  - Queries par entité/utilisateur
- **Notifications FCM** (`src/services/notificationService.ts`)
  - Structure pour future intégration
  - Documentation complète

#### Utilitaires
- **Normalisation recherche** (`src/utils/normalize.ts`)
  - `normalizeText()`, `buildSoldierSearchKey()`
- **Notifications UI** (`src/utils/notify.ts`)
  - `notifyError()`, `notifySuccess()`, `confirmAction()`
- **Export PDF** (`src/utils/exportPDF.ts`)
  - Template HTML RTL professionnel
  - Inclusion signature
- **Export Excel/CSV** (`src/utils/exportExcel.ts`)
  - BOM UTF-8 pour Excel
  - Export assignments + soldiers

#### Composants UI
- `StatCard` - Cartes statistiques
- `ModuleCard` - Cartes modules avec badge
- `SoldierCard` - Carte soldat avec avatar
- `ScreenHeader` - Header unifié
- `PrimaryButton` / `SecondaryButton` - Boutons standardisés
- `EmptyState` - État vide avec CTA
- `LoadingState` - Indicateur chargement
- `StatusBadge` - Badge statut (נופק/לא חתום/זוכה)
- `OfflineBanner` - Bannière mode offline

#### Hooks
- `useSoldierSearch` - Recherche performante + pagination infinie

#### Documentation
- `docs/firestore-indexes.md` - Index requis
- `docs/firestore-rules.txt` - Rules RBAC
- `docs/notifications-setup.md` - Guide FCM
- `docs/IMPROVEMENTS.md` - Résumé technique
- `docs/REFACTORING-SUMMARY.md` - Résumé complet

### 🔧 Modifié

#### Services
- **firebaseService.ts**
  - Ajout `searchKey` et `nameLower` auto-générés
  - Recherche server-side avec `orderBy('searchKey')` + `startAt/endAt`
  - Pagination avec `startAfter(lastDoc)`
  - Gestion erreurs standardisée
  - Méthode `getByCompany()` optimisée
  - Timestamps `updatedAt` partout

#### Types
- **types/index.ts**
  - Ajout `searchKey?: string`
  - Ajout `nameLower?: string`
  - Ajout `updatedAt?: Date`

#### Écrans
- **AddSoldierScreen.tsx**
  - Migration vers `firebaseService`
  - Utilise `notifyError()` / `notifySuccess()`
- **SoldierSearchScreen.tsx**
  - Refacto complète avec `useSoldierSearch`
  - Composants réutilisables (SoldierCard, EmptyState, LoadingState)
  - Pagination infinie
  - Debounce 300ms
- **HomeScreen.tsx**
  - Utilise `StatCard`, `ModuleCard`
  - `confirmAction()` pour déconnexion
- **AdminPanelScreen.tsx**
  - Migration vers `firebaseService.soldierService`
- **LoginScreen.tsx**
  - Design PRO avec thème Colors
  - `PrimaryButton`
  - Accessibilité complète (labels + hints)

### 🗑️ Supprimé
- `src/services/soldierService.ts` - Consolidé dans firebaseService

### 🐛 Corrigé
- TypeScript strict mode : aucune erreur de compilation
- Accessibilité : labels ajoutés sur tous les boutons critiques
- RTL : tous les nouveaux composants respectent le RTL
- Performance : recherche ne charge plus toute la collection

### 🔒 Sécurité
- Firestore rules RBAC par rôle (admin/arme/vetement)
- Audit logs immuables
- Custom claims pour permissions

### ⚡ Performance
- Recherche ~10x plus rapide (server-side)
- Pagination réduisant charge réseau
- Queries optimisées avec index

### ♿ Accessibilité
- Labels sur tous boutons critiques
- Hints descriptifs
- RTL partout
- Contrastes WCAG AA

---

## [1.0.0] - 2024-11

### Initial Release
- Authentification Firebase
- Module Arme (נשקייה)
- Module Vêtement (אפסנאות)
- Module Admin
- Gestion soldats
- Attributions équipement
- Signatures
- Dashboard statistiques

---

## À venir (Roadmap)

### [2.1.0] - Q1 2025
- [ ] Intégration notifications FCM
- [ ] Cloud Functions pour rappels retour
- [ ] Écran visualisation audit logs
- [ ] Filtres avancés recherche

### [2.2.0] - Q2 2025
- [ ] Mode offline complet (cache persistant)
- [ ] Synchronisation différée
- [ ] Dashboard analytics
- [ ] Rapports Excel avancés

---

Pour plus de détails, voir `docs/REFACTORING-SUMMARY.md`





