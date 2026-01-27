# Guide d'Impression Automatique - גדוד 982

## Fonctionnement

Après qu'un soldat signe pour recevoir du matériel de combat, le système génère automatiquement un document PDF et l'envoie à l'imprimante.

## Plateformes Supportées

### iOS (iPad/iPhone)

- **Technologie:** AirPrint
- Un dialogue s'ouvre automatiquement pour sélectionner l'imprimante
- L'imprimante sélectionnée est mémorisée
- Toutes les imprimantes AirPrint du réseau WiFi sont détectées

**Configuration:**
1. iPad/iPhone et imprimante sur le même réseau WiFi
2. Imprimante compatible AirPrint
3. Lors de la première utilisation, sélectionner l'imprimante

### Android (Tablette/Téléphone)

- **Technologie:** Service d'impression Android
- Dialogue système pour sélectionner l'imprimante
- Support WiFi, Bluetooth, et USB

**Configuration:**
1. Paramètres → Appareils connectés → Impression
2. Activer le service d'impression (Google Cloud Print, HP Print, etc.)
3. Ajouter l'imprimante
4. L'application utilisera ce service automatiquement

### Web (Ordinateur)

- Ouvre la boîte de dialogue d'impression du navigateur
- Utilise les imprimantes configurées dans le système

## Imprimantes Compatibles

### AirPrint (iOS/Mac)
- HP: La plupart des modèles récents
- Canon: Séries Pixma, Maxify
- Epson: Séries EcoTank, WorkForce
- Brother: Séries HL, MFC, DCP
- Samsung/Xerox: Modèles réseau

### Android
- Toute imprimante WiFi avec application dédiée
- Google Cloud Print (si supporté)
- Imprimantes USB (avec adaptateur OTG)

## Contenu du Document

Le document PDF généré contient:
- Logo גדוד 982
- Date et heure de l'assignation
- **Informations du soldat:**
  - שם חייל (Nom)
  - מספר אישי (Numéro personnel)
  - פלוגה (Compagnie)
  - טלפון (Téléphone)
- **Tableau du matériel:**
  - שם ציוד (Nom du matériel)
  - כמות (Quantité)
  - מסטב (Numéro de série)
- Signature digitale du soldat
- Opérateur qui a effectué l'assignation

## Options Disponibles

Après l'assignation:
1. **סגור** - Fermer et retourner
2. **הדפס שוב** - Réimprimer le document
3. **שנה מדפסת** - Changer d'imprimante (iOS uniquement)
4. **שלח WhatsApp** - Envoyer résumé par WhatsApp au soldat

## Résolution de Problèmes

### L'imprimante n'apparaît pas
- Vérifier que l'appareil et l'imprimante sont sur le même réseau WiFi
- Redémarrer l'imprimante
- Redémarrer l'application
- Vérifier compatibilité AirPrint (iOS) ou service d'impression installé (Android)

### Le document ne s'imprime pas
- Vérifier papier et encre
- Vérifier la file d'attente d'impression
- Réimprimer avec "הדפס שוב"

### Mauvaise qualité d'impression
- Vérifier paramètres d'impression (qualité, type de papier)
- Nettoyer les têtes d'impression
- Vérifier niveau d'encre

## Conseils

- Le document est au format A4 - utiliser du papier A4
- L'imprimante sélectionnée est mémorisée
- Même si l'impression échoue, l'assignation est sauvegardée
- Possibilité de réimprimer depuis l'historique du soldat

## Support

En cas de problème persistant:
1. Vérifier la compatibilité de l'imprimante
2. Contacter l'administrateur réseau pour la configuration WiFi
3. Consulter le manuel de l'imprimante pour AirPrint/Service d'impression

**Note:** L'impression automatique fonctionne uniquement après signature d'une assignation dans la section נשקייה (Armurerie).
