# 一次性脚本：从 default.reference.docx 生成 engineering-report.reference.docx
# 工程报告排版：正文 宋体+Times New Roman；标题 黑体+Arial
# 中文字体名用 Unicode 码位组装，避免 PowerShell 5.1 脚本编码问题
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$songti = [string]::Join('', [char]0x5B8B, [char]0x4F53)   # SimSun
$heiti  = [string]::Join('', [char]0x9ED1, [char]0x4F53)   # SimHei

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $here 'default.reference.docx'
$dst = Join-Path $here 'engineering-report.reference.docx'

Copy-Item $src $dst -Force

$zip = [System.IO.Compression.ZipFile]::Open($dst, 'Update')
try {
    $entry = $zip.GetEntry('word/styles.xml')
    $reader = New-Object System.IO.StreamReader($entry.Open())
    $xml = $reader.ReadToEnd()
    $reader.Close()

    $bodyNew  = 'w:ascii="Times New Roman" w:eastAsia="' + $songti + '" w:hAnsi="Times New Roman"'
    $titleNew = 'w:ascii="Arial" w:eastAsia="' + $heiti + '" w:hAnsi="Arial"'

    $xml = $xml -replace 'w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:hAnsiTheme="minorHAnsi"', $bodyNew
    $xml = $xml -replace 'w:asciiTheme="majorHAnsi"\s+w:eastAsiaTheme="majorEastAsia"\s+w:hAnsiTheme="majorHAnsi"', $titleNew

    if ($xml -notmatch [regex]::Escape($songti)) { throw 'body font replace failed' }
    if ($xml -notmatch [regex]::Escape($heiti)) { throw 'title font replace failed' }

    $entry.Delete()
    $newEntry = $zip.CreateEntry('word/styles.xml')
    $writer = New-Object System.IO.StreamWriter($newEntry.Open(), (New-Object System.Text.UTF8Encoding($false)))
    $writer.Write($xml)
    $writer.Close()
}
finally {
    $zip.Dispose()
}

Write-Host "generated: $dst"
