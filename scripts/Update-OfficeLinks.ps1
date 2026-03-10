<#
.SYNOPSIS
    Aktualisiert Hyperlinks in Microsoft Office Dokumenten (Word, Excel, PowerPoint) automatisch
    mithilfe der SmartRedirect Suite Transform API und generiert detaillierte CSV-Reports.

.DESCRIPTION
    Dieses Skript durchsucht ein angegebenes Verzeichnis nach kompatiblen Office-Dateien
    (z.B. .doc, .docx, .docm, .xls, .xlsx, .xlsm, .ppt, .pptx, .pptm). Für jede gefundene Datei
    werden alle enthaltenen Hyperlinks ausgelesen und an den Transform API Endpoint
    der SmartRedirect Suite gesendet.

    Wird eine neue URL von der API zurückgegeben, wird der Link im Dokument automatisch ersetzt.
    Optional können die Dokumente nach der Bearbeitung als PDF exportiert werden.

    Reporting:
    Das Skript erstellt zwei CSV-Reports im Verzeichnis des Skripts (oder im aktuellen Pfad):
    1. 'ReplacedLinksReport.csv': Loggt Dokumentname, Dateipfad, alten Link und neuen Link.
    2. 'SkippedFilesReport.csv': Loggt Dateien, die übersprungen wurden (z.B. Schreibschutz, Fehler beim Öffnen) inkl. Grund.

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

.PARAMETER ReportPath
    Das Verzeichnis, in dem die CSV-Reports gespeichert werden.
    Standard: Das aktuelle Arbeitsverzeichnis.

.EXAMPLE
    .\Update-OfficeLinks.ps1 -FolderPath "C:\Weisungen" -ApiEndpoint "https://redirect.firma.com/api/public/transform" -ExportToPDF
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$FolderPath,

    [Parameter(Mandatory=$false)]
    [string]$ApiEndpoint = "https://yourdomain.com/api/public/transform",

    [switch]$ExportToPDF,

    [Parameter(Mandatory=$false)]
    [string]$ReportPath = ".\"
)

# Überprüfen, ob das Verzeichnis existiert
if (-not (Test-Path $FolderPath)) {
    Write-Error "Das Verzeichnis '$FolderPath' wurde nicht gefunden."
    return
}

# CSV Report Pfade
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$replacedLinksReport = Join-Path -Path $ReportPath -ChildPath "ReplacedLinksReport_$timestamp.csv"
$skippedFilesReport = Join-Path -Path $ReportPath -ChildPath "SkippedFilesReport_$timestamp.csv"

# Report Arrays
$replacedLinksData = @()
$skippedFilesData = @()

# Hilfsfunktion zum Protokollieren übersprungener Dateien
function Log-SkippedFile {
    param([string]$FileName, [string]$FilePath, [string]$Reason)
    $global:skippedFilesData += [PSCustomObject]@{
        DocumentName = $FileName
        DocumentPath = $FilePath
        Reason = $Reason
        Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }
    Write-Warning "Übersprungen: $FileName - Grund: $Reason"
}

# Hilfsfunktion zum Protokollieren ersetzter Links
function Log-ReplacedLink {
    param([string]$FileName, [string]$FilePath, [string]$OldLink, [string]$NewLink)
    $global:replacedLinksData += [PSCustomObject]@{
        DocumentName = $FileName
        DocumentPath = $FilePath
        OldLink = $OldLink
        NewLink = $NewLink
        Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }
}

# Hilfsfunktion, um die SmartRedirect Suite API aufzurufen
function Get-TransformedUrl {
    param([string]$Url)

    try {
        $body = @{ url = $Url } | ConvertTo-Json -Depth 2
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
$wordExtensions = @("*.doc", "*.docx", "*.docm")
$wordFiles = Get-ChildItem -Path $FolderPath -Include $wordExtensions -Recurse
if ($wordFiles.Count -gt 0) {
    Write-Host "Starte Word-Verarbeitung ($($wordFiles.Count) Dateien gefunden)..."
    try {
        $wordApp = New-Object -ComObject Word.Application
        $wordApp.Visible = $false
        $wordApp.DisplayAlerts = 0 # wdAlertsNone

        foreach ($file in $wordFiles) {
            Write-Host "  Bearbeite: $($file.Name)"
            try {
                if ($file.IsReadOnly) {
                    Log-SkippedFile -FileName $file.Name -FilePath $file.FullName -Reason "Datei ist schreibgeschützt."
                    continue
                }

                $doc = $wordApp.Documents.Open($file.FullName, $false, $false)
                $linksChanged = $false

                foreach ($hyperlink in $doc.Hyperlinks) {
                    if (-not [string]::IsNullOrEmpty($hyperlink.Address)) {
                        $newUrl = Get-TransformedUrl -Url $hyperlink.Address
                        if ($newUrl -and $newUrl -ne $hyperlink.Address) {
                            Write-Host "    Ersetze: $($hyperlink.Address) -> $newUrl"
                            Log-ReplacedLink -FileName $file.Name -FilePath $file.FullName -OldLink $hyperlink.Address -NewLink $newUrl
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

                $doc.Close(-1) # wdDoNotSaveChanges (changes are already saved)
            }
            catch {
                Log-SkippedFile -FileName $file.Name -FilePath $file.FullName -Reason "Fehler bei der Verarbeitung: $_"
                if ($doc) { $doc.Close(0) } # wdDoNotSaveChanges
            }
        }
    }
    finally {
        if ($wordApp) {
            $wordApp.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wordApp) | Out-Null
        }
    }
}

# --- Excel Verarbeitung ---
$excelExtensions = @("*.xls", "*.xlsx", "*.xlsm", "*.xlsb")
$excelFiles = Get-ChildItem -Path $FolderPath -Include $excelExtensions -Recurse
if ($excelFiles.Count -gt 0) {
    Write-Host "Starte Excel-Verarbeitung ($($excelFiles.Count) Dateien gefunden)..."
    try {
        $excelApp = New-Object -ComObject Excel.Application
        $excelApp.Visible = $false
        $excelApp.DisplayAlerts = $false

        foreach ($file in $excelFiles) {
            Write-Host "  Bearbeite: $($file.Name)"
            try {
                if ($file.IsReadOnly) {
                    Log-SkippedFile -FileName $file.Name -FilePath $file.FullName -Reason "Datei ist schreibgeschützt."
                    continue
                }

                $wb = $excelApp.Workbooks.Open($file.FullName, 0, $false)
                $linksChanged = $false

                foreach ($ws in $wb.Worksheets) {
                    foreach ($hyperlink in $ws.Hyperlinks) {
                        if (-not [string]::IsNullOrEmpty($hyperlink.Address)) {
                            $newUrl = Get-TransformedUrl -Url $hyperlink.Address
                            if ($newUrl -and $newUrl -ne $hyperlink.Address) {
                                Write-Host "    Ersetze: $($hyperlink.Address) -> $newUrl"
                                Log-ReplacedLink -FileName $file.Name -FilePath $file.FullName -OldLink $hyperlink.Address -NewLink $newUrl
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
            catch {
                Log-SkippedFile -FileName $file.Name -FilePath $file.FullName -Reason "Fehler bei der Verarbeitung: $_"
                if ($wb) { $wb.Close($false) }
            }
        }
    }
    finally {
        if ($excelApp) {
            $excelApp.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelApp) | Out-Null
        }
    }
}

# --- PowerPoint Verarbeitung ---
$pptExtensions = @("*.ppt", "*.pptx", "*.pptm")
$pptFiles = Get-ChildItem -Path $FolderPath -Include $pptExtensions -Recurse
if ($pptFiles.Count -gt 0) {
    Write-Host "Starte PowerPoint-Verarbeitung ($($pptFiles.Count) Dateien gefunden)..."
    try {
        $pptApp = New-Object -ComObject PowerPoint.Application
        # PowerPoint benötigt manchmal ein sichtbares Fenster, msoFalse = 0, msoTrue = -1
        # $pptApp.Visible = -1

        foreach ($file in $pptFiles) {
            Write-Host "  Bearbeite: $($file.Name)"
            try {
                if ($file.IsReadOnly) {
                    Log-SkippedFile -FileName $file.Name -FilePath $file.FullName -Reason "Datei ist schreibgeschützt."
                    continue
                }

                # msoFalse = 0
                $presentation = $pptApp.Presentations.Open($file.FullName, 0, 0, 0)
                $linksChanged = $false

                foreach ($slide in $presentation.Slides) {
                    foreach ($hyperlink in $slide.Hyperlinks) {
                        if (-not [string]::IsNullOrEmpty($hyperlink.Address)) {
                            $newUrl = Get-TransformedUrl -Url $hyperlink.Address
                            if ($newUrl -and $newUrl -ne $hyperlink.Address) {
                                Write-Host "    Ersetze: $($hyperlink.Address) -> $newUrl"
                                Log-ReplacedLink -FileName $file.Name -FilePath $file.FullName -OldLink $hyperlink.Address -NewLink $newUrl
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
            catch {
                Log-SkippedFile -FileName $file.Name -FilePath $file.FullName -Reason "Fehler bei der Verarbeitung: $_"
                if ($presentation) { $presentation.Close() }
            }
        }
    }
    finally {
        if ($pptApp) {
            $pptApp.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($pptApp) | Out-Null
        }
    }
}

# CSV Reports speichern
if ($replacedLinksData.Count -gt 0) {
    $replacedLinksData | Export-Csv -Path $replacedLinksReport -NoTypeInformation -Encoding UTF8
    Write-Host "Report der ersetzten Links gespeichert unter: $replacedLinksReport"
}
else {
    Write-Host "Keine Links wurden ersetzt. Report übersprungen."
}

if ($skippedFilesData.Count -gt 0) {
    $skippedFilesData | Export-Csv -Path $skippedFilesReport -NoTypeInformation -Encoding UTF8
    Write-Host "Report der übersprungenen Dateien gespeichert unter: $skippedFilesReport"
}
else {
    Write-Host "Keine Dateien wurden übersprungen. Report übersprungen."
}

Write-Host "Verarbeitung abgeschlossen."
