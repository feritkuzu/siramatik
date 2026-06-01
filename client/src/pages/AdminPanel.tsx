import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


export default function AdminPanel() {
  const [bankCount, setBankCount] = useState(2);

  // Fetch system config
  const { data: config, refetch: refetchConfig } = trpc.admin.getConfig.useQuery(undefined, {
    refetchInterval: 2000,
  });

  // Fetch all banks
  const { data: banks, refetch: refetchBanks } = trpc.bank.getAll.useQuery(undefined, {
    refetchInterval: 2000,
  });

  // Fetch queue stats
  const { data: stats, refetch: refetchStats } = trpc.queue.getStats.useQuery(undefined, {
    refetchInterval: 2000,
  });

  // Mutations
  const initSystemMutation = trpc.admin.initialize.useMutation();
  const updateBankCountMutation = trpc.admin.updateBankCount.useMutation();
  const toggleBankMutation = trpc.admin.toggleBankStatus.useMutation();
  const resetQueueMutation = trpc.admin.resetQueue.useMutation();
  const testPrinterMutation = trpc.admin.testPrinter.useMutation();
  
  // Queries
  const { data: usbPrinters } = trpc.admin.listUSBPrinters.useQuery();
  
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

  // Sound settings state
  const [soundSettings, setSoundSettings] = useState<any>({
    soundType: "chime",
    soundVolume: 70,
    isEnabled: true,
    animationType: "pulse",
    animationSpeed: "normal",
  });
  const [showSoundSettings, setShowSoundSettings] = useState(false);

  // Sound settings queries and mutations
  const { data: fetchedSoundSettings } = trpc.admin.getSoundSettings.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const updateSoundSettingsMutation = trpc.admin.updateSoundSettings.useMutation();

  // Socket.io connection
  const { on, emit } = useSocket("admin");

  useEffect(() => {
    if (config && config.totalBanks) {
      setBankCount(config.totalBanks);
    }
  }, [config]);

  useEffect(() => {
    if (fetchedSoundSettings && fetchedSoundSettings.soundType) {
      setSoundSettings(fetchedSoundSettings);
    }
  }, [fetchedSoundSettings]);



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
      if (bankCount < 2 || bankCount > 10) {
        alert("Banko sayısı 2 ile 10 arasında olmalıdır");
        return;
      }
      await updateBankCountMutation.mutateAsync({ count: bankCount });
      
      // Emit socket event
      emit("system:configUpdated", {
        totalBanks: bankCount,
        timestamp: Date.now(),
      });
      
      await refetchConfig();
      await refetchBanks();
    } catch (error) {
      console.error("Failed to update bank count:", error);
    }
  };

  const handleToggleBankStatus = async (bankId: number, isActive: boolean) => {
    try {
      await toggleBankMutation.mutateAsync({ bankId });
      
      // Emit socket event
      emit("bank:statusChanged", {
        bankId,
        isOccupied: false,
        isActive: !isActive,
        timestamp: Date.now(),
      });
      
      await refetchBanks();
    } catch (error) {
      console.error("Failed to toggle bank status:", error);
    }
  };

  const handleResetQueue = async () => {
    try {
      await resetQueueMutation.mutateAsync();
      
      // Emit socket event
      emit("system:configUpdated", {
        totalBanks: config?.totalBanks || 2,
        timestamp: Date.now(),
      });
      
      await refetchConfig();
      await refetchStats();
    } catch (error) {
      console.error("Failed to reset queue:", error);
    }
  };
  
  const handleExportStatsCSV = async () => {
    // TODO: Implement export stats CSV
    console.log("Export stats CSV - Coming soon");
  };
  
  const handleExportStatsPDF = async () => {
    // TODO: Implement export stats PDF
    console.log("Export stats PDF - Coming soon");
  };
  
  const handleExportLogsCSV = async () => {
    // TODO: Implement export logs CSV
    console.log("Export logs CSV - Coming soon");
  };
  
  const handleExportLogsPDF = async () => {
    // TODO: Implement export logs PDF
    console.log("Export logs PDF - Coming soon");
  };

  return (
    <div className="w-full min-h-screen bg-background p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="border-2 sm:border-3 md:border-4 border-primary p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 md:mb-8 relative">
        <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary" />
        <div className="absolute top-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary" />
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black neon-pink mb-1 sm:mb-2" style={{ textShadow: "0 0 10px currentColor, 0 0 20px currentColor" }}>ADMİN YÖNETİM PANELİ</h1>
        <p className="text-xs sm:text-sm md:text-base lg:text-lg neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>Sistem Kontrol ve Ayarları</p>
      </div>

      {/* System Initialization */}
      {true && (
        <div className="border-4 border-primary p-6 mb-8 relative bg-red-900/20">
          <h2 className="text-3xl font-black neon-pink mb-4" style={{ textShadow: "0 0 10px currentColor" }}>SİSTEM BAŞLATMA</h2>
          <p className="text-lg neon-blue mb-6">Sistemi başlatmak için banko sayısını seçin ve BAŞLAT butonuna tıklayın.</p>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-lg font-black neon-blue mb-2">BANKO SAYISI (2-10)</label>
              <Input
                type="number"
                min="2"
                max="10"
                value={bankCount}
                onChange={(e) => setBankCount(parseInt(e.target.value) || 2)}
                className="text-2xl font-black h-12 border-4 border-primary bg-card text-foreground"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                console.log("BAŞLAT butonuna tıklandı, bankCount:", bankCount);
                initSystemMutation.mutate({ bankCount }, {
                  onSuccess: () => {
                    console.log("Sistem başlatıldı");
                    refetchConfig();
                    refetchBanks();
                  },
                  onError: (error) => {
                    console.error("Sistem başlatma hatası:", error);
                  }
                });
              }}
              disabled={initSystemMutation.isPending}
              className="h-12 px-8 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary neon-glow cursor-pointer"
            >
              {initSystemMutation.isPending ? "BAŞLATILIYOR..." : "BAŞLAT"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8 mb-4 sm:mb-6 md:mb-8">
        {/* System Status */}
        <div className="border-2 sm:border-3 md:border-4 border-secondary p-3 sm:p-4 md:p-6 relative">
          <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary pointer-events-none" />
          <h2 className="text-sm sm:text-base md:text-lg lg:text-2xl font-black neon-blue mb-2 sm:mb-3 md:mb-4" style={{ textShadow: "0 0 10px currentColor" }}>SİSTEM DURUMU</h2>
          <div className="space-y-2 sm:space-y-3">
            <div>
              <p className="text-xs sm:text-sm text-foreground/60">Sistem Aktif</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-green-400" style={{ textShadow: "0 0 10px currentColor" }}>
              {config?.isSystemActive ? "✓ AÇIK" : "✗ KAPAL"}
            </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-foreground/60">Aktif Bankalar</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-black neon-pink" style={{ textShadow: "0 0 10px currentColor" }}>
              {banks?.filter((b: any) => b.isActive).length || 0}
            </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-foreground/60">Meşgul Bankalar</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>
              {banks?.filter((b: any) => b.isOccupied).length || 0}
            </p>
            </div>
          </div>
        </div>

        {/* Queue Statistics */}
        <div className="border-2 sm:border-3 md:border-4 border-secondary p-3 sm:p-4 md:p-6 relative">
          <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary pointer-events-none" />
          <h2 className="text-sm sm:text-base md:text-lg lg:text-2xl font-black neon-blue mb-2 sm:mb-3 md:mb-4" style={{ textShadow: "0 0 10px currentColor" }}>KUYRUK İSTATİSTİĞİ</h2>
          <div className="space-y-2 sm:space-y-3">
            <div>
              <p className="text-xs sm:text-sm text-foreground/60">Toplam Bilet</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-black neon-pink" style={{ textShadow: "0 0 10px currentColor" }}>{stats?.totalCompleted || 0}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-foreground/60">Bekleme Sayısı</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>{stats?.waitingCount || 0}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-foreground/60">Hizmet Verilen</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-black text-green-400" style={{ textShadow: "0 0 10px currentColor" }}>{stats?.totalProcessed || 0}</p>
            </div>
          </div>
        </div>

        {/* Timing Statistics */}
        <div className="border-2 sm:border-3 md:border-4 border-secondary p-3 sm:p-4 md:p-6 relative">
          <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary pointer-events-none" />
          <h2 className="text-sm sm:text-base md:text-lg lg:text-2xl font-black neon-blue mb-2 sm:mb-3 md:mb-4" style={{ textShadow: "0 0 10px currentColor" }}>ZAMAN İSTATİSTİĞİ</h2>
          <div className="space-y-2 sm:space-y-3">
            <div>
              <p className="text-xs sm:text-sm text-foreground/60">Ort. Bekleme Süresi</p>
              <p className="text-lg sm:text-xl md:text-2xl font-black neon-pink" style={{ textShadow: "0 0 10px currentColor" }}>
                {Math.round((stats?.averageWaitTime || 0) / 1000)}s
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-foreground/60">Ort. Hizmet Süresi</p>
              <p className="text-lg sm:text-xl md:text-2xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>
                {Math.round((stats?.averageServiceTime || 0) / 1000)}s
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sound and Animation Settings */}
      <div className="border-4 border-primary p-6 mb-8 relative">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
        <h2 className="text-3xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor" }}>SES VE ANİMASYON AYARLARI</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Sound Type */}
          <div className="border-4 border-secondary p-6">
            <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
              SES TÜRÜ
            </label>
            <select
              value={soundSettings.soundType}
              onChange={(e) => setSoundSettings({ ...soundSettings, soundType: e.target.value as any })}
              className="w-full h-12 font-black border-4 border-secondary bg-card text-foreground px-4"
            >
              <option value="chime">Çan Sesi</option>
              <option value="bell">Zil Sesi</option>
              <option value="alarm">Alarm Sesi</option>
              <option value="beep">Bip Sesi</option>
              <option value="siren">Siren Sesi</option>
              <option value="notification">Bildirim Sesi</option>
            </select>
          </div>

          {/* Sound Volume */}
          <div className="border-4 border-secondary p-6">
            <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
              SES SEVİYESİ: {soundSettings.soundVolume}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={soundSettings.soundVolume}
              onChange={(e) => setSoundSettings({ ...soundSettings, soundVolume: parseInt(e.target.value) })}
              className="w-full h-4 border-4 border-secondary"
            />
          </div>

          {/* Animation Type */}
          <div className="border-4 border-secondary p-6">
            <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
              ANİMASYON TÜRÜ
            </label>
            <select
              value={soundSettings.animationType}
              onChange={(e) => setSoundSettings({ ...soundSettings, animationType: e.target.value as any })}
              className="w-full h-12 font-black border-4 border-secondary bg-card text-foreground px-4"
            >
              <option value="pulse">Nabız</option>
              <option value="flash">Flaş</option>
              <option value="bounce">Sıçrama</option>
              <option value="shake">Titreme</option>
              <option value="rainbow">Gökkuşağı</option>
              <option value="glow">Işıltı</option>
            </select>
          </div>

          {/* Animation Speed */}
          <div className="border-4 border-secondary p-6">
            <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
              ANİMASYON HIZI
            </label>
            <select
              value={soundSettings.animationSpeed}
              onChange={(e) => setSoundSettings({ ...soundSettings, animationSpeed: e.target.value as any })}
              className="w-full h-12 font-black border-4 border-secondary bg-card text-foreground px-4"
            >
              <option value="slow">Yavaş</option>
              <option value="normal">Normal</option>
              <option value="fast">Hızlı</option>
            </select>
          </div>
        </div>

        {/* Sound Enable Toggle */}
        <div className="border-4 border-secondary p-6 mb-6">
          <label className="flex items-center gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={soundSettings.isEnabled}
              onChange={(e) => setSoundSettings({ ...soundSettings, isEnabled: e.target.checked })}
              className="w-6 h-6 border-4 border-secondary"
            />
            <span className="text-lg font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>
              SES VE ANİMASYONLARI ETKINLEŞTIR
            </span>
          </label>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleUpdateSoundSettings}
          disabled={ updateSoundSettingsMutation.isPending}
          className="w-full h-12 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary"
        >
          {updateSoundSettingsMutation.isPending ? "KAYDEDILIYOR..." : "AYARLARI KAYDET"}
        </Button>
      </div>

      {/* Bank Configuration */}
      <div className="border-4 border-primary p-6 mb-8 relative">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
        <h2 className="text-3xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor" }}>BANKO AYARLARI</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Bank Count Control */}
          <div className="border-4 border-secondary p-6">
            <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
              BANKO SAYISI (2-10)
            </label>
            <div className="flex gap-4 items-end">
              <Input
                type="number"
                min="2"
                max="10"
                value={bankCount}
                onChange={(e) => setBankCount(parseInt(e.target.value))}
                className="text-2xl font-black h-12 border-4 border-primary bg-card text-foreground"
              />
              <Button
                onClick={handleUpdateBankCount}
                disabled={false}
                className="h-12 px-6 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary neon-glow"
              >
                GÜNCELLE
              </Button>
            </div>
          </div>

          {/* Reset Queue */}
          <div className="border-4 border-secondary p-6">
            <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
              KUYRUK KONTROL
            </label>
            <Button
              onClick={handleResetQueue}
              disabled={false}
              className="w-full h-12 font-black bg-destructive hover:bg-destructive/90 text-destructive-foreground border-4 border-destructive neon-glow"
            >
              KUYRUK SIFIRLA
            </Button>
          </div>
        </div>

        {/* Bank List */}
        <div className="mb-6">
          <h3 className="text-2xl font-black neon-pink mb-4" style={{ textShadow: "0 0 10px currentColor" }}>BANKO LİSTESİ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {banks?.map((bank: any) => (
              <div
                key={bank.id}
                className="border-4 border-secondary p-4 flex flex-col gap-3"
              >
                <div className="text-2xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>
                  BANKO {bank.bankNumber}
                </div>
                <div className="flex gap-2 text-sm">
                  <span className={bank.isActive ? "text-green-400" : "text-red-400"}>
                    {bank.isActive ? "● AÇIK" : "● KAPAL"}
                  </span>
                  <span className={bank.isOccupied ? "neon-pink" : "text-foreground/60"} style={bank.isOccupied ? { textShadow: "0 0 10px currentColor" } : {}}>
                    {bank.isOccupied ? "MEŞGUL" : "BOŞ"}
                  </span>
                </div>
                <div className="text-sm text-foreground/60">
                  Hizmet Verilen: {bank.totalServed}
                </div>
                <Button
                  onClick={() => handleToggleBankStatus(bank.id, bank.isActive)}
                  className={`w-full h-10 font-black border-4 ${
                    bank.isActive
                      ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive"
                      : "bg-green-600 hover:bg-green-700 text-white border-green-600"
                  }`}
                >
                  {bank.isActive ? "KAPAT" : "AÇ"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Printer Settings Section */}
      <div className="border-4 border-primary p-6 mb-8 relative">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
        <h2 className="text-3xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor" }}>YAZICI AYARLARI</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  testPrinterMutation.mutate(undefined, {
                    onSuccess: (result) => {
                      alert(result.message);
                    },
                    onError: (error) => {
                      alert("Yazıcı testi başarısız");
                    }
                  });
                }}
                disabled={testPrinterMutation.isPending}
                className="w-full h-12 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary neon-glow"
              >
                TEST YAZDIRMASI YAP
              </Button>
            </div>
          </div>

          {/* USB Printers */}
          <div className="border-4 border-secondary p-6">
            <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
              MEVCUT USB YAZICILAR
            </label>
            <div>
              <p className="text-sm text-foreground/60 mb-4">Sisteme bağlı USB yazıcıları listele</p>
              {usbPrinters && usbPrinters.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {usbPrinters.map((printer: any, idx: number) => (
                    <div key={idx} className="text-sm text-foreground/80 border border-secondary p-2">
                      Yazıcı {idx + 1}: VID=0x{printer.vendorId?.toString(16)}, PID=0x{printer.productId?.toString(16)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground/60 mb-4">USB yazıcı bulunamadı</p>
              )}
              <Button
                onClick={() => {
                  if (usbPrinters && usbPrinters.length > 0) {
                    alert(`${usbPrinters.length} yazıcı bulundu`);
                  } else {
                    alert("USB yazıcı bulunamadı");
                  }
                }}
                className="w-full h-12 font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground border-4 border-secondary"
              >
                YAZICILAR LİSTESİNİ GÖSTER
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Email Section */}
      <div className="border-4 border-primary p-6 mb-8 relative">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
        <h2 className="text-3xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor" }}>EMAIL GONDERIMI</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Email Recipient */}
          <div className="border-4 border-secondary p-6">
            <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
              ALICI EMAIL
            </label>
            <Input
              type="email"
              placeholder="ornek@email.com"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              className="text-lg font-black h-12 border-4 border-primary bg-card text-foreground mb-4"
            />
            <Button
              onClick={() => console.log("Send test email - Coming soon")}
              disabled={true}
              className="w-full h-12 font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground border-4 border-secondary"
            >
              TEST EMAIL GONDER (Yakında)
            </Button>
          </div>
          
          {/* Report Date Range */}
          <div className="border-4 border-secondary p-6">
            <label className="block text-lg font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
              RAPOR TARIH ARALIGI
            </label>
            <div className="flex gap-2 mb-4">
              <Input
                type="date"
                value={emailStartDate}
                onChange={(e) => setEmailStartDate(e.target.value)}
                className="flex-1 font-black h-10 border-4 border-primary bg-card text-foreground"
              />
              <Input
                type="date"
                value={emailEndDate}
                onChange={(e) => setEmailEndDate(e.target.value)}
                className="flex-1 font-black h-10 border-4 border-primary bg-card text-foreground"
              />
            </div>
            <Button
              onClick={() => console.log("Send report email - Coming soon")}
              disabled={true}
              className="w-full h-12 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary"
            >
              RAPOR GONDER
            </Button>
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="border-4 border-primary p-6 mb-8 relative">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
        <h2 className="text-3xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor" }}>DIŞA AKTARMA</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Statistics Export */}
          <div className="border-4 border-secondary p-6">
            <h3 className="text-xl font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>İSTATİSTİKLER</h3>
            <div className="flex gap-4">
              <Button
                onClick={handleExportStatsCSV}
                disabled={false}
                className="flex-1 h-12 font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground border-4 border-secondary"
              >
                CSV İNDİR
              </Button>
              <Button
                onClick={handleExportStatsPDF}
                disabled={false}
                className="flex-1 h-12 font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground border-4 border-secondary"
              >
                PDF İNDİR
              </Button>
            </div>
          </div>
          
          {/* Logs Export */}
          <div className="border-4 border-secondary p-6">
            <h3 className="text-xl font-black neon-blue mb-4" style={{ textShadow: "0 0 10px currentColor" }}>SİSTEM LOGLARI</h3>
            <div className="flex gap-4">
              <Button
                onClick={handleExportLogsCSV}
                disabled={false}
                className="flex-1 h-12 font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground border-4 border-secondary"
              >
                CSV İNDİR
              </Button>
              <Button
                onClick={handleExportLogsPDF}
                disabled={false}
                className="flex-1 h-12 font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground border-4 border-secondary"
              >
                PDF İNDİR
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-4 border-primary p-4 text-center text-sm text-foreground/60">
        <span className="neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>● CANLI</span> - Sistem Aktif - Son Güncelleme: {new Date().toLocaleTimeString("tr-TR")}
      </div>
    </div>
  );
}
