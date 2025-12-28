# 🧪 Checklist de Tests - Gestion-982

## 📋 Tests Fonctionnels

### 1. Authentification
- [ ] Login avec email/password valides
- [ ] Login avec credentials invalides (erreur claire)
- [ ] Logout (confirmation + redirection)
- [ ] Permissions par rôle (admin/arme/vetement)

### 2. Recherche Soldats
- [ ] Recherche par nom (doit trouver)
- [ ] Recherche par numéro personnel
- [ ] Recherche par téléphone
- [ ] Recherche avec terme vide (liste paginée)
- [ ] Pagination (scroll infini fonctionne)
- [ ] Indicateur "charger plus" visible
- [ ] Debounce 300ms (pas de requête à chaque frappe)
- [ ] Message "0 soldats trouvés" si aucun résultat

### 3. CRUD Soldats
- [ ] Créer un nouveau soldat
  - [ ] Validation champs requis (nom, numéro, compagnie)
  - [ ] Détection doublon numéro personnel
  - [ ] Message succès après création
  - [ ] Soldat apparaît dans la liste
- [ ] Modifier un soldat
  - [ ] Changements sauvegardés
  - [ ] `searchKey` recalculé si nom/numéro changé
- [ ] Supprimer un soldat
  - [ ] Confirmation demandée
  - [ ] Suppression effective

### 4. Audit Logs
- [ ] Log créé lors de création soldat
- [ ] Log créé lors de modification soldat
- [ ] Log créé lors de suppression soldat
- [ ] Log contient `before`/`after`, `performedBy`, `timestamp`
- [ ] Visualiser les logs (écran admin ou Firestore Console)

### 5. Export PDF
- [ ] Ouvrir écran avec attribution
- [ ] Cliquer "Exporter PDF"
- [ ] Loader visible
- [ ] Fichier PDF généré
- [ ] PDF contient :
  - [ ] Nom soldat + numéro personnel
  - [ ] Liste items
  - [ ] Statut
  - [ ] Signature (si présente)
  - [ ] Date génération
- [ ] Partage fonctionne (share sheet)

### 6. Export Excel/CSV
- [ ] Exporter liste soldats
- [ ] Fichier CSV généré
- [ ] Ouvrir dans Excel → encodage UTF-8 OK (accents)
- [ ] Colonnes correctes
- [ ] Partage fonctionne

### 7. Mode Offline
- [ ] Activer mode avion
- [ ] Bannière "offline" apparaît en haut
- [ ] Tentative d'action → message d'erreur clair
- [ ] Désactiver mode avion → bannière disparaît

### 8. UI/UX
- [ ] Tous les écrans en RTL (texte à droite)
- [ ] Chevrons inversés (‹ au lieu de ›)
- [ ] Loading states visibles
- [ ] Empty states avec CTA
- [ ] Boutons avec labels accessibilité
- [ ] Contrastes suffisants (WCAG AA)

### 9. Performance
- [ ] Recherche < 500ms
- [ ] Scroll fluide (pas de lag)
- [ ] Pas de re-render inutiles
- [ ] Images/avatars chargent vite

### 10. Navigation
- [ ] Toutes les routes accessibles
- [ ] Bouton retour fonctionne
- [ ] Deep links (si implémentés)
- [ ] Pas de navigation cassée

---

## 🔥 Tests Firestore

### Index
- [ ] Créer index composite: `soldiers` → `company` + `nameLower`
- [ ] Créer index: `assignments` → `soldierId` + `timestamp`
- [ ] Créer index: `assignments` → `type` + `timestamp`
- [ ] Créer index: `logs` → `entityType` + `entityId` + `performedAt`
- [ ] Créer index: `logs` → `performedBy` + `performedAt`
- [ ] Tester requêtes après création index

### Rules
- [ ] Déployer rules: `firebase deploy --only firestore:rules`
- [ ] Tester lecture soldats (auth requis)
- [ ] Tester écriture soldats (permissions)
- [ ] Admin peut tout faire
- [ ] User arme ne peut pas accéder clothingEquipment
- [ ] User vetement ne peut pas accéder combatEquipment
- [ ] Logs read-only sauf création

---

## 📱 Tests Plateformes

### Android
- [ ] Build: `npm run android`
- [ ] App démarre sans crash
- [ ] Recherche fonctionne
- [ ] Export PDF fonctionne
- [ ] Notifications (si implémentées)

### iOS
- [ ] Build: `npm run ios`
- [ ] App démarre sans crash
- [ ] Recherche fonctionne
- [ ] Export PDF fonctionne
- [ ] Notifications (si implémentées)

### Web (si applicable)
- [ ] Build: `npm run web`
- [ ] UI responsive
- [ ] Pas d'erreur console

---

## 🐛 Tests Erreurs

### Cas limites
- [ ] Créer soldat avec numéro existant → erreur "déjà existant"
- [ ] Rechercher avec caractères spéciaux
- [ ] Rechercher avec émojis
- [ ] Créer soldat sans compagnie → erreur validation
- [ ] Modifier soldat inexistant → erreur
- [ ] Exporter PDF sans signature → PDF sans section signature

### Erreurs réseau
- [ ] Couper internet pendant recherche → erreur claire
- [ ] Timeout Firestore → erreur + retry possible
- [ ] Token expiré → déconnexion

---

## ✅ Résultat Attendu

**Tous les tests passent = Prêt pour production !** 🚀

---

## 📝 Notes

- Documenter les bugs trouvés dans un fichier `BUGS.md`
- Prendre des screenshots des erreurs
- Tester avec plusieurs utilisateurs (différents rôles)
- Tester avec données réelles (pas seulement test)

---

**Bon testing ! 🧪**

