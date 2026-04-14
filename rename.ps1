$base = "C:\Users\marco\Desktop\DARKORBIT"

# 1. Rinomina cartelle
Rename-Item "$base\darkorbit-server" "vertexorbit-server"
Rename-Item "$base\darkorbit-client" "vertexorbit-client"
Write-Host "Cartelle rinominate OK" -ForegroundColor Green

# 2. Aggiorna package.json server
$pkg = Get-Content "$base\vertexorbit-server\package.json" | ConvertFrom-Json
$pkg.name = "vertexorbit-server"
$pkg.description = "VerteXOrbit MMO - Game Server"
$pkg | ConvertTo-Json -Depth 5 | Set-Content "$base\vertexorbit-server\package.json"
Write-Host "package.json aggiornato OK" -ForegroundColor Green

# 3. Aggiorna README.md
$readme = Get-Content "$base\README.md" -Raw
$readme = $readme -replace 'darkorbit-server', 'vertexorbit-server'
$readme = $readme -replace 'darkorbit-client', 'vertexorbit-client'
$readme = $readme -replace 'DarkOrbit', 'VerteXOrbit'
$readme = $readme -replace 'darkorbit', 'vertexorbit'
Set-Content "$base\README.md" $readme
Write-Host "README.md aggiornato OK" -ForegroundColor Green

# 4. Aggiorna .gitignore root
$gi = Get-Content "$base\.gitignore" -Raw
$gi = $gi -replace 'darkorbit-server', 'vertexorbit-server'
$gi = $gi -replace 'darkorbit-client', 'vertexorbit-client'
Set-Content "$base\.gitignore" $gi
Write-Host ".gitignore aggiornato OK" -ForegroundColor Green

Write-Host "`nFatto! Struttura finale:" -ForegroundColor Cyan
Get-ChildItem $base -Depth 0 | Select-Object Name
