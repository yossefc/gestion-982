#!/bin/bash

# Script de déploiement Gestion-982
# Usage: ./scripts/deploy.sh

set -e  # Arrêter en cas d'erreur

echo "🚀 DÉPLOIEMENT GESTION-982"
echo "=========================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Vérifier compilation TypeScript
echo "📝 1. Vérification TypeScript..."
if npx tsc --noEmit; then
    echo -e "${GREEN}✅ TypeScript OK${NC}\n"
else
    echo -e "${RED}❌ Erreurs TypeScript détectées${NC}"
    exit 1
fi

# 2. Vérifier Firebase CLI
echo "🔥 2. Vérification Firebase CLI..."
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI non installé${NC}"
    echo "Installation: npm install -g firebase-tools"
    exit 1
fi
echo -e "${GREEN}✅ Firebase CLI OK${NC}\n"

# 3. Login Firebase
echo "🔐 3. Authentification Firebase..."
firebase login:ci
echo ""

# 4. Déployer Firestore Rules
echo "📋 4. Déploiement Firestore Rules..."
read -p "Déployer les rules Firestore? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "firestore.rules" ]; then
        firebase deploy --only firestore:rules
        echo -e "${GREEN}✅ Rules déployées${NC}\n"
    elif [ -f "docs/firestore-rules.txt" ]; then
        echo -e "${YELLOW}⚠️  Copier docs/firestore-rules.txt vers firestore.rules d'abord${NC}"
        cp docs/firestore-rules.txt firestore.rules
        firebase deploy --only firestore:rules
        echo -e "${GREEN}✅ Rules déployées${NC}\n"
    else
        echo -e "${RED}❌ Fichier firestore.rules introuvable${NC}"
    fi
fi

# 5. Déployer Index Firestore
echo "📊 5. Déploiement Index Firestore..."
read -p "Déployer les index Firestore? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "firestore.indexes.json" ]; then
        firebase deploy --only firestore:indexes
        echo -e "${GREEN}✅ Index déployés${NC}\n"
    else
        echo -e "${YELLOW}⚠️  Créer firestore.indexes.json d'abord${NC}"
        echo "Voir: docs/firestore-indexes.md"
    fi
fi

# 6. Déployer Cloud Functions (optionnel)
echo "⚡ 6. Déploiement Cloud Functions..."
read -p "Déployer les Cloud Functions? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "functions" ]; then
        firebase deploy --only functions
        echo -e "${GREEN}✅ Functions déployées${NC}\n"
    else
        echo -e "${YELLOW}⚠️  Pas de dossier functions/ trouvé${NC}\n"
    fi
fi

# 7. Résumé
echo ""
echo "=========================="
echo -e "${GREEN}🎉 DÉPLOIEMENT TERMINÉ${NC}"
echo "=========================="
echo ""
echo "PROCHAINES ÉTAPES:"
echo "1. Vérifier les index dans Firebase Console"
echo "2. Tester les rules avec l'émulateur"
echo "3. Migrer les soldats: npx ts-node scripts/migrate-soldiers.ts"
echo "4. Configurer les rôles: npx ts-node scripts/setup-custom-claims.ts"
echo ""
echo "Tests: voir scripts/test-checklist.md"
echo ""




