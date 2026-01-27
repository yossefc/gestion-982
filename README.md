# Gestion-982 - Application de Gestion Militaire

Application React Native pour la gestion du matériel militaire (armes et vêtements) du גדוד 982.

**Version:** 2.0.0
**Status:** Production Ready

## Caractéristiques

- Gestion des soldats, armes, et équipements
- Système de permissions RBAC (admin, arme, vetement)
- Recherche rapide server-side avec pagination
- Export PDF et Excel
- Signatures digitales
- Mode hors ligne
- Impression automatique (AirPrint, Android Print)
- Support RTL (hébreu) et accessibilité
- Audit logs automatiques

## Installation Rapide

### Prérequis
- Node.js 18+
- npm ou yarn
- Expo CLI
- Compte Firebase

### Étapes

```bash
# 1. Cloner le repo
git clone https://github.com/yossefc/gestion-982.git
cd gestion-982

# 2. Installer les dépendances
npm install

# 3. Configurer Firebase (voir GUIDE-DEPLOIEMENT.md pour les détails)
cp .env.example .env
# Éditer .env avec vos credentials Firebase

# 4. Démarrer l'application
npm start
```

## Structure du Projet

```
src/
├── components/       # UI réutilisables (StatCard, ModuleCard, etc.)
├── services/         # Services Firebase et métier
│   ├── firebaseService.ts    # CRUD unifié + audit logs
│   ├── assignmentService.ts  # Gestion attributions
│   ├── pdfService.ts         # Génération PDF
│   └── ...
├── hooks/            # Custom hooks (useSoldierSearch)
├── contexts/         # Contexts React (Auth, Soldiers)
├── screens/          # Écrans de l'application
│   ├── auth/         # Authentification
│   ├── common/       # Écrans communs (Home, Search)
│   ├── arme/         # Module armurerie
│   └── vetement/     # Module vêtements
├── navigation/       # Configuration navigation
├── theme/            # Styles et couleurs
├── types/            # Définitions TypeScript
└── utils/            # Utilitaires (PDF, Excel, normalisation)
```

## Commandes Principales

```bash
# Développement
npm start              # Démarrer Expo
npm run android        # Lancer sur Android
npm run ios            # Lancer sur iOS
npm run web            # Lancer version web

# Vérifications
npm run typecheck      # Vérifier TypeScript
```

## Documentation

- **[GUIDE-DEPLOIEMENT.md](GUIDE-DEPLOIEMENT.md)** - Configuration Firebase et déploiement complet
- **[GUIDE-IMPRESSION.md](GUIDE-IMPRESSION.md)** - Système d'impression automatique
- **[docs/](docs/)** - Documentation technique détaillée

## Tests Critiques

Après installation, testez:
1. Login avec un utilisateur
2. Recherche de soldat (résultats instantanés)
3. Création d'un nouveau soldat
4. Assignation de matériel avec signature
5. Export PDF
6. Mode hors ligne (bannière affichée)

## Technologies

- React Native 0.81.5
- Expo 54.0.30
- TypeScript 5.9.2
- Firebase 12.7.0
- React Navigation

## Problèmes Courants

**"searchKey index missing"**
→ Solution: Créer les index Firestore (voir GUIDE-DEPLOIEMENT.md)

**"Permission denied"**
→ Solution: Déployer les Firestore rules

**"User doesn't have permission"**
→ Solution: Configurer les custom claims + se déconnecter/reconnecter

**Pas de résultats de recherche**
→ Les nouveaux soldats créés via l'app auront automatiquement les champs nécessaires

## Sécurité

**Ne jamais commiter:**
- `.env`
- `serviceAccountKey.json`
- `google-services.json`
- `GoogleService-Info.plist`

Ces fichiers sont déjà dans `.gitignore`.

## Support

Pour toute question ou problème:
- Consultez GUIDE-DEPLOIEMENT.md pour les problèmes de configuration
- Vérifiez la documentation dans le dossier `docs/`
- Créez une issue sur GitHub

## Contribution

1. Créer une branche: `git checkout -b feature/ma-fonctionnalite`
2. Commit: `git commit -m "feat: ma nouvelle fonctionnalité"`
3. Push: `git push origin feature/ma-fonctionnalite`
4. Créer une Pull Request

## Licence

Propriétaire - Gestion-982

---

**Made with ❤️ in Israel 🇮🇱**
