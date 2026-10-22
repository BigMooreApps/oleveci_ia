import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Eye,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Plus,
  Clock,
  Flame,
  Award,
  Lightbulb,
  DollarSign,
  Users,
  Info,
  Check,
  QrCode,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Business, Post, DailyMetricRecord } from '../types';
import { OleVeciIcon } from './OleVeciLogo';
import { PostDatesBar } from './common/PostDatesBar';
import { getPostTypeLabel } from '../utils/postTypeIcons';
import {
  countCutDays,
  getDateKeysInRange,
  formatDateLabel,
  getTodayKey,
  getDaysAgoKey,
  getStartOfMonthKey,
  generateDailyMetricsForPost,
} from '../utils/metricsUtils';

// 3 radiant sunburst sparks inspired directly by the OleVeci logo pin
const SunburstSparks: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-0.5 select-none ${className}`} aria-hidden="true">
    <span className="w-1 h-3.5 bg-gradient-to-b from-[#ffbe00] to-[#ff5500] rounded-full rotate-12 inline-block shadow-2xs" />
    <span className="w-1 h-3 bg-gradient-to-b from-[#ffbe00] to-[#ff7700] rounded-full rotate-45 inline-block shadow-2xs" />
    <span className="w-1 h-2.5 bg-gradient-to-b from-[#ffbe00] to-[#ff7700] rounded-full rotate-75 inline-block shadow-2xs" />
  </div>
);

// Custom OleVeci-branded Tooltip for Timeline AreaChart
const CustomTimelineTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const rawData = payload[0]?.payload;
    const vistas = payload.find((p: any) => p.dataKey === 'vistas')?.value || 0;
    const contactos = payload.find((p: any) => p.dataKey === 'contactos')?.value || 0;
    const conversion = vistas > 0 ? ((contactos / vistas) * 100).toFixed(1) : '0';
    const displayDate = rawData?.fullDateLabel || label;

    return (
      <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200/90 shadow-xl shadow-[#021b58]/10 min-w-[190px] sm:min-w-[220px] text-xs select-none pointer-events-none space-y-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5 font-black text-[#041f5e]">
            <Calendar className="w-3.5 h-3.5 text-[#007af7] shrink-0" />
            <span className="capitalize">{displayDate}</span>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/70">
            {conversion}% conv.
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#007af7] ring-2 ring-[#007af7]/20 shrink-0" />
              <span className="text-slate-600 font-medium">Vistas Feed</span>
            </div>
            <span className="font-black text-[#041f5e]">{vistas.toLocaleString('es-CO')}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff8400] ring-2 ring-[#ff8400]/20 shrink-0" />
              <span className="text-slate-600 font-medium">Contactos directos</span>
            </div>
            <span className="font-black text-[#ff8400]">{contactos.toLocaleString('es-CO')}</span>
          </div>
          {contactos > 0 && rawData && (
            <div className="pt-1.5 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-500 font-bold">
              <span>💬 {rawData.whatsapp || 0} WA</span>
              <span>📍 {rawData.maps || 0} Rutas</span>
              <span>📞 {rawData.llamadas || 0} Llamadas</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Custom OleVeci-branded Tooltip for Activity BarChart
const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-md p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xl shadow-[#021b58]/10 text-xs min-w-[150px] sm:min-w-[180px] select-none pointer-events-none">
        <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-100">
          <span className="font-black text-[#041f5e]">{data.dia}</span>
          {data.esPico && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center gap-1 shadow-2xs">
              <Flame className="w-2.5 h-2.5" />
              PICO
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-600 font-medium">Interacciones:</span>
          <span className="font-black text-[#041f5e] text-sm">{data.interacciones.toLocaleString('es-CO')}</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1 font-medium">
          {data.esPico ? 'Mayor flujo de clientes potenciales' : 'Actividad de consultas'}
        </div>
      </div>
    );
  }
  return null;
};

// Custom OleVeci-branded Tooltip for Channels PieChart
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-md px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200/90 shadow-lg shadow-[#021b58]/10 text-xs flex items-center gap-2 select-none pointer-events-none">
        <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: data.color }} />
        <span className="font-bold text-slate-700">{data.name}:</span>
        <span className="font-black text-[#041f5e]">
          {data.value} leads ({data.share}%)
        </span>
      </div>
    );
  }
  return null;
};

interface BusinessMetricsDashboardProps {
  business: Business;
  businessPosts: Post[];
  onOpenCreatePost: () => void;
}

export const BusinessMetricsDashboard: React.FC<BusinessMetricsDashboardProps> = ({
  business,
  businessPosts,
  onOpenCreatePost,
}) => {
  // 1. Date Range Cut Filtering State (Inicio y Fin de corte)
  const [startDate, setStartDate] = useState<string>(() => getDaysAgoKey(29));
  const [endDate, setEndDate] = useState<string>(() => getTodayKey());
  const [showFormulaExplanation, setShowFormulaExplanation] = useState<boolean>(false);

  // Handle Cut Date Input Changes
  const handleStartDateChange = (newStart: string) => {
    if (!newStart) return;
    setStartDate(newStart);
    if (newStart > endDate) {
      setEndDate(newStart);
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    if (!newEnd) return;
    setEndDate(newEnd);
    if (newEnd < startDate) {
      setStartDate(newEnd);
    }
  };

  // Days in selected cut (inclusive)
  const cutDays = useMemo(() => countCutDays(startDate, endDate), [startDate, endDate]);

  // All 'YYYY-MM-DD' keys in the selected date cut
  const rangeDateKeys = useMemo(() => getDateKeysInRange(startDate, endDate), [startDate, endDate]);

  const hasPosts = businessPosts.length > 0;

  // 1.1 Guaranteed daily metrics map per post so charts and totals NEVER desync or show 0
  const guaranteedPostDailyMap = useMemo(() => {
    const map = new Map<string, Record<string, DailyMetricRecord>>();
    businessPosts.forEach((post) => {
      let dMetrics = post.metrics?.dailyMetrics;
      if (!dMetrics || Object.keys(dMetrics).length === 0) {
        const totals = post.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
        dMetrics = generateDailyMetricsForPost(totals, Math.max(90, cutDays + 30));
      }
      map.set(post.id, dMetrics);
    });
    return map;
  }, [businessPosts, cutDays]);

  // Guaranteed daily metrics for direct business profile interactions
  const guaranteedBusinessDailyMap = useMemo<Record<string, DailyMetricRecord>>(() => {
    let dMetrics = business.metrics?.dailyMetrics;
    if (!dMetrics || Object.keys(dMetrics).length === 0) {
      const totals = business.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
      dMetrics = generateDailyMetricsForPost(totals, Math.max(90, cutDays + 30));
    }
    return dMetrics;
  }, [business.metrics, cutDays]);

  // Helper to get daily record for a post on a specific dateKey
  const getPostDayRecord = (post: Post, dateKey: string): DailyMetricRecord => {
    const dMap = guaranteedPostDailyMap.get(post.id);
    if (dMap && dMap[dateKey]) {
      return dMap[dateKey];
    }
    const totals = post.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
    const parts = dateKey.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayOfWeek = isNaN(d.getTime()) ? 1 : d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const factor = (isWeekend ? 1.4 : 0.85) / 30;
    return {
      views: Math.max(0, Math.round((totals.views || 0) * factor)),
      whatsappClicks: Math.max(0, Math.round((totals.whatsappClicks || 0) * factor)),
      mapsClicks: Math.max(0, Math.round((totals.mapsClicks || 0) * factor)),
      calls: Math.max(0, Math.round((totals.calls || 0) * factor)),
      shares: Math.max(0, Math.round((totals.shares || 0) * factor)),
    };
  };

  // Helper to get daily record for business profile on a specific dateKey
  const getBusinessDayRecord = (dateKey: string): DailyMetricRecord => {
    if (guaranteedBusinessDailyMap[dateKey]) {
      return guaranteedBusinessDailyMap[dateKey];
    }
    const totals = business.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
    const parts = dateKey.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayOfWeek = isNaN(d.getTime()) ? 1 : d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const factor = (isWeekend ? 1.4 : 0.85) / 30;
    return {
      views: Math.max(0, Math.round((totals.views || 0) * factor)),
      whatsappClicks: Math.max(0, Math.round((totals.whatsappClicks || 0) * factor)),
      mapsClicks: Math.max(0, Math.round((totals.mapsClicks || 0) * factor)),
      calls: Math.max(0, Math.round((totals.calls || 0) * factor)),
      shares: Math.max(0, Math.round((totals.shares || 0) * factor)),
    };
  };

  // 2. Compute Metrics Per Post for the Selected Cut
  const postMetricsInCut = useMemo(() => {
    const map = new Map<
      string,
      {
        views: number;
        whatsappClicks: number;
        mapsClicks: number;
        calls: number;
        shares: number;
        qrRedemptions: number;
        totalLeads: number;
        ctr: string;
      }
    >();

    businessPosts.forEach((post) => {
      let views = 0;
      let whatsappClicks = 0;
      let mapsClicks = 0;
      let calls = 0;
      let shares = 0;
      let qrRedemptions = 0;

      rangeDateKeys.forEach((key) => {
        const day = getPostDayRecord(post, key);
        views += day.views;
        whatsappClicks += day.whatsappClicks;
        mapsClicks += day.mapsClicks;
        calls += day.calls;
        shares += day.shares;
        qrRedemptions += day.qrRedemptions || 0;
      });

      const totalLeads = whatsappClicks + mapsClicks + calls;
      const ctr = views > 0 ? ((totalLeads / views) * 100).toFixed(1) : '0';

      map.set(post.id, {
        views,
        whatsappClicks,
        mapsClicks,
        calls,
        shares,
        qrRedemptions,
        totalLeads,
        ctr,
      });
    });

    return map;
  }, [businessPosts, rangeDateKeys, guaranteedPostDailyMap]);

  // 3. Compute Aggregate Business Totals in the Selected Cut
  const { totalViews, totalWhatsapp, totalMaps, totalCalls, totalShares, totalQrRedemptions } = useMemo(() => {
    let views = 0;
    let wa = 0;
    let maps = 0;
    let calls = 0;
    let shares = 0;
    let qr = 0;

    if (hasPosts) {
      postMetricsInCut.forEach((m) => {
        views += m.views;
        wa += m.whatsappClicks;
        maps += m.mapsClicks;
        calls += m.calls;
        shares += m.shares;
        qr += m.qrRedemptions;
      });
    } else {
      rangeDateKeys.forEach((key) => {
        const day = getBusinessDayRecord(key);
        views += day.views;
        wa += day.whatsappClicks;
        maps += day.mapsClicks;
        calls += day.calls;
        shares += day.shares;
        qr += day.qrRedemptions || 0;
      });
    }

    return {
      totalViews: views,
      totalWhatsapp: wa,
      totalMaps: maps,
      totalCalls: calls,
      totalShares: shares,
      totalQrRedemptions: qr,
    };
  }, [hasPosts, postMetricsInCut, rangeDateKeys, guaranteedBusinessDailyMap]);

  // High-value direct client contacts (Leads)
  const totalLeads = totalWhatsapp + totalMaps + totalCalls;

  // Conversion rate (Leads / Views) in the cut
  const conversionRate = totalViews > 0 ? ((totalLeads / totalViews) * 100).toFixed(1) : '0';

  // 4. Exact Mathematical Subscription Prorating and Cost Per Lead
  // Monthly Flat Rate: $29.900 COP / 30 days = ~$996.67 COP/day
  const monthlyCost = 29900;
  const dailyRate = monthlyCost / 30;
  const effectivePeriodCost =
    cutDays === 30 ? monthlyCost : Math.round(cutDays * dailyRate);

  // Transparent Cost Per Lead: Period Cost / Total Leads (no artificial floor)
  const costPerLead = totalLeads > 0 ? Math.round(effectivePeriodCost / totalLeads) : 0;

  // Real Customer Acquisition Cost (CAC Real) based on scanned QR codes:
  // CAC Real = effectivePeriodCost / totalQrRedemptions
  const realCAC = totalQrRedemptions > 0 ? Math.round(effectivePeriodCost / totalQrRedemptions) : 0;

  // Benchmark vs traditional Meta/Google Ads (~$1.800 COP per lead in Colombia)
  const traditionalAdCostEstimate = totalLeads * 1800;
  const estimatedSavings = Math.max(0, traditionalAdCostEstimate - effectivePeriodCost);

  // 5. Timeline Chart Series and Evenly Spaced X-Axis Ticks
  const timelineData = useMemo(() => {
    return rangeDateKeys.map((dateKey) => {
      let dayViews = 0;
      let dayWa = 0;
      let dayMaps = 0;
      let dayCalls = 0;

      if (hasPosts) {
        businessPosts.forEach((p) => {
          const dayM = getPostDayRecord(p, dateKey);
          dayViews += dayM.views;
          dayWa += dayM.whatsappClicks;
          dayMaps += dayM.mapsClicks;
          dayCalls += dayM.calls;
        });
      } else {
        const dayM = getBusinessDayRecord(dateKey);
        dayViews = dayM.views;
        dayWa = dayM.whatsappClicks;
        dayMaps = dayM.mapsClicks;
        dayCalls = dayM.calls;
      }

      const dayContacts = dayWa + dayMaps + dayCalls;
      const label = formatDateLabel(dateKey, cutDays <= 7);
      const fullDateLabel = formatDateLabel(dateKey, false);

      return {
        name: label,
        fullDate: dateKey,
        fullDateLabel,
        vistas: dayViews,
        contactos: dayContacts,
        whatsapp: dayWa,
        maps: dayMaps,
        llamadas: dayCalls,
      };
    });
  }, [rangeDateKeys, hasPosts, businessPosts, guaranteedPostDailyMap, guaranteedBusinessDailyMap, cutDays]);

  // Compute 4-6 evenly spaced ticks to guarantee labels NEVER crowd or overlap
  const timelineTicks = useMemo(() => {
    if (timelineData.length <= 6) {
      return timelineData.map((d) => d.name);
    }
    const total = timelineData.length;
    const step = (total - 1) / 4;
    const indices = [
      0,
      Math.round(step),
      Math.round(step * 2),
      Math.round(step * 3),
      total - 1,
    ];
    const uniqueIndices = Array.from(new Set(indices));
    return uniqueIndices.map((idx) => timelineData[idx].name);
  }, [timelineData]);

  // 6. Channels Distribution for the Selected Cut
  const channelData = useMemo(() => {
    return [
      {
        name: 'WhatsApp Directo',
        value: totalWhatsapp,
        color: '#00d8a5',
        gradientId: 'waGradient',
        share: totalLeads > 0 ? Math.round((totalWhatsapp / totalLeads) * 100) : 0,
      },
      {
        name: 'Rutas (Google Maps)',
        value: totalMaps,
        color: '#ff8400',
        gradientId: 'mapsGradient',
        share: totalLeads > 0 ? Math.round((totalMaps / totalLeads) * 100) : 0,
      },
      {
        name: 'Llamadas Telefónicas',
        value: totalCalls,
        color: '#007af7',
        gradientId: 'callsGradient',
        share: totalLeads > 0 ? Math.round((totalCalls / totalLeads) * 100) : 0,
      },
    ];
  }, [totalWhatsapp, totalMaps, totalCalls, totalLeads]);

  // 7. Day of Week Demand in the Selected Cut
  const dayActivityData = useMemo(() => {
    const daysOrder = [
      { day: 'Lun', dayIdx: 1 },
      { day: 'Mar', dayIdx: 2 },
      { day: 'Mié', dayIdx: 3 },
      { day: 'Jue', dayIdx: 4 },
      { day: 'Vie', dayIdx: 5 },
      { day: 'Sáb', dayIdx: 6 },
      { day: 'Dom', dayIdx: 0 },
    ];

    const daySums: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    rangeDateKeys.forEach((dateKey) => {
      const parts = dateKey.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const dayOfWeek = isNaN(d.getTime()) ? 1 : d.getDay();
        let dayInteractions = 0;
        if (hasPosts) {
          businessPosts.forEach((p) => {
            const m = getPostDayRecord(p, dateKey);
            dayInteractions += m.whatsappClicks + m.mapsClicks + m.calls;
          });
        } else {
          const m = getBusinessDayRecord(dateKey);
          dayInteractions += m.whatsappClicks + m.mapsClicks + m.calls;
        }
        daySums[dayOfWeek] = (daySums[dayOfWeek] || 0) + dayInteractions;
      }
    });

    const maxVal = Math.max(1, ...Object.values(daySums));

    return daysOrder.map((d) => {
      const count = daySums[d.dayIdx] || 0;
      return {
        dia: d.day,
        interacciones: count,
        esPico: count >= maxVal * 0.8 && count > 0,
      };
    });
  }, [rangeDateKeys, hasPosts, businessPosts, guaranteedPostDailyMap, guaranteedBusinessDailyMap]);

  // 8. Ranked publications by contacts generated in the selected cut
  const rankedPosts = useMemo(() => {
    return [...businessPosts]
      .map((p) => {
        const metricsInCut = postMetricsInCut.get(p.id) || {
          views: 0,
          whatsappClicks: 0,
          mapsClicks: 0,
          calls: 0,
          shares: 0,
          qrRedemptions: 0,
          totalLeads: 0,
          ctr: '0',
        };

        return {
          ...p,
          cutViews: metricsInCut.views,
          cutWhatsapp: metricsInCut.whatsappClicks,
          cutMaps: metricsInCut.mapsClicks,
          cutCalls: metricsInCut.calls,
          cutShares: metricsInCut.shares,
          cutQrRedemptions: metricsInCut.qrRedemptions,
          totalInteractions: metricsInCut.totalLeads,
          ctr: metricsInCut.ctr,
        };
      })
      .sort((a, b) => b.totalInteractions - a.totalInteractions);
  }, [businessPosts, postMetricsInCut]);

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Toolbar with Cut Date Range Filters */}
      <div className="bg-white p-3.5 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-3.5 overflow-hidden">
        {/* Title row */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0">
            <OleVeciIcon size={26} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base md:text-lg font-black text-[#041f5e] leading-snug">
                Rendimiento Comercial &amp; Métricas
              </h2>
              <SunburstSparks />
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Control diario de visualizaciones, contactos directos y retorno de inversión
            </p>
          </div>
        </div>

        {/* Compact Date Range Filter */}
        <div className="flex items-center bg-white rounded-2xl border border-slate-200/90 shadow-2xs px-3 py-1.5 gap-2 text-xs self-start md:self-auto shrink-0">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="flex items-center gap-1.5 font-bold text-[#041f5e]">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase select-none">Del</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="text-xs font-bold text-[#041f5e] bg-transparent outline-none cursor-pointer p-0"
              title="Fecha inicial de corte"
            />
          </div>
          <span className="text-slate-300 font-bold select-none text-[10px]">al</span>
          <div className="flex items-center gap-1.5 font-bold text-[#041f5e]">
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={getTodayKey()}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="text-xs font-bold text-[#041f5e] bg-transparent outline-none cursor-pointer p-0"
              title="Fecha final de corte"
            />
          </div>
          <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-[#007af7] font-black text-[10px] border border-blue-200/60 select-none">
            {cutDays}d
          </span>
        </div>
      </div>

      {/* 2. Top KPI Cards in Selected Cut */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {/* Vistas */}
        <div className="p-2 sm:p-3 md:p-3.5 rounded-2xl sm:rounded-3xl bg-white border border-sky-200/80 shadow-xs hover:border-[#007af7]/50 transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-slate-500 mb-1 sm:mb-2">
            <span className="text-[9px] min-[400px]:text-[10px] sm:text-[11px] font-extrabold text-slate-600 uppercase tracking-tight">
              Vistas
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg sm:rounded-xl bg-sky-50 flex items-center justify-center text-[#007af7] shrink-0">
              <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl md:text-3xl font-black text-[#041f5e] tracking-tight leading-tight">
              {totalViews.toLocaleString('es-CO')}
            </div>
            <div className="mt-0.5 sm:mt-1 flex items-center gap-0.5 sm:gap-1 text-[8.5px] sm:text-[10px] text-[#007af7] font-extrabold truncate">
              <span>Corte ({cutDays}d)</span>
            </div>
          </div>
        </div>

        {/* WhatsApp Directo */}
        <div className="p-2 sm:p-3 md:p-3.5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/80 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-emerald-900 mb-1 sm:mb-2">
            <span className="text-[9px] min-[400px]:text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight">
              WhatsApp
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MessageCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl md:text-3xl font-black text-[#041f5e] tracking-tight leading-tight">
              {totalWhatsapp.toLocaleString('es-CO')}
            </div>
            <div className="mt-0.5 sm:mt-1 text-[8.5px] sm:text-[10px] text-emerald-800 font-bold flex items-center gap-1 truncate">
              <span>Chats</span>
            </div>
          </div>
        </div>

        {/* Cómo llegar (Maps) */}
        <div className="p-2 sm:p-3 md:p-3.5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-orange-50/90 to-amber-50/50 border border-orange-200/80 shadow-xs hover:border-orange-300 transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-orange-900 mb-1 sm:mb-2">
            <span className="text-[9px] min-[400px]:text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight">
              Maps
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg sm:rounded-xl bg-orange-100 text-[#ff8400] flex items-center justify-center shrink-0">
              <Navigation className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl md:text-3xl font-black text-[#041f5e] tracking-tight leading-tight">
              {totalMaps.toLocaleString('es-CO')}
            </div>
            <div className="mt-0.5 sm:mt-1 text-[8.5px] sm:text-[10px] text-orange-800 font-bold flex items-center gap-1 truncate">
              <span>Rutas</span>
            </div>
          </div>
        </div>

        {/* Llamadas telefónicas */}
        <div className="p-2 sm:p-3 md:p-3.5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-50/90 to-sky-50/50 border border-blue-200/80 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-blue-900 mb-1 sm:mb-2">
            <span className="text-[9px] min-[400px]:text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight">
              Llamadas
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg sm:rounded-xl bg-blue-100 text-[#007af7] flex items-center justify-center shrink-0">
              <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl md:text-3xl font-black text-[#041f5e] tracking-tight leading-tight">
              {totalCalls.toLocaleString('es-CO')}
            </div>
            <div className="mt-0.5 sm:mt-1 text-[8.5px] sm:text-[10px] text-blue-800 font-bold flex items-center gap-1 truncate">
              <span>Directas</span>
            </div>
          </div>
        </div>

        {/* Compartidos */}
        <div className="p-2 sm:p-3 md:p-3.5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-50/80 to-blue-50/50 border border-indigo-200/80 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-indigo-900 mb-1 sm:mb-2">
            <span className="text-[9px] min-[400px]:text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight">
              Compartidos
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg sm:rounded-xl bg-indigo-100 text-[#041f5e] flex items-center justify-center shrink-0">
              <Share2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl md:text-3xl font-black text-[#041f5e] tracking-tight leading-tight">
              {totalShares.toLocaleString('es-CO')}
            </div>
            <div className="mt-0.5 sm:mt-1 text-[8.5px] sm:text-[10px] text-indigo-800 font-bold flex items-center gap-1 truncate">
              <span>Boca a boca</span>
            </div>
          </div>
        </div>

        {/* Clientes Reales (QR Canjeados) */}
        <div className="p-2 sm:p-3 md:p-3.5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-purple-50/90 to-indigo-50/60 border border-purple-200/90 shadow-xs hover:border-purple-400 transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between text-purple-900 mb-1 sm:mb-2">
            <span className="text-[9px] min-[400px]:text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight">
              Clientes QR
            </span>
            <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg sm:rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <QrCode className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl md:text-3xl font-black text-[#041f5e] tracking-tight leading-tight">
              {totalQrRedemptions.toLocaleString('es-CO')}
            </div>
            <div className="mt-0.5 sm:mt-1 text-[8.5px] sm:text-[10px] text-purple-800 font-bold flex items-center gap-1 truncate">
              <span>En tienda</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Funnel & Economic ROI Summary Banner with Exact Formula Transparency */}
      <div className="rounded-3xl bg-gradient-to-br from-[#021b58] via-[#041f5e] to-[#0062f5] text-white p-4 sm:p-6 shadow-md relative overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#0088ff]/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-[#00d8a5]/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4 sm:space-y-5">
          {/* Main Highlights - Full width with ample breathing room */}
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-extrabold text-[#00d8a5]">
              <SunburstSparks />
              <span>Retorno de Inversión (ROI) en el Corte</span>
            </div>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white leading-snug">
              Has captado <span className="text-[#ffbe00]">{totalLeads} contactos directos</span>{' '}
              {totalQrRedemptions > 0 && (
                <>
                  y <span className="text-[#00d8a5]">{totalQrRedemptions} clientes con QR</span>
                </>
              )}
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 font-normal leading-relaxed">
              {totalQrRedemptions > 0 ? (
                <>
                  Tu <strong>CAC Real</strong> (Costo de adquisición por cliente físico validado con QR) fue de{' '}
                  <strong className="text-white font-black underline decoration-[#00d8a5] decoration-2">
                    ${realCAC.toLocaleString('es-CO')} COP
                  </strong>
                  . Cada contacto digital te costó ~${costPerLead.toLocaleString('es-CO')} COP. En redes tradicionales (Meta/Google Ads) te habría costado aprox.{' '}
                  <strong className="text-[#ffbe00]">
                    ${traditionalAdCostEstimate.toLocaleString('es-CO')} COP
                  </strong>
                  .
                </>
              ) : totalLeads > 0 ? (
                <>
                  Cada cliente potencial que te contactó en este corte te costó{' '}
                  <strong className="text-white font-black underline decoration-[#00d8a5] decoration-2">
                    ~${costPerLead.toLocaleString('es-CO')} COP
                  </strong>
                  . En pauta tradicional de redes (Meta/Google Ads) te habría costado aprox.{' '}
                  <strong className="text-[#ffbe00]">
                    ${traditionalAdCostEstimate.toLocaleString('es-CO')} COP
                  </strong>
                  . Para calcular tu <strong>CAC Real</strong>, pide a los clientes mostrar su QR en tienda y escanéalo con el botón superior &quot;Escanear QR&quot;.
                </>
              ) : (
                <>
                  No se registraron contactos en este corte de {cutDays} {cutDays === 1 ? 'día' : 'días'}. El costo
                  prorrateado de suscripción para el periodo es de{' '}
                  <strong className="text-white font-black">${effectivePeriodCost.toLocaleString('es-CO')} COP</strong>.
                </>
              )}
            </p>
          </div>

          {/* Quick Metrics Badges - Clean, spacious 4-column responsive grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 sm:p-4 flex flex-col justify-between text-left hover:bg-white/[0.14] transition-all">
              <span className="block text-[10px] sm:text-[11px] font-bold text-blue-200 uppercase tracking-wider">
                Tasa Conversión
              </span>
              <div className="my-1 sm:my-1.5">
                <span className="text-xl sm:text-2xl lg:text-3xl font-black text-white">{conversionRate}%</span>
              </div>
              <span className="block text-[11px] sm:text-xs text-[#00d8a5] font-bold">Vistas a Lead</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 sm:p-4 flex flex-col justify-between text-left hover:bg-white/[0.14] transition-all">
              <span className="block text-[10px] sm:text-[11px] font-bold text-blue-200 uppercase tracking-wider">
                Costo x Contacto
              </span>
              <div className="my-1 sm:my-1.5">
                <span className="text-xl sm:text-2xl lg:text-3xl font-black text-white">
                  {totalLeads > 0 ? `$${costPerLead.toLocaleString('es-CO')}` : '$0'}
                </span>
              </div>
              <span className="block text-[11px] sm:text-xs text-blue-200 font-medium">Digital</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 sm:p-4 flex flex-col justify-between text-left ring-1 ring-[#00d8a5]/30 hover:bg-white/[0.14] transition-all">
              <span className="block text-[10px] sm:text-[11px] font-bold text-blue-200 uppercase tracking-wider">
                CAC Real (QR)
              </span>
              <div className="my-1 sm:my-1.5">
                <span className="text-xl sm:text-2xl lg:text-3xl font-black text-[#00d8a5]">
                  {totalQrRedemptions > 0 ? `$${realCAC.toLocaleString('es-CO')}` : '$0'}
                </span>
              </div>
              <span className="block text-[11px] sm:text-xs text-emerald-200 font-bold">
                {totalQrRedemptions} {totalQrRedemptions === 1 ? 'visita en tienda' : 'visitas en tienda'}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 sm:p-4 flex flex-col justify-between text-left hover:bg-white/[0.14] transition-all">
              <span className="block text-[10px] sm:text-[11px] font-bold text-blue-200 uppercase tracking-wider">
                Ahorro Estimado
              </span>
              <div className="my-1 sm:my-1.5">
                <span className="text-xl sm:text-2xl lg:text-3xl font-black text-[#ffbe00]">
                  +${Math.round(estimatedSavings / 1000)}k
                </span>
              </div>
              <span className="block text-[11px] sm:text-xs text-blue-200 font-medium">vs Meta / Google</span>
            </div>
          </div>
        </div>

        {/* 3.1 Transparent Mathematical Breakdown Accordion */}
        <div className="relative z-10 pt-3 border-t border-white/15">
          <button
            type="button"
            onClick={() => setShowFormulaExplanation((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-200 hover:text-white transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-[#00d8a5]" />
            <span>
              {showFormulaExplanation
                ? 'Ocultar desglose matemático del corte'
                : '¿Cómo se calcula el costo por contacto y el CAC Real en este corte? Ver fórmula transparente'}
            </span>
          </button>

          {showFormulaExplanation && (
            <div className="mt-2.5 p-3 sm:p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-xs space-y-2 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="bg-black/20 p-2.5 rounded-xl border border-white/10">
                  <span className="text-[10px] text-blue-200 block uppercase font-bold">1. Tarifa Plana OleVeci</span>
                  <div className="text-sm font-black text-white">$29.900 COP / 30 días</div>
                  <span className="text-[10px] text-slate-300">~$997 COP por día calendario</span>
                </div>
                <div className="bg-black/20 p-2.5 rounded-xl border border-white/10">
                  <span className="text-[10px] text-blue-200 block uppercase font-bold">2. Costo del Corte ({cutDays}d)</span>
                  <div className="text-sm font-black text-[#ffbe00]">${effectivePeriodCost.toLocaleString('es-CO')} COP</div>
                  <span className="text-[10px] text-slate-300">
                    {cutDays} {cutDays === 1 ? 'día' : 'días'} × $997 COP/día
                  </span>
                </div>
                <div className="bg-black/20 p-2.5 rounded-xl border border-white/10">
                  <span className="text-[10px] text-blue-200 block uppercase font-bold">3. Costo x Lead Digital</span>
                  <div className="text-sm font-black text-white">
                    {totalLeads > 0 ? `$${costPerLead.toLocaleString('es-CO')} COP` : '$0 COP'}
                  </div>
                  <span className="text-[10px] text-slate-300">
                    ${effectivePeriodCost.toLocaleString('es-CO')} COP ÷ {Math.max(1, totalLeads)} contactos
                  </span>
                </div>
                <div className="bg-black/20 p-2.5 rounded-xl border border-white/10">
                  <span className="text-[10px] text-blue-200 block uppercase font-bold">4. CAC Real (con QR en Local)</span>
                  <div className="text-sm font-black text-[#00d8a5]">
                    {totalQrRedemptions > 0 ? `$${realCAC.toLocaleString('es-CO')} COP` : 'Sin canjes QR'}
                  </div>
                  <span className="text-[10px] text-slate-300">
                    ${effectivePeriodCost.toLocaleString('es-CO')} COP ÷ {Math.max(1, totalQrRedemptions)} clientes QR
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-blue-100 font-medium leading-relaxed pt-1">
                A diferencia de la pauta tradicional donde pagas por cada clic o impresión independientemente de si te
                compran, OleVeci funciona como una suscripción fija. Mientras más clientes potenciales captes y más
                códigos QR canjeen tus clientes en tienda, <strong>más bajo y rentable se vuelve tu Costo de Adquisición de Clientes Reales (CAC)</strong>.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left 2 Cols: Main Timeline Chart */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#041f5e] flex items-center gap-2">
                <span>Evolución Temporal en el Corte</span>
                <SunburstSparks className="hidden sm:flex" />
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Vistas en feed y contactos directos entre el {formatDateLabel(startDate, false)} y el{' '}
                {formatDateLabel(endDate, false)}
              </p>
            </div>

            {/* Static Clean Legend Badges */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs self-start sm:self-auto shrink-0">
              <div className="flex items-center gap-1.5 font-extrabold text-[#041f5e] bg-blue-50/90 px-2.5 py-1 rounded-xl border border-blue-200/70">
                <span className="w-2.5 h-2.5 rounded-full bg-[#007af7] inline-block shadow-2xs" />
                <span>Vistas ({totalViews.toLocaleString('es-CO')})</span>
              </div>
              <div className="flex items-center gap-1.5 font-extrabold text-orange-950 bg-amber-50/90 px-2.5 py-1 rounded-xl border border-amber-200/70">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff8400] inline-block shadow-2xs" />
                <span>Contactos ({totalLeads.toLocaleString('es-CO')})</span>
              </div>
            </div>
          </div>

          {/* Area Chart Container */}
          <div className="h-64 sm:h-72 w-full pt-2 select-none touch-pan-y outline-none [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_svg]:outline-none [&_path]:outline-none [&_g]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                accessibilityLayer={false}
                data={timelineData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                style={{ outline: 'none' }}
              >
                <defs>
                  {/* OleVeci Electric Sky Blue Gradient */}
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#007af7" stopOpacity={0.45} />
                    <stop offset="60%" stopColor="#0062f5" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#021b58" stopOpacity={0.0} />
                  </linearGradient>

                  {/* OleVeci Sunburst Golden Orange Gradient */}
                  <linearGradient id="contactsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffbe00" stopOpacity={0.55} />
                    <stop offset="60%" stopColor="#ff8400" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#ff5500" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  ticks={timelineTicks}
                  interval={0}
                  stroke="#64748b"
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  dy={8}
                />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  content={<CustomTimelineTooltip />}
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  wrapperStyle={{ outline: 'none', pointerEvents: 'none' }}
                />
                <Area
                  type="monotone"
                  dataKey="vistas"
                  name="Vistas Feed"
                  stroke="#007af7"
                  strokeWidth={2.8}
                  fillOpacity={1}
                  fill="url(#viewsGradient)"
                  activeDot={{ r: 5, fill: '#007af7', stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="contactos"
                  name="Contactos Directos"
                  stroke="#ff8400"
                  strokeWidth={2.8}
                  fillOpacity={1}
                  fill="url(#contactsGradient)"
                  activeDot={{ r: 5, fill: '#ff8400', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Channels Breakdown Pie / Donut Chart */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-black text-[#041f5e]">Canales de Conversión</h3>
            <p className="text-xs text-slate-500 font-medium">¿Por dónde te buscan y contactan en este corte?</p>
          </div>

          <div className="h-44 w-full relative flex items-center justify-center my-1 select-none touch-pan-y outline-none [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_svg]:outline-none [&_path]:outline-none">
            {/* SVG Defs for Donut Gradients */}
            <svg className="h-0 w-0 absolute">
              <defs>
                <linearGradient id="waGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#00d8a5" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="mapsGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffbe00" />
                  <stop offset="100%" stopColor="#ff5500" />
                </linearGradient>
                <linearGradient id="callsGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0088ff" />
                  <stop offset="100%" stopColor="#0055d4" />
                </linearGradient>
              </defs>
            </svg>

            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer={false} style={{ outline: 'none' }}>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={4}
                  dataKey="value"
                  className="outline-none"
                >
                  {channelData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`url(#${entry.gradientId})`}
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="outline-none"
                      style={{ outline: 'none' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} wrapperStyle={{ outline: 'none', pointerEvents: 'none' }} />
              </PieChart>
            </ResponsiveContainer>
            {/* White center disc reflecting OleVeci pin logo center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-white shadow-md shadow-[#021b58]/10 border border-slate-100 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-[#041f5e] leading-none tracking-tight">{totalLeads}</span>
                <span className="text-[9px] font-extrabold text-[#007af7] tracking-wider uppercase mt-0.5">Leads</span>
              </div>
            </div>
          </div>

          {/* Breakdown List with Brand Colors */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            {channelData.map((channel, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: channel.color }} />
                    <span className="font-bold text-slate-700 truncate">{channel.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-black">
                    <span className="text-[#041f5e]">{channel.value}</span>
                    <span className="text-[11px] font-extrabold text-slate-500 w-9 text-right">{channel.share}%</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${channel.share}%`, backgroundColor: channel.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Behavioral Analytics: Peak Days & Strategic Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left 2 Cols: Activity by Day of Week Bar Chart */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#041f5e] flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#ff8400]" />
                <span>Actividad por Día de la Semana en este Corte</span>
                <SunburstSparks className="hidden sm:flex" />
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Descubre qué días tus publicaciones generaron mayor volumen de consultas
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-900 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200/70 self-start">
              <Sparkles className="w-3 h-3 text-[#ff8400]" />
              <span>Demanda de clientes</span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="h-48 sm:h-52 w-full pt-2 select-none touch-pan-y outline-none [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_svg]:outline-none [&_path]:outline-none [&_rect]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer={false}
                data={dayActivityData}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                style={{ outline: 'none' }}
              >
                <defs>
                  {/* Peak Bar Gradient inspired by OleVeci Sunburst */}
                  <linearGradient id="peakBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffbe00" />
                    <stop offset="50%" stopColor="#ff8400" />
                    <stop offset="100%" stopColor="#ff5500" />
                  </linearGradient>

                  {/* Standard Bar Soft Blue Tint */}
                  <linearGradient id="normalBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e0f2fe" />
                    <stop offset="100%" stopColor="#bae6fd" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="dia" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomBarTooltip />} cursor={false} wrapperStyle={{ outline: 'none', pointerEvents: 'none' }} />
                <Bar dataKey="interacciones" radius={[8, 8, 2, 2]} className="outline-none">
                  {dayActivityData.map((entry, idx) => (
                    <Cell
                      key={`bar-${idx}`}
                      fill={entry.esPico ? 'url(#peakBarGradient)' : 'url(#normalBarGradient)'}
                      className="outline-none"
                      style={{ outline: 'none' }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Peak Hours Callout */}
          <div className="pt-2">
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center gap-3">
              <Clock className="w-4 h-4 text-[#ff8400] shrink-0" />
              <div className="text-xs">
                <strong className="block font-black text-[#041f5e]">Horarios de Mayor Tráfico</strong>
                <span className="text-amber-900 font-medium">12:00 PM – 2:30 PM y 6:00 PM – 9:30 PM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Strategic Tips & CTA */}
        <div className="bg-gradient-to-br from-white via-blue-50/40 to-slate-50 p-4 sm:p-5 rounded-3xl border border-blue-200/70 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#ffbe00] to-[#ff8400] text-white flex items-center justify-center shadow-xs">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-[#041f5e]">Consejos para Vender Más</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Las publicaciones con <strong>precio visible</strong> y <strong>foto de alta calidad</strong> generan un{' '}
              <strong>+38% más de mensajes</strong> directos.
            </p>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007af7] mt-1.5 shrink-0" />
              <span>Publica con anticipación a los días de mayor flujo comercial.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff8400] mt-1.5 shrink-0" />
              <span>Configura la vigencia hasta las 10:00 PM para activar sentido de urgencia.</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onOpenCreatePost}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white font-extrabold text-xs transition-all duration-300 shadow-xs cursor-pointer active:scale-[0.99] hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #031c54 0%, #0056d6 50%, #007af7 100%)',
                boxShadow: '0 4px 14px -2px rgba(0, 86, 214, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
              }}
            >
              <Plus className="w-4 h-4" />
              <span>Crear Publicación para Días Pico</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. Top Performing Publications Ranking in Selected Cut */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-[#041f5e] flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Rendimiento por Publicación en este Corte</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Vistas y contactos captados por cada anuncio entre el {formatDateLabel(startDate, false)} y el{' '}
              {formatDateLabel(endDate, false)} ({cutDays} {cutDays === 1 ? 'día' : 'días'})
            </p>
          </div>
          <span className="text-xs font-extrabold text-slate-500">{businessPosts.length} publicaciones registradas</span>
        </div>

        {rankedPosts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No tienes publicaciones creadas aún. Crea tu primera oferta para comenzar a medir resultados.
          </div>
        ) : (
          <div className="space-y-2.5">
            {rankedPosts.map((post, idx) => (
              <div
                key={post.id}
                className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Image + Title */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-10 sm:w-11 aspect-[9/16] rounded-xl object-cover border border-slate-200"
                    />
                    <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-[#041f5e] text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-[#041f5e] truncate">{post.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="font-semibold text-slate-700">
                        {post.promotionalPrice
                          ? `$${post.promotionalPrice.toLocaleString('es-CO')} COP`
                          : 'Sin precio'}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] text-slate-500 font-bold tracking-wider">
                        {getPostTypeLabel(post.type)}
                      </span>
                    </div>
                    <PostDatesBar post={post} className="mt-1 pt-1 border-t border-slate-200/60" />
                  </div>
                </div>

                {/* Metrics Badges for Selected Cut */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-center">
                  <div className="text-center px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Vistas Corte</span>
                    <span className="text-xs font-black text-slate-800">{post.cutViews}</span>
                  </div>

                  <div className="text-center px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs">
                    <span className="block text-[9px] font-bold text-emerald-700 uppercase tracking-wider">WhatsApp</span>
                    <span className="text-xs font-black text-emerald-950">{post.cutWhatsapp}</span>
                  </div>

                  <div className="text-center px-2.5 py-1.5 rounded-xl bg-orange-50 border border-orange-200 shadow-2xs">
                    <span className="block text-[9px] font-bold text-orange-700 uppercase tracking-wider">Maps</span>
                    <span className="text-xs font-black text-orange-950">{post.cutMaps}</span>
                  </div>

                  <div className="text-center px-2.5 py-1.5 rounded-xl bg-purple-50 border border-purple-200 shadow-2xs">
                    <span className="block text-[9px] font-bold text-purple-700 uppercase tracking-wider">Clientes QR</span>
                    <span className="text-xs font-black text-purple-950">{post.cutQrRedemptions || 0}</span>
                  </div>

                  <div className="text-center px-2.5 py-1.5 rounded-xl bg-[#007af7]/10 border border-[#007af7]/20 shadow-2xs hidden min-[480px]:block">
                    <span className="block text-[9px] font-bold text-[#007af7] uppercase tracking-wider">Conv.</span>
                    <span className="text-xs font-black text-[#041f5e]">{post.ctr}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
