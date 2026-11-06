# Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE)
# Loeito: convert an Office document to PDF with the Microsoft Office installed on this computer.
# Usage: powershell -File convert.ps1 -In <input file> -Out <output.pdf>
param([Parameter(Mandatory = $true)][string]$In, [Parameter(Mandatory = $true)][string]$Out)
$ErrorActionPreference = 'Stop'
$ext = [IO.Path]::GetExtension($In).ToLowerInvariant()

function Release($o) { if ($o) { try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($o) } catch {} } }

if (@('.doc', '.docx', '.docm', '.rtf', '.odt', '.txt') -contains $ext) {
    $app = New-Object -ComObject Word.Application
    try {
        $app.Visible = $false; $app.DisplayAlerts = 0
        # Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles)
        $doc = $app.Documents.Open($In, $false, $true, $false)
        $doc.ExportAsFixedFormat($Out, 17)   # 17 = wdExportFormatPDF
        $doc.Close(0); Release $doc
    } finally { $app.Quit(); Release $app }
}
elseif (@('.xls', '.xlsx', '.xlsm', '.ods', '.csv') -contains $ext) {
    $app = New-Object -ComObject Excel.Application
    try {
        $app.Visible = $false; $app.DisplayAlerts = $false; $app.AskToUpdateLinks = $false
        # Open(FileName, UpdateLinks, ReadOnly)
        $wb = $app.Workbooks.Open($In, 0, $true)
        $wb.ExportAsFixedFormat(0, $Out)       # 0 = xlTypePDF, every sheet with content
        $wb.Close($false); Release $wb
    } finally { $app.Quit(); Release $app }
}
elseif (@('.ppt', '.pptx', '.odp') -contains $ext) {
    $app = New-Object -ComObject PowerPoint.Application
    try {
        # Open(FileName, ReadOnly=msoTrue, Untitled=msoFalse, WithWindow=msoFalse)
        $pres = $app.Presentations.Open($In, -1, 0, 0)
        $pres.SaveAs($Out, 32)                 # 32 = ppSaveAsPDF
        $pres.Close(); Release $pres
    } finally { $app.Quit(); Release $app }
}
else { throw "Unsupported file type: $ext" }

if (-not (Test-Path $Out)) { throw 'Office did not produce a PDF.' }
