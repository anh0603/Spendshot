import { Camera, Coins } from "lucide-react";
import { Logo } from "../ui/Logo";

export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB] grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 mb-6">
            <Logo size={32} />
            <span className="font-bold text-lg">SpendShot</span>
          </div>
          {children}
        </div>
      </div>
      <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 p-12 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-orange-200/40 blur-2xl" />
        <div className="absolute -bottom-24 -left-16 w-80 h-80 rounded-full bg-amber-200/40 blur-2xl" />
        <div className="relative text-center max-w-md">
          <div className="relative w-64 h-64 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-white/60 blur-xl" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-center animate-float">
              <Camera size={72} strokeWidth={1.5} className="text-white" />
            </div>
            <div className="absolute top-4 right-8 w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-center animate-float" style={{ animationDelay: "0.8s" }}>
              <Coins size={26} className="text-white" />
            </div>
            <div className="absolute bottom-6 left-6 w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 shadow-[0_4px_20px_rgba(0,0,0,0.05)] animate-float" style={{ animationDelay: "1.6s" }} />
          </div>
          <p className="text-sm text-gray-500">[Illustration: 3D Camera &amp; Gold Coins]</p>
          <p className="text-xl font-bold mt-3">Chụp chi tiêu. Nhìn thấy tiền đi.</p>
        </div>
      </div>
    </div>
  );
}
