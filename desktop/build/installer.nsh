; Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE)
; Windows installer: an "Optional parts" page. English text recognition is always included; the other
; recognition languages can be left out to save space. Unticked parts are removed right after copying.
; Running the installer again with a part ticked puts it back. Silent installs keep everything.

!include nsDialogs.nsh
!include LogicLib.nsh



; Defined here, where the installer pages are built, so the Modern UI macros already exist.
!macro customPageAfterChangeDir
Var OptDlg
Var OptRtl
Var OptCjk
Var OptSwe
Var KeepRtl
Var KeepCjk
Var KeepSwe

Function LoeitoOptionsShow
  StrCmp $KeepRtl "" 0 +4
    StrCpy $KeepRtl ${BST_CHECKED}
    StrCpy $KeepCjk ${BST_CHECKED}
    StrCpy $KeepSwe ${BST_CHECKED}
  !insertmacro MUI_HEADER_TEXT "Optional parts" "Choose what to install. You can run this installer again later to add or remove parts."
  nsDialogs::Create 1018
  Pop $OptDlg
  ${If} $OptDlg == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "Loeito itself, English text recognition and every tool are always installed (about 230 MB, most of it the window engine every desktop app of this kind carries). These parts are extra:"
  Pop $0

  ${NSD_CreateCheckbox} 0 34u 100% 12u "Urdu, Arabic and Persian text recognition  (3.6 MB)"
  Pop $OptRtl
  ${NSD_SetState} $OptRtl $KeepRtl
  ${NSD_CreateLabel} 12u 47u 95% 10u "Makes scanned pages in these languages searchable and copyable, offline."
  Pop $0

  ${NSD_CreateCheckbox} 0 62u 100% 12u "Chinese and Japanese text recognition  (5.3 MB)"
  Pop $OptCjk
  ${NSD_SetState} $OptCjk $KeepCjk
  ${NSD_CreateLabel} 12u 75u 95% 10u "Simplified and traditional Chinese, and Japanese, offline."
  Pop $0

  ${NSD_CreateCheckbox} 0 90u 100% 12u "Swedish text recognition  (2.4 MB)"
  Pop $OptSwe
  ${NSD_SetState} $OptSwe $KeepSwe
  ${NSD_CreateLabel} 12u 103u 95% 10u "Swedish scans, offline."
  Pop $0

  ${NSD_CreateLabel} 0 122u 100% 22u "Left something out? Loeito can still read those languages: it downloads the part once, the first time you choose it (internet needed only then)."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function LoeitoOptionsLeave
  ${NSD_GetState} $OptRtl $KeepRtl
  ${NSD_GetState} $OptCjk $KeepCjk
  ${NSD_GetState} $OptSwe $KeepSwe
FunctionEnd

  Page custom LoeitoOptionsShow LoeitoOptionsLeave
!macroend

!macro customInstall
  ; an empty value means the page was skipped (silent install): keep everything
  ${If} $KeepRtl == ${BST_UNCHECKED}
    Delete "$INSTDIR\resources\ocr\urd.traineddata.gz"
    Delete "$INSTDIR\resources\ocr\ara.traineddata.gz"
    Delete "$INSTDIR\resources\ocr\fas.traineddata.gz"
  ${EndIf}
  ${If} $KeepCjk == ${BST_UNCHECKED}
    Delete "$INSTDIR\resources\ocr\chi_sim.traineddata.gz"
    Delete "$INSTDIR\resources\ocr\chi_tra.traineddata.gz"
    Delete "$INSTDIR\resources\ocr\jpn.traineddata.gz"
  ${EndIf}
  ${If} $KeepSwe == ${BST_UNCHECKED}
    Delete "$INSTDIR\resources\ocr\swe.traineddata.gz"
  ${EndIf}
!macroend
