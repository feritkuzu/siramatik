import { useState, useEffect } from "react";
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

  // Check system config
  const { data: config } = trpc.admin.getConfig.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const createTicketMutation = trpc.queue.createTicket.useMutation();
  const createPriorityTicketMutation = trpc.queue.createPriorityTicket.useMutation();
  const estimatedWaitTimeQuery = trpc.queue.getEstimatedWaitTime.useQuery(
    { ticketNumber: ticketNumber || 0 },
    { enabled: ticketNumber !== null && showSuccess }
  );
  const initSystemMutation = trpc.admin.initialize.useMutation();
  const { emit } = useSocket("kiosk");

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

  const handleGetTicket = async () => {
    if (systemNotInitialized) {
      alert("Sistem henüz başlatılmadı. Lütfen Admin Panelinden sistemi başlatın.");
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
      const result = await createTicketMutation.mutateAsync({ phoneNumber });
      setTicketNumber(result.ticketNumber);
      setShowSuccess(true);
      setCountdownSeconds(5);
      setIsPriority(false);
      setPhoneError("");

      // Emit socket event
      emit("ticket:created", {
        ticketNumber: result.ticketNumber,
        entryId: result.entryId,
        timestamp: Date.now(),
        isPriority: false,
      });
    } catch (error) {
      console.error("Failed to get ticket:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetPriorityTicket = async (type: "elderly" | "disabled" | "pregnant") => {
    if (systemNotInitialized) {
      alert("Sistem henüz başlatılmadı. Lütfen Admin Panelinden sistemi başlatın.");
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

      // Emit socket event
      emit("ticket:created", {
        ticketNumber: result.ticketNumber,
        entryId: result.entryId,
        timestamp: Date.now(),
        isPriority: true,
        priorityType: type,
      });
    } catch (error) {
      console.error("Failed to get priority ticket:", error);
    } finally {
      setIsLoading(false);
    }
  };

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

        {/* System Not Initialized Warning */}
        {systemNotInitialized && (
          <div className="absolute top-4 left-4 right-4 z-50 bg-red-900/80 border-2 border-red-500 rounded-lg p-4 text-center">
            <p className="text-red-200 font-semibold text-sm sm:text-base">
              Warning: Sistem henuz baslatilmadi. Lutfen Admin Panelinden sistemi baslatn.
            </p>
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center gap-6 sm:gap-8 md:gap-12 w-full">
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

              {/* Phone Number Input */}
              <div className="w-full max-w-md px-4 mb-6 sm:mb-8">
                <label className="block text-sm sm:text-base md:text-lg neon-blue mb-2 sm:mb-3 font-semibold">
                  Telefon Numaranız
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setPhoneError("");
                  }}
                  placeholder="Örn: 05301234567"
                  className="w-full h-12 sm:h-14 md:h-16 px-4 text-lg sm:text-xl font-bold border-3 sm:border-4 border-primary bg-background text-foreground rounded-none focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                />
                {phoneError && (
                  <p className="text-red-400 text-xs sm:text-sm mt-2 font-semibold">{phoneError}</p>
                )}
              </div>

              {/* Instructions */}
              <div className="text-center mb-6 sm:mb-8 md:mb-12 max-w-2xl px-4">
                <p className="text-xs sm:text-sm md:text-lg lg:text-xl text-foreground/80 mb-3 sm:mb-4">
                  Lütfen telefon numaranızı girdikten sonra aşağıdaki butona basarak sıra numaranızı alınız
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
                disabled={isLoading}
                className="w-40 h-24 sm:w-48 sm:h-28 md:w-64 md:h-32 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-none border-2 sm:border-3 md:border-4 border-primary transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 touch-manipulation"
                style={{
                  textShadow: "0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor",
                  minHeight: "auto",
                }}
              >
                {isLoading ? "İŞLENİYOR..." : "SIRA AL"}
              </Button>

              {/* Priority Ticket Section */}
              <div className="w-full max-w-4xl px-4">
                <p className="text-center text-xs sm:text-sm md:text-base lg:text-lg neon-blue mb-4 sm:mb-6">
                  ÖNCELİKLİ SIRA (Yaşlı, Engelli, Hamile)
                </p>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                  {/* Elderly Button */}
                  <Button
                    onClick={() => handleGetPriorityTicket("elderly")}
                    disabled={isLoading}
                    className="h-16 sm:h-20 md:h-24 text-xs sm:text-sm md:text-base lg:text-lg font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-none border-2 sm:border-3 md:border-4 border-secondary transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 touch-manipulation"
                    style={{
                      textShadow: "0 0 10px currentColor",
                      minHeight: "auto",
                    }}
                  >
                    {isLoading ? "..." : "👴 YAŞLI"}
                  </Button>

                  {/* Disabled Button */}
                  <Button
                    onClick={() => handleGetPriorityTicket("disabled")}
                    disabled={isLoading}
                    className="h-16 sm:h-20 md:h-24 text-xs sm:text-sm md:text-base lg:text-lg font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-none border-2 sm:border-3 md:border-4 border-secondary transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 touch-manipulation"
                    style={{
                      textShadow: "0 0 10px currentColor",
                      minHeight: "auto",
                    }}
                  >
                    {isLoading ? "..." : "♿ ENGELLİ"}
                  </Button>

                  {/* Pregnant Button */}
                  <Button
                    onClick={() => handleGetPriorityTicket("pregnant")}
                    disabled={isLoading}
                    className="h-16 sm:h-20 md:h-24 text-xs sm:text-sm md:text-base lg:text-lg font-black bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-none border-2 sm:border-3 md:border-4 border-secondary transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 touch-manipulation"
                    style={{
                      textShadow: "0 0 10px currentColor",
                      minHeight: "auto",
                    }}
                  >
                    {isLoading ? "..." : "🤰 HAMİLE"}
                  </Button>
                </div>
              </div>

              {/* Footer Info */}
              <div className="text-center text-xs sm:text-sm text-foreground/60 mt-6 sm:mt-8 md:mt-12">
                <p>Sistem Durumu: <span className="text-green-400" style={{ textShadow: "0 0 10px currentColor" }}>● AKTIF</span></p>
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
                      textShadow: "0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor",
                    }}
                  >
                    {ticketNumber}
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl neon-blue mb-4 sm:mb-6 md:mb-8">
                    SİRA NUMARANIZ
                  </p>
                </div>

                {/* HUD Border Container */}
                <div className="border-2 sm:border-3 md:border-4 border-primary p-4 sm:p-6 md:p-8 relative max-w-lg mx-auto">
                  <div className="absolute top-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary" />
                  <div className="absolute top-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary" />
                  <div className="absolute bottom-0 left-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-b-2 sm:border-b-3 md:border-b-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary" />
                  <div className="absolute bottom-0 right-0 w-2 sm:w-3 md:w-4 h-2 sm:h-3 md:h-4 border-b-2 sm:border-b-3 md:border-b-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary" />

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
                      <p className="text-2xl sm:text-3xl md:text-4xl font-black neon-blue" style={{ textShadow: "0 0 10px currentColor" }}>
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
        <div className="absolute top-2 sm:top-3 md:top-4 left-2 sm:left-3 md:left-4 w-6 sm:w-8 md:w-12 h-6 sm:h-8 md:h-12 border-t-2 sm:border-t-3 md:border-t-4 border-l-2 sm:border-l-3 md:border-l-4 border-primary opacity-50" />
        <div className="absolute top-2 sm:top-3 md:top-4 right-2 sm:right-3 md:right-4 w-6 sm:w-8 md:w-12 h-6 sm:h-8 md:h-12 border-t-2 sm:border-t-3 md:border-t-4 border-r-2 sm:border-r-3 md:border-r-4 border-secondary opacity-50" />
        <div className="absolute bottom-2 sm:bottom-3 md:bottom-4 left-2 sm:left-3 md:left-4 w-6 sm:w-8 md:w-12 h-6 sm:h-8 md:h-12 border-b-2 sm:border-b-3 md:border-b-4 border-l-2 sm:border-l-3 md:border-l-4 border-secondary opacity-50" />
        <div className="absolute bottom-2 sm:bottom-3 md:bottom-4 right-2 sm:right-3 md:right-4 w-6 sm:w-8 md:w-12 h-6 sm:h-8 md:h-12 border-b-2 sm:border-b-3 md:border-b-4 border-r-2 sm:border-r-3 md:border-r-4 border-primary opacity-50" />
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
            font-size: clamp(1.25rem, 5vw, 1.875rem);
          }
        }
      `}</style>
    </div>
  );
}
