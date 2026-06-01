import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function Home() {
  const { user, logout, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="w-full min-h-screen bg-background flex flex-col items-center justify-center p-8">
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

      <div className="relative z-10 max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-7xl md:text-8xl font-black neon-pink mb-4">
            SIRAMATI K
          </h1>
          <p className="text-2xl md:text-3xl neon-blue mb-4">
            Gerçek Zamanlı Sıra Yönetim Sistemi
          </p>
          <p className="text-lg text-foreground/70">
            Cyberpunk Estetiği ile Geliştirilmiş Profesyonel Çözüm
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="border-4 border-primary p-6 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
            <h3 className="text-2xl font-black neon-pink mb-3">KIOSK EKRANI</h3>
            <p className="text-foreground/80 mb-4">
              Müşteriler dokunmatik ekrandan sıra numarası alabilir. Tam ekran, kiosk modunda çalışan arayüz.
            </p>
            <Button
              onClick={() => navigate("/kiosk")}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary neon-glow font-black"
            >
              KIOSK MODUNA GİT
            </Button>
          </div>

          <div className="border-4 border-secondary p-6 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-secondary" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-secondary" />
            <h3 className="text-2xl font-black neon-blue mb-3">ANA EKRAN</h3>
            <p className="text-foreground/80 mb-4">
              Bekleme salonundaki büyük monitörde çağrılan numaraları yanıp sönerek gösterir. Ses bildirimi ile destekli.
            </p>
            <Button
              onClick={() => navigate("/display")}
              className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground border-4 border-secondary neon-glow font-black"
            >
              EKRANI AÇ
            </Button>
          </div>

          <div className="border-4 border-primary p-6 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
            <h3 className="text-2xl font-black neon-pink mb-3">BANKO YETKİLİ</h3>
            <p className="text-foreground/80 mb-4">
              Gişe görevlileri "Sıradakini Çağır" butonuyla müşteri çağırabilir ve hizmet yönetebilir.
            </p>
            <Button
              onClick={() => navigate("/bank")}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary neon-glow font-black"
            >
              BANKO PANELİ
            </Button>
          </div>

          <div className="border-4 border-secondary p-6 relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-secondary" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-secondary" />
            <h3 className="text-2xl font-black neon-blue mb-3">ADMİN PANELİ</h3>
            <p className="text-foreground/80 mb-4">
              Sistem yönetimi, banko sayısı ayarı, istatistikler ve sistem durumu izleme.
            </p>
            <Button
              onClick={() => navigate("/admin")}
              className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground border-4 border-secondary neon-glow font-black"
            >
              ADMİN PANELİ
            </Button>
          </div>
        </div>

        {/* System Info */}
        <div className="border-4 border-primary p-8 relative mb-8">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary" />

          <h2 className="text-3xl font-black neon-pink mb-6">SİSTEM ÖZELLİKLERİ</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-black neon-blue mb-3">✓ Gerçek Zamanlı</h3>
              <p className="text-foreground/80">
                WebSocket teknolojisi ile tüm bileşenler anlık senkronize çalışır.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-black neon-blue mb-3">✓ Değişken Banko</h3>
              <p className="text-foreground/80">
                2 ile 10 arasında banko sayısı dinamik olarak ayarlanabilir.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-black neon-blue mb-3">✓ Ses Bildirimi</h3>
              <p className="text-foreground/80">
                Web Audio API ile doğrudan bildirim sesi üretilir.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-black neon-blue mb-3">✓ Veri Kaydı</h3>
              <p className="text-foreground/80">
                Tüm sıra hareketleri ve istatistikler veritabanında tutulur.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-black neon-blue mb-3">✓ Cyberpunk Tasarım</h3>
              <p className="text-foreground/80">
                Neon renkler, glow efektleri ve HUD tasarımı ile modern görünüm.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-black neon-blue mb-3">✓ Responsive</h3>
              <p className="text-foreground/80">
                Masaüstü, tablet ve mobil cihazlarda sorunsuz çalışır.
              </p>
            </div>
          </div>
        </div>

        {/* Auth Section */}
        <div className="flex gap-4 justify-center">
          {isAuthenticated ? (
            <>
              <div className="text-center">
                <p className="text-foreground/80 mb-4">
                  Hoş geldiniz, <span className="neon-pink font-black">{user?.name}</span>
                </p>
              </div>
              <Button
                onClick={() => logout()}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-4 border-destructive neon-glow font-black"
              >
                ÇIKIŞ YAP
              </Button>
            </>
          ) : (
            <Button
              onClick={() => (window.location.href = getLoginUrl())}
              className="bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary neon-glow font-black px-8 py-3 text-lg"
            >
              GİRİŞ YAP
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-foreground/60">
          <p>Sıramatik v1.0 - Gerçek Zamanlı Sıra Yönetim Sistemi</p>
          <p className="mt-2">
            <span className="neon-blue">● CANLI</span> - Sistem Aktif
          </p>
        </div>
      </div>

      {/* Corner Accents */}
      <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-primary opacity-50" />
      <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-secondary opacity-50" />
      <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-secondary opacity-50" />
      <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-primary opacity-50" />
    </div>
  );
}
