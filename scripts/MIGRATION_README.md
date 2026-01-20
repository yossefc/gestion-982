# Script de Migration Firestore

## 📋 Description

Ce script nettoie et restructure votre base de données Firestore pour éliminer les doublons et optimiser la structure des données.

## 🎯 Objectifs de la migration

1. **Nettoyer les données dupliquées** dans `soldier_equipment` et `assignments`
2. **Fusionner** `soldier_holdings` dans `soldier_equipment`
3. **Supprimer** la collection `equipment_clothing` (doublon de `clothingEquipment`)
4. **Supprimer** la collection `soldier_holdings` (après migration)

## ⚙️ Prérequis

1. Node.js installé
2. Le fichier `serviceAccountKey.json` dans le dossier `scripts/`
3. Accès administrateur à Firebase

## 🚀 Utilisation

### Étape 1: Simulation (Dry-run) - RECOMMANDÉ

**Toujours commencer par une simulation pour voir ce qui serait modifié:**

```bash
node scripts/migrate-firestore.js --dry-run
```

Cette commande affiche toutes les modifications qui seraient effectuées **sans rien modifier** dans la base de données.

### Étape 2: Exécution réelle

**Une fois satisfait de la simulation, exécutez la migration:**

```bash
node scripts/migrate-firestore.js
```

Le script va automatiquement:
- ✅ Créer un backup complet dans `scripts/backups/`
- ✅ Exécuter toutes les migrations
- ✅ Générer un rapport final

### Option: Sans backup (déconseillé)

```bash
node scripts/migrate-firestore.js --skip-backup
```

⚠️ **Non recommandé** - Utilisez cette option uniquement si vous avez déjà un backup récent.

## 📊 Ce que fait le script

### Étape 1: Nettoyage des données dupliquées

Supprime les champs redondants dans `soldier_equipment` et `assignments`:
- `soldierName`
- `soldierPhone`
- `soldierPersonalNumber`
- `soldierCompany`

Ces données restent dans la collection `soldiers` uniquement.

### Étape 2: Fusion de soldier_holdings

Migre les données de `soldier_holdings` vers `soldier_equipment`:
- Compare les quantités existantes
- Ajoute les items manquants
- Conserve les données d'equipment en cas de conflit
- Affiche les conflits détectés

### Étape 3: Suppression de equipment_clothing

Supprime la collection `equipment_clothing` qui est un doublon de `clothingEquipment`:
- Vérifie qu'aucune référence active n'existe
- Affiche un avertissement si des références sont trouvées

### Étape 4: Suppression de soldier_holdings

Supprime la collection `soldier_holdings` après migration complète.

## 📦 Backups

Les backups sont automatiquement créés dans:
```
scripts/backups/firestore-backup-YYYY-MM-DDTHH-mm-ss.json
```

Format du backup:
```json
{
  "timestamp": "2026-01-16T...",
  "collections": {
    "soldiers": [...],
    "soldier_equipment": [...],
    ...
  }
}
```

## 🔄 Restauration en cas de problème

Si quelque chose ne va pas, vous pouvez restaurer manuellement depuis le backup:

1. Ouvrez le fichier de backup
2. Utilisez la console Firebase pour réimporter les données
3. Ou créez un script de restauration personnalisé

## ⚠️ Avertissements

- **Toujours tester en dry-run d'abord**
- **Vérifier le backup créé avant la migration**
- **Ne pas interrompre le script pendant l'exécution**
- **Attendre la fin complète du script**

## 📝 Rapport final

À la fin, le script affiche:
- Nombre de documents par collection
- Collections à conserver
- Collections supprimées
- Structure recommandée

## 🐛 En cas d'erreur

1. Vérifier les logs pour identifier l'erreur
2. Consulter le backup créé
3. Relancer en dry-run pour vérifier l'état
4. Contacter le support si nécessaire

## 📞 Support

Pour toute question ou problème:
1. Vérifier les logs du script
2. Lancer une analyse avec `analyze-firestore-detailed.js`
3. Examiner le backup JSON

## ✅ Vérification post-migration

Après migration, vérifiez:

```bash
# Analyser l'état final
node scripts/analyze-firestore-detailed.js

# Vérifier qu'il n'y a plus de doublons
node scripts/check-duplicates.js
```

## 📋 Checklist de migration

- [ ] Lancer `--dry-run` et vérifier les modifications
- [ ] S'assurer d'avoir assez d'espace disque pour le backup
- [ ] Exécuter la migration réelle
- [ ] Vérifier le rapport final
- [ ] Tester l'application
- [ ] Confirmer que tout fonctionne
- [ ] Archiver le backup en lieu sûr
