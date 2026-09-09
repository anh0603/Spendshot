import { useEffect, useState } from "react";
import { Trophy, CalendarDays, Receipt, Wallet } from "lucide-react";
import { Reveal } from "../../components/ui/Reveal";
import { listJars } from "../../lib/jar";
import { listExpenses } from "../../lib/expense";
import { formatVND } from "../../lib/formatVND";
import { photoUrl } from "../../lib/photo";
import { NoPhoto } from "../../components/expense/NoPhoto";
import { parseServerTime } from "../../lib/time";

const CAT_COLORS: Record<string, string> = {
  "An uong": "#FF6B35",
  "Di chuyen": "#3B82F6",
  "Mua sam": "#8B5CF6",
  "Tien nha": "#10B981",
  "Dien": "#F59E0B",
  "Nuoc": "#06B6D4",
  "Giai tri": "#EC4899",
  "Khac": "#6B7280",
};
const CAT_LABELS: Record<string, string> = {
  "An uong": "Ăn uống",
  "Di chuyen": "Di chuyển",
  "Mua sam": "Mua sắm",
  "Tien nha": "Tiền nhà",
  "Dien": "Điện",
  "Nuoc": "Nước",
  "Giai tri": "Giải trí",
  "Khac": "Khác",
};

export function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [jarCount, setJarCount] = useState(0);
  const [biggest, setBiggest] = useState<any>(null);
  const [avgDay, setAvgDay] = useState(0);
  const [byCat, setByCat] = useState<{ cat: string; amount: number }[]>([]);
  const [byDay, setByDay] = useState<{ day: string; amount: number }[]>(() => emptyDays());
  const [byMonth, setByMonth] = useState<{ month: string; amount: number }[]>(() => emptyMonths());

  useEffect(() => {
    (async () => {
      try {
        const jars = await listJars();
        setJarCount(jars.length);
        let all: any[] = [];
        for (const j of jars.slice(0, 3)) {
          try { all = all.concat(await listExpenses(j.id)); } catch { /* bỏ qua */ }
        }
        setCount(all.length);
        setTotal(all.reduce((s, e) => s + e.amount, 0));
        if (all.length > 0) {
          setBiggest(all.reduce((a, b) => (a.amount >= b.amount ? a : b)));
          const daySet = new Set(all.map((e) => parseServerTime(e.created_at).toDateString()));
          setAvgDay(Math.round(all.reduce((s, e) => s + e.amount, 0) / Math.max(1, daySet.size)));
        }
        const cats: Record<string, number> = {};
        const dayMap: Record<string, number> = {};
        const monthMap: Record<string, number> = {};
        for (const e of all) {
          const c = e.category || "Khac";
          cats[c] = (cats[c] || 0) + e.amount;
          const dt = parseServerTime(e.created_at);
          const dk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
          dayMap[dk] = (dayMap[dk] || 0) + e.amount;
          const mk = `${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
          monthMap[mk] = (monthMap[mk] || 0) + e.amount;
        }
        // Đủ 7 ngày gần nhất (ngày trống = 0) để biểu đồ liền mạch
        const days: { day: string; amount: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const dt = new Date();
          dt.setDate(dt.getDate() - i);
          const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
          days.push({ day: dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }), amount: dayMap[key] || 0 });
        }
        // Đủ 6 tháng gần nhất (tháng trống = 0)
        const months: { month: string; amount: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const dt = new Date();
          dt.setMonth(dt.getMonth() - i);
          const key = `${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
          months.push({ month: key, amount: monthMap[key] || 0 });
        }
        setByCat(Object.entries(cats).map(([cat, amount]) => ({ cat, amount })).sort((a, b) => b.amount - a.amount));
        setByDay(days);
        setByMonth(months);
      } catch { /* offline */ }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6"><div className="h-40 bg-white rounded-modal animate-pulse" /></div>;

function shortNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}Tr`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return `${n}`;
}

function emptyDays(): { day: string; amount: number }[] {
  const out: { day: string; amount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    out.push({ day: dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }), amount: 0 });
  }
  return out;
}

function emptyMonths(): { month: string; amount: number }[] {
  const out: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date();
    dt.setMonth(dt.getMonth() - i);
    out.push({ month: `${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`, amount: 0 });
  }
  return out;
}

/** Biểu đồ cột đứng: trục số Y + nhãn ngày + giá trị trên đầu cột + tooltip khi di chuột */
function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = [1, 0.66, 0.33, 0].map((t) => Math.round(max * t));
  return (
    <div className="relative" data-testid="day-chart">
      <div className="absolute left-8 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
        {ticks.map((t, i) => (
          <div key={i} className="border-t border-dashed border-gray-200 relative">
            <span className="absolute -left-8 -top-2 text-[9px] text-gray-500 w-7 text-right">{shortNum(t)}</span>
          </div>
        ))}
      </div>
      <div className="ml-8 flex items-end gap-1.5 h-40">
        {data.map((d, i) => (
          <div
            key={d.label}
            className="relative flex-1 flex flex-col items-center justify-end gap-1 h-full cursor-pointer"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={() => setHover(i)}
          >
            {hover === i && (
              <div data-testid="chart-tip" className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-lg px-2.5 py-1.5 text-center whitespace-nowrap z-10 shadow-lg animate-pop pointer-events-none">
                <p className="text-[10px] opacity-70">{d.label}</p>
                <p className="text-xs font-bold">{formatVND(d.value)}</p>
              </div>
            )}
            <span className="text-[10px] font-semibold" style={{ color }}>{d.value > 0 ? shortNum(d.value) : ""}</span>
            <div
              className="w-full max-w-[44px] rounded-t-lg transition-all"
              style={{
                height: `${Math.max(d.value > 0 ? 8 : 2, (d.value / max) * 118)}px`,
                background: `linear-gradient(to top, ${color}B3, ${color})`,
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
              title={formatVND(d.value)}
            />
            <span className="text-[10px] text-text-secondary">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Biểu đồ miền (area) mượt: đường cong + tô gradient mờ dần + lưới + nhãn trục */
function AreaChart({ data, color, height = 160 }: { data: { label: string; value: number }[]; color: string; height?: number }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-text-secondary">Chưa có dữ liệu</p>;
  }
  const W = 320;
  const H = height;
  const padL = 34;
  const padB = 20;
  const padT = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const innerW = W - padL - 8;
  const innerH = H - padT - padB;
  const pts = data.map((d, i) => ({
    x: padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: padT + innerH - (d.value / max) * innerH,
  }));
  // Đường cong mượt Catmull-Rom
  let line = "";
  if (pts.length === 1) {
    line = `M ${pts[0].x - 20} ${pts[0].y} L ${pts[0].x + 20} ${pts[0].y}`;
  } else {
    line = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      line += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
  }
  const area = `${line} L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${padT + innerH} Z`;
  const gid = `g-${color.replace("#", "")}-${data.length}`;
  const ticks = [0, 0.5, 1].map((t) => ({ y: padT + innerH - t * innerH, v: Math.round(max * t) }));
  const labelIdx = data.map((_, i) => i).filter((i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1);

  const [hover, setHover] = useState<number | null>(null);

  const onMove = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < bd) { bd = d; best = i; }
    });
    setHover(best);
  };

  const tipX = hover != null ? Math.min(Math.max(pts[hover].x, 56), W - 56) : 0;
  const tipY = hover != null ? Math.max(pts[hover].y - 46, 20) : 0;

  return (
    <div data-testid="month-chart" className="cursor-crosshair"
      onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
      onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
      onTouchEnd={() => setHover(null)}
    >
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.8} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={t.y} x2={W - 4} y2={t.y} stroke="#E5E7EB" strokeDasharray="3 3" strokeWidth={1} />
          <text x={padL - 5} y={t.y + 3} textAnchor="end" fontSize={8} fill="#6B7280">{shortNum(t.v)}</text>
        </g>
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 5 : data[i].value > 0 ? 3.5 : 0} fill="#fff" stroke={color} strokeWidth={2} />
      ))}
      {hover != null && (
        <g>
          <line x1={pts[hover].x} y1={padT} x2={pts[hover].x} y2={padT + innerH} stroke={color} strokeWidth={1} strokeDasharray="3 2" opacity={0.6} />
          <g transform={`translate(${tipX},${tipY})`}>
            <rect x={-52} y={-16} width={104} height={34} rx={8} fill="#111827" />
            <text textAnchor="middle" fontSize={9} fill="#9CA3AF" y={-2}>{data[hover].label}</text>
            <text textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" y={12}>{formatVND(data[hover].value)}</text>
          </g>
        </g>
      )}
      {labelIdx.map((i) => (
        <text key={i} x={pts[i].x} y={H - 6} textAnchor="middle" fontSize={9} fill="#6B7280">{data[i].label}</text>
      ))}
    </svg>
    </div>
  );
}

  return (
    <div className="max-w-[1000px] mx-auto p-4 lg:p-8 pb-20 lg:pb-8">
      <h1 className="text-xl font-bold mb-4">Thống kê</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Reveal delay={0}>
        <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-l-4 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all" style={{ borderLeftColor: "#FF6B35" }}>
          <p className="text-xs text-text-secondary flex items-center gap-1"><Wallet size={14} className="text-orange-500" /> Tổng chi</p>
          <p className="text-xl font-bold mt-1">{formatVND(total)}</p>
        </div>
        </Reveal>
        <Reveal delay={60}>
        <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-l-4 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all" style={{ borderLeftColor: "#3B82F6" }}>
          <p className="text-xs text-text-secondary flex items-center gap-1"><Receipt size={14} className="text-blue-500" /> Số khoản chi</p>
          <p className="text-xl font-bold mt-1">{count}</p>
        </div>
        </Reveal>
        <Reveal delay={120}>
        <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-l-4 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all" style={{ borderLeftColor: "#10B981" }}>
          <p className="text-xs text-text-secondary flex items-center gap-1"><CalendarDays size={14} className="text-green-500" /> Trung bình/ngày</p>
          <p className="text-xl font-bold mt-1">{formatVND(avgDay)}</p>
        </div>
        </Reveal>
        <Reveal delay={180}>
        <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-l-4 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all" style={{ borderLeftColor: "#8B5CF6" }}>
          <p className="text-xs text-text-secondary flex items-center gap-1"><Trophy size={14} className="text-purple-500" /> Số Hũ</p>
          <p className="text-xl font-bold mt-1">{jarCount}</p>
        </div>
        </Reveal>
      </div>

      {biggest && (
        <Reveal delay={100}>
        <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 mt-4 flex items-center gap-4 hover:shadow-md transition-shadow">
          {photoUrl(biggest.thumbnail || biggest.photo) ? (
            <img src={photoUrl(biggest.thumbnail || biggest.photo)} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
          ) : (
            <NoPhoto className="w-16 h-16 rounded-lg shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-xs text-warning font-medium flex items-center gap-1"><Trophy size={13} /> Khoản chi lớn nhất</p>
            <p className="text-lg font-bold text-text-primary">{formatVND(biggest.amount)}</p>
            <p className="text-xs text-text-secondary">{parseServerTime(biggest.created_at).toLocaleString("vi-VN")}</p>
          </div>
        </div>
        </Reveal>
      )}

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start mt-4">
      <Reveal delay={0}>
      <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary" /> Chi theo ngày (7 ngày gần nhất)</h2>
        <BarChart data={byDay.map((d) => ({ label: d.day, value: d.amount }))} color="#FF6B35" />
      </div>

      </Reveal>
      <Reveal delay={80}>
      <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 mt-4 lg:mt-0">
        <h2 className="font-semibold text-sm mb-3">Chi theo danh mục</h2>
        {byCat.length === 0 ? (
          <p className="text-sm text-text-secondary">Chưa có dữ liệu</p>
        ) : (
          <div className="flex flex-col gap-4">
            {byCat.map((c) => (
              <div key={c.cat}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${CAT_COLORS[c.cat] || "#6B7280"}1A` }}>
                      <span className="w-3 h-3 rounded-full" style={{ background: CAT_COLORS[c.cat] || "#6B7280" }} />
                    </span>
                    {CAT_LABELS[c.cat] || c.cat}
                  </span>
                  <span className="font-bold">{formatVND(c.amount)}</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${total ? (c.amount / total) * 100 : 0}%`, background: `linear-gradient(to right, ${CAT_COLORS[c.cat] || "#6B7280"}, ${CAT_COLORS[c.cat] || "#6B7280"}CC)` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </Reveal>

      <Reveal delay={120}>
      <div className="bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 mt-4 lg:mt-0 lg:col-span-2">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#8B5CF6]" /> Chi theo tháng (6 tháng gần nhất)</h2>
        <AreaChart data={byMonth.map((d) => ({ label: d.month, value: d.amount }))} color="#8B5CF6" height={180} />
      </div>
      </Reveal>
      </div>
    </div>
  );
}
