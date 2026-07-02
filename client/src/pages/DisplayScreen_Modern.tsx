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
      root.style.setProperty("--background", c.themeBg || "#0a0e27");
      root.style.setProperty("--foreground", c.themeText || "#f0f4ff");
      root.style.setProperty("--card", c.themeBg || "#0a0e27");
      root.style.setProperty("--primary", c.themeHeader || "#00d4ff");
      root.style.setProperty("--secondary", c.themeSubheader || "#6366f1");
      root.style.setProperty("--border", c.themeBorder || "#1e3a8a");
      document.body.style.fontFamily = c.themeFont || "'Inter', 'Segoe UI', sans-serif";
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
      setTimeout(() => setPulsingTicket(null), 5000);
      playNotificationSound();

      setNotificationQueue((prev) => [...prev, { ticketNumber: ticketNum, bankId: data.bankId }]);
    });

    return unsubscribe;
  }, [on, playNotificationSound]);

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

  // Auto-remove stale called tickets after 120 seconds
  useEffect(() => {
    if (calledTickets.length === 0) return;
    const id = setInterval(() => {
      const cutoff = Date.now() - 120000;
      setCalledTickets((prev) => prev.filter((t) => t.timestamp > cutoff));
    }, 30000);
    return () => clearInterval(id);
  }, [calledTickets.length > 0]);

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
    if (c.includes("çok bulut") || c.includes("cloudy") || c.includes("overcast")) return "☁️";
    if (c.includes("yağmur") || c.includes("rain")) return "🌧️";
    if (c.includes("kar") || c.includes("snow")) return "❄️";
    if (c.includes("fırtına") || c.includes("storm")) return "⛈️";
    return "🌡️";
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-foreground overflow-hidden" style={{ fontFamily: "var(--font-family, 'Inter', sans-serif)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        @keyframes flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        @keyframes rainbow {
          0% { color: #00d4ff; }
          25% { color: #6366f1; }
          50% { color: #ec4899; }
          75% { color: #f59e0b; }
          100% { color: #00d4ff; }
        }
        
        @keyframes glow {
          0%, 100% { 
            text-shadow: 0 0 10px var(--primary), 0 0 20px var(--primary);
            box-shadow: 0 0 20px var(--primary);
          }
          50% { 
            text-shadow: 0 0 20px var(--primary), 0 0 40px var(--primary);
            box-shadow: 0 0 40px var(--primary);
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideInUp {
          from { 
            opacity: 0; 
            transform: translateY(20px);
          }
          to { 
            opacity: 1; 
            transform: translateY(0);
          }
        }
        
        @keyframes callFadeIn {
          from { 
            opacity: 0; 
            transform: scale(0.8) rotateX(20deg);
          }
          to { 
            opacity: 1; 
            transform: scale(1) rotateX(0deg);
          }
        }
        
        @keyframes callPulse {
          0%, 100% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.85;
            transform: scale(1.02);
          }
        }
        
        @keyframes weatherFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        
        @keyframes tickerScroll {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        
        @keyframes slideIn {
          from { 
            opacity: 0;
            transform: translateX(-20px);
          }
          to { 
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .glass-effect {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }
        
        .glow-border {
          border: 2px solid var(--primary);
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.3), inset 0 0 20px rgba(0, 212, 255, 0.1);
        }
        
        .ticket-card {
          animation: slideIn 0.3s ease-out;
        }
        
        .priority-badge {
          background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
          box-shadow: 0 0 15px rgba(249, 158, 11, 0.4);
        }
      `}</style>

      {/* Header */}
      <div className="glass-effect border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">Q</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{systemName || "Sıra Yönetim Sistemi"}</h1>
            <p className="text-xs text-slate-400">Gerçek Zamanlı Görüntüleme Ekranı</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Date & Time */}
          <div className="text-right">
            <div className="text-2xl font-bold text-cyan-400">{clock.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
            <div className="text-xs text-slate-400">{days[clock.getDay()]} {clock.getDate()} {["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][clock.getMonth()]}</div>
          </div>
          
          {/* Weather */}
          {weather && (
            <div className="glass-effect rounded-lg px-4 py-2 text-center" style={{ animation: "weatherFloat 3s ease-in-out infinite" }}>
              <div className="text-3xl">{getWeatherEmoji((weather as any).desc, (weather as any).code)}</div>
              <div className="text-xs text-slate-400 mt-1">{(weather as any).temp}°C</div>
              <div className="text-xs text-slate-500">{weatherCity}</div>
            </div>
          )}
          
          {/* System Status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${config && !(config as any)?.isSystemActive ? 'bg-red-500/20 border border-red-500/50' : 'bg-green-500/20 border border-green-500/50'}`}>
            <div className={`w-3 h-3 rounded-full ${config && !(config as any)?.isSystemActive ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
            <span className="text-xs font-semibold">{config && !(config as any)?.isSystemActive ? 'KAPALI' : 'AKTİF'}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 p-6 min-h-0 overflow-hidden">
        {/* Left - Called Tickets */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="mb-4">
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-2xl font-bold text-white">Çağrılan Sıralar</h2>
              <span className="text-sm text-slate-400">({calledTickets.length})</span>
            </div>
            <div className="h-1 w-32 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full"></div>
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 pr-2">
            {calledTickets.map((ticket) => (
              <div
                key={`${ticket.ticketNumber}-${ticket.bankId}`}
                className="ticket-card glass-effect rounded-xl p-4 border border-slate-700 hover:border-cyan-400/50 transition-all duration-300"
                style={{ animation: ticket.ticketNumber === pulsingTicket ? getAnimationStyle() : "none" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs text-slate-400 font-medium mb-1">SIR NO</div>
                    <div className="text-4xl font-black text-cyan-400">{ticket.ticketNumber}</div>
                  </div>
                  {ticket.isPriority && (
                    <div className="priority-badge rounded-lg px-2 py-1 text-white text-xs font-bold">
                      {ticket.priorityType === "elderly" ? "👴 Yaşlı" : ticket.priorityType === "disabled" ? "♿ Engelli" : "🤰 Hamile"}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-medium mb-1">BANKO</div>
                    <div className="text-2xl font-bold text-blue-400">{bankMap[ticket.bankId] ?? ticket.bankId}</div>
                  </div>
                  {ticket.completed && (
                    <div className="text-3xl">✓</div>
                  )}
                </div>
              </div>
            ))}
            
            {calledTickets.length === 0 && (
              <div className="col-span-2 flex items-center justify-center h-40 text-slate-400">
                <div className="text-center">
                  <div className="text-5xl mb-2">📭</div>
                  <div className="text-sm">Henüz çağrılan sıra yok</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right - Waiting Queue */}
        <div className="w-80 flex flex-col min-h-0">
          <div className="mb-4">
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-2xl font-bold text-white">Bekleme Kuyruğu</h2>
              <span className="text-sm text-slate-400">({waitingQueue.length})</span>
            </div>
            <div className="h-1 w-32 bg-gradient-to-r from-indigo-400 to-purple-600 rounded-full"></div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {waitingQueue.map((entry, index) => (
              <div
                key={entry.id}
                className="glass-effect rounded-lg p-3 border border-slate-700 hover:border-indigo-400/50 transition-all duration-300 flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-bold text-cyan-400">#{entry.ticketNumber}</div>
                    {entry.isPriority && entry.priorityType && (
                      <div className="text-xs text-amber-400 font-medium">
                        {entry.priorityType === "elderly" ? "👴 Yaşlı" : entry.priorityType === "disabled" ? "♿ Engelli" : "🤰 Hamile"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {waitingQueue.length === 0 && (
              <div className="flex items-center justify-center h-32 text-slate-400">
                <div className="text-center">
                  <div className="text-4xl mb-2">✨</div>
                  <div className="text-sm">Kuyruk boş</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Closed Overlay */}
      {config && !(config as any)?.isSystemActive && (
        <div className="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-md bg-black/60" style={{ animation: "fadeIn 0.5s ease-out" }}>
          <div className="text-center p-12 rounded-2xl glass-effect border-2 border-red-500/50" style={{ boxShadow: "0 0 60px rgba(239, 68, 68, 0.3)" }}>
            <div className="text-7xl font-black text-red-500 leading-none mb-4" style={{ textShadow: "0 0 40px rgba(239, 68, 68, 0.6), 0 0 80px rgba(239, 68, 68, 0.3)" }}>
              ⚠️
            </div>
            <div className="text-5xl font-black text-red-400" style={{ textShadow: "0 0 30px rgba(239, 68, 68, 0.5)" }}>
              SİSTEM KAPALI
            </div>
            <p className="text-red-300/80 mt-4 text-lg">Lütfen daha sonra tekrar deneyin</p>
          </div>
        </div>
      )}

      {/* Footer - Status Bar */}
      <div className="glass-effect border-t border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${config && !(config as any)?.isSystemActive ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
          <span className="text-sm font-semibold text-slate-300">
            {config && !(config as any)?.isSystemActive ? "SİSTEM KAPALI" : "SİSTEM AKTİF"}
          </span>
        </div>

        {/* Announcements Ticker */}
        {(config as any)?.announcements && (
          <div className="flex-1 mx-8 overflow-hidden">
            <div
              className="whitespace-nowrap text-sm text-cyan-400 font-medium"
              style={{
                animation: `tickerScroll ${(config as any)?.tickerSpeed || 8}s linear infinite`,
              }}
            >
              {(config as any).announcements.split('\n').filter(Boolean).map((a: string, i: number) => (
                <span key={i} className="mx-12">{a.trim()}</span>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-slate-500">
          {new Date().toLocaleString("tr-TR")}
        </div>
      </div>

      {/* Call Notification Overlay */}
      {callNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="glow-border rounded-3xl bg-black/90 px-20 py-16 text-center" style={{ animation: "callFadeIn 0.3s ease-out, callPulse 1s ease-in-out infinite", perspective: "1000px" }}>
            <div className="text-9xl font-black leading-none mb-6" style={{ color: "var(--primary)", textShadow: "0 0 40px var(--primary), 0 0 80px var(--primary), 0 0 120px var(--primary)" }}>
              {callNotification.ticketNumber}
            </div>
            <div className="text-5xl font-black tracking-widest" style={{ color: "var(--secondary)", textShadow: "0 0 20px var(--secondary), 0 0 40px var(--secondary)" }}>
              BANKO {bankMap[callNotification.bankId] ?? callNotification.bankId}
            </div>
            <div className="text-lg text-slate-300 mt-6 font-medium">Lütfen gişeye gidiniz</div>
          </div>
        </div>
      )}
    </div>
  );
}
