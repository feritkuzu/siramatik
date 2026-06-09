import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe('Label Settings Save and Verify', () => {
  beforeAll(async () => {
    // Database is initialized automatically
    await db.getDb();
  });

  it('should save label settings and retrieve them', async () => {
    // Get initial settings
    const initialSettings = await db.getLabelSettings(1);
    expect(initialSettings).toBeDefined();
    expect(initialSettings.id).toBe(1);

    // Update settings
    const newSettings = {
      labelName: 'Test Etiket',
      headerText: 'Test Başlık',
      footerText: 'Test Alt Metin',
      width: 100,
      height: 150,
      showQRCode: true,
      showBarcode: true,
      backgroundColor: '#FF0000',
      textColor: '#FFFFFF',
    };

    await db.updateLabelSettings(1, newSettings);

    // Retrieve and verify
    const savedSettings = await db.getLabelSettings(1);
    expect(savedSettings.labelName).toBe('Test Etiket');
    expect(savedSettings.headerText).toBe('Test Başlık');
    expect(savedSettings.footerText).toBe('Test Alt Metin');
    expect(savedSettings.width).toBe(100);
    expect(savedSettings.height).toBe(150);
    expect(savedSettings.showQRCode).toBe(true);
    expect(savedSettings.showBarcode).toBe(true);
    expect(savedSettings.backgroundColor).toBe('#FF0000');
    expect(savedSettings.textColor).toBe('#FFFFFF');
  });

  it('should update only specified fields', async () => {
    // Update only one field
    await db.updateLabelSettings(1, {
      labelName: 'Updated Name Only',
    });

    const settings = await db.getLabelSettings(1);
    expect(settings.labelName).toBe('Updated Name Only');
    // Other fields should remain unchanged
    expect(settings.headerText).toBe('Test Başlık');
    expect(settings.width).toBe(100);
  });

  it('should handle boolean fields correctly', async () => {
    await db.updateLabelSettings(1, {
      showQRCode: false,
      showBarcode: false,
      showDateTime: false,
      showBankInfo: false,
    });

    const settings = await db.getLabelSettings(1);
    expect(settings.showQRCode).toBe(false);
    expect(settings.showBarcode).toBe(false);
    expect(settings.showDateTime).toBe(false);
    expect(settings.showBankInfo).toBe(false);
  });

  it('should preserve timestamps', async () => {
    const settings1 = await db.getLabelSettings(1);
    const createdAt1 = settings1.createdAt;

    // Wait a bit and update
    await new Promise(resolve => setTimeout(resolve, 100));
    await db.updateLabelSettings(1, { labelName: 'Another Update' });

    const settings2 = await db.getLabelSettings(1);
    const createdAt2 = settings2.createdAt;
    const updatedAt2 = settings2.updatedAt;

    // createdAt should not change
    expect(createdAt2.getTime()).toBe(createdAt1.getTime());
    // updatedAt should be newer
    expect(updatedAt2.getTime()).toBeGreaterThan(createdAt1.getTime());
  });
});
