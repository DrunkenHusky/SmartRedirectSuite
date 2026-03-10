<#
.SYNOPSIS
    Aktualisiert Hyperlinks in Microsoft Office Dokumenten (Word, Excel, PowerPoint) automatisch
    mithilfe der SmartRedirect Suite Transform API.

.DESCRIPTION
    Dieses Skript durchsucht ein angegebenes Verzeichnis nach Word (.docx), Excel (.xlsx) und
    PowerPoint (.pptx) Dateien. Für jede gefundene Datei werden alle enthaltenen Hyperlinks
    ausgelesen und an den Transform API Endpoint der SmartRedirect Suite gesendet.

    Wird eine neue URL von der API zurückgegeben, wird der Link im Dokument automatisch ersetzt.
    Optional können die Dokumente nach der Bearbeitung als PDF exportiert werden.

    Anwendungsfall:
    Automatisiertes Anpassen von Office Dokumenten im Batch via Skript. Damit werden die Links
    in allen Dokumenten durchsucht und ersetzt. Beispielsweise Weisungen, die als PDF vorliegen,
    müssen im Originaldokument angepasst werden und dann erneut als PDF zur Verfügung gestellt werden.

.PARAMETER FolderPath
    Der Pfad zum Verzeichnis, das die zu verarbeitenden Office Dokumente enthält.

.PARAMETER ApiEndpoint
    Die URL zum Transform API Endpoint der SmartRedirect Suite.
    Standard: "https://yourdomain.com/api/public/transform"

.PARAMETER ExportToPDF
    Optionaler Schalter. Wenn gesetzt, wird jedes verarbeitete Dokument zusätzlich als PDF
    exportiert (im selben Verzeichnis, gleicher Name, Endung .pdf).

.EXAMPLE
    .\Update-OfficeLinks.ps1 -FolderPath "C:\Weisungen" -ApiEndpoint "https://redirect.firma.com/api/public/transform" -ExportToPDF
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$FolderPath,

    [Parameter(Mandatory=$false)]
    [string]$ApiEndpoint = "https://yourdomain.com/api/public/transform",

    [switch]$ExportToPDF
)

# Überprüfen, ob das Verzeichnis existiert
if (-not (Test-Path $FolderPath)) {
    Write-Error "Das Verzeichnis '$FolderPath' wurde nicht gefunden."
    return
}

# Hilfsfunktion, um die SmartRedirect Suite API aufzurufen
function Get-TransformedUrl {
    param([string]$Url)

    try {
        $body = @{ url = $Url } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri $ApiEndpoint -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop

        if ($response.hasMatch -eq $true) {
            return $response.newUrl
        }
    }
    catch {
        Write-Warning "Fehler bei der API-Anfrage für URL '$Url': $_"
    }

    return $null
}

# --- Word Verarbeitung ---
$wordFiles = Get-ChildItem -Path $FolderPath -Filter "*.docx" -Recurse
if ($wordFiles.Count -gt 0) {
    Write-Host "Starte Word-Verarbeitung ($($wordFiles.Count) Dateien gefunden)..."
    $wordApp = New-Object -ComObject Word.Application
    $wordApp.Visible = $false

    foreach ($file in $wordFiles) {
        Write-Host "  Bearbeite: $($file.Name)"
        $doc = $wordApp.Documents.Open($file.FullName)
        $linksChanged = $false

        foreach ($hyperlink in $doc.Hyperlinks) {
            if (-not [string]::IsNullOrEmpty($hyperlink.Address)) {
                $newUrl = Get-TransformedUrl -Url $hyperlink.Address
                if ($newUrl) {
                    Write-Host "    Ersetze: $($hyperlink.Address) -> $newUrl"
                    $hyperlink.Address = $newUrl
                    $linksChanged = $true
                }
            }
        }

        if ($linksChanged) {
            $doc.Save()
        }

        if ($ExportToPDF) {
            $pdfPath = [System.IO.Path]::ChangeExtension($file.FullName, ".pdf")
            Write-Host "    Exportiere als PDF: $pdfPath"
            # 17 = wdFormatPDF
            $doc.SaveAs([ref]$pdfPath, [ref]17)
        }

        $doc.Close()
    }
    $wordApp.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wordApp) | Out-Null
}

# --- Excel Verarbeitung ---
$excelFiles = Get-ChildItem -Path $FolderPath -Filter "*.xlsx" -Recurse
if ($excelFiles.Count -gt 0) {
    Write-Host "Starte Excel-Verarbeitung ($($excelFiles.Count) Dateien gefunden)..."
    $excelApp = New-Object -ComObject Excel.Application
    $excelApp.Visible = $false
    $excelApp.DisplayAlerts = $false

    foreach ($file in $excelFiles) {
        Write-Host "  Bearbeite: $($file.Name)"
        $wb = $excelApp.Workbooks.Open($file.FullName)
        $linksChanged = $false

        foreach ($ws in $wb.Worksheets) {
            foreach ($hyperlink in $ws.Hyperlinks) {
                if (-not [string]::IsNullOrEmpty($hyperlink.Address)) {
                    $newUrl = Get-TransformedUrl -Url $hyperlink.Address
                    if ($newUrl) {
                        Write-Host "    Ersetze: $($hyperlink.Address) -> $newUrl"
                        $hyperlink.Address = $newUrl
                        $linksChanged = $true
                    }
                }
            }
        }

        if ($linksChanged) {
            $wb.Save()
        }

        if ($ExportToPDF) {
            $pdfPath = [System.IO.Path]::ChangeExtension($file.FullName, ".pdf")
            Write-Host "    Exportiere als PDF: $pdfPath"
            # 0 = xlTypePDF
            $wb.ExportAsFixedFormat(0, $pdfPath)
        }

        $wb.Close($false)
    }
    $excelApp.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelApp) | Out-Null
}

# --- PowerPoint Verarbeitung ---
$pptFiles = Get-ChildItem -Path $FolderPath -Filter "*.pptx" -Recurse
if ($pptFiles.Count -gt 0) {
    Write-Host "Starte PowerPoint-Verarbeitung ($($pptFiles.Count) Dateien gefunden)..."
    $pptApp = New-Object -ComObject PowerPoint.Application
    # PowerPoint erfordert oft ein sichtbares Fenster bei COM, wir minimieren es
    # $pptApp.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue

    foreach ($file in $pptFiles) {
        Write-Host "  Bearbeite: $($file.Name)"
        $presentation = $pptApp.Presentations.Open($file.FullName, $false, $false, $false)
        $linksChanged = $false

        foreach ($slide in $presentation.Slides) {
            foreach ($hyperlink in $slide.Hyperlinks) {
                if (-not [string]::IsNullOrEmpty($hyperlink.Address)) {
                    $newUrl = Get-TransformedUrl -Url $hyperlink.Address
                    if ($newUrl) {
                        Write-Host "    Ersetze: $($hyperlink.Address) -> $newUrl"
                        $hyperlink.Address = $newUrl
                        $linksChanged = $true
                    }
                }
            }
        }

        if ($linksChanged) {
            $presentation.Save()
        }

        if ($ExportToPDF) {
            $pdfPath = [System.IO.Path]::ChangeExtension($file.FullName, ".pdf")
            Write-Host "    Exportiere als PDF: $pdfPath"
            # 32 = ppSaveAsPDF
            $presentation.SaveAs($pdfPath, 32)
        }

        $presentation.Close()
    }
    $pptApp.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($pptApp) | Out-Null
}

Write-Host "Verarbeitung abgeschlossen."
