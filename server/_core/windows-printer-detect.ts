/**
 * Windows Printer Detection and Direct Printing
 * Uses Windows API to detect and print to printers
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Get list of Windows printers using WMI
 */
export async function getWindowsPrintersList(): Promise<string[]> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve([]);
      return;
    }

    try {
      // Use PowerShell to get printer list
      const command = `powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"`;
      
      exec(command, { encoding: 'utf-8' }, (error, stdout, stderr) => {
        if (error) {
          console.error('[Printer Detect] Error getting printers:', error);
          resolve([]);
          return;
        }

        const printers = stdout
          .split('\n')
          .map(p => p.trim())
          .filter(p => p.length > 0);

        console.log('[Printer Detect] Found printers:', printers);
        resolve(printers);
      });
    } catch (error) {
      console.error('[Printer Detect] Error:', error);
      resolve([]);
    }
  });
}

/**
 * Print to Windows printer using PowerShell
 */
export async function printToWindowsPrinterPowerShell(
  printerName: string,
  filePath: string
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({
        success: false,
        message: 'Windows printer access only available on Windows',
      });
      return;
    }

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        resolve({
          success: false,
          message: `Dosya bulunamadı: ${filePath}`,
        });
        return;
      }

      // Use PowerShell to print
      const escapedPath = filePath.replace(/\\/g, '\\\\');
      const escapedPrinter = printerName.replace(/"/g, '\\"');
      
      const command = `powershell -Command "Add-PrinterPort -Name 'FILE:' -PrinterPortType File -ErrorAction SilentlyContinue; Print-Document -PrinterName '${escapedPrinter}' -FilePath '${escapedPath}' -ErrorAction Stop"`;

      exec(command, { encoding: 'utf-8', timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[Printer Detect] Print error:', error);
          resolve({
            success: false,
            message: `Yazdırma hatası: ${error.message}`,
          });
          return;
        }

        console.log('[Printer Detect] Print successful');
        resolve({
          success: true,
          message: `${printerName} yazıcısına gönderildi`,
        });
      });
    } catch (error) {
      console.error('[Printer Detect] Error:', error);
      resolve({
        success: false,
        message: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  });
}

/**
 * Print raw data to Windows printer using temp file
 */
export async function printRawDataToWindowsPrinter(
  printerName: string,
  data: Buffer | string
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({
        success: false,
        message: 'Windows printer access only available on Windows',
      });
      return;
    }

    try {
      // Create temp file
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `print-${Date.now()}.txt`);
      
      // Write data to temp file
      const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
      fs.writeFileSync(tempFile, buffer);

      console.log('[Printer Detect] Created temp file:', tempFile);

      // Print using PowerShell
      const escapedPath = tempFile.replace(/\\/g, '\\\\');
      const escapedPrinter = printerName.replace(/"/g, '\\"');
      
      // Try using notepad to print
      const command = `powershell -Command "& 'notepad' /p '${escapedPath}' | Out-Null; Start-Sleep -Milliseconds 500; Remove-Item '${escapedPath}' -Force -ErrorAction SilentlyContinue"`;

      exec(command, { encoding: 'utf-8', timeout: 15000 }, (error, stdout, stderr) => {
        // Clean up temp file
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (e) {
          console.error('[Printer Detect] Error deleting temp file:', e);
        }

        if (error) {
          console.error('[Printer Detect] Print error:', error);
          resolve({
            success: false,
            message: `Yazdırma hatası: ${error.message}`,
          });
          return;
        }

        console.log('[Printer Detect] Print successful');
        resolve({
          success: true,
          message: `${printerName} yazıcısına gönderildi`,
        });
      });
    } catch (error) {
      console.error('[Printer Detect] Error:', error);
      resolve({
        success: false,
        message: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  });
}

/**
 * Send raw ESC/POS commands directly to printer port
 */
export async function sendRawCommandToPort(
  portName: string,
  data: Buffer
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({
        success: false,
        message: 'Port access only available on Windows',
      });
      return;
    }

    try {
      // Use PowerShell to send raw data to port
      const base64Data = data.toString('base64');
      const command = `powershell -Command "[byte[]]\\$data = [Convert]::FromBase64String('${base64Data}'); \\$port = New-Object System.IO.Ports.SerialPort '${portName}', 9600, None, 8, One; \\$port.Open(); \\$port.Write(\\$data, 0, \\$data.Length); Start-Sleep -Milliseconds 100; \\$port.Close()"`;

      exec(command, { encoding: 'utf-8', timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[Printer Detect] Port write error:', error);
          resolve({
            success: false,
            message: `Port yazma hatası: ${error.message}`,
          });
          return;
        }

        console.log('[Printer Detect] Port write successful');
        resolve({
          success: true,
          message: `${portName} portuna gönderildi`,
        });
      });
    } catch (error) {
      console.error('[Printer Detect] Error:', error);
      resolve({
        success: false,
        message: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  });
}
