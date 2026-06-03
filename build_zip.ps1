# build_zip.ps1
# This script packages the WaifuWire extension for upload to Chrome, Opera, Firefox, and Edge.

$ErrorActionPreference = "Stop"

$workspaceDir = "d:\dhruv\Chrome Extension\WaifuWire"
$outputZip = "$workspaceDir\WaifuWire_Extension_v1.0.zip"
$tempDir = "$workspaceDir\temp_build"

Write-Host "Starting build process for WaifuWire Extension..."

# Remove old zip and temp dir if they exist
if (Test-Path $outputZip) { Remove-Item $outputZip -Force }
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }

# Create temp build directory
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy necessary files
Write-Host "Copying extension files..."
Copy-Item "$workspaceDir\manifest.json" "$tempDir\"
Copy-Item "$workspaceDir\background.js" "$tempDir\"
Copy-Item "$workspaceDir\content.js" "$tempDir\"
Copy-Item "$workspaceDir\popup.js" "$tempDir\"
Copy-Item "$workspaceDir\popup.html" "$tempDir\"
Copy-Item "$workspaceDir\popup.css" "$tempDir\"
Copy-Item "$workspaceDir\styles.css" "$tempDir\"

# Copy images folder
Copy-Item "$workspaceDir\images" "$tempDir\" -Recurse

# Compress to ZIP
Write-Host "Compressing to ZIP file..."
Compress-Archive -Path "$tempDir\*" -DestinationPath $outputZip

# Cleanup temp dir
Remove-Item $tempDir -Recurse -Force

Write-Host "Build Complete! Clean extension package is ready at:"
Write-Host $outputZip
