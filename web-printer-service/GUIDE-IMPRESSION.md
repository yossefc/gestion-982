# Guide d'Impression Automatique - Gestion 982

## Problème: Le PDF se télécharge au lieu de s'imprimer

C'est normal! Chrome ne peut pas imprimer complètement automatiquement pour des raisons de sécurité.

## Solutions Disponibles

### ✅ Solution 1: Mode Semi-Automatique (RECOMMANDÉ)

**La plus simple et fiable:**

1. **Lancez:** `Mode-Automatique-V2.bat` (nouveau script amélioré)

2. **Connectez-vous** sur la page web qui s'ouvre

3. **Quand un PDF apparaît:**
   - Appuyez sur **Ctrl+P**
   - Appuyez sur **Enter**
   - C'est tout! (2 secondes)

**Avantages:**
- Fonctionne toujours
- Contrôle total
- Pas de bugs

---

### Solution 2: AutoHotkey (Automatisation Complète)

**Pour vraiment automatiser:**

1. **Installer AutoHotkey:**
   - Télécharger: https://www.autohotkey.com/
   - Installer sur Windows

2. **Double-cliquer sur:** `Auto-Print.ahk`

3. **Lancer:** `Ouvrir-Impression.bat` ou `Demarrer-Imprimante.bat`

4. **L'impression se fera automatiquement!**

Le script AutoHotkey surveille Chrome et:
- Détecte quand un PDF s'ouvre
- Appuie automatiquement sur Ctrl+P
- Appuie automatiquement sur Enter
- Imprime sans intervention

**Avantages:**
- Vraiment automatique
- Zéro intervention manuelle

**Inconvénients:**
- Nécessite AutoHotkey installé
- Peut imprimer par erreur si vous ouvrez d'autres PDFs

---

### Solution 3: Impression Manuelle Simple

**La plus directe:**

1. **Lancez:** `Ouvrir-Impression.bat`

2. **Quand un PDF s'ouvre:**
   - Ctrl+P
   - Enter

---

## Configuration Requise

### Définir l'Imprimante par Défaut

**Important:** Chrome utilise toujours l'imprimante par défaut de Windows.

**Vérifier dans PowerShell:**
```powershell
Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true} | Select-Object Name
```

**Définir dans Windows:**
1. Windows → Paramètres
2. Périphériques → Imprimantes et scanners
3. Cliquer sur votre imprimante
4. Cocher "Utiliser comme imprimante par défaut"

---

## Fichiers Disponibles

| Fichier | Description | Usage |
|---------|-------------|-------|
| `Mode-Automatique.bat` | Script original | Fonctionne mais nécessite Ctrl+P manuel |
| `Mode-Automatique-V2.bat` | **NOUVEAU - Recommandé** | Meilleur guidage, vérifie imprimante |
| `Auto-Print.ahk` | Automatisation complète | Nécessite AutoHotkey installé |
| `Ouvrir-Impression.bat` | Ouvre page simple | Impression manuelle |
| `Demarrer-Imprimante.bat` | Identique ci-dessus | Impression manuelle |

---

## Dépannage

### Le PDF ne s'ouvre pas
- Vérifier connexion internet
- Vérifier que vous êtes connecté sur https://gestion-982.web.app/printer.html
- Vérifier dans Firebase que les PDFs sont générés

### Rien ne s'imprime
- Vérifier que l'imprimante est allumée
- Vérifier qu'elle est définie par défaut
- Vérifier qu'elle a du papier et de l'encre
- Essayer Ctrl+P manuellement

### Chrome se ferme tout seul
- Ne pas fermer la fenêtre du script bat/PowerShell
- Elle doit rester ouverte pendant l'utilisation

### AutoHotkey imprime tout
- Configurer le script pour être plus spécifique
- Ou désactiver quand vous ne l'utilisez pas

---

## Recommandation Finale

**Pour usage quotidien:**
- Utilisez `Mode-Automatique-V2.bat`
- Gardez la fenêtre ouverte
- Appuyez juste Ctrl+P + Enter quand un PDF apparaît

**Pour automatisation totale:**
- Installez AutoHotkey
- Lancez `Auto-Print.ahk`
- Tout se fera automatiquement

---

## Support

Si problèmes persistent:
1. Vérifier logs dans la console Chrome (F12)
2. Vérifier Firebase Console (print_queue collection)
3. Tester avec un autre navigateur
4. Redémarrer l'imprimante

---

**Bon courage! 🖨️**
