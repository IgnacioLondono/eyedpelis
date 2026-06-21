# Empaqueta Eyedpelis sin node_modules para subir al servidor
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$out  = Join-Path $root "eyedpelis-deploy.zip"

Write-Host "Empaquetando Eyedpelis..." -ForegroundColor Cyan

$temp = Join-Path $env:TEMP "eyedpelis-deploy"
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp | Out-Null

$exclude = @('node_modules', 'dist', 'data', '.git', 'eyedpelis-deploy.zip', 'media')

Get-ChildItem $root -Force | Where-Object {
    $exclude -notcontains $_.Name
} | ForEach-Object {
    Copy-Item $_.FullName -Destination $temp -Recurse -Force
}

# Limpiar node_modules dentro de subcarpetas si se colaron
Get-ChildItem $temp -Recurse -Directory -Filter "node_modules" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path "$temp\*" -DestinationPath $out -CompressionLevel Optimal
Remove-Item $temp -Recurse -Force

$size = [math]::Round((Get-Item $out).Length / 1MB, 1)
Write-Host ""
Write-Host "Listo: $out ($size MB)" -ForegroundColor Green
Write-Host "Siguiente paso: .\scripts\upload-to-server.ps1" -ForegroundColor Yellow
