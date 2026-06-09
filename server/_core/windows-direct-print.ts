/**
 * Windows Direct Printer Port Communication
 * Sends data directly to printer ports (LPT1, USB, network)
 */

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get list of available printer ports
 */
export async function getPrinterPorts(): Promise<string[]> {
  const ports: string[] = [];
  
  if (process.platform !== 'win32') {
    return ports;
  }

  try {
    // Check common parallel ports
    for (let i = 1; i <= 4; i++) {
      ports.push(`LPT${i}:`);
    }
    
    // Check USB ports (typically COM ports on Windows)
    for (let i = 1; i <= 10; i++) {
      ports.push(`COM${i}:`);
    }
    
    return ports;
  } catch (error) {
    console.error('[Direct Print] Error getting printer ports:', error);
    return ports;
  }
}

/**
 * Print directly to printer port
 */
export async function printToPort(
  portName: string,
  data: Buffer | string
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({
        success: false,
        message: 'Direct port printing only available on Windows',
      });
      return;
    }

    try {
      // Convert data to buffer
      const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;

      // Normalize port name
      const normalizedPort = portName.toUpperCase();

      // For parallel ports (LPT), use file I/O
      if (normalizedPort.startsWith('LPT')) {
        try {
          fs.writeFileSync(normalizedPort, buffer);
          console.log(`[Direct Print] Successfully printed to ${normalizedPort}`);
          resolve({
            success: true,
            message: `Yazıcıya gönderildi: ${normalizedPort}`,
          });
        } catch (error) {
          console.error(`[Direct Print] Failed to write to ${normalizedPort}:`, error);
          resolve({
            success: false,
            message: `Port yazma hatası: ${normalizedPort}`,
          });
        }
        return;
      }

      // For serial/USB ports (COM), use serial communication
      if (normalizedPort.startsWith('COM')) {
        // Serial port communication would require additional setup
        // For now, return error
        resolve({
          success: false,
          message: `COM portları için ek kurulum gerekli: ${normalizedPort}`,
        });
        return;
      }

      resolve({
        success: false,
        message: `Bilinmeyen port türü: ${normalizedPort}`,
      });
    } catch (error) {
      console.error('[Direct Print] Error:', error);
      resolve({
        success: false,
        message: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  });
}

/**
 * Print to network printer via IP address
 */
export async function printToNetworkPrinter(
  ipAddress: string,
  port: number,
  data: Buffer | string
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    try {
      const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;

      const client = new net.Socket();
      
      const timeout = setTimeout(() => {
        client.destroy();
        resolve({
          success: false,
          message: 'Ağ yazıcısı bağlantısı zaman aşımı',
        });
      }, 5000);

      client.connect(port, ipAddress, () => {
        clearTimeout(timeout);
        client.write(buffer, (err) => {
          if (err) {
            console.error('[Direct Print] Network write error:', err);
            resolve({
              success: false,
              message: 'Ağ yazıcısına yazma hatası',
            });
          } else {
            console.log(`[Direct Print] Successfully sent to ${ipAddress}:${port}`);
            resolve({
              success: true,
              message: `Ağ yazıcısına gönderildi: ${ipAddress}:${port}`,
            });
          }
          client.destroy();
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[Direct Print] Network error:', err);
        resolve({
          success: false,
          message: 'Ağ yazıcısı bağlantı hatası',
        });
      });
    } catch (error) {
      console.error('[Direct Print] Error:', error);
      resolve({
        success: false,
        message: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  });
}

/**
 * Print to default Windows printer using raw data
 */
export async function printToDefaultWindowsPrinter(
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
      // Try common printer ports in order
      const portsToTry = ['LPT1:', 'LPT2:', 'COM1:', 'COM2:'];
      
      let lastError: string = '';
      let successCount = 0;

      const tryNextPort = (index: number) => {
        if (index >= portsToTry.length) {
          if (successCount > 0) {
            resolve({
              success: true,
              message: `Yazıcıya gönderildi (${successCount} port)`,
            });
          } else {
            resolve({
              success: false,
              message: lastError || 'Yazıcı portları erişilebilir değil',
            });
          }
          return;
        }

        const port = portsToTry[index];
        const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;

        try {
          fs.writeFileSync(port, buffer);
          console.log(`[Direct Print] Successfully printed to ${port}`);
          successCount++;
        } catch (error) {
          lastError = `${port}: ${error instanceof Error ? error.message : 'Hata'}`;
          console.log(`[Direct Print] Port ${port} not available`);
        }

        // Try next port
        tryNextPort(index + 1);
      };

      tryNextPort(0);
    } catch (error) {
      console.error('[Direct Print] Error:', error);
      resolve({
        success: false,
        message: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  });
}
