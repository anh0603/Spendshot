import { formatVND } from "../../lib/formatVND";

interface Props {
  budget: number;
  spent: number;
  onClick?: () => void;
}

export function JarCard({ budget, spent, onClick }: Props) {
  const remaining = budget - spent;
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const isNegative = remaining < 0;
  const displayPct = Math.min(percentage, 100);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-up ${isNegative ? "bg-[#FEF2F2]" : ""}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Ngân sách</p>
          <p className="text-2xl font-bold text-text-primary">{formatVND(budget)}</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-primary-light text-primary font-medium">{Math.round(percentage)}% đã dùng</span>
      </div>

      <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all ${isNegative ? "bg-danger" : "bg-primary"}`}
          style={{ width: `${Math.min(displayPct, 100)}%` }}
        />
        {isNegative && <div className="h-full bg-danger" style={{ width: "100%" }} />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-text-secondary">Đã chi</p>
          <p className="text-sm font-semibold text-text-primary">{formatVND(spent)}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Còn lại</p>
          <p className={`text-sm font-bold ${isNegative ? "text-danger" : "text-success"}`}>{formatVND(remaining)}</p>
        </div>
      </div>

      {isNegative && (
        <div className="mt-4 p-3 bg-[#FEF3C7] border border-warning/30 rounded-md">
          <p className="text-xs text-warning font-medium">Bạn đã vượt ngân sách tháng này {formatVND(Math.abs(remaining))}.</p>
        </div>
      )}
    </div>
  );
}
