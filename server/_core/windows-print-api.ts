/**
 * Windows Print API Integration
 * Uses Windows native print API via PowerShell for reliable printing
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface PrinterInfo {
  name: string;
  isDefault?: boolean;
}

/**
 * Get list of available printers using Windows WMI
 */
export async function listWindowsPrintersViaAPI(): Promise<PrinterInfo[]> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve([]);
      return;
    }

    try {
      const ps = spawn('powershell.exe', [
        '-Command',
        `Get-WmiObject -Class Win32_Printer | Select-Object -Property Name, Default | ConvertTo-Json`,
      ]);

      let output = '';
      let errorOutput = '';

      ps.stdout.on('data', (data) => {
        output += data.toString();
      });

      ps.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ps.on('close', (code) => {
        if (code !== 0 || !output.trim()) {
          console.log('[Windows Print API] Failed to get printers via WMI');
          resolve([]);
          return;
        }

        try {
          const printers = JSON.parse(output);
          const printerList = Array.isArray(printers) ? printers : [printers];
          
          const result = printerList.map((p: any) => ({
            name: p.Name || p.name,
            isDefault: p.Default || p.default || false,
          }));

          resolve(result);
        } catch (e) {
          console.error('[Windows Print API] Failed to parse printer list:', e);
          resolve([]);
        }
      });
    } catch (error) {
      console.error('[Windows Print API] Error listing printers:', error);
      resolve([]);
    }
  });
}

/**
 * Print to Windows printer using Print Spooler
 */
export async function printViaWindowsAPI(
  printerName: string,
  data: Buffer | string
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({
        success: false,
        message: 'Windows Print API only available on Windows',
      });
      return;
    }

    try {
      // Create temporary file
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `print-${Date.now()}.txt`);
      
      // Write data to temp file
      const content = typeof data === 'string' ? data : data.toString('utf-8');
      fs.writeFileSync(tempFile, content);

      // Use Windows print command to send file to printer
      const ps = spawn('powershell.exe', [
        '-Command',
        `Get-Content "${tempFile}" | Out-Printer -Name "${printerName}"`,
      ]);

      let errorOutput = '';

      ps.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ps.on('close', (code) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }

        if (code === 0) {
          console.log(`[Windows Print API] Successfully sent to printer: ${printerName}`);
          resolve({
            success: true,
            message: `Yazıcıya gönderildi: ${printerName}`,
          });
        } else {
          console.error(`[Windows Print API] Print failed: ${errorOutput}`);
          resolve({
            success: false,
            message: `Yazıcı hatası: ${printerName}`,
          });
        }
      });

      ps.on('error', (error) => {
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }

        console.error('[Windows Print API] Process error:', error);
        resolve({
          success: false,
          message: 'Yazıcı işlemi başarısız',
        });
      });
    } catch (error) {
      console.error('[Windows Print API] Error:', error);
      resolve({
        success: false,
        message: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  });
}

/**
 * Print ESC/POS commands to thermal printer
 */
function cleanup(file: string) {
  try { fs.unlinkSync(file); } catch { /* ignore */ }
}

function runCmd(cmd: string, desc: string): { ok: boolean; out: string } {
  try {
    const out = execSync(cmd, { timeout: 15000, stdio: 'pipe', encoding: 'utf-8' });
    console.log(`[Windows Print API] ${desc} OK`);
    return { ok: true, out: out || '' };
  } catch (e: any) {
    console.log(`[Windows Print API] ${desc} FAIL: ${e.message}`);
    return { ok: false, out: e.message };
  }
}

export async function printESCPOSViaWindowsAPI(
  printerName: string,
  escposData: Buffer
): Promise<{ success: boolean; message: string }> {
  if (process.platform !== 'win32') {
    return { success: false, message: 'Windows Print API only available on Windows' };
  }

  const tempFile = path.join(os.tmpdir(), `print-${Date.now()}.bin`);
  fs.writeFileSync(tempFile, escposData);
  const pn = printerName.replace(/'/g, "''");

  // 1. PowerShell Write-Printer (native raw printing) via temp file
  const r1 = runCmd(
    `powershell -NoProfile -Command "$b=[System.IO.File]::ReadAllBytes('${tempFile}'); Write-Printer -Name '${pn}' -Data $b"`,
    'Write-Printer'
  );
  if (r1.ok) { cleanup(tempFile); return { success: true, message: `Yazdırıldı: ${printerName}` }; }

  // 2. PowerShell .NET RAW via PrintServer
  const script = `Add-Type -AssemblyName System.Printing; $s=New-Object System.Printing.PrintServer; $q=$s.GetPrintQueue('${pn}'); $j=$q.AddJob('s'); $j.JobStream.Write([System.IO.File]::ReadAllBytes('${tempFile}'),0,([System.IO.File]::ReadAllBytes('${tempFile}')).Length); $j.JobStream.Close()`;
  const r2 = runCmd(`powershell -NoProfile -Command "${script}"`, '.NET RAW');
  if (r2.ok) { cleanup(tempFile); return { success: true, message: `Yazdırıldı: ${printerName}` }; }

  // 3. cmd print /D:
  const r3 = runCmd(`cmd /c print /D:"${printerName}" "${tempFile}"`, 'print /D:');
  if (r3.ok) { cleanup(tempFile); return { success: true, message: `Yazdırıldı: ${printerName}` }; }

  // 4. copy /b
  const r4 = runCmd(`copy /b "${tempFile}" "\\\\localhost\\${printerName}" /y`, 'copy /b');
  if (r4.ok) { cleanup(tempFile); return { success: true, message: `Yazdırıldı: ${printerName}` }; }

  // 5. fs.writeFileSync to share
  try {
    fs.writeFileSync(`\\\\localhost\\${printerName}`, escposData);
    cleanup(tempFile);
    return { success: true, message: `Yazdırıldı: ${printerName}` };
  } catch { /* fall through */ }

  // 6. Out-Printer (text)
  const r6 = runCmd(`powershell -NoProfile -Command "Get-Content '${tempFile}' -Raw | Out-Printer -Name '${pn}'"`, 'Out-Printer');
  if (r6.ok) { cleanup(tempFile); return { success: true, message: `Yazdırıldı: ${printerName}` }; }

  cleanup(tempFile);
  return { success: false, message: 'Hiçbir yöntem çalışmadı' };
}
