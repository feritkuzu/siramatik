import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";

type PriorityType = "none" | "elderly" | "disabled" | "pregnant";

export default function Kiosk() {
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<string | null>(null);
  const [isPriority, setIsPriority] = useState(false);
  const [priorityType, setPriorityType] = useState<PriorityType>("none");
  const [systemNotInitialized, setSystemNotInitialized] = useState(false);
  const [bankCount, setBankCount] = useState(2);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const cooldownRef = useRef(0);
  const [ticketCooldown, setTicketCooldown] = useState(0);

  // Cooldown countdown timer
  useEffect(() => {
    if (ticketCooldown <= 0) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownRef.current - Date.now()) / 1000));
      setTicketCooldown(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, [ticketCooldown]);

  // Check system config
  const { data: config } = trpc.admin.getConfig.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const createTicketMutation = trpc.queue.createTicket.useMutation();
  const createPriorityTicketMutation = trpc.queue.createPriorityTicket.useMutation();
  const estimatedWaitTimeQuery = trpc.queue.getEstimatedWaitTime.useQuery(
    { ticketNumber: ticketNumber || 0 },
    { enabled: ticketNumber !== null && showSuccess }
  );
  const initSystemMutation = trpc.admin.initialize.useMutation();
  const { emit } = useSocket("kiosk");

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

  // Monitor system status
  useEffect(() => {
    if (config) {
      setSystemNotInitialized(false);
    } else {
      setSystemNotInitialized(true);
    }
  }, [config]);

  // Detect mobile/tablet
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Countdown effect
  useEffect(() => {
    if (countdownSeconds <= 0) return;
    const timer = setTimeout(() => setCountdownSeconds(countdownSeconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdownSeconds]);

  // Reset after countdown
  useEffect(() => {
    if (countdownSeconds === 0 && showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setTicketNumber(null);
        setEstimatedWaitTime(null);
        setIsPriority(false);
        setPriorityType("none");
        setPhoneNumber("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [countdownSeconds, showSuccess]);

  // Update estimated wait time when data changes
  useEffect(() => {
    if (estimatedWaitTimeQuery.data) {
      const { estimatedWaitTime: waitMs } = estimatedWaitTimeQuery.data;
      const seconds = Math.round(waitMs / 1000);
      const minutes = Math.round(seconds / 60);
      
      if (minutes < 1) {
        setEstimatedWaitTime(`${seconds}s`);
      } else if (minutes < 60) {
        setEstimatedWaitTime(`${minutes}dk`);
      } else {
        const hours = Math.round(minutes / 60);
        setEstimatedWaitTime(`${hours}s`);
      }
    }
  }, [estimatedWaitTimeQuery.data]);

  const setCooldown = useCallback(() => {
    cooldownRef.current = Date.now() + 5000;
    setTicketCooldown(5);
  }, []);

  const handleGetTicket = async () => {
    if (Date.now() < cooldownRef.current) return;
    if (config && !(config as any)?.isSystemActive) {
      toast.error("Sistem kapalı");
      return;
    }
    if (systemNotInitialized) {
      toast.error("Sistem henüz başlatılmadı");
      return;
    }
    
    // Validate phone number
    const minDigits = kioskMode === "usb_keypad" ? 3 : 10;
    const phoneClean = phoneNumber.replace(/[\s-]/g, "");
    if (!phoneClean || phoneClean.length < minDigits || phoneClean.length > 15) {
      setPhoneError(kioskMode === "usb_keypad" ? "En az 3 rakam giriniz" : "Geçerli bir telefon numarası giriniz (10-15 rakam)");
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await createTicketMutation.mutateAsync({ phoneNumber });
      setTicketNumber(result.ticketNumber);
      setShowSuccess(true);
      setCountdownSeconds(5);
      setIsPriority(false);
      setPhoneError("");
      setCooldown();

      // Emit socket event
      emit("ticket:created", {
        ticketNumber: result.ticketNumber,
        entryId: result.entryId,
        timestamp: Date.now(),
        isPriority: false,
      });
      playTicketSound();
    } catch (error) {
      console.error("Failed to get ticket:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetPriorityTicket = async (type: "elderly" | "disabled" | "pregnant") => {
    if (Date.now() < cooldownRef.current) return;
    if (config && !(config as any)?.isSystemActive) {
      toast.error("Sistem kapalı");
      return;
    }
    if (systemNotInitialized) {
      toast.error("Sistem henüz başlatılmadı");
      return;
    }
    
    // Validate phone number
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber.replace(/[\s-]/g, ""))) {
      setPhoneError("Geçerli bir telefon numarası giriniz (10-15 rakam)");
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await createPriorityTicketMutation.mutateAsync({ priorityType: type, phoneNumber });
      setTicketNumber(result.ticketNumber);
      setShowSuccess(true);
      setCountdownSeconds(5);
      setIsPriority(true);
      setPriorityType(type);
      setPhoneError("");
      setCooldown();

      // Emit socket event
      emit("ticket:created", {
        ticketNumber: result.ticketNumber,
        entryId: result.entryId,
        timestamp: Date.now(),
        isPriority: true,
        priorityType: type,
      });
      playTicketSound();
    } catch (error) {
      console.error("Failed to get priority ticket:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const kioskMode = (config as any)?.kioskMode || "touch";

  // Single button mode: capture any keypress as ticket trigger
  useEffect(() => {
    if (kioskMode !== "single_button") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); return; }
      if (!showSuccess && !isLoading) handleGetTicketSimple();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [kioskMode, showSuccess, isLoading]);

  // USB keypad mode: capture numeric keyboard input
  useEffect(() => {
    if (kioskMode !== "usb_keypad") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); return; }
      if (showSuccess) return;
      if (e.key === "Enter") {
        if (phoneNumber.length >= 3) handleGetTicket();
        return;
      }
      if (e.key === "Backspace") {
        setPhoneNumber(prev => prev.slice(0, -1));
        setPhoneError("");
        return;
      }
      if (/^[0-9]$/.test(e.key) && phoneNumber.length < 15) {
        setPhoneNumber(prev => prev + e.key);
        setPhoneError("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [kioskMode, phoneNumber, showSuccess]);

  // Serial port connection for Arduino buttons
  const [serialConnected, setSerialConnected] = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const portRef = useRef<any>(null);
  const actionsRef = useRef({ btn1: "simple_ticket", btn2: "priority_elderly" });

  // Keep actions ref in sync with config
  useEffect(() => {
    actionsRef.current = {
      btn1: (config as any)?.serialBtn1Action || "simple_ticket",
      btn2: (config as any)?.serialBtn2Action || "priority_elderly",
    };
  }, [config]);

  // Refs for latest callback functions so serial loop always has current versions
  const fnRef = useRef({
    simple: () => {}, normal: () => {},
    prioE: (_t: string) => {}, prioD: (_t: string) => {}, prioP: (_t: string) => {},
  });
  useEffect(() => {
    fnRef.current = {
      simple: handleGetTicketSimple,
      normal: handleGetTicket,
      prioE: (t: string) => handleGetPriorityTicket(t as any),
      prioD: (t: string) => handleGetPriorityTicket(t as any),
      prioP: (t: string) => handleGetPriorityTicket(t as any),
    };
  });

  const connectSerial = async () => {
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      localStorage.setItem("kiosk-serial-authorized", "1");
      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const inputStream = decoder.readable;
      readerRef.current = inputStream.getReader();
      setSerialConnected(true);
      readSerialLoop();
    } catch (e) {
      if ((e as Error).name !== "NotFoundError") console.error("Serial connect failed:", e);
    }
  };

  const readSerialLoop = async () => {
    const reader = readerRef.current;
    if (!reader) return;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const lines = (value as string).split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          console.log("[Serial]", trimmed);
          const { btn1, btn2 } = actionsRef.current;
          const fn = fnRef.current;
          let action = trimmed === "BTN1" ? btn1 : trimmed === "BTN2" ? btn2 : null;
          if (action === "simple_ticket") fn.simple();
          else if (action === "normal_ticket") fn.normal();
          else if (action === "priority_elderly") fn.prioE("elderly");
          else if (action === "priority_disabled") fn.prioD("disabled");
          else if (action === "priority_pregnant") fn.prioP("pregnant");
        }
      }
    } catch (e) {
      console.error("Serial read error:", e);
    } finally {
      setSerialConnected(false);
      readerRef.current = null;
      portRef.current = null;
      localStorage.removeItem("kiosk-serial-authorized");
    }
  };

  // Auto-connect to previously authorized serial port on mount
  useEffect(() => {
    if (!(navigator as any).serial) return;
    const saved = localStorage.getItem("kiosk-serial-authorized");
    if (!saved) return;
    (async () => {
      const ports = await (navigator as any).serial.getPorts();
      if (ports?.length > 0) {
        const port = ports[0];
        await port.open({ baudRate: 9600 });
        portRef.current = port;
        const decoder = new TextDecoderStream();
        port.readable.pipeTo(decoder.writable);
        readerRef.current = decoder.readable.getReader();
        setSerialConnected(true);
        readSerialLoop();
      } else {
        localStorage.removeItem("kiosk-serial-authorized");
      }
    })();
  }, []);

  // Full screen kiosk mode
  useEffect(() => {
    const handleFullscreen = () => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent ESC from exiting fullscreen
      if (e.key === "Escape") {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Only request fullscreen on user interaction
    const handleClick = () => {
      handleFullscreen();
      document.removeEventListener("click", handleClick);
    };
    document.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  // Single button ticket (no phone number required)
  const handleGetTicketSimple = async () => {
    if (Date.now() < cooldownRef.current) return;
    if (config && !(config as any)?.isSystemActive) return;
    if (systemNotInitialized || isLoading) return;
    setIsLoading(true);
    try {
      const result = await createTicketMutation.mutateAsync({});
      setTicketNumber(result.ticketNumber);
      setShowSuccess(true);
      setCountdownSeconds(5);
      setCooldown();
      emit("ticket:created", {
        ticketNumber: result.ticketNumber,
        entryId: result.entryId,
        timestamp: Date.now(),
        isPriority: false,
      });
      playTicketSound();
    } catch (error) {
      console.error("Failed to get ticket:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const playTicketSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;
      const t = (freq: number, start: number, dur: number) => {
        const o = audioContext.createOscillator();
        const g = audioContext.createGain();
        o.connect(g);
        g.connect(audioContext.destination);
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.15, start);
        g.gain.exponentialRampToValueAtTime(0.01, start + dur);
        o.start(start);
        o.stop(start + dur);
      };
      t(523, now, 0.12);
      t(659, now + 0.12, 0.12);
      t(784, now + 0.24, 0.2);
    } catch (_) {}
  };

  return (
    <div className="w-full h-screen bg-background flex items-center justify-center overflow-hidden">
      {/* Main Container */}
      <div className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative">
        {/* Background Grid Effect */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `
                linear-gradient(0deg, transparent 24%, rgba(255, 0, 110, 0.1) 25%, rgba(255, 0, 110, 0.1) 26%, transparent 27%, transparent 74%, rgba(255, 0, 110, 0.1) 75%, rgba(255, 0, 110, 0.1) 76%, transparent 77%, transparent),
                linear-gradient(90deg, transparent 24%, rgba(0, 217, 255, 0.1) 25%, rgba(0, 217, 255, 0.1) 26%, transparent 27%, transparent 74%, rgba(0, 217, 255, 0.1) 75%, rgba(0, 217, 255, 0.1) 76%, transparent 77%, transparent)
              `,
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        {/* System Closed Overlay */}
        {config && !(config as any)?.isSystemActive && (
          <div className="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-md bg-black/50" style={{ animation: "fadeIn 0.5s ease-out" }}>
            <div className="text-[12vw] md:text-[8vw] font-black text-red-500 leading-none" style={{ textShadow: "0 0 40px rgba(255,0,0,0.6), 0 0 80px rgba(255,0,0,0.3)", letterSpacing: "8px" }}>
              SİSTEM KAPALI
            </div>
          </div>
        )}

        {/* System Not Initialized Warning */}
        {systemNotInitialized && (
          <div className="absolute top-4 left-4 right-4 z-50 bg-red-900/80 border-2 border-red-500 rounded-lg p-4 text-center">
            <p className="text-red-200 font-semibold text-sm sm:text-base">
              Uyarı: Sistem henüz başlatılmadı. Lütfen Admin Panelinden sistemi başlatın.
            </p>
          </div>
        )}

          {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center gap-6 sm:gap-8 md:gap-12 w-full">
          {/* Serial status indicator */}
          {!showSuccess && (
            <div className="fixed bottom-4 right-4 z-50 text-[10px]">
              {serialConnected ? (
                <span className="text-green-500/40">SERIAL ✓</span>
              ) : (navigator as any).serial && !localStorage.getItem("kiosk-serial-authorized") && (
                <button onClick={connectSerial} className="text-foreground/20 hover:text-foreground/60 border border-foreground/20 px-2 py-1">
                  SERIAL KUR
                </button>
              )}
            </div>
          )}
          {!showSuccess ? (
            <>
              {/* Title */}
              <div className="text-center mb-4 sm:mb-6 md:mb-8 px-4">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black neon-pink mb-2 sm:mb-3 md:mb-4 break-words">
                  SIRAMATI K
                </h1>
                <p className="text-sm sm:text-base md:text-xl lg:text-2xl neon-blue">
                  Sıra Numarası Alma Sistemi
                </p>
              </div>

              {kioskMode === "single_button" ? (
                <>
                  {/* Tek Buton: huge button, no phone input */}
                  <button
                    onClick={handleGetTicketSimple}
                    disabled={isLoading || ticketCooldown > 0}
                     className="w-64 h-64 sm:w-72 sm:h-72 md:w-96 md:h-96 text-4xl sm:text-5xl md:text-7xl font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-none border-4 sm:border-8 border-border transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer touch-manipulation flex items-center justify-center"
                    style={{
                      animation: "neon-pulse 2s ease-in-out infinite",
                    }}
                   >
                    {isLoading ? "..." : ticketCooldown > 0 ? `${ticketCooldown}` : "SIRA\nAL"}
                  </button>
                  <p className="text-lg sm:text-xl text-foreground/60 text-center max-w-md px-4">
                    Sıra almak için butona basınız veya klavyede herhangi bir tuşa basınız.
                  </p>
                </>
              ) : (
                <>
                  {/* Phone Number Display (touch & usb_keypad modes) */}
                  <div className="w-full max-w-md px-4 mb-4">
                    <label className="block text-sm sm:text-base md:text-lg neon-blue mb-2 font-semibold text-center">
                      Telefon Numaranız
                    </label>
                    <div className="w-full h-14 sm:h-16 md:h-20 px-4 text-2xl sm:text-3xl md:text-4xl font-bold border-3 sm:border-4 border-border bg-background text-foreground flex items-center justify-center tracking-widest">
                      {phoneNumber ? (
                        <span>{phoneNumber}</span>
                      ) : (
                        <span className="text-foreground/30 text-lg sm:text-xl">
                          {kioskMode === "usb_keypad" ? "USB tuş takımı ile numara giriniz" : "Numara giriniz"}
                        </span>
                      )}
                    </div>
                    {phoneError && (
                      <p className="text-red-400 text-xs sm:text-sm mt-2 font-semibold text-center">{phoneError}</p>
                    )}
                  </div>

                  {/* Virtual Keypad (only in touch mode) */}
                  {kioskMode === "touch" && (
                    <div className="w-full max-w-xs mx-auto px-4 mb-6">
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {["1","2","3","4","5","6","7","8","9"].map((digit) => (
                          <button key={digit} onClick={() => { if (phoneNumber.length < 15) { setPhoneNumber(prev => prev + digit); setPhoneError(""); } }} disabled={isLoading}
                            className="h-14 sm:h-16 w-full text-xl sm:text-2xl font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground border-2 border-secondary rounded-none transition-all duration-200 active:scale-95 disabled:opacity-50 touch-manipulation">
                            {digit}
                          </button>
                        ))}
                        <button onClick={() => setPhoneNumber(prev => prev.slice(0, -1))} disabled={isLoading || !phoneNumber}
                          className="h-14 sm:h-16 w-full text-sm font-black bg-destructive hover:bg-destructive/90 text-destructive-foreground border-2 border-destructive rounded-none transition-all duration-200 active:scale-95 disabled:opacity-50 touch-manipulation">
                          SIL
                        </button>
                        <button onClick={() => { if (phoneNumber.length < 15) { setPhoneNumber(prev => prev + "0"); setPhoneError(""); } }} disabled={isLoading}
                          className="h-14 sm:h-16 w-full text-xl sm:text-2xl font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground border-2 border-secondary rounded-none transition-all duration-200 active:scale-95 disabled:opacity-50 touch-manipulation">
                          0
                        </button>
                        <button onClick={() => { setPhoneNumber(""); setPhoneError(""); }} disabled={isLoading || !phoneNumber}
                          className="h-14 sm:h-16 w-full text-sm font-black bg-foreground/20 hover:bg-foreground/30 text-foreground border-2 border-foreground/30 rounded-none transition-all duration-200 active:scale-95 disabled:opacity-50 touch-manipulation">
                          TEMIZLE
                        </button>
                      </div>
                    </div>
                  )}

                  {/* USB Keypad hint */}
                  {kioskMode === "usb_keypad" && (
                    <p className="text-sm text-foreground/60 text-center mb-4">
                      USB tuş takımı ile numaranızı girip onaylayınız
                    </p>
                  )}

                  {/* Instructions */}
                  <div className="text-center mb-6 sm:mb-8 md:mb-12 max-w-2xl px-4">
                    <p className="text-xs sm:text-sm md:text-lg lg:text-xl text-foreground/80 mb-3 sm:mb-4">
                      {kioskMode === "usb_keypad"
                        ? "Numaranızı USB tuş takımı ile girip onaylayın"
                        : "Lütfen telefon numaranızı girdikten sonra aşağıdaki butona basarak sıra numaranızı alınız"}
                    </p>
                    <div className="flex gap-2 sm:gap-3 md:gap-4 justify-center flex-wrap text-xs sm:text-sm">
                      <div className="neon-blue">► Hızlı İşlem</div>
                      <div className="neon-pink">► Güvenli Sistem</div>
                      <div className="neon-blue">► Anlık Bildirim</div>
                    </div>
                  </div>

                  {/* Regular Ticket Button */}
                  <Button
                    onClick={handleGetTicket}
                    disabled={isLoading || ticketCooldown > 0}
                    className="w-40 h-24 sm:w-48 sm:h-28 md:w-64 md:h-32 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-none border-2 sm:border-3 md:border-4 border-border transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 touch-manipulation"
                    style={{
                      minHeight: "auto",
                    }}
                  >
                    {isLoading ? "İŞLENİYOR..." : ticketCooldown > 0 ? `${ticketCooldown}sn` : "SIRA AL"}
                  </Button>

                  {/* Priority Ticket Section */}
                  <div className="w-full max-w-4xl px-4">
                    <p className="text-center text-xs sm:text-sm md:text-base lg:text-lg neon-blue mb-4 sm:mb-6">
                      ÖNCELİKLİ SIRA (Yaşlı, Engelli, Hamile)
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                      <Button onClick={() => handleGetPriorityTicket("elderly")} disabled={isLoading || ticketCooldown > 0}
                        className="h-16 sm:h-20 md:h-24 text-xs sm:text-sm md:text-base lg:text-lg font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-none border-2 sm:border-3 md:border-4 border-secondary transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 touch-manipulation"
                        style={{ minHeight: "auto" }}>
                        {isLoading ? "..." : ticketCooldown > 0 ? `${ticketCooldown}sn` : "👴 YAŞLI"}
                      </Button>
                      <Button onClick={() => handleGetPriorityTicket("disabled")} disabled={isLoading || ticketCooldown > 0}
                        className="h-16 sm:h-20 md:h-24 text-xs sm:text-sm md:text-base lg:text-lg font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-none border-2 sm:border-3 md:border-4 border-secondary transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 touch-manipulation"
                        style={{ minHeight: "auto" }}>
                        {isLoading ? "..." : ticketCooldown > 0 ? `${ticketCooldown}sn` : "♿ ENGELLİ"}
                      </Button>
                      <Button onClick={() => handleGetPriorityTicket("pregnant")} disabled={isLoading || ticketCooldown > 0}
                        className="h-16 sm:h-20 md:h-24 text-xs sm:text-sm md:text-base lg:text-lg font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-none border-2 sm:border-3 md:border-4 border-secondary transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 touch-manipulation"
                        style={{ minHeight: "auto" }}>
                        {isLoading ? "..." : ticketCooldown > 0 ? `${ticketCooldown}sn` : "🤰 HAMİLE"}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Footer Info */}
              <div className="text-center text-xs sm:text-sm text-foreground/60 mt-6 sm:mt-8 md:mt-12">
                <p>Sistem Durumu: <span className="text-green-400">● AKTIF</span></p>
              </div>
            </>
          ) : (
            <>
              {/* Success Screen */}
              <div className="text-center w-full px-4">
                <div className="mb-6 sm:mb-8">
                  {isPriority && (
                    <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl neon-blue mb-2 sm:mb-3 md:mb-4">
                      ⭐ ÖNCELİKLİ SIRA ⭐
                    </p>
                  )}
                  <div
                    className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black neon-pink mb-2 sm:mb-3 md:mb-4"
                    style={{
                      animation: "neon-pulse 1s ease-in-out infinite",
                    }}
                  >
                    {ticketNumber}
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl neon-blue mb-4 sm:mb-6 md:mb-8">
                    SİRA NUMARANIZ
                  </p>
                </div>

                {/* HUD Border Container */}
                <div className="border-2 sm:border-3 md:border-4 border-border p-4 sm:p-6 md:p-8 relative max-w-lg mx-auto">
                  <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-border" />
                  <div className="absolute top-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-border" />
                  <div className="absolute bottom-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-b-2 sm:border-b-3 md:border-b-4 border-l-2 sm:border-l-3 md:border-l-4 border-border" />
                  <div className="absolute bottom-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-b-2 sm:border-b-3 md:border-b-4 border-r-2 sm:border-r-3 md:border-r-4 border-border" />

                  <p className="text-sm sm:text-base md:text-lg lg:text-xl text-foreground/80 mb-2 sm:mb-3 md:mb-4">
                    Lütfen bekleme salonunda bekleyiniz.
                  </p>
                  <p className="text-xs sm:text-sm md:text-base lg:text-lg neon-blue mb-4 sm:mb-5 md:mb-6">
                    Numaranız çağrıldığında ana ekranda görülecektir.
                  </p>

                  {/* Estimated Wait Time */}
                  {estimatedWaitTime && (
                    <div className="mb-4 sm:mb-5 md:mb-6 p-2 sm:p-3 md:p-4 border-2 sm:border-3 md:border-4 border-secondary">
                      <p className="text-xs sm:text-sm text-foreground/60 mb-1 sm:mb-2">TAHMİNİ BEKLEME SÜRESİ</p>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-black neon-blue">
                        {estimatedWaitTime}
                      </p>
                    </div>
                  )}

                  {/* Countdown */}
                  <div className="text-4xl sm:text-5xl md:text-5xl font-black neon-pink">
                    {countdownSeconds}
                  </div>
                  <p className="text-xs sm:text-sm text-foreground/60 mt-3 sm:mt-4">
                    Sayfa otomatik sıfırlanacak
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Corner Accents */}
        <div className="absolute top-2 sm:top-3 md:top-4 left-2 sm:left-3 md:left-4 w-6 sm:w-8 md:w-12 h-6 sm:h-8 md:h-12 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-border opacity-50" />
        <div className="absolute top-2 sm:top-3 md:top-4 right-2 sm:right-3 md:right-4 w-6 sm:w-8 md:w-12 h-6 sm:h-8 md:h-12 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-secondary opacity-50" />
        <div className="absolute bottom-2 sm:bottom-3 md:bottom-4 left-2 sm:left-3 md:left-4 w-6 sm:w-8 md:w-12 h-6 sm:h-8 md:h-12 border-b-2 sm:border-b-3 md:border-b-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary opacity-50" />
        <div className="absolute bottom-2 sm:bottom-3 md:bottom-4 right-2 sm:right-3 md:right-4 w-6 sm:w-8 md:w-12 h-6 sm:h-8 md:h-12 border-b-2 sm:border-b-3 md:border-b-4 border-r-2 sm:border-r-3 md:border-r-4 border-border opacity-50" />
      </div>

      <style>{`
        @keyframes neon-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        @media (max-width: 640px) {
          button {
            font-size: clamp(1.25rem, 5vw, 1.875rem);
          }
        }
      `}</style>
    </div>
  );
}
