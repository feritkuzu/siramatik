import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";

export default function BankPanel() {
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [currentCustomer, setCurrentCustomer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile/tablet
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch all banks
  const { data: banks, refetch: refetchBanks } = trpc.bank.getAll.useQuery(undefined, {
    refetchInterval: 2000,
  });

  // Fetch waiting queue
  const { data: queue } = trpc.queue.getWaitingQueue.useQuery(undefined, {
    refetchInterval: 2000,
  });

  // Call next customer mutation
  const callNextMutation = trpc.queue.getNextWaitingEntry.useQuery();
  const completeMutation = trpc.queue.updateQueueEntryStatus.useMutation();

  // Socket.io connection
  const { on, emit } = useSocket("bank", selectedBankId || undefined);

  // Set default bank on first load
  useEffect(() => {
    if (banks && banks.length > 0 && !selectedBankId) {
      setSelectedBankId(banks[0].id);
    }
  }, [banks, selectedBankId]);

  // Update current customer when bank changes
  useEffect(() => {
    if (selectedBankId && banks) {
      const bank = banks.find((b: any) => b.id === selectedBankId);
      if (bank && bank.currentQueueEntryId) {
        const customer = queue?.find((q: any) => q.id === bank.currentQueueEntryId);
        setCurrentCustomer(customer || null);
      } else {
        setCurrentCustomer(null);
      }
    }
  }, [selectedBankId, banks, queue]);

  // Listen for customer called events
  useEffect(() => {
    const unsubscribe = on("customer:called", (data) => {
      if (data.bankId === selectedBankId) {
        console.log("[BankPanel] Customer called for this bank:", data);
        setCurrentCustomer({
          id: data.entryId,
          ticketNumber: data.ticketNumber,
        });
      }
    });

    return unsubscribe;
  }, [on, selectedBankId]);

  // Listen for service completed events
  useEffect(() => {
    const unsubscribe = on("service:completed", (data) => {
      if (data.bankId === selectedBankId) {
        console.log("[BankPanel] Service completed for this bank:", data);
        setCurrentCustomer(null);
      }
    });

    return unsubscribe;
  }, [on, selectedBankId]);

  const handleCallNext = async () => {
    if (!selectedBankId) return;
    setIsLoading(true);
    try {
      // Get next waiting customer
      const result = callNextMutation.data;
      if (!result) {
        console.error("No waiting customers");
        return;
      }
      
      setCurrentCustomer({
        id: result.id,
        ticketNumber: result.ticketNumber,
      });

      // Update status to 'called'
      await completeMutation.mutateAsync({ 
        entryId: result.id, 
        status: 'called' 
      });

      // Emit socket event
      emit("customer:called", {
        ticketNumber: result.ticketNumber,
        bankId: selectedBankId,
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

  const handleCompleteService = async () => {
    if (!selectedBankId || !currentCustomer) return;
    setIsLoading(true);
    try {
      // Update status to 'completed'
      await completeMutation.mutateAsync({ 
        entryId: currentCustomer.id, 
        status: 'completed' 
      });

      // Emit socket event
      emit("service:completed", {
        ticketNumber: currentCustomer.ticketNumber,
        bankId: selectedBankId,
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

  const selectedBank = banks?.find((b: any) => b.id === selectedBankId);

  return (
    <div className="w-full h-screen bg-background flex flex-col p-2 sm:p-4 md:p-6 lg:p-8 gap-4 md:gap-6 lg:gap-8">
      {/* Header */}
      <div className="border-2 sm:border-3 md:border-4 border-primary p-3 sm:p-4 md:p-6 relative">
        <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary" />
        <div className="absolute top-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary" />
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black neon-pink mb-1 sm:mb-2" style={{ textShadow: "0 0 10px currentColor, 0 0 20px currentColor" }}>BANKO YETKİLİ PANELİ</h1>
        <p className="text-xs sm:text-sm md:text-base lg:text-lg neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>Müşteri Yönetim Sistemi</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 md:gap-6 lg:gap-8 min-h-0">
        {/* Bank Selection */}
        <div className={`${isMobile ? "w-full" : "w-64"} flex flex-col gap-2 sm:gap-3 md:gap-4`}>
          <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-4">
            <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>BANKO SEÇ</h2>
          </div>

          <div className={`${isMobile ? "flex gap-2 overflow-x-auto pb-2" : "flex-1 overflow-y-auto space-y-2"}`}>
            {banks?.map((bank: any) => (
              <button
                key={bank.id}
                onClick={() => setSelectedBankId(bank.id)}
                className={`${isMobile ? "flex-shrink-0 w-32 sm:w-40" : "w-full"} p-2 sm:p-3 md:p-4 border-2 sm:border-3 md:border-4 transition-all touch-manipulation ${
                  selectedBankId === bank.id
                    ? "border-primary bg-primary/20"
                    : "border-secondary bg-card hover:border-primary"
                }`}
              >
                <div className="font-black text-xs sm:text-sm md:text-base lg:text-lg neon-pink" style={{ textShadow: "0 0 10px currentColor" }}>BANKO {bank.bankNumber}</div>
                <div className="text-xs mt-1 sm:mt-2">
                  {bank.isActive ? (
                    <span className="text-green-400">● Aktif</span>
                  ) : (
                    <span className="text-red-400">● Kapalı</span>
                  )}
                </div>
                <div className="text-xs mt-1">
                  {bank.isOccupied ? (
                    <span className="neon-pink" style={{ textShadow: "0 0 10px currentColor" }}>Müşteri Var</span>
                  ) : (
                    <span className="text-foreground/60">Boş</span>
                  )}
                </div>
                <div className="text-xs mt-1 sm:mt-2 text-foreground/60">
                  Hizmet: {bank.totalServed}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col gap-3 sm:gap-4 md:gap-6 lg:gap-8 min-h-0">
          {/* Current Customer Section */}
          <div className="border-2 sm:border-3 md:border-4 border-primary p-3 sm:p-4 md:p-6 lg:p-8 flex-1 flex flex-col items-center justify-center relative min-h-0">
            <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary" />
            <div className="absolute top-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary" />
            <div className="absolute bottom-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-b-2 sm:border-b-3 md:border-b-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary" />
            <div className="absolute bottom-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-b-2 sm:border-b-3 md:border-b-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary" />

            {currentCustomer ? (
              <div className="text-center w-full">
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-foreground/60 mb-2 sm:mb-3 md:mb-4">AKTİF MÜŞTERİ</p>
                <div
                  className="text-5xl sm:text-6xl md:text-7xl lg:text-9xl font-black neon-pink mb-3 sm:mb-4 md:mb-6 lg:mb-8"
                  style={{
                    animation: "neon-pulse 1s ease-in-out infinite",
                    textShadow: "0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor",
                  }}
                >
                  {currentCustomer.ticketNumber}
                </div>
                <p className="text-sm sm:text-base md:text-lg lg:text-2xl neon-blue mb-3 sm:mb-4 md:mb-6 lg:mb-8" style={{ textShadow: "0 0 10px currentColor" }}>
                  BANKO {selectedBank?.bankNumber}
                </p>
                <Button
                  onClick={handleCompleteService}
                  disabled={isLoading}
                  className="w-32 sm:w-40 md:w-48 lg:w-80 h-10 sm:h-12 md:h-16 lg:h-20 text-xs sm:text-sm md:text-base lg:text-2xl font-black bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-none border-2 sm:border-3 md:border-4 border-destructive touch-manipulation"
                  style={{ textShadow: "0 0 10px currentColor" }}
                >
                  {isLoading ? "İŞLENİYOR..." : "HİZMET BİTTİ"}
                </Button>
              </div>
            ) : (
              <div className="text-center w-full">
                <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-foreground/50 mb-3 sm:mb-4 md:mb-6 lg:mb-8">MÜŞTERİ YOK</p>
                <Button
                  onClick={handleCallNext}
                  disabled={isLoading || !queue || queue.length === 0}
                  className="w-32 sm:w-40 md:w-48 lg:w-80 h-10 sm:h-12 md:h-16 lg:h-20 text-xs sm:text-sm md:text-base lg:text-2xl font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-none border-2 sm:border-3 md:border-4 border-primary touch-manipulation"
                  style={{ textShadow: "0 0 10px currentColor" }}
                >
                  {isLoading ? "ÇAĞRILIYOR..." : "SIRADAKINI ÇAĞIR"}
                </Button>
                {(!queue || queue.length === 0) && (
                  <p className="text-xs sm:text-sm md:text-base lg:text-lg text-foreground/60 mt-3 sm:mt-4 md:mt-6 lg:mt-8">
                    Kuyrukta müşteri yok
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Queue Info */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
            <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-4 lg:p-6 text-center">
              <p className="text-xs sm:text-sm text-foreground/60 mb-1 sm:mb-2">BEKLEME</p>
              <p className="text-2xl sm:text-3xl md:text-4xl lg:text-4xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>{queue?.length || 0}</p>
            </div>
            <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-4 lg:p-6 text-center">
              <p className="text-xs sm:text-sm text-foreground/60 mb-1 sm:mb-2">DURUM</p>
              <p className="text-sm sm:text-base md:text-lg lg:text-2xl font-black">
                {selectedBank?.isOccupied ? (
                  <span className="neon-pink" style={{ textShadow: "0 0 10px currentColor" }}>MEŞGUL</span>
                ) : (
                  <span className="text-green-400">BOŞ</span>
                )}
              </p>
            </div>
            <div className="border-2 sm:border-3 md:border-4 border-secondary p-2 sm:p-3 md:p-4 lg:p-6 text-center">
              <p className="text-xs sm:text-sm text-foreground/60 mb-1 sm:mb-2">HİZMET</p>
              <p className="text-2xl sm:text-3xl md:text-4xl lg:text-4xl font-black neon-pink" style={{ textShadow: "0 0 10px currentColor" }}>
                {selectedBank?.totalServed || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-2 sm:border-t-3 md:border-t-4 border-primary p-2 sm:p-3 md:p-4 text-center text-xs sm:text-sm text-foreground/60">
        <span className="neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>● CANLI</span> - Sistem Aktif
      </div>

      <style>{`
        @keyframes neon-pulse {
          0%, 100% {
            opacity: 1;
            text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor;
          }
          50% {
            opacity: 0.5;
            text-shadow: 0 0 5px currentColor, 0 0 10px currentColor;
          }
        }
        
        @media (max-width: 640px) {
          button {
            font-size: clamp(0.75rem, 3vw, 1rem);
          }
        }
      `}</style>
    </div>
  );
}
