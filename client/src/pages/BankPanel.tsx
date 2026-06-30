import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";

function getIpc() {
  try {
    const api = (window as any).electronAPI;
    if (api) {
      return {
        send: (channel: string) => {
          if (channel === "window-minimize") api.minimize();
          else if (channel === "window-close") api.close();
        }
      };
    }
    const electron = (window as any).require?.("electron");
    if (electron?.ipcRenderer) return electron.ipcRenderer;
  } catch (_) {}
  return null;
}

async function getMacAddress(): Promise<string | null> {
  try {
    const os = (window as any).require?.("os");
    if (os) {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
            return iface.mac;
          }
        }
      }
    }
  } catch (_) {}
  let machineId = localStorage.getItem("bank-machine-id");
  if (!machineId) {
    machineId = crypto.randomUUID();
    localStorage.setItem("bank-machine-id", machineId);
  }
  return machineId;
}

export default function BankPanel() {
  const [currentCustomer, setCurrentCustomer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<{ id: number; name: string } | null>(() => {
    const stored = sessionStorage.getItem("bank-operator");
    return stored ? JSON.parse(stored) : null;
  });

  const ipc = getIpc();
  const isElectron = !!ipc;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { data: banks, refetch: refetchBanks } = trpc.bank.getAll.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const { data: config } = trpc.admin.getConfig.useQuery(undefined, { refetchInterval: 15000 });

  const [macAddress, setMacAddress] = useState<string | null>(null);

  useEffect(() => {
    getMacAddress().then(setMacAddress);
  }, []);

  const { data: myBank, isLoading: isMyBankLoading } = trpc.bank.getMyBank.useQuery(
    macAddress ? { macAddress } : undefined,
    { refetchInterval: 30000 }
  );

  const { data: queue } = trpc.queue.getWaitingQueue.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const { data: operators } = trpc.admin.getBankOperators.useQuery();

  const [isReceived, setIsReceived] = useState(false);

  // Apply theme
  useEffect(() => {
    if (config) {
      const c = config as any;
      const root = document.documentElement;
      root.style.setProperty("--background", c.themeBg || "#0d1b2a");
      root.style.setProperty("--foreground", c.themeText || "#e0e1dd");
      root.style.setProperty("--card", c.themeBg || "#0d1b2a");
      root.style.setProperty("--primary", c.themeHeader || "#1b98a0");
      root.style.setProperty("--secondary", c.themeSubheader || "#415a77");
      root.style.setProperty("--border", c.themeBorder || "#1b98a0");
      document.body.style.fontFamily = c.themeFont || "Segoe UI, sans-serif";
    }
  }, [config]);

  const callNextMutation = trpc.queue.callNext.useMutation();
  const callSpecificMutation = trpc.queue.callSpecific.useMutation();
  const markReceivedMutation = trpc.queue.markReceived.useMutation();
  const skipNoShowMutation = trpc.queue.skipNoShow.useMutation();
  const requeueEntryMutation = trpc.queue.requeueEntry.useMutation();
  const completeServiceMutation = trpc.queue.completeService.useMutation();

  const { data: skippedEntries, refetch: refetchSkipped } = trpc.queue.getSkippedEntries.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const { on } = useSocket("bank", myBank?.id || undefined);

  const selectedBank = banks?.find((b: any) => b.id === myBank?.id);

  useEffect(() => {
    if (myBank && banks && !currentCustomer) {
      const bank = banks.find((b: any) => b.id === myBank.id);
      if (bank && bank.currentQueueEntryId) {
        const customer = queue?.find((q: any) => q.id === bank.currentQueueEntryId);
        const c: any = customer;
        if (c) {
          setCurrentCustomer({
            id: c.id,
            ticketNumber: c.ticketNumber ?? c.ticket_number,
            phoneNumber: c.phoneNumber ?? c.phone_number,
          });
        }
      }
    }
  }, [myBank, banks, queue, currentCustomer]);

  useEffect(() => {
    const unsubscribe = on("customer:called", (data: any) => {
      if (myBank && data.bankId === myBank.id) {
        setCurrentCustomer({
          id: data.entryId,
          ticketNumber: data.ticketNumber,
          phoneNumber: data.phoneNumber,
        });
        setIsReceived(false);
      }
    });
    return unsubscribe;
  }, [on, myBank]);

  useEffect(() => {
    const unsubscribe = on("service:completed", (data: any) => {
      if (myBank && data.bankId === myBank.id) {
        setCurrentCustomer(null);
        setIsReceived(false);
      }
    });
    return unsubscribe;
  }, [on, myBank]);

  const handleCallNext = async () => {
    if (!myBank) return;
    if (!selectedOperator) { toast.error("Lütfen önce kullanıcı seçin"); return; }
    setIsLoading(true);
    try {
      const result = await callNextMutation.mutateAsync({ bankId: myBank.id, operatorId: selectedOperator.id });
      setCurrentCustomer({
        id: result.id,
        ticketNumber: result.ticketNumber,
        phoneNumber: result.phoneNumber,
      });
      setIsReceived(false);
      await refetchBanks();
    } catch (error) {
      console.error("Failed to call next customer:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallSpecific = async (entryId: number, ticketNumber: number) => {
    if (!myBank) return;
    if (!selectedOperator) { toast.error("Lütfen önce kullanıcı seçin"); return; }
    setIsLoading(true);
    try {
      const result = await callSpecificMutation.mutateAsync({ bankId: myBank.id, entryId, operatorId: selectedOperator.id });
      setCurrentCustomer({
        id: result.id,
        ticketNumber: result.ticketNumber,
        phoneNumber: result.phoneNumber,
      });
      setIsReceived(false);
      await refetchBanks();
    } catch (error) {
      console.error("Failed to call specific customer:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteService = async () => {
    if (!myBank || !currentCustomer) return;
    setIsLoading(true);
    try {
      await completeServiceMutation.mutateAsync({
        bankId: myBank.id,
        entryId: currentCustomer.id,
      });
      setCurrentCustomer(null);
      setIsReceived(false);
      await refetchBanks();
    } catch (error) {
      console.error("Failed to complete service:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkReceived = async () => {
    if (!currentCustomer) return;
    setIsLoading(true);
    try {
      await markReceivedMutation.mutateAsync({ entryId: currentCustomer.id });
      setIsReceived(true);
    } catch (error) {
      console.error("Failed to mark as received:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequeue = async () => {
    if (!myBank || !currentCustomer) return;
    setIsLoading(true);
    try {
      await requeueEntryMutation.mutateAsync({ bankId: myBank.id, entryId: currentCustomer.id });
      setCurrentCustomer(null);
      setIsReceived(false);
      await refetchBanks();
    } catch (error) {
      console.error("Failed to requeue:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipNoShow = async () => {
    if (!myBank || !currentCustomer) return;
    setIsLoading(true);
    try {
      await skipNoShowMutation.mutateAsync({
        bankId: myBank.id,
        entryId: currentCustomer.id,
      });
      setCurrentCustomer(null);
      setIsReceived(false);
      await refetchBanks();
    } catch (error) {
      console.error("Failed to skip no-show:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isMyBankLoading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <p className="text-xl font-black text-foreground/60">YÜKLENİYOR...</p>
      </div>
    );
  }

  // No bank assigned to this IP
  if (!myBank) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center p-4">
        {isElectron && (
          <div className="fixed top-0 right-0 flex gap-1 p-2 z-50">
            <button onClick={() => ipc?.send("window-minimize")} className="w-8 h-8 flex items-center justify-center bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-black border border-secondary cursor-pointer" title="Küçült">_</button>
            <button onClick={() => setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white text-sm font-black border border-red-600 cursor-pointer" title="Kapat">X</button>
          </div>
        )}
        <div className="border-4 border-yellow-400 p-8 max-w-md w-full text-center">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-yellow-400" />
          <h1 className="text-2xl font-black neon-pink mb-6">
            SİRAMATİK
          </h1>
          <div className="text-6xl mb-4">⚠</div>
          <p className="text-xl font-black text-yellow-400 mb-2">HENÜZ BU BANKO KAYDEDİLMEDİ</p>
          <p className="text-sm text-foreground/60">
            Bu bilgisayarın IP adresi sistemde tanımlı değil. Süperadmin panelinden IP adresinizi kaydettirin.
          </p>
        </div>
        {showExitConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
            <div className="border-4 border-red-600 p-8 bg-card text-center max-w-sm w-full">
              <p className="text-lg font-black mb-4">Uygulama kapatılsın mı?</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => ipc?.send("window-close")} className="h-10 px-6 font-black text-sm bg-red-600 hover:bg-red-700 text-white border-2 border-red-600 cursor-pointer">KAPAT</button>
                <button onClick={() => setShowExitConfirm(false)} className="h-10 px-6 font-black text-sm bg-secondary hover:bg-secondary/80 text-secondary-foreground border-2 border-secondary cursor-pointer">İPTAL</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Bank assigned but inactive
  if (!myBank.isActive) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center p-4">
        {isElectron && (
          <div className="fixed top-0 right-0 flex gap-1 p-2 z-50">
            <button onClick={() => ipc?.send("window-minimize")} className="w-8 h-8 flex items-center justify-center bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-black border border-secondary cursor-pointer" title="Küçült">_</button>
            <button onClick={() => setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white text-sm font-black border border-red-600 cursor-pointer" title="Kapat">X</button>
          </div>
        )}
        <div className="border-4 border-yellow-400 p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-black neon-pink mb-6">
            BANKO {myBank.bankNumber}
          </h1>
          <p className="text-xl font-black text-red-400 mb-2">✗ BANKO KAPALI</p>
          <p className="text-sm text-foreground/60">Bu banko şu anda aktif değil. Admin panelinden açılmasını bekleyin.</p>
        </div>
        {showExitConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
            <div className="border-4 border-red-600 p-8 bg-card text-center max-w-sm w-full">
              <p className="text-lg font-black mb-4">Uygulama kapatılsın mı?</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => ipc?.send("window-close")} className="h-10 px-6 font-black text-sm bg-red-600 hover:bg-red-700 text-white border-2 border-red-600 cursor-pointer">KAPAT</button>
                <button onClick={() => setShowExitConfirm(false)} className="h-10 px-6 font-black text-sm bg-secondary hover:bg-secondary/80 text-secondary-foreground border-2 border-secondary cursor-pointer">İPTAL</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Operator selection screen
  if (!selectedOperator) {
    return (
      <div className="w-full h-screen bg-background flex items-center justify-center p-4">
        {isElectron && (
          <div className="fixed top-0 right-0 flex gap-1 p-2 z-50">
            <button onClick={() => ipc?.send("window-minimize")} className="w-8 h-8 flex items-center justify-center bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-black border border-secondary cursor-pointer" title="Küçült">_</button>
            <button onClick={() => setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white text-sm font-black border border-red-600 cursor-pointer" title="Kapat">X</button>
          </div>
        )}
        <div className="border-4 border-secondary p-6 max-w-md w-full text-center">
          <div className="absolute top-0 left-0 w-3 h-3 border-t-3 border-l-3 border-secondary" />
          <h1 className="text-xl font-black neon-pink mb-2">SİRAMATİK</h1>
          <p className="text-lg font-black neon-blue mb-6">BANKO {selectedBank?.bankNumber || myBank?.bankNumber}</p>
          <p className="text-sm font-bold text-foreground/80 mb-4">KULLANICI SEÇİN</p>
          <div className="space-y-2">
            {operators && operators.length > 0 ? operators.map((op: any) => (
              <button key={op.id} onClick={() => {
                setSelectedOperator({ id: op.id, name: op.name });
                sessionStorage.setItem("bank-operator", JSON.stringify({ id: op.id, name: op.name }));
              }}
                className="w-full h-12 border-2 border-primary bg-card text-foreground font-black text-sm hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
              >
                {op.name}
              </button>
            )) : (
              <p className="text-sm text-foreground/60">Henüz kullanıcı tanımlanmamış. Admin panelinden ekleyin.</p>
            )}
          </div>
        </div>
        {showExitConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
            <div className="border-4 border-red-600 p-8 bg-card text-center max-w-sm w-full">
              <p className="text-lg font-black mb-4">Uygulama kapatılsın mı?</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => ipc?.send("window-close")} className="h-10 px-6 font-black text-sm bg-red-600 hover:bg-red-700 text-white border-2 border-red-600 cursor-pointer">KAPAT</button>
                <button onClick={() => setShowExitConfirm(false)} className="h-10 px-6 font-black text-sm bg-secondary hover:bg-secondary/80 text-secondary-foreground border-2 border-secondary cursor-pointer">İPTAL</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-background flex flex-col p-1 sm:p-2 md:p-3 gap-1 md:gap-2">
      {/* Electron window controls */}
      {isElectron && (
        <div className="fixed top-0 right-0 flex gap-1 p-2 z-50">
          <button onClick={() => ipc?.send("window-minimize")} className="w-8 h-8 flex items-center justify-center bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-black border border-secondary cursor-pointer" title="Küçült">_</button>
          <button onClick={() => setShowExitConfirm(true)} className="w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white text-sm font-black border border-red-600 cursor-pointer" title="Kapat">X</button>
        </div>
      )}

      {/* Header - draggable for Electron frameless window */}
      <div className="border-2 border-border p-2 relative" style={{ WebkitAppRegion: "drag" } as any}>
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-border" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-border" />
        <div className="flex items-center justify-between">
          <h1 className="text-base sm:text-lg font-black neon-pink text-center flex-1">
            BANKO YETKİLİ PANELİ - BANKO {selectedBank?.bankNumber}
          </h1>
          <button onClick={() => {
            setSelectedOperator(null);
            sessionStorage.removeItem("bank-operator");
          }} className="text-xs text-foreground/60 hover:text-red-400 underline ml-2 shrink-0">
            {selectedOperator?.name} (ÇIKIŞ)
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-1 min-h-0">
        {/* Left Column - Stats + Current Customer */}
        <div className="flex-1 flex flex-col gap-1 min-h-0">
          {/* Stats row */}
          <div className="flex gap-1">
            <div className="flex-1 border border-secondary p-1 text-center">
              <p className="text-xs text-foreground/60">DURUM</p>
              <p className="text-sm font-black">{selectedBank?.isOccupied ? <span className="neon-pink">MEŞGUL</span> : <span className="text-green-400">BOŞ</span>}</p>
            </div>
            <div className="flex-1 border border-secondary p-1 text-center">
              <p className="text-xs text-foreground/60">HİZMET</p>
              <p className="text-sm font-black neon-pink">{selectedBank?.totalServed || 0}</p>
            </div>
            <div className="flex-1 border border-secondary p-1 text-center">
              <p className="text-xs text-foreground/60">BEKLEYEN</p>
              <p className="text-sm font-black neon-blue">{queue?.length || 0}</p>
            </div>
          </div>

          {/* Current Customer Section */}
          <div className="border-2 border-border p-2 flex-1 flex flex-col items-center justify-center relative min-h-0">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-border" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-border" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-border" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-border" />

            {currentCustomer ? (
              <div className="text-center w-full">
                <p className="text-xs text-foreground/60 mb-1">AKTİF MÜŞTERİ</p>
                <div className="text-3xl sm:text-4xl font-black neon-pink mb-1" style={{ animation: "neon-pulse 1s ease-in-out infinite" }}>
                  {currentCustomer.ticketNumber}
                </div>
                {currentCustomer.phoneNumber && (
                  <p className="text-sm sm:text-base font-black neon-blue mb-1">
                    {currentCustomer.phoneNumber}
                  </p>
                )}
                <div className="flex flex-col gap-1 items-center">
                  <div className="flex gap-1 justify-center">
                    {!isReceived ? (
                      <Button onClick={handleMarkReceived} disabled={isLoading} className="h-8 px-4 text-xs font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-none border-2 border-border">
                        {isLoading ? "İŞLENİYOR..." : "HİZMET FİŞİ ALINDI"}
                      </Button>
                    ) : (
                      <Button disabled className="h-8 px-4 text-xs font-black bg-muted text-muted-foreground rounded-none border-2 border-muted cursor-default">
                        FİŞ ALINDI ✓
                      </Button>
                    )}
                    <Button onClick={handleCompleteService} disabled={isLoading || !isReceived} className="h-8 px-4 text-xs font-black bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-none border-2 border-destructive">
                      {isLoading ? "İŞLENİYOR..." : "HİZMET BİTTİ"}
                    </Button>
                  </div>
                  <Button onClick={handleSkipNoShow} disabled={isLoading || isReceived} className="h-8 px-4 text-xs font-black text-white rounded-none border-2" style={{ backgroundColor: "#ffbe0b", borderColor: "#ffbe0b" }}>
                    {isLoading ? "İŞLENİYOR..." : "BOŞ GEÇ"}
                  </Button>
                  <Button onClick={handleRequeue} disabled={isLoading} className="h-8 px-4 text-xs font-black text-white rounded-none border-2" style={{ backgroundColor: "#f72585", borderColor: "#f72585" }}>
                    GERİ EKLE
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center w-full">
                <p className="text-sm text-foreground/50 mb-1">MÜŞTERİ YOK</p>
                <Button onClick={handleCallNext} disabled={isLoading || !queue || queue.length === 0} className="h-8 px-4 text-xs font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-none border-2 border-border">
                  {isLoading ? "ÇAĞRILIYOR..." : "SIRADAKINI ÇAĞIR"}
                </Button>
                {(!queue || queue.length === 0) && (
                  <p className="text-xs text-foreground/60 mt-1">Kuyrukta müşteri yok</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Waiting Queue List */}
        <div className="w-72 flex flex-col border-2 border-secondary p-2 min-h-0 relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-secondary" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-secondary" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-secondary" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-secondary" />
          <p className="text-xs font-black neon-blue mb-2">BEKLEYEN MÜŞTERİLER</p>
          <div className="flex-1 overflow-y-auto space-y-1">
            {queue && queue.length > 0 ? (
              queue.map((entry: any) => (
                <div key={entry.id} className="border border-secondary p-1 flex items-center gap-1">
                  <span className="text-base font-black flex-1">{entry.ticketNumber}</span>
                  {entry.priorityType && entry.priorityType !== 'none' && (
                    <span className="text-xs text-yellow-400 mr-1">
                      {entry.priorityType === 'elderly' ? '👴' : entry.priorityType === 'disabled' ? '♿' : entry.priorityType === 'pregnant' ? '🤰' : ''}
                    </span>
                  )}
                  <button
                    onClick={() => handleCallSpecific(entry.id, entry.ticketNumber)}
                    disabled={isLoading || !!currentCustomer}
                    className="h-6 px-2 text-xs font-black bg-primary hover:bg-primary/90 disabled:opacity-30 text-primary-foreground border border-border cursor-pointer disabled:cursor-not-allowed"
                  >
                    ÇAĞIR
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-foreground/50 text-center mt-4">Bekleyen müşteri yok</p>
            )}
          </div>
        </div>
      </div>

      {/* Skipped (No-Show) Entries */}
      {skippedEntries && skippedEntries.length > 0 && (
        <div className="border-4 border-yellow-500/50 p-3 mt-2 relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-yellow-500" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-yellow-500" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-yellow-500" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-yellow-500" />
          <p className="text-xs font-black text-yellow-400 mb-2">BOŞ GEÇİLENLER ({skippedEntries.length})</p>
          <div className="flex flex-wrap gap-1">
            {skippedEntries.map((entry: any) => (
              <button
                key={entry.id}
                onClick={async () => {
                  if (!myBank) return;
                  setIsLoading(true);
                  try {
                    await requeueEntryMutation.mutateAsync({ bankId: myBank.id, entryId: entry.id });
                    await refetchSkipped();
                    toast.success(`#${entry.ticketNumber} kuyruğa geri eklendi`);
                  } catch (e) {
                    toast.error("Eklenemedi");
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                className="h-7 px-2 text-xs font-black bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 border border-yellow-500 cursor-pointer disabled:opacity-30"
              >
                #{entry.ticketNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
          <div className="border-4 border-red-600 p-8 bg-card text-center max-w-sm w-full">
            <p className="text-lg font-black mb-4">Uygulama kapatılsın mı?</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => ipc?.send("window-close")} className="h-10 px-6 font-black text-sm bg-red-600 hover:bg-red-700 text-white border-2 border-red-600 cursor-pointer">KAPAT</button>
              <button onClick={() => setShowExitConfirm(false)} className="h-10 px-6 font-black text-sm bg-secondary hover:bg-secondary/80 text-secondary-foreground border-2 border-secondary cursor-pointer">İPTAL</button>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border p-1 text-center text-xs text-foreground/60">
        <span className="neon-blue">● CANLI</span> - BANKO {selectedBank?.bankNumber} - {selectedOperator?.name}
      </div>

      <style>{`
        @keyframes neon-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
