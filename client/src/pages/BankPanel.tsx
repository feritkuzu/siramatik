import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";

function getIpc() {
  try {
    const electron = (window as any).require?.("electron");
    if (electron?.ipcRenderer) return electron.ipcRenderer;
  } catch (_) {}
  return null;
}

export default function BankPanel() {
  const [currentCustomer, setCurrentCustomer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const ipc = getIpc();
  const isElectron = !!ipc;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { data: banks, refetch: refetchBanks } = trpc.bank.getAll.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const { data: myBank, isLoading: isMyBankLoading } = trpc.bank.getMyBank.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const { data: queue } = trpc.queue.getWaitingQueue.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const callNextMutation = trpc.queue.callNext.useMutation();
  const callSpecificMutation = trpc.queue.callSpecific.useMutation();
  const completeServiceMutation = trpc.queue.completeService.useMutation();

  const { on, emit } = useSocket("bank", myBank?.id || undefined);

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
      }
    });
    return unsubscribe;
  }, [on, myBank]);

  useEffect(() => {
    const unsubscribe = on("service:completed", (data: any) => {
      if (myBank && data.bankId === myBank.id) {
        setCurrentCustomer(null);
      }
    });
    return unsubscribe;
  }, [on, myBank]);

  const handleCallNext = async () => {
    if (!myBank) return;
    setIsLoading(true);
    try {
      const result = await callNextMutation.mutateAsync({ bankId: myBank.id });
      setCurrentCustomer({
        id: result.id,
        ticketNumber: result.ticketNumber,
        phoneNumber: result.phoneNumber,
      });
      emit("customer:called", {
        ticketNumber: result.ticketNumber,
        phoneNumber: result.phoneNumber,
        bankId: myBank.id,
        entryId: result.id,
        timestamp: Date.now(),
      });
      await refetchBanks();
    } catch (error) {
      console.error("Failed to call next customer:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallSpecific = async (entryId: number, ticketNumber: number) => {
    if (!myBank) return;
    setIsLoading(true);
    try {
      const result = await callSpecificMutation.mutateAsync({ bankId: myBank.id, entryId });
      setCurrentCustomer({
        id: result.id,
        ticketNumber: result.ticketNumber,
        phoneNumber: result.phoneNumber,
      });
      emit("customer:called", {
        ticketNumber: result.ticketNumber,
        phoneNumber: result.phoneNumber,
        bankId: myBank.id,
        entryId: result.id,
        timestamp: Date.now(),
      });
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
      emit("service:completed", {
        ticketNumber: currentCustomer.ticketNumber,
        bankId: myBank.id,
        entryId: currentCustomer.id,
        timestamp: Date.now(),
      });
      setCurrentCustomer(null);
      await refetchBanks();
    } catch (error) {
      console.error("Failed to complete service:", error);
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
          <h1 className="text-2xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor, 0 0 20px currentColor" }}>
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
          <h1 className="text-2xl font-black neon-pink mb-6" style={{ textShadow: "0 0 10px currentColor, 0 0 20px currentColor" }}>
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
      <div className="border-2 border-primary p-2 relative" style={{ WebkitAppRegion: "drag" } as any}>
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary" />
        <h1 className="text-base sm:text-lg font-black neon-pink text-center" style={{ textShadow: "0 0 10px currentColor, 0 0 20px currentColor" }}>
          BANKO YETKİLİ PANELİ - BANKO {selectedBank?.bankNumber}
        </h1>
      </div>

      <div className="flex-1 flex gap-1 min-h-0">
        {/* Left Column - Stats + Current Customer */}
        <div className="flex-1 flex flex-col gap-1 min-h-0">
          {/* Stats row */}
          <div className="flex gap-1">
            <div className="flex-1 border border-secondary p-1 text-center">
              <p className="text-xs text-foreground/60">DURUM</p>
              <p className="text-sm font-black">{selectedBank?.isOccupied ? <span className="neon-pink" style={{ textShadow: "0 0 10px currentColor" }}>MEŞGUL</span> : <span className="text-green-400">BOŞ</span>}</p>
            </div>
            <div className="flex-1 border border-secondary p-1 text-center">
              <p className="text-xs text-foreground/60">HİZMET</p>
              <p className="text-sm font-black neon-pink" style={{ textShadow: "0 0 10px currentColor" }}>{selectedBank?.totalServed || 0}</p>
            </div>
            <div className="flex-1 border border-secondary p-1 text-center">
              <p className="text-xs text-foreground/60">BEKLEYEN</p>
              <p className="text-sm font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>{queue?.length || 0}</p>
            </div>
          </div>

          {/* Current Customer Section */}
          <div className="border-2 border-primary p-2 flex-1 flex flex-col items-center justify-center relative min-h-0">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary" />

            {currentCustomer ? (
              <div className="text-center w-full">
                <p className="text-xs text-foreground/60 mb-1">AKTİF MÜŞTERİ</p>
                <div className="text-3xl sm:text-4xl font-black neon-pink mb-1" style={{ animation: "neon-pulse 1s ease-in-out infinite", textShadow: "0 0 10px currentColor, 0 0 20px currentColor" }}>
                  {currentCustomer.ticketNumber}
                </div>
                {currentCustomer.phoneNumber && (
                  <p className="text-sm sm:text-base font-black neon-blue mb-1" style={{ textShadow: "0 0 10px currentColor" }}>
                    {currentCustomer.phoneNumber}
                  </p>
                )}
                <Button onClick={handleCompleteService} disabled={isLoading} className="h-8 px-4 text-xs font-black bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-none border-2 border-destructive">
                  {isLoading ? "İŞLENİYOR..." : "HİZMET BİTTİ"}
                </Button>
              </div>
            ) : (
              <div className="text-center w-full">
                <p className="text-sm text-foreground/50 mb-1">MÜŞTERİ YOK</p>
                <Button onClick={handleCallNext} disabled={isLoading || !queue || queue.length === 0} className="h-8 px-4 text-xs font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-none border-2 border-primary">
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
          <p className="text-xs font-black neon-blue mb-2" style={{ textShadow: "0 0 10px currentColor" }}>BEKLEYEN MÜŞTERİLER</p>
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
                    className="h-6 px-2 text-xs font-black bg-primary hover:bg-primary/90 disabled:opacity-30 text-primary-foreground border border-primary cursor-pointer disabled:cursor-not-allowed"
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

      <div className="border-t border-primary p-1 text-center text-xs text-foreground/60">
        <span className="neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>● CANLI</span> - BANKO {selectedBank?.bankNumber}
      </div>

      <style>{`
        @keyframes neon-pulse {
          0%, 100% { opacity: 1; text-shadow: 0 0 10px currentColor, 0 0 20px currentColor; }
          50% { opacity: 0.5; text-shadow: 0 0 5px currentColor; }
        }
      `}</style>
    </div>
  );
}
