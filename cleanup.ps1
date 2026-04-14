$base = "C:\Users\marco\Desktop\DARKORBIT"

Write-Host "=== PULIZIA CARTELLA MAIN ===" -ForegroundColor Cyan

# File e cartelle da eliminare (spazzatura/temp/vecchi)
$toDelete = @(
    "server",
    "src",
    "assets",
    "node_modules",
    "suoni",
    "ultime-modifiche",
    "setup_structure.ps1",
    "create_configs.ps1",
    "fix_laser_cleanup.js",
    "fix_laser_final.js",
    "fix_laser_logic.js",
    "fix_syntax.js",
    "patch_fase3.js",
    "patch_fase3b.js",
    "move_audio.js",
    "GIT_PUSH_CLIENT.bat",
    "GIT_PUSH_SERVER.bat",
    "install.bat",
    "start_client.bat",
    "start_server.bat",
    "BACKUP.bat",
    "backup.py",
    "package.json",
    "package-lock.json",
    "main.js"
)

foreach ($item in $toDelete) {
    $path = "$base\$item"
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force
        Write-Host "  ELIMINATO: $item" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== STRUTTURA FINALE ===" -ForegroundColor Green
Get-ChildItem -Path $base -Depth 0 | Select-Object Name | Format-Table -AutoSize
Write-Host "Pulizia completata!" -ForegroundColor Green
