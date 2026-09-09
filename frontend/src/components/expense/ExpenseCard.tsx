import { formatVND } from "../../lib/formatVND";
import { NoPhoto } from "./NoPhoto";

interface Props {
  photo: string;
  amount: number;
  time: string;
  onClick?: () => void;
  /** Độ trễ hiện dần (ms) để feed chạy so le */
  enterDelay?: number;
}

export function ExpenseCard({ photo, amount, time, onClick, enterDelay = 0 }: Props) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg overflow-hidden shadow-sm border border-border hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group animate-fade-up"
      style={{ animationDelay: `${Math.min(enterDelay, 400)}ms` }}
    >
      <div className="aspect-square overflow-hidden bg-gray-100">
        {photo ? (
          <img src={photo} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200" loading="lazy" />
        ) : (
          <NoPhoto className="w-full h-full" />
        )}
      </div>
      <div className="p-2 md:p-3">
        <p className="text-[13px] md:text-sm font-bold text-text-primary">{formatVND(amount)}</p>
        <p className="text-[10px] md:text-[11px] font-medium uppercase tracking-wide text-text-secondary">{time}</p>
      </div>
    </div>
  );
}

export function ExpenseGrid({ children }: { children: React.ReactNode }) {
  return <div data-testid="expense-grid" className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">{children}</div>;
}
