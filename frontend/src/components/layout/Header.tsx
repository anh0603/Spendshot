import { NotificationCenter } from "./NotificationCenter";
import { photoUrl } from "../../lib/photo";

export function Header({ userName = "Bạn", avatar, offline = false }: { userName?: string; avatar?: string; offline?: boolean }) {
  const avatarSrc = photoUrl(avatar);
  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-8 bg-white/80 backdrop-blur-xl border-b border-border sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {avatarSrc ? (
          <img src={avatarSrc} alt="Ảnh đại diện" className="w-10 h-10 rounded-full object-cover border-2 border-primary/30" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[#FF8A5C] flex items-center justify-center text-white font-bold">
            {userName[0]?.toUpperCase() || "B"}
          </div>
        )}
        <div>
          <p className="text-xs text-text-secondary">Xin chào</p>
          <p className="font-semibold text-primary">{userName}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {offline && <span className="text-xs px-2 py-1 rounded-full bg-[#FEF3C7] text-warning border border-warning/20">Offline</span>}
        <NotificationCenter />
      </div>
    </header>
  );
}
