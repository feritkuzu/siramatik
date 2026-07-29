<#
.SYNOPSIS
    EKSIKSIZ Kurulum .exe'si Olusturucu (Self-Extracting)
.DESCRIPTION
    Tüm dosyaları içeren, kendi kendine açılan kurulum .exe'si.
    .exe'yi calistirinca dosyalar acilir ve setup.bat calisir.
#>

param([switch]$Server, [switch]$Bank)
if (-not $Server -and -not $Bank) { $Server = $true; $Bank = $true }

$ErrorActionPreference = "Continue"
$PROJECT_DIR = Split-Path -Parent $PSScriptRoot
$INSTALLER_DIR = $PSScriptRoot
$OUTPUT_DIR = "$PROJECT_DIR\dist\setup"
$TEMP_DIR = "$env:TEMP\siramatik-build"
$CSC = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"

New-Item -ItemType Directory -Path $OUTPUT_DIR -Force | Out-Null
New-Item -ItemType Directory -Path $TEMP_DIR -Force | Out-Null

function New-ServerPackage {
    Write-Host "[Server] Paket hazirlaniyor..." -ForegroundColor Yellow
    $pkgDir = "$TEMP_DIR\server-pkg"
    if (Test-Path $pkgDir) { Remove-Item $pkgDir -Recurse -Force }
    New-Item -ItemType Directory -Path $pkgDir -Force | Out-Null

    # Ensure builds exist
    if (-not (Test-Path "$PROJECT_DIR\dist\index.js")) {
        Write-Host "  Server build aliniyor..." -ForegroundColor Yellow
        Push-Location $PROJECT_DIR
        npm run build 2>&1 | Out-Null
        Pop-Location
    }
    if (-not (Test-Path "$PROJECT_DIR\dist\public\index.html")) {
        Write-Host "  Client build aliniyor..." -ForegroundColor Yellow
        Push-Location $PROJECT_DIR
        npx vite build 2>&1 | Out-Null
        Pop-Location
    }

    # 1) Copy package.json first (needed for npm install)
    Copy-Item -Path "$PROJECT_DIR\package.json" -Destination "$pkgDir\" -Force

    # 2) Download & extract Node.js portable (cached)
    $nodeVersion = "v22.14.0"
    $nodeZip = "$TEMP_DIR\node-$nodeVersion-win-x64.zip"
    $nodeUrl = "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-win-x64.zip"
    if (-not (Test-Path $nodeZip)) {
        Write-Host "  Node.js $nodeVersion indiriliyor..." -ForegroundColor Yellow
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip -UseBasicParsing
    }
    $nodeDir = "$pkgDir\node"
    if (Test-Path "$TEMP_DIR\node-extract") { Remove-Item "$TEMP_DIR\node-extract" -Recurse -Force }
    Write-Host "  Node.js ayikleniyor..." -ForegroundColor Yellow
    Expand-Archive -Path $nodeZip -DestinationPath "$TEMP_DIR\node-extract" -Force
    New-Item -ItemType Directory -Path $nodeDir -Force | Out-Null
    Move-Item -Path "$TEMP_DIR\node-extract\node-$nodeVersion-win-x64\*" -Destination $nodeDir -Force
    Remove-Item "$TEMP_DIR\node-extract" -Recurse -Force

    # 3) npm install (production only) using bundled Node.js
    Write-Host "  npm install calistiriliyor (production)..." -ForegroundColor Yellow
    $npmCli = "$nodeDir\node_modules\npm\bin\npm-cli.js"
    $oldPath = $env:Path
    $env:Path = "$nodeDir;$env:Path"
    Push-Location $pkgDir
    & "$nodeDir\node.exe" $npmCli install --production --legacy-peer-deps --ignore-scripts 2>&1 | ForEach-Object { Write-Host "    $_" }
    Pop-Location
    $env:Path = $oldPath

    # 3b) Download VC++ Redistributable (needed by Node.js on fresh Windows)
    $vcRedistUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"
    $vcRedistPath = "$TEMP_DIR\vc_redist.x64.exe"
    if (-not (Test-Path $vcRedistPath)) {
        Write-Host "  VC++ Redistributable indiriliyor..." -ForegroundColor Yellow
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $vcRedistUrl -OutFile $vcRedistPath -UseBasicParsing
    }
    Copy-Item -Path $vcRedistPath -Destination "$pkgDir\vc_redist.x64.exe" -Force
    Write-Host "  [OK] VC++ Redistributable eklendi" -ForegroundColor Green

    # 4) Copy remaining files
    New-Item -ItemType Directory -Path "$pkgDir\server" -Force | Out-Null
    Copy-Item -Path "$PROJECT_DIR\dist\index.js" -Destination "$pkgDir\server\index.js" -Force
    if (Test-Path "$PROJECT_DIR\dist\public") {
        Copy-Item -Path "$PROJECT_DIR\dist\public" -Destination "$pkgDir\client" -Recurse -Force
    }
    Copy-Item -Path "$PROJECT_DIR\shared" -Destination "$pkgDir\shared" -Recurse -Force
    if (Test-Path "$PROJECT_DIR\release") {
        Copy-Item -Path "$PROJECT_DIR\release" -Destination "$pkgDir\release" -Recurse -Force
    }
    if (Test-Path "$PROJECT_DIR\siramatik.db") {
        Copy-Item -Path "$PROJECT_DIR\siramatik.db" -Destination "$pkgDir\" -Force
    }
    Copy-Item -Path "$INSTALLER_DIR\server-setup.bat" -Destination "$pkgDir\setup.bat" -Force

    return $pkgDir
}

function New-BankPackage {
    Write-Host "[Bank] Paket hazirlaniyor..." -ForegroundColor Yellow
    $pkgDir = "$TEMP_DIR\bank-pkg"
    if (Test-Path $pkgDir) { Remove-Item $pkgDir -Recurse -Force }
    New-Item -ItemType Directory -Path $pkgDir -Force | Out-Null

    # Electron files
    if (Test-Path "$PROJECT_DIR\electron") {
        Copy-Item -Path "$PROJECT_DIR\electron" -Destination "$pkgDir\electron" -Recurse -Force
    }
    # Setup script
    Copy-Item -Path "$INSTALLER_DIR\bank-setup.bat" -Destination "$pkgDir\setup.bat" -Force
    
    return $pkgDir
}

function New-SfxExe {
    param($Name, $SourceDir)
    
    $exePath = "$OUTPUT_DIR\Siramatik-$Name-Kurulum.exe"
    
    # Create ZIP of the package
    Write-Host "  ZIP sikistiriliyor..." -ForegroundColor Yellow
    $zipPath = "$TEMP_DIR\$Name-pkg.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path "$SourceDir\*" -DestinationPath $zipPath -CompressionLevel Optimal
    
    $zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
    Write-Host "  ZIP boyutu: $zipSize MB" -ForegroundColor Gray
    
    # Select stub source based on package type
    if ($Name -eq "Server") {
        $csFile = "$INSTALLER_DIR\ServerInstaller.cs"
        $target = "winexe"
        $refs = @(
            "-reference:System.dll",
            "-reference:System.Windows.Forms.dll",
            "-reference:System.Drawing.dll",
            "-reference:System.IO.Compression.dll",
            "-reference:System.IO.Compression.FileSystem.dll",
            "-reference:System.Net.Http.dll"
        )
    } else {
        # Console stub for Bank package
        $csCode = @'
using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Reflection;

class Program {
    static void Main() {
        string exePath = Assembly.GetExecutingAssembly().Location;
        string extractDir = Path.Combine(Path.GetTempPath(), "SiramatikSetup");
        Console.WriteLine("Siramatik Banko Kurulumu");
        try {
            byte[] buf = File.ReadAllBytes(exePath);
            int zipSize = BitConverter.ToInt32(buf, buf.Length - 4);
            int zipStart = buf.Length - 4 - zipSize;
            if (Directory.Exists(extractDir)) Directory.Delete(extractDir, true);
            Directory.CreateDirectory(extractDir);
            using (var ms = new MemoryStream(buf, zipStart, zipSize)) {
              using (var archive = new ZipArchive(ms)) {
                foreach (var entry in archive.Entries) {
                  string dest = Path.Combine(extractDir, entry.FullName);
                  if (string.IsNullOrEmpty(entry.Name)) { Directory.CreateDirectory(dest); }
                  else {
                    Directory.CreateDirectory(Path.GetDirectoryName(dest));
                    using (var src = entry.Open()) { using (var dst = File.Create(dest)) { src.CopyTo(dst); } }
                  }
                }
              }
            }
            string setupBat = Path.Combine(extractDir, "setup.bat");
            if (File.Exists(setupBat)) Process.Start("cmd.exe", "/c \"" + setupBat + "\"").WaitForExit();
        } catch (Exception ex) { Console.WriteLine("Hata: " + ex.Message); Console.ReadKey(); }
        finally { try { if (Directory.Exists(extractDir)) Directory.Delete(extractDir, true); } catch {} }
    }
}
'@
        $csFile = "$TEMP_DIR\$Name-stub.cs"
        Set-Content -Path $csFile -Value $csCode -Encoding ASCII
        $target = "exe"
        $refs = @("-reference:System.dll", "-reference:System.IO.Compression.dll")
    }
    
    $stubExe = "$TEMP_DIR\$Name-stub.exe"
    $output = & $CSC -nologo -target:$target "-out:$stubExe" $refs "$csFile" 2>&1
    if ($Name -ne "Server") { Remove-Item $csFile -Force -ErrorAction SilentlyContinue }
    
    if (-not (Test-Path $stubExe)) {
        Write-Host "  [!] Derleme basarisiz" -ForegroundColor Red
        Write-Host "  $output" -ForegroundColor Gray
        return $false
    }
    
    # Append ZIP to stub, plus 4-byte ZIP size footer
    Write-Host "  Self-extracting .exe olusturuluyor..." -ForegroundColor Yellow
    $stubBytes = [System.IO.File]::ReadAllBytes($stubExe)
    $zipBytes = [System.IO.File]::ReadAllBytes($zipPath)
    $sizeBytes = [System.BitConverter]::GetBytes([int]$zipBytes.Length)
    
    $combined = New-Object byte[] ($stubBytes.Length + $zipBytes.Length + 4)
    [Buffer]::BlockCopy($stubBytes, 0, $combined, 0, $stubBytes.Length)
    [Buffer]::BlockCopy($zipBytes, 0, $combined, $stubBytes.Length, $zipBytes.Length)
    [Buffer]::BlockCopy($sizeBytes, 0, $combined, $stubBytes.Length + $zipBytes.Length, 4)
    
    [System.IO.File]::WriteAllBytes($exePath, $combined)
    Remove-Item $stubExe -Force -ErrorAction SilentlyContinue
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    
    if (Test-Path $exePath) {
        $size = [math]::Round((Get-Item $exePath).Length / 1MB, 1)
        Write-Host "  [OK] $exePath ($size MB)" -ForegroundColor Green
        return $true
    }
    return $false
}

# === MAIN ===
Write-Host "======================================" -ForegroundColor Magenta
Write-Host "  SIRAMATIK KURULUM OLUSTURUCU" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Magenta
""

$allOk = $true

if ($Server) {
    Write-Host "1/2 - SUNUCU KURULUMU" -ForegroundColor Cyan
    $pkg = New-ServerPackage
    if (-not (New-SfxExe -Name "Server" -SourceDir $pkg)) { $allOk = $false }
    Remove-Item $pkg -Recurse -Force -ErrorAction SilentlyContinue
    ""
}

if ($Bank) {
    Write-Host "2/2 - BANKO KURULUMU" -ForegroundColor Cyan
    $pkg = New-BankPackage
    if (-not (New-SfxExe -Name "Bank" -SourceDir $pkg)) { $allOk = $false }
    Remove-Item $pkg -Recurse -Force -ErrorAction SilentlyContinue
    ""
}

Remove-Item $TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue

if ($allOk) {
    Write-Host "======================================" -ForegroundColor Green
    Write-Host "  TUM KURULUM DOSYALARI HAZIR!" -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Green
    ""
    Get-ChildItem $OUTPUT_DIR -Filter "*.exe" | ForEach-Object {
        Write-Host ("  " + $_.Name + " (" + [math]::Round($_.Length/1MB,1) + " MB)") -ForegroundColor White
    }
    ""
    Write-Host "Kullaniciya tek dosya olarak verin." -ForegroundColor Cyan
    Write-Host "Dosyaya sag tiklayip 'Yonetici olarak calistir' secin." -ForegroundColor Cyan
}
