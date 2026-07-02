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

    # Compiled server (dist/index.js is the bundled server)
    New-Item -ItemType Directory -Path "$pkgDir\server" -Force | Out-Null
    Copy-Item -Path "$PROJECT_DIR\dist\index.js" -Destination "$pkgDir\server\index.js" -Force
    
    # Client build
    if (Test-Path "$PROJECT_DIR\dist\public") {
        Copy-Item -Path "$PROJECT_DIR\dist\public" -Destination "$pkgDir\client" -Recurse -Force
    }
    # Shared files (needed by some server modules)
    Copy-Item -Path "$PROJECT_DIR\shared" -Destination "$pkgDir\shared" -Recurse -Force
    # Media files
    if (Test-Path "$PROJECT_DIR\release") {
        Copy-Item -Path "$PROJECT_DIR\release" -Destination "$pkgDir\release" -Recurse -Force
    }
    # Root files
    Copy-Item -Path "$PROJECT_DIR\package.json" -Destination "$pkgDir\" -Force
    if (Test-Path "$PROJECT_DIR\siramatik.db") {
        Copy-Item -Path "$PROJECT_DIR\siramatik.db" -Destination "$pkgDir\" -Force
    }
    # Setup script
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
    
    # C# self-extractor stub - manually extracts ZIP (C# 5 compatible)
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
        
        Console.WriteLine("Siramatik Kurulumu");
        Console.WriteLine("Dosyalar aciliyor...");
        
        try {
            byte[] buf = File.ReadAllBytes(exePath);
            int zipStart = FindZipStart(buf);
            if (zipStart < 0) { Console.WriteLine("Hata: ZIP bulunamadi!"); Console.ReadKey(); return; }
            
            if (Directory.Exists(extractDir)) Directory.Delete(extractDir, true);
            Directory.CreateDirectory(extractDir);
            
            using (MemoryStream ms = new MemoryStream(buf, zipStart, buf.Length - zipStart))
            using (ZipArchive archive = new ZipArchive(ms)) {
                foreach (ZipArchiveEntry entry in archive.Entries) {
                    string destPath = Path.Combine(extractDir, entry.FullName);
                    if (string.IsNullOrEmpty(entry.Name)) {
                        Directory.CreateDirectory(destPath);
                    } else {
                        Directory.CreateDirectory(Path.GetDirectoryName(destPath));
                        using (Stream src = entry.Open())
                        using (FileStream dst = File.Create(destPath)) {
                            src.CopyTo(dst);
                        }
                    }
                }
            }
            
            string setupBat = Path.Combine(extractDir, "setup.bat");
            if (File.Exists(setupBat)) {
                Process.Start("cmd.exe", "/c \"" + setupBat + "\"").WaitForExit();
            }
        } catch (Exception ex) {
            Console.WriteLine("Hata: " + ex.Message);
            Console.ReadKey();
        } finally {
            try { if (Directory.Exists(extractDir)) Directory.Delete(extractDir, true); } catch {}
        }
    }
    
    static int FindZipStart(byte[] data) {
        for (int i = data.Length - 4; i >= 0; i--) {
            if (data[i] == 0x50 && data[i+1] == 0x4B && data[i+2] == 0x03 && data[i+3] == 0x04)
                return i;
        }
        return -1;
    }
}
'@
    
    # Compile
    $csFile = "$TEMP_DIR\$Name-stub.cs"
    $stubExe = "$TEMP_DIR\$Name-stub.exe"
    Set-Content -Path $csFile -Value $csCode -Encoding ASCII
    
    $refs = @("-reference:System.dll", "-reference:System.IO.Compression.dll")
    $output = & $CSC -target:exe "-out:$stubExe" $refs "$csFile" 2>&1
    Remove-Item $csFile -Force -ErrorAction SilentlyContinue
    
    if (-not (Test-Path $stubExe)) {
        Write-Host "  [!] Derleme basarisiz" -ForegroundColor Red
        Write-Host "  $output" -ForegroundColor Gray
        return $false
    }
    
    # Append ZIP to stub
    Write-Host "  Self-extracting .exe olusturuluyor..." -ForegroundColor Yellow
    $stubBytes = [System.IO.File]::ReadAllBytes($stubExe)
    $zipBytes = [System.IO.File]::ReadAllBytes($zipPath)
    
    $combined = New-Object byte[] ($stubBytes.Length + $zipBytes.Length)
    [Buffer]::BlockCopy($stubBytes, 0, $combined, 0, $stubBytes.Length)
    [Buffer]::BlockCopy($zipBytes, 0, $combined, $stubBytes.Length, $zipBytes.Length)
    
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
