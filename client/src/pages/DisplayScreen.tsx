import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";

interface CalledTicket {
  ticketNumber: number;
  bankId: number;
  timestamp: number;
  isPriority?: boolean;
  priorityType?: string;
}

export default function DisplayScreen() {
  const [calledTickets, setCalledTickets] = useState<CalledTicket[]>([]);
  const [waitingQueue, setWaitingQueue] = useState<any[]>([]);
  const [pulsingTicket, setPulsingTicket] = useState<number | null>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [soundSettings, setSoundSettings] = useState<any>({
    id: 1,
    soundType: "chime",
    soundVolume: 70,
    isEnabled: true,
    animationType: "pulse",
    animationSpeed: "normal",
    customSoundUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Fetch waiting queue
  const { data: queue } = trpc.queue.getWaitingQueue.useQuery(undefined, {
    refetchInterval: 2000,
  });

  // Fetch all banks
  const { data: allBanks } = trpc.bank.getAll.useQuery(undefined, {
    refetchInterval: 2000,
  });

  // Fetch sound settings
  const { data: fetchedSoundSettings } = trpc.admin.getSoundSettings.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Socket.io connection
  const { on } = useSocket("display");

  useEffect(() => {
    if (queue) {
      setWaitingQueue(queue);
    }
  }, [queue]);

  useEffect(() => {
    if (allBanks) {
      setBanks(allBanks);
    }
  }, [allBanks]);

  useEffect(() => {
    if (fetchedSoundSettings) {
      setSoundSettings(fetchedSoundSettings);
    }
  }, [fetchedSoundSettings]);

  // Listen for customer called events
  useEffect(() => {
    const unsubscribe = on("customer:called", (data) => {
      console.log("[Display] Customer called:", data);
      
      const ticket: CalledTicket = {
        ticketNumber: data.ticketNumber,
        bankId: data.bankId,
        timestamp: data.timestamp,
        isPriority: data.isPriority,
        priorityType: data.priorityType,
      };

      setCalledTickets((prev) => [...prev, ticket]);
      setPulsingTicket(data.ticketNumber);
      playNotificationSound();

      // Remove from pulsing after animation - animasyon hızına göre ayarla
      const animationDuration = soundSettings.animationSpeed === "fast" ? 2000 : soundSettings.animationSpeed === "slow" ? 8000 : 5000;
      setTimeout(() => setPulsingTicket(null), animationDuration);

      // Remove from called list after 10 seconds
      setTimeout(() => {
        setCalledTickets((prev) =>
          prev.filter((t) => t.ticketNumber !== data.ticketNumber)
        );
      }, 10000);
    });

    return unsubscribe;
  }, [on]);

  // Listen for service completed events
  useEffect(() => {
    const unsubscribe = on("service:completed", (data) => {
      console.log("[Display] Service completed:", data);
      
      setCalledTickets((prev) =>
        prev.filter((t) => t.ticketNumber !== data.ticketNumber)
      );
    });

    return unsubscribe;
  }, [on]);

  // Listen for sound settings updates
  useEffect(() => {
    const unsubscribe = on("soundSettings:updated", (data) => {
      console.log("[Display] Sound settings updated:", data);
      setSoundSettings(data);
    });

    return unsubscribe;
  }, [on]);

  const playNotificationSound = () => {
    if (!soundSettings.isEnabled) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    const volume = soundSettings.soundVolume / 100;

    // Ses türüne göre frekans seç
    const getFrequencies = () => {
      switch (soundSettings.soundType) {
        case "bell":
          return { freq1: 1200, freq2: 800 };
        case "alarm":
          return { freq1: 1000, freq2: 500 };
        case "beep":
          return { freq1: 600, freq2: 400 };
        case "siren":
          return { freq1: 1500, freq2: 700 };
        case "notification":
          return { freq1: 900, freq2: 600 };
        case "chime":
        default:
          return { freq1: 800, freq2: 600 };
      }
    };

    const { freq1, freq2 } = getFrequencies();

    // First beep
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.frequency.value = freq1;
    gain1.gain.setValueAtTime(volume * 0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Second beep
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.frequency.value = freq2;
    gain2.gain.setValueAtTime(volume * 0.3, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc2.start(now + 0.25);
    osc2.stop(now + 0.45);
  };

  const getPriorityLabel = (priorityType?: string) => {
    switch (priorityType) {
      case "elderly":
        return "👴 Yaşlı";
      case "disabled":
        return "♿ Engelli";
      case "pregnant":
        return "🤰 Hamile";
      default:
        return "";
    }
  };

  const getAnimationClass = () => {
    const speedClass = soundSettings.animationSpeed === "fast" ? "animation-fast" : soundSettings.animationSpeed === "slow" ? "animation-slow" : "animation-normal";
    return `${soundSettings.animationType}-animation ${speedClass}`;
  };

  const getAnimationStyle = () => {
    const speedMap: Record<string, string> = {
      fast: "0.5s",
      normal: "1s",
      slow: "2s",
    };
    const duration = speedMap[soundSettings.animationSpeed] || "1s";

    const animationMap: Record<string, string> = {
      pulse: `pulse ${duration} ease-in-out infinite`,
      flash: `flash ${duration} ease-in-out infinite`,
      bounce: `bounce ${duration} ease-in-out infinite`,
      shake: `shake ${duration} ease-in-out infinite`,
      rainbow: `rainbow ${duration} ease-in-out infinite`,
      glow: `glow ${duration} ease-in-out infinite`,
    };

    return animationMap[soundSettings.animationType] || `pulse ${duration} ease-in-out infinite`;
  };

  return (
    <div className="w-full h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b-4 border-primary p-6 bg-card">
        <h1 className="text-5xl md:text-6xl font-black neon-pink text-center" style={{ textShadow: "0 0 10px currentColor, 0 0 20px currentColor" }}>
          SIRAMATI K
        </h1>
        <p className="text-center text-lg neon-blue mt-2" style={{ textShadow: "0 0 10px currentColor" }}>
          Sıra Numarası Takip Sistemi
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row gap-8 p-8 overflow-hidden">
        {/* Called Tickets Section */}
        <div className="flex-1 flex flex-col">
          <div className="border-4 border-primary p-6 mb-6 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
            <h2 className="text-3xl font-black neon-pink" style={{ textShadow: "0 0 10px currentColor" }}>ÇAĞRILAN NUMARALAR</h2>
          </div>

          {/* Called Tickets Grid */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto">
            {calledTickets.map((ticket) => (
              <div
                key={`${ticket.ticketNumber}-${ticket.bankId}`}
                className={`border-4 p-6 text-center flex flex-col items-center justify-center transition-all duration-300 ${
                  ticket.isPriority ? "border-yellow-400 bg-yellow-400/10" : "border-primary bg-card/50"
                } ${
                  pulsingTicket === ticket.ticketNumber
                    ? "bg-primary/20"
                    : ""
                }`}
                style={
                  pulsingTicket === ticket.ticketNumber
                    ? {
                        animation: getAnimationStyle(),
                      }
                    : {}
                }
              >
                {ticket.isPriority && (
                  <div className="text-2xl mb-2">⭐</div>
                )}
                <div className="text-5xl md:text-6xl font-black neon-pink mb-2" style={{ textShadow: "0 0 10px currentColor, 0 0 20px currentColor" }}>
                  {ticket.ticketNumber}
                </div>
                <div className="text-lg md:text-xl neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>
                  BANKO {ticket.bankId}
                </div>
                {ticket.isPriority && (
                  <div className="text-sm text-yellow-400 mt-2" style={{ textShadow: "0 0 5px currentColor" }}>
                    {getPriorityLabel(ticket.priorityType)}
                  </div>
                )}
              </div>
            ))}

            {calledTickets.length === 0 && (
              <div className="col-span-full flex items-center justify-center text-2xl text-foreground/50" style={{ textShadow: "0 0 10px currentColor" }}>
                Bekleniyor...
              </div>
            )}
          </div>
        </div>

        {/* Waiting Queue Section */}
        <div className="w-full md:w-80 flex flex-col">
          <div className="border-4 border-secondary p-6 mb-6 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-secondary" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-secondary" />
            <h2 className="text-2xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>BEKLEME KUYRUĞU</h2>
            <p className="text-sm text-foreground/60 mt-2">
              {waitingQueue.length} kişi bekliyor
            </p>
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {waitingQueue.slice(0, 10).map((entry, index) => (
              <div
                key={entry.id}
                className={`border-2 p-3 flex items-center gap-3 ${
                  entry.isPriority
                    ? "border-yellow-400 bg-yellow-400/10"
                    : "border-secondary bg-card/50"
                }`}
              >
                <div className="text-2xl font-black neon-pink w-12 text-center" style={{ textShadow: "0 0 10px currentColor" }}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold neon-blue flex items-center gap-2" style={{ textShadow: "0 0 10px currentColor" }}>
                    #{entry.ticketNumber}
                    {entry.isPriority && (
                      <span style={{ textShadow: "0 0 5px currentColor" }}>⭐</span>
                    )}
                  </div>
                  <div className="text-xs text-foreground/60">
                    {entry.status}
                    {entry.isPriority && entry.priorityType && (
                      <span className="ml-2 text-yellow-400">
                        {entry.priorityType === "elderly" && "(Yaşlı)"}
                        {entry.priorityType === "disabled" && "(Engelli)"}
                        {entry.priorityType === "pregnant" && "(Hamile)"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {waitingQueue.length === 0 && (
              <div className="text-center text-foreground/50 py-8">
                Kuyruk boş
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="border-4 border-primary p-4 mt-6 text-center">
            <div className="text-sm text-foreground/60 mb-2">SİSTEM DURUMU</div>
            <div className="text-3xl font-black neon-pink" style={{ textShadow: "0 0 10px currentColor" }}>
              {banks?.filter((b: any) => b.isActive).length || 0}
            </div>
            <div className="text-xs text-foreground/60">Aktif Banko</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-4 border-primary p-4 text-center text-sm text-foreground/60">
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
      `}</style>
    </div>
  );
}
