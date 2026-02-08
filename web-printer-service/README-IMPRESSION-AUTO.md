# 🖨️ IMPRESSION AUTOMATIQUE - GESTION 982

## ✅ SOLUTION FINALE - ZERO INTERVENTION

Ce script imprime **automatiquement** les PDFs sans que vous ayez à appuyer sur quoi que ce soit!

---

## 🚀 UTILISATION (SUPER SIMPLE)

### 1. Lancez le script
Double-cliquez sur:
```
IMPRESSION-AUTO.bat
```

### 2. Connectez-vous
- Chrome s'ouvre automatiquement
- Connectez-vous sur la page
- **Laissez Chrome et la fenêtre PowerShell ouverts**

### 3. C'est tout!
**Les PDFs s'impriment automatiquement!**

---

## 🔧 COMMENT ÇA MARCHE

1. **Chrome télécharge le PDF** (dans Téléchargements)
2. **Le script détecte le nouveau PDF** (en 1 seconde)
3. **Le script l'envoie à l'imprimante** (automatiquement)
4. **Le PDF s'imprime** (sans rien faire!)
5. **Le fichier est supprimé** (pour garder propre)

---

## 📋 PRÉREQUIS

### Imprimante par Défaut
Vous DEVEZ avoir une imprimante par défaut définie dans Windows.

**Vérifier:**
```powershell
Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true}
```

**Définir:**
1. Windows → Paramètres
2. Périphériques → Imprimantes et scanners
3. Cliquez sur votre imprimante
4. "Définir comme imprimante par défaut"

---

## 🎯 AVANTAGES

✅ **Vraiment automatique** - Zéro clic nécessaire
✅ **Fonctionne toujours** - Pas de bug AutoHotkey
✅ **Simple** - Un seul fichier à lancer
✅ **Fiable** - Surveille en temps réel
✅ **Propre** - Supprime les PDFs après impression

---

## 🔍 DÉPANNAGE

### Le PDF ne s'imprime pas
1. **Vérifiez que la fenêtre PowerShell est ouverte** (avec le texte bleu)
2. **Vérifiez l'imprimante par défaut** (commande ci-dessus)
3. **Vérifiez que l'imprimante est allumée**
4. **Regardez les messages dans la fenêtre PowerShell** (elle affiche tout)

### Le PDF se télécharge mais rien ne se passe
- Le script cherche des PDFs avec "Assignment", "attribution", "החתמה" dans le nom
- Vérifiez que le nom du PDF contient un de ces mots
- Regardez la fenêtre PowerShell pour les messages

### Chrome ne s'ouvre pas
- Installez Chrome: https://www.google.com/chrome/
- Ou ouvrez manuellement: https://gestion-982.web.app/printer.html

---

## ⚙️ CONFIGURATION AVANCÉE

### Changer le dossier surveillé
Éditez `Impression-Automatique-COMPLETE.ps1` ligne 34:
```powershell
$downloadsPath = "C:\VotreDossier"
```

### Garder les PDFs (ne pas supprimer)
Commentez la ligne 90-95 dans le script

### Imprimer tous les PDFs (pas seulement gestion-982)
Supprimez la condition ligne 59:
```powershell
# Supprimez cette ligne:
if ($fileName -match "Assignment|attribution|החתמה|gestion-982") {
```

---

## 📝 NOTES IMPORTANTES

1. **Laissez la fenêtre PowerShell ouverte** - Elle doit rester ouverte pour surveiller
2. **Laissez Chrome ouvert** - Pas obligatoire mais recommandé
3. **L'imprimante doit être allumée** - Évident mais important!
4. **Un seul script à la fois** - Ne lancez pas plusieurs instances

---

## 🎊 RÉSUMÉ

**EN BREF:**
1. Double-cliquez sur `IMPRESSION-AUTO.bat`
2. Connectez-vous sur Chrome
3. Laissez ouvert
4. **LES PDFs S'IMPRIMENT TOUT SEULS!** 🎉

---

**Support:** Si problème, regardez les messages dans la fenêtre PowerShell bleue.
