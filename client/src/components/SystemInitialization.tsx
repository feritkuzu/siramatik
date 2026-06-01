import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SystemInitializationProps {
  onInitialized?: () => void;
}

export function SystemInitialization({ onInitialized }: SystemInitializationProps) {
  const [tempBankCount, setTempBankCount] = useState("2");
  const [isLoading, setIsLoading] = useState(false);

  const initSystemMutation = trpc.admin.initialize.useMutation();
  const { refetch: refetchConfig } = trpc.admin.getConfig.useQuery(undefined, {
    refetchInterval: 2000,
  });
  const { refetch: refetchBanks } = trpc.bank.getAll.useQuery(undefined, {
    refetchInterval: 2000,
  });

  const handleInitializeSystem = async () => {
    console.log("handleInitializeSystem called");
    setIsLoading(true);
    try {
      const count = parseInt(tempBankCount);
      console.log("Parsed count:", count);
      if (count < 2 || count > 10) {
        alert("Banko sayısı 2 ile 10 arasında olmalıdır");
        setIsLoading(false);
        return;
      }
      console.log("Calling initSystemMutation...");
      await initSystemMutation.mutateAsync({ bankCount: count });
      console.log("Mutation successful");
      await refetchConfig();
      await refetchBanks();
      if (onInitialized) {
        onInitialized();
      }
    } catch (error) {
      console.error("Failed to initialize system:", error);
      alert("Sistem başlatılamadı: " + String(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-4 border-primary p-6 mb-8 relative bg-red-900/20">
      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary pointer-events-none" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary pointer-events-none" />
      <h2 className="text-3xl font-black neon-pink mb-4" style={{ textShadow: "0 0 10px currentColor" }}>
        SİSTEM BAŞLATMA
      </h2>
      <p className="text-lg neon-blue mb-6">Sistemi başlatmak için banko sayısını seçin ve BAŞLAT butonuna tıklayın.</p>
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-lg font-black neon-blue mb-2">BANKO SAYISI (2-10)</label>
          <Input
            type="number"
            min="2"
            max="10"
            value={tempBankCount}
            onChange={(e) => setTempBankCount(e.target.value)}
            className="text-2xl font-black h-12 border-4 border-primary bg-card text-foreground"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            console.log('Native button clicked!');
            e.preventDefault();
            handleInitializeSystem();
          }}
          disabled={isLoading || initSystemMutation.isPending}
          className="h-12 px-8 font-black bg-primary hover:bg-primary/90 text-primary-foreground border-4 border-primary neon-glow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initSystemMutation.isPending ? "BAŞLATILIYOR..." : "BAŞLAT"}
        </button>
      </div>
    </div>
  );
}
