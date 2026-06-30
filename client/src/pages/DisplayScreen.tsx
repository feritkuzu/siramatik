import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";

interface CalledTicket {
  ticketNumber: number;
  bankId: number;
  timestamp: number;
  isPriority?: boolean;
  priorityType?: string;
  completed?: boolean;
}

interface CallNotification {
  ticketNumber: number;
  bankId: number;
}

export default function DisplayScreen() {
  const [calledTickets, setCalledTickets] = useState<CalledTicket[]>([]);
  const [waitingQueue, setWaitingQueue] = useState<any[]>([]);
  const [pulsingTicket, setPulsingTicket] = useState<number | null>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [bankMap, setBankMap] = useState<Record<number, number>>({});
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

  const [notificationQueue, setNotificationQueue] = useState<CallNotification[]>([]);
  const [callNotification, setCallNotification] = useState<CallNotification | null>(null);

  // Fetch waiting queue
  const { data: queue } = trpc.queue.getWaitingQueue.useQuery(undefined, {
    refetchInterval: 10000,
  });

  // Fetch all banks
  const { data: allBanks } = trpc.bank.getAll.useQuery(undefined, {
    refetchInterval: 10000,
  });

  // Fetch connected banks (via socket)
  const { data: connectedBankIds } = trpc.admin.getConnectedBanks.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Aktif çağrıları sunucudan senkronize et (sayfa yenileme / reconnect)
  const { data: activeCalled } = trpc.queue.getActiveCalled.useQuery(undefined, {
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!activeCalled?.length) return;
    setCalledTickets((prev) => {
      const existing = new Map(prev.map((t) => [`${t.ticketNumber}-${t.bankId}`, t]));
      for (const entry of activeCalled) {
        const key = `${entry.ticketNumber}-${entry.bankId}`;
        if (!existing.has(key)) {
          existing.set(key, {
            ticketNumber: entry.ticketNumber,
            bankId: entry.bankId,
            timestamp: entry.calledAt ?? Date.now(),
            isPriority: entry.isPriority,
            priorityType: entry.priorityType,
          });
        }
      }
      return Array.from(existing.values());
    });
  }, [activeCalled]);

  // Fetch system config
  const { data: config } = trpc.admin.getConfig.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Fetch weather
  const { data: weather } = trpc.weather.getCurrent.useQuery(undefined, {
    refetchInterval: 300000,
    enabled: !!(config as any)?.weatherCity,
  });

  // Fetch sound settings
  const { data: fetchedSoundSettings } = trpc.admin.getSoundSettings.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Socket.io connection
  const { on } = useSocket("display");

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

  useEffect(() => {
    if (queue) {
      const sorted = [...queue].sort((a: any, b: any) => {
        if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
        return a.ticketNumber - b.ticketNumber;
      });
      setWaitingQueue(sorted);
    }
  }, [queue]);

  useEffect(() => {
    if (allBanks) {
      setBanks(allBanks);
      const map: Record<number, number> = {};
      allBanks.forEach((b: any) => { map[b.id] = b.bankNumber; });
      setBankMap(map);
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

      const ticketNum = data.ticketNumber ?? (data as any).ticket_number;
      if (ticketNum == null) return;

      setCalledTickets((prev) => {
        const ticket: CalledTicket = {
          ticketNumber: ticketNum,
          bankId: data.bankId,
          timestamp: data.timestamp ?? Date.now(),
          isPriority: data.isPriority,
          priorityType: data.priorityType,
        };
        return [ticket, ...prev.filter((t) => t.ticketNumber !== ticketNum)];
      });

      setPulsingTicket(ticketNum);
      playNotificationSound();

      setNotificationQueue((prev) => [...prev, { ticketNumber: ticketNum, bankId: data.bankId }]);

      const animationDuration = soundSettings.animationSpeed === "fast" ? 2000 : soundSettings.animationSpeed === "slow" ? 8000 : 5000;
      setTimeout(() => setPulsingTicket(null), animationDuration);
    });

    return unsubscribe;
  }, [on]);

  const speakNotification = useCallback((ticketNumber: number, bankId: number) => {
    if (!window.speechSynthesis) return;
    if (!soundSettings.isEnabled || !soundSettings.voiceEnabled) return;
    const bankNo = bankMap[bankId] ?? bankId;
    const msg = `Sıra numarası ${ticketNumber}, Banko ${bankNo}`;
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.lang = "tr-TR";
    utterance.rate = 1.1;
    utterance.volume = Math.max(0.3, (soundSettings.soundVolume || 70) / 100);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [bankMap, soundSettings.isEnabled, soundSettings.voiceEnabled, soundSettings.soundVolume]);

  // Bildirim kuyruğu: sırayla göster
  useEffect(() => {
    if (callNotification) return;
    if (notificationQueue.length === 0) return;

    const next = notificationQueue[0];
    setCallNotification(next);
    setNotificationQueue((prev) => prev.slice(1));
    speakNotification(next.ticketNumber, next.bankId);
  }, [notificationQueue, callNotification, speakNotification]);

  // Overlay'i 3 saniye sonra kapat (ayrı effect — timer cleanup sorunu olmasın)
  useEffect(() => {
    if (!callNotification) return;
    const timer = setTimeout(() => setCallNotification(null), 3000);
    return () => clearTimeout(timer);
  }, [callNotification]);

  // Listen for service completed events
  useEffect(() => {
    const unsubscribe = on("service:completed", (data) => {
      console.log("[Display] Service completed:", data);

      setCalledTickets((prev) => {
        const exists = prev.some((t) => t.ticketNumber === data.ticketNumber);
        if (!exists) return prev;
        return prev.map((t) =>
          t.ticketNumber === data.ticketNumber ? { ...t, completed: true } : t
        );
      });

      setCallNotification((prev) =>
        prev?.ticketNumber === data.ticketNumber ? null : prev
      );
      setNotificationQueue((prev) =>
        prev.filter((n) => n.ticketNumber !== data.ticketNumber)
      );

      // Hizmet tamamlandıktan 5sn sonra kartı kaldır
      setTimeout(() => {
        setCalledTickets((prev) => prev.filter((t) => t.ticketNumber !== data.ticketNumber));
      }, 5000);
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

    for (let i = 0; i < 12; i++) {
      const t = now + i * 0.5;

      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.frequency.value = freq1;
      gain1.gain.setValueAtTime(volume * 0.3, t);
      gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc1.start(t);
      osc1.stop(t + 0.2);

      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = freq2;
      gain2.gain.setValueAtTime(volume * 0.3, t + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
      osc2.start(t + 0.25);
      osc2.stop(t + 0.45);
    }
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

  // Real-time clock
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const days = ["PAZAR", "PAZARTESİ", "SALI", "ÇARŞAMBA", "PERŞEMBE", "CUMA", "CUMARTESİ"];

  const systemName = (config as any)?.systemName || "";
  const weatherCity = (config as any)?.weatherCity || "";

  const getWeatherEmoji = (desc: string, code: string): string => {
    const c = desc.toLowerCase();
    if (c.includes("güneş") || c.includes("sunny") || c.includes("clear") || c.includes("açık")) return "☀️";
    if (c.includes("parçalı") || c.includes("partly") || c.includes("az bulut")) return "⛅";
    if (c.includes("çok bulut") || c.includes("kapalı") || c.includes("overcast") || c.includes("bulutlu")) return "☁️";
    if (c.includes("yağmur") || c.includes("rain") || c.includes("drizzle") || c.includes("sağanak") || c.includes("çisil")) return "🌧️";
    if (c.includes("kar") || c.includes("snow") || c.includes("tipi") || c.includes("karla")) return "❄️";
    if (c.includes("sis") || c.includes("fog") || c.includes("pus") || c.includes("duman")) return "🌫️";
    if (c.includes("fırtına") || c.includes("storm") || c.includes("thunder") || c.includes("gök") || c.includes("yıldırım")) return "⛈️";
    if (c.includes("rüzgar") || c.includes("wind") || c.includes("fırtınalı")) return "💨";
    return "🌡️";
  };

  const translateWeatherDesc = (desc: string): string => {
    const m: Record<string, string> = {
      "sunny": "Güneşli",
      "clear": "Açık",
      "partly cloudy": "Parçalı Bulutlu",
      "cloudy": "Bulutlu",
      "overcast": "Kapalı",
      "rain": "Yağmurlu",
      "light rain": "Hafif Yağmur",
      "heavy rain": "Şiddetli Yağmur",
      "patchy rain possible": "Yer Yer Yağmur",
      "moderate rain": "Orta Şiddetli Yağmur",
      "light drizzle": "Hafif Çisenti",
      "drizzle": "Çisenti",
      "thundery outbreaks in nearby": "Yakında Gök Gürültülü",
      "thunderstorm": "Gök Gürültülü Fırtına",
      "snow": "Karlı",
      "light snow": "Hafif Kar",
      "heavy snow": "Yoğun Kar",
      "patchy snow possible": "Yer Yer Kar",
      "blizzard": "Tipi",
      "fog": "Sisli",
      "mist": "Puslu",
      "haze": "Puslu",
      "windy": "Rüzgarlı",
    };
    return m[desc.toLowerCase()] || desc;
  };

  return (
    <div className="w-full h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b-4 border-border p-4 md:p-6 bg-card flex items-center">
        <div className="flex-1 text-center">
          {systemName && (
            <h1 className="text-3xl md:text-5xl font-black neon-pink mb-1">
              {systemName}
            </h1>
          )}
          <p className="text-lg md:text-xl neon-blue">
            SIRAMATİK SİSTEMİ
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {weather && (
            <div className="w-32 border-2 border-border p-2 text-center flex flex-col items-center justify-center">
              <span className="text-3xl md:text-4xl" style={{ animation: "weatherFloat 3s ease-in-out infinite" }}>{getWeatherEmoji(weather.desc, weather.code)}</span>
              <p className="text-xs text-foreground/70 mt-1 font-semibold truncate max-w-full">{weatherCity}</p>
              <p className="text-lg md:text-xl font-black neon-pink">
                {weather.temp}°C
              </p>
              <p className="text-[10px] text-foreground/60 truncate max-w-full">{translateWeatherDesc(weather.desc)}</p>
            </div>
          )}
          <div className="w-48 border-2 border-border p-2 text-center">
            <p className="text-sm md:text-base font-black neon-pink">
              {clock.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }).toUpperCase()}
            </p>
            <p className="text-xs md:text-sm neon-blue mt-1">
              {days[clock.getDay()]}
            </p>
            <p className="text-xl md:text-2xl font-black text-foreground mt-1">
              {clock.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row gap-8 p-8 overflow-hidden">
        {/* Called Tickets Section */}
        <div className="flex-1 flex flex-col">
          <div className="border-4 border-border p-6 mb-6 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-border" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-border" />
            <h2 className="text-3xl font-black neon-pink">ÇAĞRILAN NUMARALAR</h2>
          </div>

            {/* Called Tickets Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
              {[...calledTickets]
                .sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0))
                .map((ticket) => (
              <div
                key={`${ticket.ticketNumber}-${ticket.bankId}`}
                className={`border-4 p-4 flex items-center justify-between transition-all duration-300 ${
                  ticket.completed
                    ? "border-secondary bg-card/20 opacity-50"
                    : ticket.isPriority
                      ? "border-yellow-400 bg-yellow-400/10"
                      : "border-border bg-card/50"
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
                <div className="flex items-center gap-3">
                  {ticket.completed ? (
                    <div className="text-2xl text-green-400">✓</div>
                  ) : ticket.isPriority ? (
                    <div className="text-2xl">⭐</div>
                  ) : null}
                  <div className={`text-5xl md:text-6xl font-black ${ticket.completed ? 'text-foreground/50' : 'neon-pink'}`}>
                    {ticket.ticketNumber}
                  </div>
                  {ticket.isPriority && !ticket.completed && (
                    <div className="text-sm text-yellow-400 ml-2">
                      {getPriorityLabel(ticket.priorityType)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-lg md:text-xl font-black ${ticket.completed ? 'text-foreground/40' : 'neon-blue'}`}>
                    BANKO {bankMap[ticket.bankId] ?? ticket.bankId}
                  </div>
                  {ticket.completed && (
                    <div className="text-xs text-green-400 mt-1">HİZMET TAMAM</div>
                  )}
                </div>
              </div>
              ))}

            {calledTickets.length === 0 && (
              <div className="col-span-full flex items-center justify-center text-2xl text-foreground/50">
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
            <h2 className="text-2xl font-black neon-blue">BEKLEME KUYRUĞU</h2>
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
                <div className="text-2xl font-black neon-pink w-12 text-center">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold neon-blue flex items-center gap-2">
                    #{entry.ticketNumber}
                    {entry.isPriority && (
                      <span>⭐</span>
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
          <div className="border-4 border-border p-4 mt-6 text-center">
            <div className="text-sm text-foreground/60 mb-2">SİSTEM DURUMU</div>
            <div className="text-3xl font-black neon-pink">
              {connectedBankIds?.length || 0}
            </div>
            <div className="text-xs text-foreground/60">Aktif Banko</div>
          </div>
        </div>
      </div>

      {/* System Closed Overlay */}
      {config && !(config as any)?.isSystemActive && (
        <div className="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-md bg-black/50" style={{ animation: "fadeIn 0.5s ease-out" }}>
          <div className="text-center p-8 border-8 border-red-500 bg-black/70" style={{ boxShadow: "0 0 60px rgba(255,0,0,0.3)" }}>
            <div className="text-[12vw] md:text-[8vw] font-black text-red-500 leading-none" style={{ textShadow: "0 0 40px rgba(255,0,0,0.6), 0 0 80px rgba(255,0,0,0.3)", letterSpacing: "8px" }}>
              SİSTEM KAPALI
            </div>
          </div>
        </div>
      )}

      {/* Footer - LED Display Ticker */}
      <div className="border-t-4 border-border bg-black">
        <div className="flex" style={{ height: "52px" }}>
          {/* Left: System Status */}
          <div className="bg-black border-r-4 border-border px-5 flex items-center font-bold whitespace-nowrap tracking-wider gap-3"
            style={{ fontFamily: "'LED Counter 7', 'Courier New', monospace", fontSize: "18px", textShadow: "0 0 8px currentColor" }}>
            <span style={{ color: config && !(config as any)?.isSystemActive ? "#ef4444" : "#22c55e" }}>●</span>
            <span style={{ color: config && !(config as any)?.isSystemActive ? "#ef4444" : "#22c55e" }}>
              {config && !(config as any)?.isSystemActive ? "SİSTEM KAPALI" : "SİSTEM AKTİF"}
            </span>
          </div>
          {/* Right: Scrolling Announcements */}
          <div className="flex-1 bg-black overflow-hidden flex items-center relative">
            {(config as any)?.announcements ? (
              <div
                className="whitespace-nowrap absolute"
                style={{
                  fontFamily: "'LED Counter 7', 'Courier New', monospace",
                  fontSize: `${(config as any)?.tickerFontSize || 22}px`,
                  fontWeight: 600,
                  color: "#22c55e",
                  textShadow: "0 0 8px rgba(34, 197, 94, 0.7)",
                  letterSpacing: "4px",
                  animation: `tickerScroll ${(config as any)?.tickerSpeed || 8}s linear infinite`,
                }}
              >
                {(config as any).announcements.split('\n').filter(Boolean).map((a: string, i: number) => (
                  <span key={i} className="mx-12">{a.trim()}</span>
                ))}
              </div>
            ) : (
              <span className="px-5 font-bold tracking-widest"
                style={{
                  fontFamily: "'LED Counter 7', 'Courier New', monospace",
                  fontSize: "18px",
                  color: "#22c55e",
                  textShadow: "0 0 8px rgba(34, 197, 94, 0.7)",
                }}>
                SİSTEM ÇALIŞIYOR
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Call Notification Overlay */}
      {callNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: "flashBg 0.3s ease-out" }}>
          <div className="absolute inset-0 bg-black/80" />
          <div className="text-center relative z-10">
            <div className="text-[20vw] md:text-[15vw] font-black neon-pink leading-none mb-4" style={{ animation: "notificationPulse 1s ease-in-out infinite" }}>
              {callNotification.ticketNumber}
            </div>
            <div className="text-[6vw] md:text-[4vw] font-black neon-blue tracking-widest">
              BANKO {bankMap[callNotification.bankId] ?? callNotification.bankId}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes neon-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes notificationPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes flashBg {
          0% { background-color: rgba(255, 255, 255, 0.6); }
          30% { background-color: rgba(255, 0, 255, 0.2); }
          100% { background-color: transparent; }
        }
        @keyframes weatherFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes tickerScroll {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        .ticker-text {
          text-shadow: 0 0 4px currentColor;
        }
      `}</style>
    </div>
  );
}
