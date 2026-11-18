param([string]$Destination = ".build/arduino/FleetNode")
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$target = [IO.Path]::GetFullPath((Join-Path $repoRoot $Destination))
if (!$target.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Choose an export directory inside the repository."
}
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot "firmware/src/main.cpp") -Destination (Join-Path $target "fleet_main.cpp")
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "arduino/FleetNode.ino") -Destination (Join-Path $target "FleetNode.ino")
Write-Output "Open $target/FleetNode.ino in Arduino IDE."
Write-Output "Use esp32 core 2.0.17, ESP32 Dev Module, ArduinoJson 7.3.1, COM5."
