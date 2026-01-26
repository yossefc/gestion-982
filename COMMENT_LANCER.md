# 🚀 Comment lancer l'application Gestion 982

## ⚠️ Problèmes résolus
- ✅ Crash de mémoire Metro Bundler
- ✅ Erreur "Error while reading multipart response"
- ✅ Compatibilité Expo Go SDK 54

## 📱 MÉTHODE SIMPLE (Recommandé)

### 1. Sur votre ordinateur

Double-cliquez sur le fichier :
```
start-expo.bat
```

Ou dans PowerShell/CMD :
```bash
cd D:\gestion-982
.\start-expo.bat
```

⏱️ **Attendez 2-3 minutes** - Le premier lancement est long !

### 2. Sur votre téléphone

Une fois que le QR code apparaît :

**Option A : Scanner le QR code**
- Ouvrez Expo Go
- Scannez le QR code qui s'affiche dans le terminal

**Option B : Connexion manuelle**
- Ouvrez Expo Go
- Cliquez sur "Enter URL"
- Tapez : `exp://votre-ip:8081` (l'URL est affichée dans le terminal)

## 🔧 Si ça ne marche toujours pas

### Solution 1 : Vérifier la version d'Expo Go

Votre Expo Go doit supporter **SDK 54**.

Si vous voyez le message "only support SDK 55", **NE METTEZ PAS À JOUR Expo Go** !

À la place :
1. Dans Expo Go, allez dans les paramètres
2. Cherchez "Compatible versions"
3. OU téléchargez une version compatible depuis : https://expo.dev/go

### Solution 2 : Utiliser le mode LAN au lieu de Tunnel

Modifiez `start-expo.bat`, ligne finale :
```batch
npx expo start --clear --max-workers 1 --lan
```

### Solution 3 : Augmenter encore plus la mémoire

Dans `start-expo.bat`, changez :
```batch
set NODE_OPTIONS=--max-old-space-size=16384 --max-semi-space-size=256
```

## 📊 Vérifier que tout fonctionne

Vous devriez voir dans le terminal :
```
✓ Metro waiting on exp://...
✓ Scan the QR code above with Expo Go
```

Sur le téléphone, l'app devrait se charger en 10-30 secondes.

## ❌ Messages d'erreur courants

### "Error while reading multipart response"
→ Metro a crashé. Relancez `start-expo.bat`

### "Connection timeout"
→ Vérifiez que PC et téléphone sont sur le même WiFi

### "Unable to resolve module"
→ Nettoyez tout :
```bash
npm install
.\start-expo.bat
```

## 📞 Aide supplémentaire

Si rien ne fonctionne, envoyez-moi :
1. La capture d'écran du terminal
2. La capture d'écran de l'erreur sur le téléphone
3. La version de votre Expo Go (dans Paramètres)
