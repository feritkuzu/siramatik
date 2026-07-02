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
    voiceEnabled: true,
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
    });

    return unsubscribe;
  }, [on, playNotificationSound]);

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

  // Overlay'i 5 saniye sonra kapat
  useEffect(() => {
    if (!callNotification) return;
    const timer = setTimeout(() => setCallNotification(null), 5000);
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

  const playNotificationSound = useCallback(() => {
    if (!soundSettings.isEnabled) return;

    const ns = soundSettings.notificationSound;
    if (ns && ns !== "chime") {
      const audio = new Audio(`/notification-sounds/${ns}.mp3`);
      audio.volume = (soundSettings.soundVolume || 70) / 100;
      audio.play().catch(() => {});
      setTimeout(() => {
        const audio2 = new Audio(`/notification-sounds/${ns}.mp3`);
        audio2.volume = (soundSettings.soundVolume || 70) / 100;
        audio2.play().catch(() => {});
      }, 600);
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    const volume = soundSettings.soundVolume / 100;

    const getFrequencies = () => {
      switch (soundSettings.soundType) {
        case "bell": return { ding: 1200, dong: 900 };
        case "alarm": return { ding: 1000, dong: 600 };
        case "beep": return { ding: 800, dong: 500 };
        case "siren": return { ding: 1500, dong: 1000 };
        case "notification": return { ding: 900, dong: 700 };
        case "chime":
        default: return { ding: 880, dong: 660 };
      }
    };
    const { ding, dong } = getFrequencies();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(ding, now);
    gain.gain.setValueAtTime(volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.frequency.setValueAtTime(dong, now + 0.25);
    gain.gain.setValueAtTime(volume * 0.3, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.5);
  }, [soundSettings.isEnabled, soundSettings.notificationSound, soundSettings.soundVolume, soundSettings.soundType]);

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
      <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 overflow-hidden">
        {/* Left - Called Tickets List */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="border-b-2 border-border pb-2 mb-3 flex items-center gap-4">
            <h2 className="text-xl font-black neon-pink flex-1">ÇAĞRILAN</h2>
            <span className="text-xs text-foreground/60">{connectedBankIds?.length || 0} Aktif Banko</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {[...calledTickets]
              .sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0))
              .map((ticket) => (
              <div key={`${ticket.ticketNumber}-${ticket.bankId}`}
                className={`flex items-center gap-3 py-1.5 ${ticket.completed ? "opacity-40" : ""}`}>
                <div className={`text-xl font-black w-12 text-right ${ticket.completed ? "text-foreground/40" : "neon-pink"}`}>
                  {ticket.ticketNumber}
                </div>
                <div className={`text-base font-bold flex-1 ${ticket.completed ? "text-foreground/40" : "neon-blue"}`}>
                  BANKO {bankMap[ticket.bankId] ?? ticket.bankId}
                </div>
                {ticket.isPriority && !ticket.completed && (
                  <span className="text-xs text-yellow-400">{getPriorityLabel(ticket.priorityType)}</span>
                )}
                {ticket.completed && <span className="text-xs text-green-400">✓</span>}
              </div>
            ))}
            {calledTickets.length === 0 && (
              <div className="flex items-center justify-center h-full text-lg text-foreground/40">Bekleniyor...</div>
            )}
          </div>
        </div>

        {/* Right - Waiting Queue */}
        <div className="w-full md:w-64 flex flex-col min-h-0">
          <div className="border-b-2 border-secondary pb-2 mb-3">
            <h2 className="text-lg font-black neon-blue">BEKLEYEN</h2>
            <p className="text-xs text-foreground/60">{waitingQueue.length} kişi</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {waitingQueue.map((entry, index) => (
              <div key={entry.id} className="flex items-center gap-2 py-1">
                <div className="text-sm font-black text-foreground/50 w-6 text-right shrink-0">{index + 1}</div>
                <div className="text-base font-bold neon-blue flex-1">#{entry.ticketNumber}</div>
                {entry.isPriority && entry.priorityType && (
                  <span className="text-[10px] text-yellow-400 shrink-0">
                    {entry.priorityType === "elderly" ? "Yaşlı" : entry.priorityType === "disabled" ? "Engelli" : "Hamile"}
                  </span>
                )}
              </div>
            ))}
            {waitingQueue.length === 0 && (
              <div className="text-center text-foreground/40 py-6 text-sm">Kuyruk boş</div>
            )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/85 border-8 border-primary px-16 py-12 text-center" style={{ animation: "callFadeIn 0.3s ease-out, callPulse 1s ease-in-out infinite" }}>
            <div className="text-[15vw] md:text-[10vw] font-black leading-none mb-4" style={{ color: "var(--primary)", textShadow: "0 0 40px var(--primary), 0 0 80px var(--primary)" }}>
              {callNotification.ticketNumber}
            </div>
            <div className="text-[4vw] md:text-[3vw] font-black tracking-widest" style={{ color: "var(--secondary)", textShadow: "0 0 20px var(--secondary)" }}>
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
        @keyframes callFadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes callPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
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
