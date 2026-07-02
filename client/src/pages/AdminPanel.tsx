import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const themePresets: Record<string, { label: string; bg: string; text: string; header: string; subheader: string; border: string; font: string }> = {
  cyber: { label: "Cyberpunk", bg: "#0a0a0a", text: "#00ff41", header: "#ff00ff", subheader: "#00ffff", border: "#ff00ff", font: "Courier New, monospace" },
  ocean: { label: "Okyanus", bg: "#0d1b2a", text: "#e0e1dd", header: "#1b98a0", subheader: "#415a77", border: "#1b98a0", font: "Segoe UI, sans-serif" },
  classic: { label: "Klasik", bg: "#1a1a2e", text: "#ffffff", header: "#e94560", subheader: "#16213e", border: "#e94560", font: "Arial, sans-serif" },
  forest: { label: "Orman", bg: "#0a1f0a", text: "#d4edda", header: "#28a745", subheader: "#155724", border: "#28a745", font: "Georgia, serif" },
  sunset: { label: "Günbatımı", bg: "#1a0a0a", text: "#ffe0d0", header: "#ff6b35", subheader: "#c73e1d", border: "#ff6b35", font: "Tahoma, sans-serif" },
  midnight: { label: "Gece Mavisi", bg: "#000814", text: "#c0c8e0", header: "#003566", subheader: "#001233", border: "#ffc300", font: "Segoe UI, sans-serif" },
  lavender: { label: "Lavanta", bg: "#1a0a2e", text: "#e5d9f2", header: "#9b5de5", subheader: "#7b2d8e", border: "#9b5de5", font: "Verdana, sans-serif" },
};

export default function AdminPanel() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(() => {
    return !!sessionStorage.getItem("superadmin-token");
  });
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const verifyPasscodeMutation = trpc.admin.verifyPasscode.useMutation();
  const [bankCount, setBankCount] = useState(2);
  const [labelSettings, setLabelSettings] = useState<any>({
    labelName: "Varsayılan Etiket",
    labelType: "ticket",
    width: 58,
    height: 30,
    headerText: "Başlık",
    footerText: "Alt Metin",
    backgroundColor: "#ffffff",
    textColor: "#000000",
    showQRCode: false,
    showBarcode: false,
    showDateTime: true,
    showBankInfo: true,
  });

  // Fetch system config
  const { data: config, refetch: refetchConfig } = trpc.admin.getConfig.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Fetch all banks
  const { data: banks, refetch: refetchBanks } = trpc.bank.getAll.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Fetch queue stats
  const { data: stats, refetch: refetchStats } = trpc.queue.getStats.useQuery(undefined, {
    refetchInterval: 50000,
  });

  // Get connected banks (via socket)
  const { data: connectedBankIds } = trpc.admin.getConnectedBanks.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Mutations
  const initSystemMutation = trpc.admin.initialize.useMutation();
  const shutdownSystemMutation = trpc.admin.shutdown.useMutation();
  const updateBankCountMutation = trpc.admin.updateBankCount.useMutation();
  const toggleBankMutation = trpc.admin.toggleBankStatus.useMutation();
  const resetQueueMutation = trpc.admin.resetQueue.useMutation();
  const assignBankOperatorMutation = trpc.admin.assignBankOperator.useMutation();
  const createBankOperatorMutation = trpc.admin.createBankOperator.useMutation();
  const updateBankOperatorMutation = trpc.admin.updateBankOperator.useMutation();
  const deleteBankOperatorMutation = trpc.admin.deleteBankOperator.useMutation();
  const updateBankIpAddressMutation = trpc.admin.updateBankIpAddress.useMutation();
  const updateBankMacAddressMutation = trpc.admin.updateBankMacAddress.useMutation();
  const updateSystemSettingsMutation = trpc.admin.updateSystemSettings.useMutation();
  const testPrinterMutation = trpc.admin.testPrinter.useMutation();
  const testWindowsPrinterMutation = trpc.admin.testWindowsPrinterEndpoint.useMutation();
  const updateLabelSettingsMutation = trpc.admin.updateLabelSettings.useMutation();
  const updatePrinterSettingsMutation = trpc.admin.updatePrinterSettings.useMutation();
  const createLabelMutation = trpc.admin.createLabelSettings.useMutation();
  const deleteLabelMutation = trpc.admin.deleteLabelSettings.useMutation();
  const setDefaultLabelMutation = trpc.admin.setDefaultLabelSettings.useMutation();
  
  // Label State
  const [selectedLabelId, setSelectedLabelId] = useState(1);
  
  // Queries
  const { data: usbPrinters } = trpc.admin.listUSBPrinters.useQuery();
  const { data: windowsPrinters, refetch: refetchWindowsPrinters, isLoading: isLoadingPrinters, error: printersError } = trpc.admin.listWindowsPrinters.useQuery();
  const { data: allLabels, refetch: refetchLabels } = trpc.admin.getAllLabelSettings.useQuery();
  const { data: labelSettingsData } = trpc.admin.getLabelSettings.useQuery({ labelId: selectedLabelId });
  
  // Fetch bank operators
  const { data: operators, refetch: refetchOperators } = trpc.admin.getBankOperators.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Operator management state
  const [newOperatorName, setNewOperatorName] = useState("");
  const [editingOperatorId, setEditingOperatorId] = useState<number | null>(null);
  const [editingOperatorName, setEditingOperatorName] = useState("");

  // Debug: Log printer data
  useEffect(() => {
    console.log('[AdminPanel] windowsPrinters:', windowsPrinters);
    console.log('[AdminPanel] isLoadingPrinters:', isLoadingPrinters);
    console.log('[AdminPanel] printersError:', printersError);
  }, [windowsPrinters, isLoadingPrinters, printersError]);
  
  // Windows Printer State
  const [selectedPrinter, setSelectedPrinter] = useState("");
  
  // Export queries (TODO: Implement export endpoints)
  // const exportStatsCSVQuery = trpc.admin.exportStatsCSV.useQuery({}, { enabled: false });
  // const exportStatsPDFQuery = trpc.admin.exportStatsPDF.useQuery({}, { enabled: false });
  // const exportLogsCSVQuery = trpc.admin.exportLogsCSV.useQuery({}, { enabled: false });
  // const exportLogsPDFQuery = trpc.admin.exportLogsPDF.useQuery({}, { enabled: false });
  
  // Email state (TODO: Implement email endpoints)
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailStartDate, setEmailStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split("T")[0];
  });
  const [emailEndDate, setEmailEndDate] = useState(new Date().toISOString().split("T")[0]);
  
  // Email mutations (TODO: Implement email endpoints)
  // const sendReportMutation = trpc.email.sendReport.useMutation();
  // const sendTestEmailMutation = trpc.email.sendTest.useMutation();

  // System settings state
  const [systemName, setSystemName] = useState("");
  const [queuePrefix, setQueuePrefix] = useState("");
  const [maxQueueNumber, setMaxQueueNumber] = useState(0);
  const [businessHoursStart, setBusinessHoursStart] = useState("09:00");
  const [businessHoursEnd, setBusinessHoursEnd] = useState("18:00");
  const [kioskMessage, setKioskMessage] = useState("");
  const [kioskMode, setKioskMode] = useState("touch");
  const [serialBtn1Action, setSerialBtn1Action] = useState("simple_ticket");
  const [serialBtn2Action, setSerialBtn2Action] = useState("priority_elderly");
  const [themeBg, setThemeBg] = useState("#0d1b2a");
  const [themeText, setThemeText] = useState("#e0e1dd");
  const [themeHeader, setThemeHeader] = useState("#1b98a0");
  const [themeSubheader, setThemeSubheader] = useState("#415a77");
  const [themeFont, setThemeFont] = useState("Segoe UI, sans-serif");
  const [themeFontSize, setThemeFontSize] = useState(16);
  const [themeBorder, setThemeBorder] = useState("#1b98a0");
  const [weatherCity, setWeatherCity] = useState("");
  const [announcements, setAnnouncements] = useState("");
  const [tickerSpeed, setTickerSpeed] = useState(8);
  const [tickerFontSize, setTickerFontSize] = useState(22);
  const [workingDays, setWorkingDays] = useState("1,2,3,4,5");

  // Sound settings state
  const [soundSettings, setSoundSettings] = useState<any>({
    soundType: "chime",
    soundVolume: 70,
    isEnabled: true,
    voiceEnabled: true,
    notificationSound: "chime",
    animationType: "pulse",
    animationSpeed: "normal",
  });
  const [showSoundSettings, setShowSoundSettings] = useState(false);

  // Sound settings queries and mutations
  const { data: fetchedSoundSettings } = trpc.admin.getSoundSettings.useQuery();
  const updateSoundSettingsMutation = trpc.admin.updateSoundSettings.useMutation();
  const { data: notificationSounds } = trpc.admin.getNotificationSounds.useQuery();

  // Socket.io connection
  const { on, emit } = useSocket("admin");

  useEffect(() => {
    if (config && config.totalBanks) {
      setBankCount(config.totalBanks);
      setSystemName(config.systemName || "SIRAMATİK");
      setQueuePrefix(config.queuePrefix || "");
      setMaxQueueNumber(config.maxQueueNumber || 0);
      setBusinessHoursStart(config.businessHoursStart || "09:00");
      setBusinessHoursEnd(config.businessHoursEnd || "18:00");
      setKioskMessage(config.kioskMessage || "");
      setKioskMode(config.kioskMode || "touch");
      setSerialBtn1Action(config.serialBtn1Action || "simple_ticket");
      setSerialBtn2Action(config.serialBtn2Action || "priority_elderly");
      setThemeBg(config.themeBg || "#0d1b2a");
      setThemeText(config.themeText || "#e0e1dd");
      setThemeHeader(config.themeHeader || "#1b98a0");
      setThemeSubheader(config.themeSubheader || "#415a77");
      setThemeFont(config.themeFont || "Segoe UI, sans-serif");
      setThemeFontSize(config.themeFontSize ?? 16);
      setThemeBorder(config.themeBorder || "#1b98a0");
      setWeatherCity(config.weatherCity || "");
      setAnnouncements(config.announcements || "");
      setTickerSpeed(config.tickerSpeed ?? 8);
      setTickerFontSize(config.tickerFontSize ?? 22);
      setWorkingDays(config.workingDays || "1,2,3,4,5");
    }
  }, [config]);

  useEffect(() => {
    if (fetchedSoundSettings && fetchedSoundSettings.soundType) {
      setSoundSettings(fetchedSoundSettings);
    }
  }, [fetchedSoundSettings]);

  useEffect(() => {
    if (labelSettingsData && labelSettingsData.id) {
      setLabelSettings(labelSettingsData);
    }
  }, [selectedLabelId]);

  useEffect(() => {
    if (allLabels && allLabels.length > 0 && selectedLabelId === 1) {
      const active = allLabels.find((l: any) => l.isActive);
      if (active) setSelectedLabelId(active.id);
    }
  }, [allLabels, selectedLabelId]);

  useEffect(() => {
    // Initialize selected printer from windowsPrinters
    if (windowsPrinters && windowsPrinters.length > 0) {
      setSelectedPrinter(windowsPrinters[0].name || "");
    }
  }, [windowsPrinters]);

  // Listen for bank status changes from other clients
  useEffect(() => {
    const unsubscribe = on("bank:statusChanged", () => {
      refetchBanks();
    });
    return unsubscribe;
  }, [on, refetchBanks]);

  const handleUpdateSoundSettings = async () => {
    try {
      await updateSoundSettingsMutation.mutateAsync(soundSettings);
      setShowSoundSettings(false);
      // Emit socket event for real-time update
      emit("soundSettings:updated", soundSettings);
    } catch (error) {
      console.error("Failed to update sound settings:", error);
    }
  };

  const handleUpdateBankCount = async () => {
    try {
      await updateBankCountMutation.mutateAsync({ count: bankCount });
      await refetchBanks();
    } catch (error) {
      console.error("Failed to update bank count:", error);
    }
  };

  const handleInitSystem = async () => {
    try {
      await initSystemMutation.mutateAsync({ bankCount });
      await refetchConfig();
    } catch (error) {
      console.error("Failed to initialize system:", error);
    }
  };

  const handleShutdownSystem = async () => {
    try {
      await shutdownSystemMutation.mutateAsync();
      await refetchConfig();
      toast.success("✓ Sistem kapatıldı");
    } catch (error) {
      console.error("Failed to shut down system:", error);
      toast.error("✗ Sistem kapatılamadı");
    }
  };

  const handleSavePrinter = async () => {
    if (!selectedPrinter) {
      toast.error("Lütfen bir yazıcı seçin");
      return;
    }
    try {
      await updatePrinterSettingsMutation.mutateAsync({ windowsPrinterName: selectedPrinter });
      toast.success(`Yazıcı kaydedildi: ${selectedPrinter}`);
    } catch (error) {
      toast.error("Yazıcı kaydedilemedi");
    }
  };

  const handleSuperAdminLogin = async () => {
    const result = await verifyPasscodeMutation.mutateAsync({ passcode: passcodeInput });
    if (result.success && result.token) {
      sessionStorage.setItem("superadmin-token", result.token);
      setIsSuperAdmin(true);
      setPasscodeInput("");
      setPasscodeError("");
    } else {
      setPasscodeError("Hatalı şifre!");
    }
  };

  const handleSuperAdminLogout = () => {
    sessionStorage.removeItem("superadmin-token");
    setIsSuperAdmin(false);
    setPasscodeInput("");
    setPasscodeError("");
  };

  return (
    <div className="min-h-screen bg-black text-foreground p-8" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255, 0, 255, 0.1) 0%, transparent 50%)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <h1 className="text-5xl font-black neon-pink" style={{ textShadow: "0 0 20px currentColor" }}>
            ADMİN PANELİ
          </h1>
          <div className="flex items-center gap-4">
            <button onClick={() => window.open("/reports", "_blank")} className="h-10 px-4 font-black text-xs bg-purple-600 hover:bg-purple-700 text-white border-4 border-purple-600 cursor-pointer">
              RAPORLAR
            </button>
            {isSuperAdmin ? (
              <div className="flex items-center gap-3 border-4 border-yellow-400 p-3">
                <span className="text-yellow-400 font-black text-sm" style={{ textShadow: "0 0 10px currentColor" }}>● SÜPERADMİN</span>
                <Button onClick={handleSuperAdminLogout} className="h-10 px-4 font-black text-xs bg-yellow-600 hover:bg-yellow-700 text-white border-4 border-yellow-600">
                  ÇIKIŞ
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="Süperadmin şifre"
                  value={passcodeInput}
                  onChange={(e) => { setPasscodeInput(e.target.value); setPasscodeError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSuperAdminLogin()}
                  className="h-12 w-40 border-4 border-secondary bg-card text-foreground font-black text-sm p-2"
                />
                <Button onClick={handleSuperAdminLogin} className="h-12 px-4 font-black text-xs bg-yellow-600 hover:bg-yellow-700 text-white border-4 border-yellow-600">
                  SÜPERADMİN GİRİŞ
                </Button>
              </div>
            )}
          </div>
        </div>
        {passcodeError && (
          <p className="text-red-500 text-sm mb-4 text-right">{passcodeError}</p>
        )}

        {isSuperAdmin && (
        <div className="border-4 border-yellow-400 p-6 mb-8 relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-yellow-400" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-yellow-400" />
          <h2 className="text-3xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor" }}>SİSTEM BAŞLATMA (SÜPERADMİN)</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border-4 border-secondary p-6">
              <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
                BANKO SAYISI
              </label>
              <input
                type="number"
                min="2"
                max="10"
                value={bankCount}
                onChange={(e) => setBankCount(parseInt(e.target.value))}
                className="w-full h-12 border-4 border-primary bg-card text-foreground font-black text-lg p-2 mb-4"
              />
              <Button
                onClick={handleInitSystem}
                disabled={initSystemMutation.isPending || config?.isSystemActive}
                className="w-full h-12 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary neon-glow"
              >
                {initSystemMutation.isPending ? "BAŞLATILIYOR..." : "SİSTEMİ BAŞLAT"}
              </Button>
              <Button
                onClick={handleShutdownSystem}
                disabled={shutdownSystemMutation.isPending || !config?.isSystemActive}
                className="w-full h-12 font-black bg-red-600 hover:bg-red-700 text-white border-4 border-red-600 mt-2"
              >
                {shutdownSystemMutation.isPending ? "KAPATILIYOR..." : "SİSTEMİ KAPAT"}
              </Button>
            </div>

            <div className="border-4 border-secondary p-6">
              <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
                BANKO SAYISINI GÜNCELLE
              </label>
              <input
                type="number"
                min="2"
                max="10"
                value={bankCount}
                onChange={(e) => setBankCount(parseInt(e.target.value))}
                className="w-full h-12 border-4 border-primary bg-card text-foreground font-black text-lg p-2 mb-4"
              />
              <Button
                onClick={handleUpdateBankCount}
                disabled={updateBankCountMutation.isPending}
                className="w-full h-12 font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground border-4 border-secondary"
              >
                {updateBankCountMutation.isPending ? "GÜNCELLENIYOR..." : "GÜNCELLE"}
              </Button>
            </div>

            <div className="border-4 border-secondary p-6">
              <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
                SİSTEM DURUMU
              </label>
              <div className="space-y-2">
                <p className="text-sm text-foreground/60">Aktif: {config?.isSystemActive ? "✓ EVET" : "✗ HAYIR"}</p>
                <p className="text-sm text-foreground/60">Banko Sayısı: {config?.totalBanks || 0}</p>
                <p className="text-sm text-foreground/60">Aktif Banko: <span className={connectedBankIds?.length ? "text-green-400" : "text-red-400"}>{connectedBankIds?.length || 0}</span></p>
                <p className="text-sm text-foreground/60">Sıra No: {config?.currentQueueNumber || 0}</p>
              </div>
            </div>
          </div>

          {/* System Settings (Superadmin) */}
          <div className="border-4 border-yellow-400 p-6 mt-6">
            <h3 className="text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>SİSTEM AYARLARI</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Sistem Adı</label>
                <input type="text" value={systemName} onChange={(e) => setSystemName(e.target.value)} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Sıra Ön Eki</label>
                <input type="text" value={queuePrefix} onChange={(e) => setQueuePrefix(e.target.value)} placeholder="Örn: A" maxLength={5} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Maksimum Sıra No (0 = limitsiz)</label>
                <input type="number" value={maxQueueNumber} onChange={(e) => setMaxQueueNumber(parseInt(e.target.value) || 0)} min="0" className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Çalışma Başlangıç</label>
                <input type="time" value={businessHoursStart} onChange={(e) => setBusinessHoursStart(e.target.value)} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Çalışma Bitiş</label>
                <input type="time" value={businessHoursEnd} onChange={(e) => setBusinessHoursEnd(e.target.value)} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Kiosk Modu</label>
                <select value={kioskMode} onChange={(e) => setKioskMode(e.target.value)} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-1">
                  <option value="touch">Dokunmatik Ekran</option>
                  <option value="usb_keypad">USB Keypad</option>
                  <option value="single_button">Tek Buton</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Kiosk Mesajı</label>
                <input type="text" value={kioskMessage} onChange={(e) => setKioskMessage(e.target.value)} placeholder="Kiosk ekranında gösterilecek mesaj" maxLength={100} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Seri BTN1 Aksiyonu</label>
                <select value={serialBtn1Action} onChange={(e) => setSerialBtn1Action(e.target.value)} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-1">
                  <option value="simple_ticket">Basit Sıra</option>
                  <option value="priority_elderly">Öncelikli - Yaşlı</option>
                  <option value="priority_disabled">Öncelikli - Engelli</option>
                  <option value="priority_pregnant">Öncelikli - Hamile</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Seri BTN2 Aksiyonu</label>
                <select value={serialBtn2Action} onChange={(e) => setSerialBtn2Action(e.target.value)} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-1">
                  <option value="simple_ticket">Basit Sıra</option>
                  <option value="priority_elderly">Öncelikli - Yaşlı</option>
                  <option value="priority_disabled">Öncelikli - Engelli</option>
                  <option value="priority_pregnant">Öncelikli - Hamile</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Hava Durumu Şehir</label>
                <input type="text" value={weatherCity} onChange={(e) => setWeatherCity(e.target.value)} placeholder="Örn: Istanbul" className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2" />
              </div>
            </div>

            {/* Theme Settings */}
            <h3 className="text-lg font-black neon-purple mt-6 mb-4" style={{ textShadow: "0 0 10px currentColor" }}>TEMA AYARLARI</h3>

            {/* Theme Preset Selector */}
            <div className="mb-6">
              <label className="block text-sm font-bold mb-2 text-foreground/80">Hazır Tema Seç</label>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "custom") return;
                  const preset = themePresets[val];
                  if (preset) {
                    setThemeBg(preset.bg);
                    setThemeText(preset.text);
                    setThemeHeader(preset.header);
                    setThemeSubheader(preset.subheader);
                    setThemeBorder(preset.border);
                    setThemeFont(preset.font);
                  }
                }}
                className="w-full h-12 border-4 border-secondary bg-card text-foreground font-black text-lg p-2"
              >
                <option value="custom">Kullanıcı Teması (Özel)</option>
                {Object.entries(themePresets).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Arka Plan Rengi</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={themeBg} onChange={(e) => setThemeBg(e.target.value)} className="w-10 h-10 border-2 border-primary cursor-pointer" />
                  <input type="text" value={themeBg} onChange={(e) => setThemeBg(e.target.value)} maxLength={20} className="flex-1 h-10 border-2 border-primary bg-card text-foreground font-mono text-sm p-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Yazı Rengi</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={themeText} onChange={(e) => setThemeText(e.target.value)} className="w-10 h-10 border-2 border-primary cursor-pointer" />
                  <input type="text" value={themeText} onChange={(e) => setThemeText(e.target.value)} maxLength={20} className="flex-1 h-10 border-2 border-primary bg-card text-foreground font-mono text-sm p-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Başlık Rengi</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={themeHeader} onChange={(e) => setThemeHeader(e.target.value)} className="w-10 h-10 border-2 border-primary cursor-pointer" />
                  <input type="text" value={themeHeader} onChange={(e) => setThemeHeader(e.target.value)} maxLength={20} className="flex-1 h-10 border-2 border-primary bg-card text-foreground font-mono text-sm p-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Alt Başlık Rengi</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={themeSubheader} onChange={(e) => setThemeSubheader(e.target.value)} className="w-10 h-10 border-2 border-primary cursor-pointer" />
                  <input type="text" value={themeSubheader} onChange={(e) => setThemeSubheader(e.target.value)} maxLength={20} className="flex-1 h-10 border-2 border-primary bg-card text-foreground font-mono text-sm p-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Kenarlık Rengi</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={themeBorder} onChange={(e) => setThemeBorder(e.target.value)} className="w-10 h-10 border-2 border-primary cursor-pointer" />
                  <input type="text" value={themeBorder} onChange={(e) => setThemeBorder(e.target.value)} maxLength={20} className="flex-1 h-10 border-2 border-primary bg-card text-foreground font-mono text-sm p-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Yazı Tipi</label>
                <select value={themeFont} onChange={(e) => setThemeFont(e.target.value)} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-1">
                  <option value="Segoe UI, sans-serif">Segoe UI</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Courier New, monospace">Courier New</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Impact, sans-serif">Impact</option>
                  <option value="Tahoma, sans-serif">Tahoma</option>
                  <option value="Trebuchet MS, sans-serif">Trebuchet MS</option>
                  <option value="Verdana, sans-serif">Verdana</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Font Boyutu (px)</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={10} max={60} value={themeFontSize} onChange={(e) => setThemeFontSize(parseInt(e.target.value))} className="flex-1 accent-primary" />
                  <span className="w-10 text-center font-black text-sm">{themeFontSize}px</span>
                </div>
              </div>
            </div>
            {/* Kiosk / Ticker Settings */}
            <h3 className="text-lg font-black neon-purple mt-6 mb-4" style={{ textShadow: "0 0 10px currentColor" }}>KİOSK & TİCKER AYARLARI</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Ticker Hızı (sn)</label>
                <input type="number" value={tickerSpeed} onChange={(e) => setTickerSpeed(parseInt(e.target.value) || 8)} min={3} max={30} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Ticker Font Boyutu</label>
                <input type="number" value={tickerFontSize} onChange={(e) => setTickerFontSize(parseInt(e.target.value) || 22)} min={12} max={60} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Çalışma Günleri (1-7)</label>
                <input type="text" value={workingDays} onChange={(e) => setWorkingDays(e.target.value)} placeholder="1,2,3,4,5" className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-bold mb-1 text-foreground/80">Duyuru Metni (ticker)</label>
                <textarea value={announcements} onChange={(e) => setAnnouncements(e.target.value)} placeholder="Kayan duyuru metni..." maxLength={2000} rows={3} className="w-full border-2 border-primary bg-card text-foreground font-black text-sm p-2" />
              </div>
            </div>
            <Button
              onClick={async () => {
                await updateSystemSettingsMutation.mutateAsync({
                  systemName,
                  queuePrefix,
                  maxQueueNumber,
                  businessHoursStart,
                  businessHoursEnd,
                  kioskMessage,
                  kioskMode,
                  serialBtn1Action,
                  serialBtn2Action,
                  themeBg,
                  themeText,
                  themeHeader,
                  themeSubheader,
                  themeFont,
                  themeFontSize,
                  themeBorder,
                  weatherCity,
                  announcements,
                  tickerSpeed,
                  tickerFontSize,
                  workingDays,
                });
                toast.success("✓ Sistem ayarları kaydedildi");
              }}
              disabled={updateSystemSettingsMutation.isPending}
              className="mt-4 h-12 px-6 font-black bg-yellow-600 hover:bg-yellow-700 text-white border-4 border-yellow-600"
            >
              {updateSystemSettingsMutation.isPending ? "KAYDEDİLİYOR..." : "SİSTEM AYARLARINI KAYDET"}
            </Button>
          </div>

          {/* Sound & Notification Settings */}
          <div className="border-4 border-primary p-6 mt-6">
            <h3 className="text-lg font-black neon-pink mb-4" style={{ textShadow: "0 0 10px currentColor" }}>BİLDİRİM & SES AYARLARI</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={soundSettings.isEnabled} onChange={(e) => setSoundSettings({ ...soundSettings, isEnabled: e.target.checked })} className="w-5 h-5" />
                <label className="text-sm font-bold text-foreground/80">Ses Aktif</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={soundSettings.voiceEnabled} onChange={(e) => setSoundSettings({ ...soundSettings, voiceEnabled: e.target.checked })} className="w-5 h-5" />
                <label className="text-sm font-bold text-foreground/80">Sesli Anons (TTS)</label>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Ses Seviyesi</label>
                <input type="range" min={0} max={100} value={soundSettings.soundVolume} onChange={(e) => setSoundSettings({ ...soundSettings, soundVolume: parseInt(e.target.value) })} className="w-full" />
                <span className="text-xs text-foreground/60">{soundSettings.soundVolume}%</span>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Bildirim Sesi</label>
                <div className="flex gap-1">
                  <select value={soundSettings.notificationSound || "chime"} onChange={(e) => setSoundSettings({ ...soundSettings, notificationSound: e.target.value })} className="flex-1 h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2">
                    <option value="chime">🔔 Ding-Dong (Varsayılan)</option>
                    {notificationSounds?.map((s: any) => (
                      <option key={s.name} value={s.name}>{s.name.replace(/soundreality-notification-/g, "").replace(/-/g, " ")}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const ns = soundSettings.notificationSound || "chime";
                      if (ns === "chime") {
                        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
                        const ctx = window.__audioCtx;
                        const ac = (ctx && ctx.state !== "closed") ? ctx : new Ctor();
                        if (ac.state === "suspended") ac.resume();
                        const now = ac.currentTime;
                        const o = ac.createOscillator();
                        const g = ac.createGain();
                        o.connect(g); g.connect(ac.destination);
                        o.frequency.setValueAtTime(880, now);
                        g.gain.setValueAtTime(0.15, now);
                        g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                        o.frequency.setValueAtTime(660, now + 0.25);
                        g.gain.setValueAtTime(0.15, now + 0.25);
                        g.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                        o.start(now); o.stop(now + 0.5);
                      } else {
                        const a = new Audio(`/notification-sounds/${ns}.mp3`);
                        a.volume = (soundSettings.soundVolume || 70) / 100;
                        a.play().catch(() => {});
                      }
                    }}
                    className="h-10 px-3 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-border cursor-pointer"
                    title="Önizle"
                  >▶</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Animasyon Tipi</label>
                <select value={soundSettings.animationType} onChange={(e) => setSoundSettings({ ...soundSettings, animationType: e.target.value })} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2">
                  <option value="pulse">Pulse</option>
                  <option value="flash">Flash</option>
                  <option value="bounce">Bounce</option>
                  <option value="shake">Shake</option>
                  <option value="rainbow">Rainbow</option>
                  <option value="glow">Glow</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-foreground/80">Animasyon Hızı</label>
                <select value={soundSettings.animationSpeed} onChange={(e) => setSoundSettings({ ...soundSettings, animationSpeed: e.target.value })} className="w-full h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2">
                  <option value="fast">Hızlı</option>
                  <option value="normal">Normal</option>
                  <option value="slow">Yavaş</option>
                </select>
              </div>
            </div>
            <Button
              onClick={handleUpdateSoundSettings}
              disabled={updateSoundSettingsMutation.isPending}
              className="mt-4 h-10 px-6 font-black bg-purple-600 hover:bg-purple-700 text-white border-4 border-purple-600"
            >
              {updateSoundSettingsMutation.isPending ? "KAYDEDİLİYOR..." : "SES AYARLARINI KAYDET"}
            </Button>
          </div>

          {/* Bank IP & MAC Configuration (Superadmin) */}
          <div className="border-4 border-yellow-400 p-6 mt-6">
            <h3 className="text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>BANKO IP & MAC ADRESLERİ</h3>
            <p className="text-xs text-foreground/60 mb-4">Her bankonun bilgisayar IP ve MAC adresini girin. Öncelikle MAC adresi ile eşleşme yapılır, bulunamazsa IP ile eşleşme denenir.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {banks && banks.map((bank: any) => (
                <div key={bank.id} className="border-2 border-secondary p-3">
                  <p className="text-sm font-black mb-2">BANKO {bank.bankNumber}</p>
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      placeholder="MAC (örn: AA:BB:CC:DD:EE:FF)"
                      defaultValue={bank.macAddress || ""}
                      onBlur={async (e) => {
                        const mac = e.target.value.trim();
                        await updateBankMacAddressMutation.mutateAsync({ bankId: bank.id, macAddress: mac });
                      }}
                      className="w-full h-8 border-2 border-primary bg-card text-foreground font-mono text-xs p-1"
                    />
                    <input
                      type="text"
                      placeholder="IP (örn: 192.168.1.100)"
                      defaultValue={bank.ipAddress || ""}
                      onBlur={async (e) => {
                        const ip = e.target.value.trim();
                        await updateBankIpAddressMutation.mutateAsync({ bankId: bank.id, ipAddress: ip });
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          const ip = (e.target as HTMLInputElement).value.trim();
                          await updateBankIpAddressMutation.mutateAsync({ bankId: bank.id, ipAddress: ip });
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="flex-1 h-8 border-2 border-primary bg-card text-foreground font-black text-xs p-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Banks Control */}
        <div className="border-4 border-primary p-6 mb-8 relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
          <h2 className="text-3xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor" }}>BANKO KONTROLÜ</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {banks && banks.map((bank: any) => (
              <div key={bank.id} className="border-4 border-secondary p-4 text-center">
                <p className="text-lg font-black neon-blue mb-2">BANKO {bank.bankNumber}</p>
                <p className={`text-2xl font-black mb-4 ${bank.isActive ? "text-green-400" : "text-red-400"}`} style={{ textShadow: "0 0 10px currentColor" }}>
                  {bank.isActive ? "✓ AÇIK" : "✗ KAPALI"}
                </p>
                <div className="flex gap-2 mb-3">
                  <Button
                    onClick={async () => {
                      if (bank.isActive) return;
                      await toggleBankMutation.mutateAsync({ bankId: bank.id });
                      emit("bank:statusChanged", { bankId: bank.id, isActive: true, isOccupied: bank.isOccupied, timestamp: Date.now() });
                      refetchBanks();
                    }}
                    className={`flex-1 h-8 font-black text-xs border-2 ${bank.isActive ? "bg-green-700 border-green-500 cursor-default" : "bg-green-600 hover:bg-green-700 border-green-600"}`}
                  >
                    AÇ
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!bank.isActive) return;
                      await toggleBankMutation.mutateAsync({ bankId: bank.id });
                      emit("bank:statusChanged", { bankId: bank.id, isActive: false, isOccupied: bank.isOccupied, timestamp: Date.now() });
                      refetchBanks();
                    }}
                    className={`flex-1 h-8 font-black text-xs border-2 ${!bank.isActive ? "bg-red-700 border-red-500 cursor-default" : "bg-red-600 hover:bg-red-700 border-red-600"}`}
                  >
                    KAPAT
                  </Button>
                </div>
                <select
                  value={bank.assignedOperatorId ?? ""}
                  onChange={async (e) => {
                    const val = e.target.value;
                    try {
                      const result: any = await assignBankOperatorMutation.mutateAsync({ bankId: bank.id, operatorId: val ? parseInt(val) : null });
                      if (result?.bank) {
                        refetchBanks();
                      }
                    } catch (err) {
                      console.error("Failed to assign operator:", err);
                    }
                  }}
                  disabled={!bank.isActive}
                  className={`w-full h-8 border-2 ${!bank.isActive ? 'border-gray-600 opacity-50 cursor-not-allowed' : 'border-secondary'} bg-card text-foreground font-black text-xs p-1`}
                >
                  <option value="">-- Kullanıcı Seç --</option>
                  {operators?.map((op: any) => {
                    const assignedElsewhere = banks?.some((b: any) => b.id !== bank.id && b.assignedOperatorId === op.id);
                    return (
                      <option key={op.id} value={op.id} disabled={!!assignedElsewhere}>
                        {op.name}{assignedElsewhere ? ` (BANKO ${banks?.find((b: any) => b.assignedOperatorId === op.id)?.bankNumber})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            ))}
          </div>

          <div className="border-4 border-secondary p-4 mb-4">
            <h3 className="text-lg font-black neon-blue mb-3" style={{ textShadow: "0 0 10px currentColor" }}>KULLANICI YÖNETİMİ</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Kullanıcı adı"
                value={newOperatorName}
                onChange={(e) => setNewOperatorName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newOperatorName.trim()) {
                    await createBankOperatorMutation.mutateAsync({ name: newOperatorName.trim() });
                    setNewOperatorName("");
                    refetchOperators();
                  }
                }}
                className="w-28 h-10 border-2 border-primary bg-card text-foreground font-black text-sm p-2"
              />
              <Button
                onClick={async () => {
                  if (!newOperatorName.trim()) return;
                  await createBankOperatorMutation.mutateAsync({ name: newOperatorName.trim() });
                  setNewOperatorName("");
                  refetchOperators();
                }}
                className="h-10 px-4 font-black text-xs bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-primary"
              >
                EKLE
              </Button>
            </div>
            <div className="space-y-1">
              {operators?.map((op: any) => (
                <div key={op.id} className="flex items-center justify-between border border-secondary p-2">
                  {editingOperatorId === op.id ? (
                    <div className="flex items-center gap-1 flex-1 mr-2">
                      <input
                        type="text"
                        value={editingOperatorName}
                        onChange={(e) => setEditingOperatorName(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && editingOperatorName.trim()) {
                            await updateBankOperatorMutation.mutateAsync({ id: op.id, name: editingOperatorName.trim() });
                            setEditingOperatorId(null);
                            setEditingOperatorName("");
                            refetchOperators();
                          }
                          if (e.key === "Escape") {
                            setEditingOperatorId(null);
                            setEditingOperatorName("");
                          }
                        }}
                        className="flex-1 h-6 border border-primary bg-card text-foreground font-black text-xs p-1"
                        autoFocus
                      />
                      <Button
                        onClick={async () => {
                          if (!editingOperatorName.trim()) return;
                          await updateBankOperatorMutation.mutateAsync({ id: op.id, name: editingOperatorName.trim() });
                          setEditingOperatorId(null);
                          setEditingOperatorName("");
                          refetchOperators();
                        }}
                        className="h-6 px-2 font-black text-xs bg-green-600 hover:bg-green-700 text-white border border-green-600"
                      >
                        KAYDET
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm font-bold">{op.name}</span>
                  )}
                  <div className="flex gap-1">
                    {editingOperatorId !== op.id && (
                      <Button
                        onClick={() => {
                          setEditingOperatorId(op.id);
                          setEditingOperatorName(op.name);
                        }}
                        className="h-6 px-2 font-black text-xs bg-blue-600 hover:bg-blue-700 text-white border border-blue-600"
                      >
                        DÜZENLE
                      </Button>
                    )}
                    <Button
                      onClick={async () => {
                        await deleteBankOperatorMutation.mutateAsync({ id: op.id });
                        refetchOperators();
                        refetchBanks();
                      }}
                      className="h-6 px-2 font-black text-xs bg-red-600 hover:bg-red-700 text-white border border-red-600"
                    >
                      SİL
                    </Button>
                  </div>
                </div>
              ))}
              {(!operators || operators.length === 0) && (
                <p className="text-xs text-foreground/60">Henüz kullanıcı eklenmemiş</p>
              )}
            </div>
          </div>

          <Button
            onClick={() => {
              resetQueueMutation.mutate(undefined);
            }}
            className="w-full h-12 font-black bg-red-600 hover:bg-red-700 text-white border-4 border-red-600"
          >
            KUYRUĞU SIFIRLA
          </Button>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="border-4 border-primary p-6 mb-8 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
            <h2 className="text-3xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor" }}>İSTATİSTİKLER</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border-4 border-secondary p-4 text-center">
                <p className="text-sm text-foreground/60 mb-2">Toplam Tamamlanan</p>
                <p className="text-3xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>{stats.totalCompleted || 0}</p>
              </div>
              <div className="border-4 border-secondary p-4 text-center">
                <p className="text-sm text-foreground/60 mb-2">Bekleme Süresi (Ort.)</p>
                <p className="text-3xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>{Math.round(stats.averageWaitTime || 0)}s</p>
              </div>
              <div className="border-4 border-secondary p-4 text-center">
                <p className="text-sm text-foreground/60 mb-2">Hizmet Süresi (Ort.)</p>
                <p className="text-3xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>{Math.round(stats.averageServiceTime || 0)}s</p>
              </div>
              <div className="border-4 border-secondary p-4 text-center">
                <p className="text-sm text-foreground/60 mb-2">Aktif Sıra</p>
                <p className="text-3xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>{stats.waitingCount || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Printer Settings Section */}
        <div className="border-4 border-primary p-6 mb-8 relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
          <h2 className="text-3xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor" }}>YAZICI AYARLARI</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Windows Printer Selection */}
            <div className="border-4 border-secondary p-6">
              <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
                WINDOWS YAZICI SEÇ
              </label>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-foreground/60 mb-2">Mevcut Yazıcılar ({windowsPrinters?.length || 0})</p>
                  {windowsPrinters && windowsPrinters.length === 0 && (
                    <p className="text-xs text-red-500 mb-2">Windows yazıcı bulunamadı</p>
                  )}
                  <select 
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="w-full h-12 border-4 border-primary bg-card text-foreground font-black text-lg p-2"
                  >
                    <option value="">-- Yazıcı Seçin --</option>
                    {windowsPrinters && windowsPrinters.map((printer: any, idx: number) => (
                      <option key={idx} value={printer.name}>
                        {printer.name} {printer.isDefault ? "(Varsayılan)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={() => refetchWindowsPrinters()}
                  className="w-full h-12 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary neon-glow"
                >
                  YAZICILAR LİSTESİNİ YENILE
                </Button>
                {selectedPrinter && (
                  <Button
                    onClick={handleSavePrinter}
                    className="w-full h-12 font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground border-4 border-secondary"
                  >
                    SEÇİLİ YAZICIYI KAYDET
                  </Button>
                )}
              </div>
            </div>

            {/* Printer Status */}
            <div className="border-4 border-secondary p-6">
              <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
                YAZICI DURUMU
              </label>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-foreground/60 mb-2">Yazıcı Aktif</p>
                    <p className="text-2xl font-black text-green-400" style={{ textShadow: "0 0 10px currentColor" }}>
                      ✓ AÇIK
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (selectedPrinter) {
                      console.log('[AdminPanel] Test printer clicked:', selectedPrinter);
                      testWindowsPrinterMutation.mutate({ printerName: selectedPrinter }, {
                      onSuccess: (result) => {
                        toast.success(`✓ ${result.message}`);
                      },
                      onError: () => {
                        toast.error(`✗ Yazıcı testi başarısız`);
                      }
                      });
                    } else {
                      toast.error("Lütfen bir yazıcı seçin");
                    }
                  }}
                  disabled={testWindowsPrinterMutation.isPending}
                  className="w-full h-12 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary neon-glow"
                >
                  TEST YAZDIRMASI YAP
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Label Design Section */}
        <div className="border-4 border-primary p-6 mb-8 relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
          <h2 className="text-3xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor" }}>ETİKET TASARIMI</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Label Settings Form */}
            <div className="space-y-4">
              {/* Label Selector */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-2 text-foreground/80">Etiket Seç</label>
                  <select
                    value={selectedLabelId}
                    onChange={(e) => setSelectedLabelId(parseInt(e.target.value))}
                    className="w-full border-2 border-primary/50 bg-background text-foreground p-2 rounded"
                  >
                    {allLabels && allLabels.map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.labelName} {l.isActive ? "(Varsayılan)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={async () => {
                    const name = prompt("Yeni etiket adı:");
                    if (!name) return;
                    try {
                      await createLabelMutation.mutateAsync({ labelName: name });
                      await refetchLabels();
                      toast.success("✓ Yeni etiket oluşturuldu");
                    } catch {
                      toast.error("✗ Oluşturulamadı");
                    }
                  }}
                  className="h-12 font-black bg-green-600 hover:bg-green-700 text-white border-4 border-green-600"
                >
                  + YENİ
                </Button>
              </div>

              {/* Label Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (!selectedLabelId) return;
                    try {
                      await setDefaultLabelMutation.mutateAsync({ labelId: selectedLabelId });
                      await refetchLabels();
                      toast.success("✓ Varsayılan etiket güncellendi");
                    } catch {
                      toast.error("✗ Güncellenemedi");
                    }
                  }}
                  disabled={!selectedLabelId || (allLabels || []).find((l: any) => l.id === selectedLabelId)?.isActive}
                  className="flex-1 h-10 font-black bg-blue-600 hover:bg-blue-700 text-white border-4 border-blue-600 text-sm"
                >
                  VARSAYILAN YAP
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedLabelId) return;
                    const label = (allLabels || []).find((l: any) => l.id === selectedLabelId);
                    if (label?.isActive) {
                      toast.error("Varsayılan etiket silinemez. Önce başka bir etiketi varsayılan yapın.");
                      return;
                    }
                    if (!confirm("Bu etiketi silmek istediğinize emin misiniz?")) return;
                    try {
                      await deleteLabelMutation.mutateAsync({ labelId: selectedLabelId });
                      await refetchLabels();
                      setSelectedLabelId((allLabels || []).find((l: any) => l.id !== selectedLabelId)?.id || 1);
                      toast.success("✓ Silindi");
                    } catch {
                      toast.error("✗ Silinemedi");
                    }
                  }}
                  disabled={!selectedLabelId}
                  className="h-10 font-black bg-red-600 hover:bg-red-700 text-white border-4 border-red-600 text-sm"
                >
                  SİL
                </Button>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-foreground/80">Etiket Adı</label>
                <Input
                  type="text"
                  placeholder="Varsayılan Etiket"
                  value={labelSettings.labelName || ""}
                  onChange={(e) => setLabelSettings({ ...labelSettings, labelName: e.target.value })}
                  className="w-full border-2 border-primary/50 bg-background text-foreground"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-2 text-foreground/80">Etiket Türü</label>
                <select
                  value={labelSettings.labelType || "ticket"}
                  onChange={(e) => setLabelSettings({ ...labelSettings, labelType: e.target.value })}
                  className="w-full border-2 border-primary/50 bg-background text-foreground p-2 rounded"
                >
                  <option value="ticket">Bilet</option>
                  <option value="sticker">Etiket</option>
                  <option value="card">Kart</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground/80">Genişlik (mm)</label>
                  <Input
                    type="number"
                    placeholder="58"
                    value={labelSettings.width || 58}
                    onChange={(e) => setLabelSettings({ ...labelSettings, width: parseInt(e.target.value) })}
                    className="w-full border-2 border-primary/50 bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground/80">Yükseklik (mm)</label>
                  <Input
                    type="number"
                    placeholder="30"
                    value={labelSettings.height || 30}
                    onChange={(e) => setLabelSettings({ ...labelSettings, height: parseInt(e.target.value) })}
                    className="w-full border-2 border-primary/50 bg-background text-foreground"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-2 text-foreground/80">Başlık Metni</label>
                <Input
                  type="text"
                  placeholder="Başlık"
                  value={labelSettings.headerText || ""}
                  onChange={(e) => setLabelSettings({ ...labelSettings, headerText: e.target.value })}
                  className="w-full border-2 border-primary/50 bg-background text-foreground"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-2 text-foreground/80">Alt Metin</label>
                <Input
                  type="text"
                  placeholder="Alt metin"
                  value={labelSettings.footerText || ""}
                  onChange={(e) => setLabelSettings({ ...labelSettings, footerText: e.target.value })}
                  className="w-full border-2 border-primary/50 bg-background text-foreground"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground/80">Arka Plan Rengi</label>
                  <Input
                    type="color"
                    value={labelSettings.backgroundColor || "#ffffff"}
                    onChange={(e) => setLabelSettings({ ...labelSettings, backgroundColor: e.target.value })}
                    className="w-full h-10 border-2 border-primary/50 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground/80">Metin Rengi</label>
                  <Input
                    type="color"
                    value={labelSettings.textColor || "#000000"}
                    onChange={(e) => setLabelSettings({ ...labelSettings, textColor: e.target.value })}
                    className="w-full h-10 border-2 border-primary/50 cursor-pointer"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={labelSettings.showQRCode || false}
                    onChange={(e) => setLabelSettings({ ...labelSettings, showQRCode: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-bold text-foreground/80">QR Kod Göster</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={labelSettings.showBarcode || false}
                    onChange={(e) => setLabelSettings({ ...labelSettings, showBarcode: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-bold text-foreground/80">Barkod Göster</span>
                </label>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={labelSettings.showDateTime || false}
                    onChange={(e) => setLabelSettings({ ...labelSettings, showDateTime: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-bold text-foreground/80">Tarih/Saat Göster</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={labelSettings.showBankInfo || false}
                    onChange={(e) => setLabelSettings({ ...labelSettings, showBankInfo: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-bold text-foreground/80">Banko Bilgisi Göster</span>
                </label>
              </div>
              
              <Button
                onClick={() => {
                  updateLabelSettingsMutation.mutate(
                    {
                      labelId: selectedLabelId,
                      ...labelSettings,
                    },
                    {
                      onSuccess: () => {
                        toast.success('✓ Etiket tasarımı kaydedildi');
                        refetchLabels();
                      },
                      onError: (error) => {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        toast.error('✗ Etiket tasarımı kaydedilemedi: ' + errorMsg);
                      },
                    }
                  );
                }}
                disabled={updateLabelSettingsMutation.isPending}
                className="w-full h-12 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary neon-glow"
              >
                {updateLabelSettingsMutation.isPending ? 'KAYDEDILIYOR...' : 'KAYDET'}
              </Button>
            </div>
            
            {/* Label Preview */}
            <div className="border-2 border-primary/50 p-4 bg-background/50 rounded">
              <h3 className="text-lg font-bold mb-4 text-foreground/80">Önizleme</h3>
              <div
                className="border-2 rounded overflow-hidden mx-auto"
                style={{
                  width: Math.min(280, (labelSettings.width || 58) * 3.5),
                  minHeight: Math.min(200, (labelSettings.height || 30) * 3.5),
                  backgroundColor: labelSettings.backgroundColor || '#ffffff',
                  color: labelSettings.textColor || '#000000',
                  borderColor: labelSettings.borderStyle !== 'none' ? (labelSettings.textColor || '#000000') : 'transparent',
                  borderWidth: labelSettings.borderStyle !== 'none' ? (labelSettings.borderWidth || 1) + 'px' : '0',
                  borderStyle: labelSettings.borderStyle !== 'none' ? (labelSettings.borderStyle || 'solid') : 'none',
                }}
              >
                <div className="p-3 flex flex-col items-center justify-between h-full" style={{ minHeight: 'inherit' }}>
                  {labelSettings.headerText && (
                    <div className="text-center font-bold mb-1" style={{ fontSize: `${Math.min(14, (labelSettings.headerFontSize || 12) * 0.5)}px` }}>
                      {labelSettings.headerText}
                    </div>
                  )}
                  <div className="border-t border-b border-dashed w-full my-1" style={{ borderColor: labelSettings.textColor || '#000000', opacity: 0.3 }} />
                  <div className="text-center font-black tracking-widest" style={{ fontSize: '28px' }}>
                    TEST
                  </div>
                  {labelSettings.showBankInfo && (
                    <div className="text-center text-xs">Banko: 1</div>
                  )}
                  {labelSettings.showDateTime && (
                    <div className="text-center text-xs">{new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR')}</div>
                  )}
                  {labelSettings.showQRCode && (
                    <div className="text-center text-xs border p-1 mt-1" style={{ borderColor: labelSettings.textColor || '#000000', opacity: 0.5 }}>
                      [QR]
                    </div>
                  )}
                  {labelSettings.showBarcode && (
                    <div className="text-center text-xs border p-1" style={{ borderColor: labelSettings.textColor || '#000000', opacity: 0.5 }}>
                      [BARCODE]
                    </div>
                  )}
                  <div className="border-t border-b border-dashed w-full my-1" style={{ borderColor: labelSettings.textColor || '#000000', opacity: 0.3 }} />
                  {labelSettings.footerText && (
                    <div className="text-center text-xs">{labelSettings.footerText}</div>
                  )}
                </div>
              </div>
              {/* Test Print Button */}
              <Button
                onClick={() => {
                  if (!selectedPrinter) {
                    toast.error("Lütfen önce Yazıcı Ayarları bölümünden bir yazıcı seçin");
                    return;
                  }
                  testWindowsPrinterMutation.mutate(
                    { printerName: selectedPrinter, labelSettings },
                    {
                      onSuccess: (result) => toast.success(result.message || '✓ Test yazdırması gönderildi'),
                      onError: (err) => toast.error('✗ Test başarısız: ' + (err instanceof Error ? err.message : String(err))),
                    }
                  );
                }}
                disabled={testWindowsPrinterMutation.isPending || !selectedPrinter}
                className="w-full h-10 font-black bg-green-600 hover:bg-green-700 text-white border-4 border-green-600 mt-4"
              >
                {testWindowsPrinterMutation.isPending ? 'YAZDIRILIYOR...' : 'TEST YAZDIR'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
