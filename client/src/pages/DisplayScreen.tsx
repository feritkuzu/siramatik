import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";

interface CalledTicket {
  ticketNumber: number;
  bankId: number;
  entryId?: number;
  timestamp: number;
  isPriority?: boolean;
  priorityType?: string;
  completed?: boolean;
  completedAt?: number;
}

interface CallNotification {
  ticketNumber: number;
  bankId: number;
}

export default function DisplayScreen() {
  const [calledTickets, setCalledTickets] = useState<CalledTicket[]>([]);
  const [waitingQueue, setWaitingQueue] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [bankMap, setBankMap] = useState<Record<number, number>>({});
  const [soundSettings, setSoundSettings] = useState<any>({
    id: 1,
    soundType: "chime",
    soundVolume: 70,
    isEnabled: true,
    voiceEnabled: true,
    notificationSound: "chime",
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

  const audioContextRef = useRef<AudioContext | null>(null);

  const getOrCreateAudioContext = useCallback((): AudioContext => {
    if (audioContextRef.current) return audioContextRef.current;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    const earlyCtx = (window as any).__audioCtx;
    if (earlyCtx && earlyCtx.state !== "closed") {
      audioContextRef.current = earlyCtx;
    } else {
      audioContextRef.current = new Ctor();
    }
    if (audioContextRef.current!.state === "suspended") {
      audioContextRef.current!.resume();
    }
    return audioContextRef.current!;
  }, []);

  const getAudioContext = useCallback((): AudioContext => {
    return getOrCreateAudioContext();
  }, [getOrCreateAudioContext]);

  const playMp3ViaAudioContext = useCallback(async (url: string, volume: number) => {
    try {
      const ac = getAudioContext();
      if (ac.state === "suspended") await ac.resume();
      const resp = await fetch(url);
      const buf = await resp.arrayBuffer();
      const decoded = await ac.decodeAudioData(buf);
      const src = ac.createBufferSource();
      src.buffer = decoded;
      const gain = ac.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(ac.destination);
      src.start(0);
    } catch (e) {
      console.warn("[Display] MP3 playback error:", e);
    }
  }, [getAudioContext]);

  const playToneViaAudioContext = useCallback(() => {
    try {
      const ac = getAudioContext();
      if (ac.state === "suspended") ac.resume();
      const now = ac.currentTime;
      const volume = (soundSettings.soundVolume || 70) / 100;

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
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(ding, now);
      gain.gain.setValueAtTime(volume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.frequency.setValueAtTime(dong, now + 0.25);
      gain.gain.setValueAtTime(volume * 0.3, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.warn("[Display] Tone playback error:", e);
    }
  }, [soundSettings.soundType, soundSettings.soundVolume, getAudioContext]);

  const playCountRef = useRef(0);

  const playNotificationSound = useCallback(() => {
    playCountRef.current++;
    console.log(`[Display] playNotificationSound called #${playCountRef.current}`, { isEnabled: soundSettings.isEnabled, ns: soundSettings.notificationSound });

    if (!soundSettings.isEnabled) return;

    // Ensure AudioContext is ready (in Electron with autoplayPolicy it's always running)
    getOrCreateAudioContext();

    const ns = soundSettings.notificationSound;
    const vol = (soundSettings.soundVolume || 70) / 100;

    if (ns && ns !== "chime") {
      const url = `/notification-sounds/${ns}.mp3`;
      playMp3ViaAudioContext(url, vol);
    } else {
      playToneViaAudioContext();
    }
  }, [soundSettings.isEnabled, soundSettings.notificationSound, soundSettings.soundVolume, playMp3ViaAudioContext, playToneViaAudioContext, getOrCreateAudioContext]);

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
    setCalledTickets((prev) => {
      const activeKeys = new Set((activeCalled ?? []).map((e: any) => `${e.ticketNumber}-${e.bankId}`));
      const map = new Map(prev.map((t) => [`${t.ticketNumber}-${t.bankId}`, t]));
      // Add new active entries
      for (const entry of activeCalled ?? []) {
        const key = `${entry.ticketNumber}-${entry.bankId}`;
        if (!map.has(key)) {
          map.set(key, {
            ticketNumber: entry.ticketNumber,
            bankId: entry.bankId,
            entryId: entry.id,
            timestamp: entry.calledAt ?? Date.now(),
            isPriority: entry.isPriority,
            priorityType: entry.priorityType,
          });
        }
      }
      // Remove entries no longer active (unless completed, timeout will clean those)
      return Array.from(map.values()).filter(
        (t) => activeKeys.has(`${t.ticketNumber}-${t.bankId}`) || t.completed
      );
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

  // Apply theme with comprehensive CSS variables
  useEffect(() => {
    if (config) {
      const c = config as any;
      const bg = c.themeBg || "#0d1b2a";
      const text = c.themeText || "#e0e1dd";
      const header = c.themeHeader || "#1b98a0";
      const subheader = c.themeSubheader || "#415a77";
      const border = c.themeBorder || "#1b98a0";
      const font = c.themeFont || "Segoe UI, sans-serif";
      const fontSize = (c.themeFontSize ?? 16) + "px";

      const root = document.documentElement;
      root.style.setProperty("--background", bg);
      root.style.setProperty("--foreground", text);
      root.style.setProperty("--card", bg);
      root.style.setProperty("--primary", header);
      root.style.setProperty("--secondary", subheader);
      root.style.setProperty("--border", border);
      root.style.setProperty("--display-name", `"${c.systemName || "SIRAMATİK"}"`);
      document.body.style.fontFamily = font;
      document.body.style.fontSize = fontSize;
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
          entryId: data.entryId,
          timestamp: data.timestamp ?? Date.now(),
          isPriority: data.isPriority,
          priorityType: data.priorityType,
        };
        return [ticket, ...prev.filter((t) => t.ticketNumber !== ticketNum)];
      });

      setNotificationQueue((prev) => [...prev, { ticketNumber: ticketNum, bankId: data.bankId }]);

      playNotificationSound();
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
    const timer = setTimeout(() => setCallNotification(null), 8000);
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
          t.ticketNumber === data.ticketNumber ? { ...t, completed: true, completedAt: data.timestamp ?? Date.now() } : t
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

  // Listen for notification:play event as additional trigger
  useEffect(() => {
    let count = 0;
    const unsubscribe = on("notification:play", (data) => {
      count++;
      console.log(`[Display] notification:play event #${count}:`, data);
      if (data.type === "customer_called") {
        playNotificationSound();
      }
    });
    return () => {
      console.log(`[Display] notification:play listener cleaned up (received ${count} events)`);
      unsubscribe();
    };
  }, [on, playNotificationSound]);

  // Listen for sound settings updates
  useEffect(() => {
    const unsubscribe = on("soundSettings:updated", (data) => {
      console.log("[Display] Sound settings updated:", data);
      setSoundSettings(data);
    });

    return unsubscribe;
  }, [on]);

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
    <div className="w-full h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "var(--display-bg)", color: "var(--display-text)", fontFamily: "inherit" }}>

      {/* ===== HEADER ===== */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 32px", height: "8vh", borderBottom: "3px solid var(--display-border)",
        backgroundColor: "color-mix(in srgb, var(--display-bg) 97%, var(--display-accent) 3%)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "50%",
            backgroundColor: "var(--display-accent)", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: "28px"
          }}>🏦</div>
          <div>
            <div style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "1px" }}>
              {systemName || "SİRAMATİK"}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.7, letterSpacing: "2px" }}>
              SIRA YÖNETİM SİSTEMİ
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            display: "flex", gap: "8px", padding: "4px 6px", borderRadius: "20px",
            background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)"
          }}>
            <span style={{
              padding: "4px 10px", borderRadius: "14px", fontSize: "12px",
              background: "var(--display-accent)", color: "#fff", fontWeight: 600
            }}>
              ● {config && !(config as any)?.isSystemActive ? "KAPALI" : "AKTİF"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{
              backgroundColor: "color-mix(in srgb, var(--display-accent) 15%, transparent)",
              padding: "8px 16px", borderRadius: "8px", fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.1)", fontSize: "17px"
            }}>
              {clock.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }).toUpperCase()}
            </div>
            <div style={{
              backgroundColor: "color-mix(in srgb, var(--display-accent) 15%, transparent)",
              padding: "8px 20px", borderRadius: "8px", fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.1)", fontSize: "26px", fontFamily: "'Courier New', monospace"
            }}>
              {clock.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <div style={{
        display: "flex", flex: 1, padding: "0 32px 32px 32px", gap: "24px", height: "85vh"
      }}>

        {/* ===== LEFT: QUEUE BOARD (30%) ===== */}
        <div style={{
          width: "30%", display: "flex", flexDirection: "column",
          borderRadius: "12px", overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
        }}>
          <div style={{
            display: "flex", backgroundColor: "var(--display-accent)",
            color: "#fff", fontSize: "20px", fontWeight: 800
          }}>
            <div style={{ flex: 1, padding: "18px 0", textAlign: "center", borderRight: "2px solid rgba(255,255,255,0.15)" }}>SIRA NO</div>
            <div style={{ flex: 1, padding: "18px 0", textAlign: "center" }}>GİŞE</div>
          </div>

          {banks.filter((b: any) => b.isOccupied).length > 0 ? (
            banks.filter((b: any) => b.isOccupied).map((bank: any) => {
              const activeTicket = calledTickets.find((t) => t.bankId === bank.id && !t.completed);
              if (!activeTicket) return null;
              return (
                <div key={bank.id} style={{
                  display: "flex", flex: 1,
                  backgroundColor: "var(--display-row-bg)",
                  borderBottom: "3px solid var(--display-row-border)",
                  transition: "all 0.3s"
                }}>
                  <div style={{
                    flex: 1, display: "flex", justifyContent: "center", alignItems: "center",
                    fontSize: "clamp(24px, 4vw, 52px)", fontWeight: 800,
                    color: "var(--display-accent)", borderRight: "3px solid var(--display-row-border)"
                  }}>
                    {activeTicket.ticketNumber}
                  </div>
                  <div style={{
                    flex: 1, display: "flex", justifyContent: "center", alignItems: "center",
                    fontSize: "clamp(24px, 4vw, 52px)", fontWeight: 800,
                    color: "var(--display-accent-secondary)"
                  }}>
                    {bank.bankNumber}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{
              flex: 1, display: "flex", justifyContent: "center", alignItems: "center",
              backgroundColor: "var(--display-row-bg)",
              fontSize: "18px", opacity: 0.5, letterSpacing: "2px"
            }}>
              BEKLENEN MÜŞTERİ YOK
            </div>
          )}

          {/* Fill remaining space with empty rows */}
          {(() => {
            const occupiedCount = banks.filter((b: any) => b.isOccupied).length;
            const emptySlots = Math.max(0, 4 - occupiedCount);
            return Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} style={{
                display: "flex", flex: 1,
                backgroundColor: "var(--display-row-bg)",
                borderBottom: "3px solid var(--display-row-border)",
                opacity: 0.3
              }}>
                <div style={{
                  flex: 1, borderRight: "3px solid var(--display-row-border)"
                }}></div>
                <div style={{ flex: 1 }}></div>
              </div>
            ));
          })()}
        </div>

        {/* ===== RIGHT: CONTENT AREA (70%) ===== */}
        <div style={{
          width: "70%", borderRadius: "12px", overflow: "hidden", position: "relative",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          border: "4px solid color-mix(in srgb, var(--display-accent) 30%, transparent)",
          display: "flex", flexDirection: "column",
          backgroundColor: "color-mix(in srgb, var(--display-bg) 95%, var(--display-accent) 5%)"
        }}>
          {/* Waiting Queue Display */}
          <div style={{ flex: 1, overflow: "hidden", padding: "24px 32px", display: "flex", flexDirection: "column" }}>
            <h2 style={{
              fontSize: "22px", fontWeight: 800, margin: 0, marginBottom: "16px",
              color: "var(--display-accent-secondary)", letterSpacing: "2px",
              borderBottom: "2px solid var(--display-row-border)", paddingBottom: "8px"
            }}>
              BEKLEYEN SIRALAR ({waitingQueue.length})
            </h2>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: "8px" }}>
              {waitingQueue.slice(0, 50).map((entry) => (
                <div key={entry.id} style={{
                  padding: "6px 14px", border: "1px solid var(--display-row-border)",
                  borderRadius: "6px", fontSize: "16px", fontWeight: 700,
                  color: entry.isPriority ? "var(--display-accent)" : "var(--display-text)",
                  background: entry.isPriority ? "color-mix(in srgb, var(--display-accent) 10%, transparent)" : "transparent"
                }}>
                  #{entry.ticketNumber}
                  {entry.isPriority && entry.priorityType && (
                    <span style={{ fontSize: "10px", marginLeft: "4px", opacity: 0.7 }}>
                      ({entry.priorityType === "elderly" ? "YAŞLI" : entry.priorityType === "disabled" ? "ENGELLİ" : "HAMİLE"})
                    </span>
                  )}
                </div>
              ))}
              {waitingQueue.length === 0 && (
                <div style={{ width: "100%", textAlign: "center", padding: "40px", opacity: 0.4, fontSize: "18px" }}>
                  Kuyruk boş
                </div>
              )}
            </div>
          </div>

          {/* Bottom Banner */}
          {(config as any)?.announcements ? (
            <div style={{
              padding: "14px 24px", textAlign: "center",
              background: "color-mix(in srgb, var(--display-accent) 12%, transparent)",
              borderTop: "2px solid var(--display-row-border)",
              fontSize: "16px", fontWeight: 600, color: "var(--display-accent-secondary)",
              letterSpacing: "1px"
            }}>
              {(config as any).announcements.split('\n').filter(Boolean).map((a: string, i: number) => (
                <span key={i} style={{ margin: "0 12px" }}>{a.trim()}</span>
              ))}
            </div>
          ) : (
            <div style={{
              padding: "20px 24px", textAlign: "center",
              background: "color-mix(in srgb, var(--display-accent) 8%, transparent)",
              borderTop: "2px solid var(--display-row-border)"
            }}>
              <span style={{ fontSize: "20px", fontWeight: 800, fontStyle: "italic", color: "var(--display-accent)", letterSpacing: "4px" }}>
                {systemName || "SIRAMATİK"} SİSTEMİ
              </span>
            </div>
          )}
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

      {/* Call Notification Overlay */}
      {callNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-black/85 border-8" style={{ borderColor: "var(--display-accent)", padding: "48px 64px", textAlign: "center", animation: "callFadeIn 0.3s ease-out, notificationPulse 1.5s ease-in-out infinite" }}>
            <div style={{ fontSize: "clamp(60px, 10vw, 120px)", fontWeight: 900, lineHeight: 1, marginBottom: "16px", color: "var(--display-accent)", textShadow: "0 0 40px var(--display-accent), 0 0 80px var(--display-accent)" }}>
              {callNotification.ticketNumber}
            </div>
            <div style={{ fontSize: "clamp(24px, 3vw, 40px)", fontWeight: 900, letterSpacing: "4px", color: "var(--display-accent-secondary)", textShadow: "0 0 20px var(--display-accent-secondary)" }}>
              BANKO {bankMap[callNotification.bankId] ?? callNotification.bankId}
            </div>
          </div>
        </div>
      )}

      <style>{`
        :root {
          --display-bg: var(--background);
          --display-text: var(--foreground);
          --display-accent: var(--primary);
          --display-accent-secondary: var(--secondary);
          --display-border: var(--border);
          --display-row-bg: color-mix(in srgb, var(--card) 97%, var(--primary) 3%);
          --display-row-border: var(--border);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes callFadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes notificationPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
