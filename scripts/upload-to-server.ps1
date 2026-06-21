# Sube Eyedpelis al servidor Linux via SCP
# Edita estas 3 lineas con tus datos:

$SERVER_USER = "nicolas"          # usuario SSH (el dueño de las carpetas Videos)
$SERVER_HOST = "192.168.1.100"    # IP de tu servidor OpenMediaVault
$SERVER_PATH = "/opt/eyedpelis"   # donde instalaremos la app

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$zip  = Join-Path $root "eyedpelis-deploy.zip"

if (-not (Test-Path $zip)) {
    Write-Host "Primero ejecuta: .\scripts\prepare-deploy.ps1" -ForegroundColor Red
    exit 1
}

if ($SERVER_HOST -eq "192.168.1.100") {
    Write-Host ""
    Write-Host "IMPORTANTE: Edita scripts\upload-to-server.ps1" -ForegroundColor Yellow
    Write-Host "  - SERVER_USER  (ej: nicolas)" -ForegroundColor Yellow
    Write-Host "  - SERVER_HOST  (IP de tu servidor)" -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "Has cambiado la IP? (s/n)"
    if ($confirm -ne "s") { exit 0 }
}

Write-Host "Subiendo a ${SERVER_USER}@${SERVER_HOST}..." -ForegroundColor Cyan

# Crear carpeta remota y subir zip
ssh "${SERVER_USER}@${SERVER_HOST}" "sudo mkdir -p $SERVER_PATH/data && sudo chown -R ${SERVER_USER}:${SERVER_USER} $SERVER_PATH"
scp $zip "${SERVER_USER}@${SERVER_HOST}:/tmp/eyedpelis-deploy.zip"

# Descomprimir en el servidor
ssh "${SERVER_USER}@${SERVER_HOST}" @"
cd $SERVER_PATH 2>/dev/null || { sudo mkdir -p $SERVER_PATH && sudo chown ${SERVER_USER}:${SERVER_USER} $SERVER_PATH && cd $SERVER_PATH; }
unzip -o /tmp/eyedpelis-deploy.zip -d $SERVER_PATH
rm /tmp/eyedpelis-deploy.zip
mkdir -p $SERVER_PATH/data
echo 'Proyecto listo en $SERVER_PATH'
ls -la $SERVER_PATH
"@

Write-Host ""
Write-Host "Subida completada!" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora en Portainer:" -ForegroundColor Cyan
Write-Host "  1. Stacks -> Add stack -> nombre: eyedpelis"
Write-Host "  2. Pega el contenido de portainer-stack.yml"
Write-Host "  3. Cambia TMDB_API_KEY y CLIENT_URL"
Write-Host "  4. Deploy the stack"
Write-Host ""
Write-Host "Accede: http://${SERVER_HOST}:3001" -ForegroundColor Green
