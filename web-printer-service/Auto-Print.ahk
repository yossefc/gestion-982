; ========================================
; GESTION-982 - Impression Automatique
; ========================================
; Script AutoHotkey pour imprimer automatiquement
; les documents quand ils s'ouvrent dans Chrome
;
; INSTALLATION:
; 1. Installer AutoHotkey: https://www.autohotkey.com/
; 2. Double-cliquer sur ce fichier (icone H verte apparait)
; 3. Ouvrir https://gestion-982.web.app/printer.html dans Chrome
; 4. Se connecter
; 5. Les PDFs s'impriment automatiquement!
;
; Pour arreter: Clic-droit sur icone H > Exit
; ========================================

#NoEnv
#Persistent
#SingleInstance Force
SetWorkingDir %A_ScriptDir%

; Configuration
global LastPrintTime := 0
global PrintDelay := 5000  ; 5 secondes entre impressions

; Afficher notification au demarrage
TrayTip, Gestion-982, Service d'impression automatique active!, 3, 1

; Verifier toutes les secondes
SetTimer, CheckForPDF, 1000
return

CheckForPDF:
    ; Verifier qu'on n'imprime pas trop souvent
    CurrentTime := A_TickCount
    if (CurrentTime - LastPrintTime < PrintDelay)
        return

    ; Chercher fenetre Chrome active
    WinGetTitle, Title, A
    WinGetClass, Class, A

    ; Verifier si c'est Chrome avec notre page
    if (Class = "Chrome_WidgetWin_1")
    {
        ; Verifier le titre contient "gestion-982" ou "printer"
        if (InStr(Title, "gestion-982") or InStr(Title, "printer") or InStr(Title, "Gestion"))
        {
            ; Verifier si un PDF est ouvert (le titre change)
            if (InStr(Title, ".pdf") or InStr(Title, "PDF"))
            {
                PrintDocument()
                LastPrintTime := A_TickCount
            }
        }
    }
return

PrintDocument()
{
    ; Notification
    TrayTip, Impression, Document detecte - Impression en cours..., 2, 1

    ; Attendre un peu que le PDF charge
    Sleep, 1500

    ; Envoyer Ctrl+P
    Send, ^p

    ; Attendre que dialogue s'ouvre
    Sleep, 800

    ; Appuyer sur Enter pour imprimer
    Send, {Enter}

    ; Notification succes
    Sleep, 500
    TrayTip, Impression, Document envoye a l'imprimante!, 2, 1
}

; Raccourci pour desactiver temporairement (Ctrl+Alt+P)
^!p::
    Suspend, Toggle
    if (A_IsSuspended)
        TrayTip, Gestion-982, Impression automatique DESACTIVEE, 3, 2
    else
        TrayTip, Gestion-982, Impression automatique ACTIVEE, 3, 1
return

; Raccourci pour quitter (Ctrl+Alt+Q)
^!q::
    TrayTip, Gestion-982, Arret du service d'impression, 2, 1
    Sleep, 1000
    ExitApp
return
