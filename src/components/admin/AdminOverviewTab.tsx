import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { APP_CONFIG } from '../../config/brand';
import { Business, Post, DailyMetricRecord } from '../../types';
import { OleVeciIcon } from '../OleVeciLogo';
import {
  TrendingUp,
  FileText,
  Users,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  Clock,
  Ban,
  Phone,
  Calendar,
  ExternalLink,
  Filter,
  BarChart3,
  Flame,
  ArrowUpRight,
  RefreshCw,
  Search,
  Check,
  ShieldCheck,
  Info,
  HelpCircle,
  ArrowDownRight,
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
import {
  countCutDays,
  getDateKeysInRange,
  formatDateLabel,
  getTodayKey,
  getDaysAgoKey,
  getStartOfMonthKey,
  generateDailyMetricsForPost,
} from '../../utils/metricsUtils';

interface AdminOverviewTabProps {
  onNavigateTab: (tab: 'businesses' | 'posts' | 'municipalities' | 'categories' | 'post_types') => void;
}

type TableFilter = 'top_leads' | 'attention_needed' | 'all';
type MetricKey = 'views' | 'whatsapp' | 'calls' | 'maps' | 'shares' | 'qr';

// Sunburst sparks matching the OleVeci brand
const SunburstSparks: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-0.5 select-none ${className}`} aria-hidden="true">
    <span className="w-1 h-3.5 bg-gradient-to-b from-[#ffbe00] to-[#ff5500] rounded-full rotate-12 inline-block shadow-2xs" />
    <span className="w-1 h-3 bg-gradient-to-b from-[#ffbe00] to-[#ff7700] rounded-full rotate-45 inline-block shadow-2xs" />
    <span className="w-1 h-2.5 bg-gradient-to-b from-[#ffbe00] to-[#ff7700] rounded-full rotate-75 inline-block shadow-2xs" />
  </div>
);

// Branded Custom Tooltip for Timeline AreaChart
const AdminTimelineTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const rawData = payload[0]?.payload;
    const vistas = rawData?.vistas || 0;
    const leads = rawData?.leads || 0;
    const whatsapp = rawData?.whatsapp || 0;
    const maps = rawData?.maps || 0;
    const llamadas = rawData?.llamadas || 0;
    const compartidos = rawData?.compartidos || 0;
    const qr = rawData?.qr || 0;
    const conversion = vistas > 0 ? ((leads / vistas) * 100).toFixed(1) : '0';
    const displayDate = rawData?.fullDateLabel || label;

    return (
      <div className="bg-[#041f5e] text-white p-3 rounded-2xl shadow-xl text-xs border border-white/20 min-w-[220px] space-y-2 select-none pointer-events-none">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <div className="flex items-center gap-1.5 font-medium text-sky-200">
            <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="capitalize">{displayDate}</span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-[#ff7700] text-[#041f5e]">
            {conversion}% conv.
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-slate-200">
            <span>Vistas Feed:</span>
            <span className="font-semibold text-white">{vistas.toLocaleString('es-CO')}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-200">
            <span>Total Contactos:</span>
            <span className="font-semibold text-emerald-400">{leads.toLocaleString('es-CO')}</span>
          </div>
          <div className="pt-1.5 border-t border-white/10 grid grid-cols-3 gap-1 text-[10px] text-slate-300">
            <span className="text-emerald-300 font-medium">WA: {whatsapp}</span>
            <span className="text-sky-300 font-medium">Tel: {llamadas}</span>
            <span className="text-amber-300 font-medium">Rutas: {maps}</span>
            <span className="text-indigo-300 font-medium">Shares: {compartidos}</span>
            <span className="text-purple-300 font-medium">QR: {qr}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Branded Custom Tooltip for Day of Week BarChart
const AdminBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 shadow-xl text-xs min-w-[150px] select-none pointer-events-none">
        <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100">
          <span className="font-semibold text-[#041f5e]">{data.diaCompleto || data.dia}</span>
          {data.esPico && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-[#ff7700] text-white flex items-center gap-0.5 shadow-2xs">
              <Flame className="w-2.5 h-2.5" /> PICO
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Interacciones:</span>
          <span className="font-bold text-[#041f5e]">{data.interacciones.toLocaleString('es-CO')}</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          {data.esPico ? 'Mayor flujo de consultas' : 'Actividad vecinal'}
        </div>
      </div>
    );
  }
  return null;
};

// Branded Custom Tooltip for Cartera Donut Chart
const AdminDonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0]?.payload;
    if (!item) return null;
    return (
      <div className="bg-[#041f5e] text-white p-2.5 rounded-xl border border-white/20 shadow-xl text-xs min-w-[170px] select-none pointer-events-none z-50">
        <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-white/10">
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.name}</span>
          </div>
          <span className="text-[10px] font-bold text-sky-200">
            {item.value} {item.value === 1 ? 'comercio' : 'comercios'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-slate-200 text-[11px]">
          <span className="text-slate-300">Facturación:</span>
          <span className="font-bold text-emerald-400">
            {item.amount > 0 ? `$${item.amount.toLocaleString('es-CO')} COP` : '$0 COP'}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Branded Custom Tooltip for Captación Channels Pie/Donut Chart
const AdminChannelPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0]?.payload;
    if (!item) return null;
    return (
      <div className="bg-[#041f5e] text-white p-2.5 rounded-xl border border-white/20 shadow-xl text-xs min-w-[175px] select-none pointer-events-none z-50">
        <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-white/10">
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.name}</span>
          </div>
          <span className="text-[10px] font-bold text-sky-200">
            {item.percentage}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-slate-200 text-[11px]">
          <span className="text-slate-300">Volumen:</span>
          <span className="font-bold text-white">
            {item.value.toLocaleString('es-CO')} {item.id === 'shares' ? 'compartidos' : item.id === 'qr' ? 'canjes' : 'contactos'}
          </span>
        </div>
        {item.description && (
          <div className="text-[10px] text-slate-300 mt-1">
            {item.description}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({ onNavigateTab }) => {
  const {
    businesses,
    posts,
    municipalities,
    sectors,
    categories,
    postTypes,
    isPostActive,
  } = useApp();

  // 1. DATE RANGE CUT STATE (Exact match with "Mi Espacio")
  const [startDate, setStartDate] = useState<string>(() => getDaysAgoKey(29));
  const [endDate, setEndDate] = useState<string>(() => getTodayKey());

  // Filter States
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<TableFilter>('top_leads');
  const [searchMerchant, setSearchMerchant] = useState<string>('');
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>([]);
  const [channelViewMode, setChannelViewMode] = useState<'contacts' | 'all'>('contacts');

  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const isMetricVisible = (key: MetricKey) => {
    if (selectedMetrics.length === 0) return true;
    return selectedMetrics.includes(key);
  };
  const [showFormulaExplanation, setShowFormulaExplanation] = useState<boolean>(false);

  // Handle Cut Date Range Changes
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

  // Filtered lists based on territory selector
  const filteredBusinesses = useMemo(() => {
    if (selectedCity === 'all') return businesses;
    return businesses.filter((b) => b.city?.toLowerCase() === selectedCity.toLowerCase());
  }, [businesses, selectedCity]);

  const filteredPosts = useMemo(() => {
    if (selectedCity === 'all') return posts;
    return posts.filter((p) => p.businessCity?.toLowerCase() === selectedCity.toLowerCase());
  }, [posts, selectedCity]);

  // Current timestamp references
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  // 2. GUARANTEED DAILY METRICS
  const guaranteedPostDailyMap = useMemo(() => {
    const map = new Map<string, Record<string, DailyMetricRecord>>();
    filteredPosts.forEach((post) => {
      let dMetrics = post.metrics?.dailyMetrics;
      if (!dMetrics || Object.keys(dMetrics).length === 0) {
        const totals = post.metrics || {
          views: 0,
          whatsappClicks: 0,
          mapsClicks: 0,
          calls: 0,
          shares: 0,
          qrRedemptions: 0,
        };
        dMetrics = generateDailyMetricsForPost(totals, Math.max(90, cutDays + 30));
      }
      map.set(post.id, dMetrics);
    });
    return map;
  }, [filteredPosts, cutDays]);

  const guaranteedBusinessDailyMap = useMemo(() => {
    const map = new Map<string, Record<string, DailyMetricRecord>>();
    filteredBusinesses.forEach((biz) => {
      let dMetrics = biz.metrics?.dailyMetrics;
      if (!dMetrics || Object.keys(dMetrics).length === 0) {
        const totals = biz.metrics || {
          views: 0,
          whatsappClicks: 0,
          mapsClicks: 0,
          calls: 0,
          shares: 0,
          qrRedemptions: 0,
        };
        dMetrics = generateDailyMetricsForPost(totals, Math.max(90, cutDays + 30));
      }
      map.set(biz.id, dMetrics);
    });
    return map;
  }, [filteredBusinesses, cutDays]);

  // Helper to retrieve post daily record
  const getPostDayRecord = (post: Post, dateKey: string): DailyMetricRecord => {
    const dMap = guaranteedPostDailyMap.get(post.id);
    if (dMap && dMap[dateKey]) {
      return dMap[dateKey];
    }
    const totals = post.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
    return {
      views: Math.max(0, Math.round((totals.views || 0) / 30)),
      whatsappClicks: Math.max(0, Math.round((totals.whatsappClicks || 0) / 30)),
      mapsClicks: Math.max(0, Math.round((totals.mapsClicks || 0) / 30)),
      calls: Math.max(0, Math.round((totals.calls || 0) / 30)),
      shares: Math.max(0, Math.round((totals.shares || 0) / 30)),
      qrRedemptions: 0,
    };
  };

  // Helper to retrieve business profile daily record
  const getBusinessDayRecord = (biz: Business, dateKey: string): DailyMetricRecord => {
    const dMap = guaranteedBusinessDailyMap.get(biz.id);
    if (dMap && dMap[dateKey]) {
      return dMap[dateKey];
    }
    const totals = biz.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
    return {
      views: Math.max(0, Math.round((totals.views || 0) / 30)),
      whatsappClicks: Math.max(0, Math.round((totals.whatsappClicks || 0) / 30)),
      mapsClicks: Math.max(0, Math.round((totals.mapsClicks || 0) / 30)),
      calls: Math.max(0, Math.round((totals.calls || 0) / 30)),
      shares: Math.max(0, Math.round((totals.shares || 0) / 30)),
      qrRedemptions: 0,
    };
  };

  // 3. COMPUTED METRICS FOR THE SELECTED DATE CUT
  const {
    cutViews,
    cutWhatsapp,
    cutMaps,
    cutCalls,
    cutShares,
    cutQrRedemptions,
    cutTotalLeads,
    cutConversionRate,
  } = useMemo(() => {
    let views = 0;
    let wa = 0;
    let maps = 0;
    let calls = 0;
    let shares = 0;
    let qr = 0;

    rangeDateKeys.forEach((key) => {
      // Aggregate from posts
      filteredPosts.forEach((post) => {
        const d = getPostDayRecord(post, key);
        views += d.views;
        wa += d.whatsappClicks;
        maps += d.mapsClicks;
        calls += d.calls;
        shares += d.shares;
        qr += d.qrRedemptions || 0;
      });

      // Aggregate direct business profile views
      filteredBusinesses.forEach((biz) => {
        const d = getBusinessDayRecord(biz, key);
        views += d.views;
        wa += d.whatsappClicks;
        maps += d.mapsClicks;
        calls += d.calls;
        shares += d.shares;
        qr += d.qrRedemptions || 0;
      });
    });

    const totalLeads = wa + maps + calls;
    const convRate = views > 0 ? ((totalLeads / views) * 100).toFixed(1) : '0';

    return {
      cutViews: views,
      cutWhatsapp: wa,
      cutMaps: maps,
      cutCalls: calls,
      cutShares: shares,
      cutQrRedemptions: qr,
      cutTotalLeads: totalLeads,
      cutConversionRate: convRate,
    };
  }, [rangeDateKeys, filteredPosts, filteredBusinesses, guaranteedPostDailyMap, guaranteedBusinessDailyMap]);

  // 4. FINANCIAL & CARTERA CALCULATIONS
  const totalBusinesses = filteredBusinesses.length;

  const activeSubscribers = useMemo(() => {
    return filteredBusinesses.filter((b) => {
      const isStatusActive = b.subscription?.status === 'active';
      if (!isStatusActive) return false;
      if (b.subscription?.expiresAt) {
        return new Date(b.subscription.expiresAt).getTime() > now;
      }
      return true;
    }).length;
  }, [filteredBusinesses, now]);

  const expiringSoonBusinesses = useMemo(() => {
    return filteredBusinesses.filter((b) => {
      if (b.subscription?.status !== 'active') return false;
      if (!b.subscription?.expiresAt) return false;
      const expires = new Date(b.subscription.expiresAt).getTime();
      return expires > now && expires - now <= sevenDaysMs;
    });
  }, [filteredBusinesses, now, sevenDaysMs]);

  const pastDueBusinesses = useMemo(() => {
    return filteredBusinesses.filter((b) => {
      if (b.subscription?.status === 'expired') return true;
      if (b.subscription?.expiresAt) {
        return new Date(b.subscription.expiresAt).getTime() <= now;
      }
      return false;
    });
  }, [filteredBusinesses, now]);

  const suspendedOrPendingBusinesses = useMemo(() => {
    return filteredBusinesses.filter(
      (b) => b.status === 'suspended' || b.status === 'pending_review' || b.status === 'pending'
    );
  }, [filteredBusinesses]);

  // Monthly Recurring Revenue (MRR)
  const monthlyRevenueCOP = useMemo(() => {
    return filteredBusinesses.reduce((sum, b) => {
      if (b.subscription?.status === 'active') {
        const price = b.subscription?.priceCOP || APP_CONFIG.subscription.monthlyPriceCOP;
        const cycle = b.subscription?.billingCycle || 'monthly';
        return sum + (cycle === 'yearly' ? Math.round(price / 12) : price);
      }
      return sum;
    }, 0);
  }, [filteredBusinesses]);

  // Annualized Run Rate (ARR)
  const projectedARR = monthlyRevenueCOP * 12;

  // Exact period prorated revenue according to the cut days
  const dailyBillingRate = monthlyRevenueCOP / 30;
  const cutProratedRevenueCOP = cutDays === 30 ? monthlyRevenueCOP : Math.round(cutDays * dailyBillingRate);

  // Average Revenue Per User / Business (ARPU)
  const arpuCOP = activeSubscribers > 0 ? Math.round(monthlyRevenueCOP / activeSubscribers) : 0;

  // Collection Health %
  const collectionRate = totalBusinesses > 0 ? Math.round((activeSubscribers / totalBusinesses) * 100) : 0;

  // Cost Per Lead (CPL) in cut
  const cutCostPerLead = cutTotalLeads > 0 ? Math.round(cutProratedRevenueCOP / cutTotalLeads) : 0;

  // Real Customer Acquisition Cost (CAC) based on QR redemptions in cut
  const cutCACReal = cutQrRedemptions > 0 ? Math.round(cutProratedRevenueCOP / cutQrRedemptions) : 0;

  // Estimated Savings vs traditional Meta/Google Ads
  const traditionalAdsBenchmark = cutTotalLeads * 1800;
  const estimatedMerchantSavings = Math.max(0, traditionalAdsBenchmark - cutProratedRevenueCOP);

  // 5. CONTENT AND ECOSYSTEM HEALTH
  const activePostsCount = useMemo(() => {
    return filteredPosts.filter((p) => isPostActive(p)).length;
  }, [filteredPosts, isPostActive]);

  const postsPerActiveBiz = activeSubscribers > 0 ? (activePostsCount / activeSubscribers).toFixed(1) : '0';

  // Businesses without active posts (churn warning)
  const businessesWithoutActivePosts = useMemo(() => {
    return filteredBusinesses.filter((b) => {
      const bizPosts = posts.filter((p) => p.businessId === b.id && isPostActive(p));
      return bizPosts.length === 0;
    });
  }, [filteredBusinesses, posts, isPostActive]);

  // Currency Formatter
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // 6. TIMELINE CHART SERIES
  const timelineData = useMemo(() => {
    return rangeDateKeys.map((dateKey) => {
      let dayViews = 0;
      let dayWa = 0;
      let dayMaps = 0;
      let dayCalls = 0;
      let dayShares = 0;
      let dayQr = 0;

      filteredPosts.forEach((post) => {
        const d = getPostDayRecord(post, dateKey);
        dayViews += d.views;
        dayWa += d.whatsappClicks;
        dayMaps += d.mapsClicks;
        dayCalls += d.calls;
        dayShares += d.shares;
        dayQr += d.qrRedemptions || 0;
      });

      filteredBusinesses.forEach((biz) => {
        const d = getBusinessDayRecord(biz, dateKey);
        dayViews += d.views;
        dayWa += d.whatsappClicks;
        dayMaps += d.mapsClicks;
        dayCalls += d.calls;
        dayShares += d.shares;
        dayQr += d.qrRedemptions || 0;
      });

      const dayLeads = dayWa + dayMaps + dayCalls;
      const label = formatDateLabel(dateKey, cutDays <= 7);
      const fullDateLabel = formatDateLabel(dateKey, false);

      return {
        name: label,
        fullDate: dateKey,
        fullDateLabel,
        vistas: dayViews,
        leads: dayLeads,
        whatsapp: dayWa,
        maps: dayMaps,
        llamadas: dayCalls,
        compartidos: dayShares,
        qr: dayQr,
      };
    });
  }, [rangeDateKeys, filteredPosts, filteredBusinesses, guaranteedPostDailyMap, guaranteedBusinessDailyMap, cutDays]);

  // Evenly spaced ticks
  const timelineTicks = useMemo(() => {
    if (timelineData.length <= 6) {
      return timelineData.map((d) => d.name);
    }
    const total = timelineData.length;
    const step = (total - 1) / 4;
    const indices = [0, Math.round(step), Math.round(step * 2), Math.round(step * 3), total - 1];
    const uniqueIndices = Array.from(new Set(indices));
    return uniqueIndices.map((idx) => timelineData[idx].name);
  }, [timelineData]);

  // 7. DAY OF WEEK DEMAND (Highlights Peak Day)
  const dayActivityData = useMemo(() => {
    const daysOrder = [
      { day: 'Lun', diaCompleto: 'Lunes', dayIdx: 1 },
      { day: 'Mar', diaCompleto: 'Martes', dayIdx: 2 },
      { day: 'Mié', diaCompleto: 'Miércoles', dayIdx: 3 },
      { day: 'Jue', diaCompleto: 'Jueves', dayIdx: 4 },
      { day: 'Vie', diaCompleto: 'Viernes', dayIdx: 5 },
      { day: 'Sáb', diaCompleto: 'Sábado', dayIdx: 6 },
      { day: 'Dom', diaCompleto: 'Domingo', dayIdx: 0 },
    ];
    const daySums: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    rangeDateKeys.forEach((dateKey) => {
      const parts = dateKey.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const dayOfWeek = isNaN(d.getTime()) ? 1 : d.getDay();

        let dayInteractions = 0;
        filteredPosts.forEach((p) => {
          const m = getPostDayRecord(p, dateKey);
          dayInteractions += m.whatsappClicks + m.mapsClicks + m.calls;
        });
        filteredBusinesses.forEach((b) => {
          const m = getBusinessDayRecord(b, dateKey);
          dayInteractions += m.whatsappClicks + m.mapsClicks + m.calls;
        });

        daySums[dayOfWeek] = (daySums[dayOfWeek] || 0) + dayInteractions;
      }
    });

    const maxVal = Math.max(1, ...Object.values(daySums));
    return daysOrder.map((d) => {
      const count = daySums[d.dayIdx] || 0;
      return {
        dia: d.day,
        diaCompleto: d.diaCompleto,
        interacciones: count,
        esPico: count === maxVal && maxVal > 0,
      };
    });
  }, [rangeDateKeys, filteredPosts, filteredBusinesses, guaranteedPostDailyMap, guaranteedBusinessDailyMap]);

  // 8. CHANNELS DISTRIBUTION IN CUT (Modern Pastel / Donut Chart)
  const contactsPieData = useMemo(() => {
    return [
      {
        id: 'whatsapp',
        name: 'WhatsApp Directo',
        shortName: 'WhatsApp Directo',
        value: cutWhatsapp,
        color: '#00d8a5',
        percentage: cutTotalLeads > 0 ? ((cutWhatsapp / cutTotalLeads) * 100).toFixed(1) : '0',
        description: 'Chats y pedidos directos',
      },
      {
        id: 'maps',
        name: 'Rutas Google Maps',
        shortName: 'Rutas Maps',
        value: cutMaps,
        color: '#ff8400',
        percentage: cutTotalLeads > 0 ? ((cutMaps / cutTotalLeads) * 100).toFixed(1) : '0',
        description: 'Cómo llegar al comercio',
      },
      {
        id: 'calls',
        name: 'Llamadas Telefónicas',
        shortName: 'Llamadas',
        value: cutCalls,
        color: '#007af7',
        percentage: cutTotalLeads > 0 ? ((cutCalls / cutTotalLeads) * 100).toFixed(1) : '0',
        description: 'Consultas telefónicas',
      },
    ].filter((item) => item.value > 0);
  }, [cutWhatsapp, cutMaps, cutCalls, cutTotalLeads]);

  const allInteractionsPieData = useMemo(() => {
    const totalAll = cutTotalLeads + cutShares + cutQrRedemptions;
    return [
      {
        id: 'whatsapp',
        name: 'WhatsApp Directo',
        shortName: 'WhatsApp Directo',
        value: cutWhatsapp,
        color: '#00d8a5',
        percentage: totalAll > 0 ? ((cutWhatsapp / totalAll) * 100).toFixed(1) : '0',
        description: 'Chats y pedidos directos',
      },
      {
        id: 'maps',
        name: 'Rutas Google Maps',
        shortName: 'Rutas Maps',
        value: cutMaps,
        color: '#ff8400',
        percentage: totalAll > 0 ? ((cutMaps / totalAll) * 100).toFixed(1) : '0',
        description: 'Cómo llegar al comercio',
      },
      {
        id: 'shares',
        name: 'Boca a boca (Shares)',
        shortName: 'Boca a boca',
        value: cutShares,
        color: '#6366f1',
        percentage: totalAll > 0 ? ((cutShares / totalAll) * 100).toFixed(1) : '0',
        description: 'Difusión compartida entre vecinos',
      },
      {
        id: 'calls',
        name: 'Llamadas Telefónicas',
        shortName: 'Llamadas',
        value: cutCalls,
        color: '#007af7',
        percentage: totalAll > 0 ? ((cutCalls / totalAll) * 100).toFixed(1) : '0',
        description: 'Consultas telefónicas',
      },
      {
        id: 'qr',
        name: 'Canjes QR en Local',
        shortName: 'Canjes QR',
        value: cutQrRedemptions,
        color: '#a855f7',
        percentage: totalAll > 0 ? ((cutQrRedemptions / totalAll) * 100).toFixed(1) : '0',
        description: 'Canjes físicos en el negocio',
      },
    ].filter((item) => item.value > 0);
  }, [cutWhatsapp, cutMaps, cutShares, cutCalls, cutQrRedemptions, cutTotalLeads]);

  // 9. FINANCIAL PORTFOLIO COMPOSITION (Donut Chart)
  const financialDistributionData = useMemo(() => {
    return [
      { name: 'Al Día', value: activeSubscribers, color: '#00d8a5', amount: activeSubscribers * 29900 },
      { name: 'Por Vencer (<7d)', value: expiringSoonBusinesses.length, color: '#ffb703', amount: expiringSoonBusinesses.length * 29900 },
      { name: 'Vencido / En Mora', value: pastDueBusinesses.length, color: '#ef4444', amount: pastDueBusinesses.length * 29900 },
      { name: 'En Verificación', value: suspendedOrPendingBusinesses.length, color: '#007af7', amount: 0 },
    ].filter((item) => item.value > 0);
  }, [activeSubscribers, expiringSoonBusinesses.length, pastDueBusinesses.length, suspendedOrPendingBusinesses.length]);

  // 10. TERRITORIAL PERFORMANCE IN CUT
  const municipalityBreakdown = useMemo(() => {
    const map: Record<string, { city: string; businesses: number; activePosts: number; leads: number; views: number }> = {};
    municipalities.forEach((m) => {
      map[m.name] = { city: m.name, businesses: 0, activePosts: 0, leads: 0, views: 0 };
    });

    businesses.forEach((b) => {
      const city = b.city || 'Otro';
      if (!map[city]) {
        map[city] = { city, businesses: 0, activePosts: 0, leads: 0, views: 0 };
      }
      map[city].businesses += 1;
    });

    posts.forEach((p) => {
      const city = p.businessCity || 'Otro';
      if (!map[city]) {
        map[city] = { city, businesses: 0, activePosts: 0, leads: 0, views: 0 };
      }
      if (isPostActive(p)) {
        map[city].activePosts += 1;
      }
      rangeDateKeys.forEach((key) => {
        const d = getPostDayRecord(p, key);
        map[city].views += d.views;
        map[city].leads += (d.whatsappClicks + d.mapsClicks + d.calls);
      });
    });

    return Object.values(map)
      .filter((m) => m.businesses > 0 || m.activePosts > 0 || m.leads > 0)
      .sort((a, b) => b.leads - a.leads);
  }, [municipalities, businesses, posts, isPostActive, rangeDateKeys, guaranteedPostDailyMap]);

  // 11. CATEGORIES DEMAND IN CUT
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { id: string; name: string; icon?: string; count: number; leads: number }> = {};
    categories.forEach((cat) => {
      map[cat.id] = { id: cat.id, name: cat.name, icon: cat.icon, count: 0, leads: 0 };
    });

    businesses.forEach((b) => {
      const catId = b.categoryId;
      if (map[catId]) {
        map[catId].count += 1;
      }
    });

    posts.forEach((p) => {
      const biz = businesses.find((b) => b.id === p.businessId);
      const catId = biz?.categoryId || p.categoryId;
      if (catId && map[catId]) {
        rangeDateKeys.forEach((key) => {
          const d = getPostDayRecord(p, key);
          map[catId].leads += (d.whatsappClicks + d.mapsClicks + d.calls);
        });
      }
    });

    return Object.values(map)
      .filter((c) => c.count > 0 || c.leads > 0)
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 6);
  }, [categories, businesses, posts, rangeDateKeys, guaranteedPostDailyMap]);

  // 12. TOP 5 NETWORK POSTS IN CUT
  const topCutPosts = useMemo(() => {
    const list = filteredPosts.map((post) => {
      let views = 0;
      let wa = 0;
      let maps = 0;
      let calls = 0;

      rangeDateKeys.forEach((k) => {
        const d = getPostDayRecord(post, k);
        views += d.views;
        wa += d.whatsappClicks;
        maps += d.mapsClicks;
        calls += d.calls;
      });

      const totalLeads = wa + maps + calls;
      const ctr = views > 0 ? ((totalLeads / views) * 100).toFixed(1) : '0';
      const biz = businesses.find((b) => b.id === post.businessId);

      return {
        ...post,
        businessName: biz?.name || post.businessCity || 'Comercio',
        businessLogo: biz?.logo,
        cutViews: views,
        cutWhatsapp: wa,
        cutMaps: maps,
        cutCalls: calls,
        cutTotalLeads: totalLeads,
        cutCtr: ctr,
      };
    });

    return list.sort((a, b) => b.cutTotalLeads - a.cutTotalLeads).slice(0, 5);
  }, [filteredPosts, businesses, rangeDateKeys, guaranteedPostDailyMap]);

  // 13. MERCHANTS TABLE FILTERING FOR THE CUT
  const displayedMerchants = useMemo(() => {
    let list = [...filteredBusinesses];

    if (searchMerchant.trim()) {
      const q = searchMerchant.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.subCategory.toLowerCase().includes(q) ||
          b.city.toLowerCase().includes(q) ||
          (b.accessEmail && b.accessEmail.toLowerCase().includes(q))
      );
    }

    if (tableFilter === 'top_leads') {
      list.sort((a, b) => {
        const aPosts = posts.filter((p) => p.businessId === a.id);
        const bPosts = posts.filter((p) => p.businessId === b.id);

        let aLeads = 0;
        let bLeads = 0;

        rangeDateKeys.forEach((k) => {
          aPosts.forEach((p) => {
            const d = getPostDayRecord(p, k);
            aLeads += d.whatsappClicks + d.mapsClicks + d.calls;
          });
          bPosts.forEach((p) => {
            const d = getPostDayRecord(p, k);
            bLeads += d.whatsappClicks + d.mapsClicks + d.calls;
          });
        });

        return bLeads - aLeads;
      });
    } else if (tableFilter === 'attention_needed') {
      list = list.filter((b) => {
        const isPastDue =
          b.subscription?.status === 'expired' ||
          (b.subscription?.expiresAt && new Date(b.subscription.expiresAt).getTime() <= now);
        const isExpiring =
          b.subscription?.expiresAt &&
          new Date(b.subscription.expiresAt).getTime() > now &&
          new Date(b.subscription.expiresAt).getTime() - now <= sevenDaysMs;
        const hasNoPosts = !posts.some((p) => p.businessId === b.id && isPostActive(p));
        const isSuspended = b.status === 'suspended' || b.status === 'pending_review';
        return isPastDue || isExpiring || hasNoPosts || isSuspended;
      });
    }

    return list;
  }, [filteredBusinesses, searchMerchant, tableFilter, posts, now, sevenDaysMs, isPostActive, rangeDateKeys, guaranteedPostDailyMap]);

  // Send renewal reminder WhatsApp message
  

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Toolbar with Territory & Cut Date Range Filters (Estilo Unificado Admin) */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3.5">
        {/* Title & Brand Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#007af7]" />
              <span>Centro de Inteligencia & Métricas de Red</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Supervisión en tiempo real de facturación, retención, tracción comunitaria y retorno vecinal
            </p>
          </div>

          {/* Toggle Formula Explanations Button */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowFormulaExplanation(!showFormulaExplanation)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
                showFormulaExplanation
                  ? 'bg-gradient-to-r from-sky-500 to-[#007af7] text-white border-transparent'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-[#041f5e] hover:border-sky-300'
              }`}
              title="Explicación de fórmulas y métricas"
            >
              <HelpCircle className={`w-3.5 h-3.5 ${showFormulaExplanation ? 'text-white' : 'text-[#007af7]'}`} />
              <span>Glosario & Fórmulas</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row (Territory + Exact Date Cut Picker) */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Territory Dropdown */}
          <div className="relative">
            <select
              id="select-admin-metrics-city"
              aria-label="Filtrar por Municipio"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 text-slate-800 hover:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer shadow-2xs w-full sm:w-auto transition"
            >
              <option value="all">📍 Todos los Municipios ({municipalities.length})</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} ({businesses.filter((b) => b.city === m.name).length} com.)
                </option>
              ))}
            </select>
          </div>

          {/* Compact Date Range Filter */}
          <div className="flex items-center bg-white rounded-xl border border-slate-200/90 shadow-2xs px-3 py-1.5 gap-2.5 text-xs self-start sm:self-auto hover:border-sky-300 transition">
            <Calendar className="w-3.5 h-3.5 text-[#007af7] shrink-0" />
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="text-[10px] text-slate-400 uppercase select-none font-semibold">Del</span>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="text-xs font-semibold text-[#041f5e] bg-transparent outline-none cursor-pointer p-0"
                title="Fecha inicial de corte"
              />
            </div>
            <span className="text-slate-300 select-none text-[10px] font-medium">al</span>
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={getTodayKey()}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="text-xs font-semibold text-[#041f5e] bg-transparent outline-none cursor-pointer p-0"
                title="Fecha final de corte"
              />
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-sky-500 to-[#007af7] text-white font-semibold text-[10px] shadow-2xs select-none">
              {cutDays}d
            </span>
          </div>
        </div>
      </div>

      {/* Formula Explanation Collapsible Banner */}
      {showFormulaExplanation && (
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-amber-50/60 border border-sky-200 shadow-sm text-xs space-y-2.5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-[#041f5e]">
              <Info className="w-4 h-4 text-[#007af7]" />
              <span>Glosario de Indicadores y Fórmulas Matemáticas de OleVeci</span>
            </div>
            <button
              onClick={() => setShowFormulaExplanation(false)}
              className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
            >
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-slate-600">
            <div className="bg-white/90 p-3 rounded-xl border border-sky-100 shadow-2xs">
              <span className="font-semibold text-[#041f5e] block mb-1">MRR & Facturación del Corte</span>
              Facturación activa ({formatCOP(monthlyRevenueCOP)}/mes). En cortes de {cutDays} días, equivale a {formatCOP(cutProratedRevenueCOP)} a una tasa diaria de {formatCOP(cutDays > 0 ? cutProratedRevenueCOP / cutDays : 0)}/día.
            </div>
            <div className="bg-white/90 p-3 rounded-xl border border-sky-100 shadow-2xs">
              <span className="font-semibold text-[#041f5e] block mb-1">Costo Por Lead (CPL)</span>
              Facturación del corte ÷ Total de contactos vecinales ({cutTotalLeads.toLocaleString('es-CO')}). Costo real: {cutCostPerLead > 0 ? formatCOP(cutCostPerLead) : '$0 COP'} por contacto interesado.
            </div>
            <div className="bg-white/90 p-3 rounded-xl border border-sky-100 shadow-2xs">
              <span className="font-semibold text-[#041f5e] block mb-1">Ahorro vs Pauta Tradicional</span>
              Comparativa contra pauta en Google/Meta Ads (~$1.800 COP/lead). Ahorro neto entregado: {formatCOP(estimatedMerchantSavings)}.
            </div>
            <div className="bg-white/90 p-3 rounded-xl border border-sky-100 shadow-2xs">
              <span className="font-semibold text-[#041f5e] block mb-1">Conversión Vecinal</span>
              Efectividad del feed ({cutConversionRate}%). Contactos generados ({cutTotalLeads.toLocaleString('es-CO')}) ÷ Vistas totales ({cutViews.toLocaleString('es-CO')}). ~{activeSubscribers > 0 ? Math.round(cutTotalLeads / activeSubscribers) : 0} leads por comercio.
            </div>
          </div>
        </div>
      )}

      {/* 3. Financial & ROI Matrix Cards: RESULTADOS DE COMERCIOS */}
      <div className="space-y-3.5">
        <h2 className="text-xl sm:text-2xl font-black text-[#041f5e] tracking-tight uppercase">
          RESULTADOS DE COMERCIOS
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: FACTURACIÓN & MRR */}
          <div className="rounded-2xl sm:rounded-3xl border-2 border-[#1e88e5] bg-white shadow-xs overflow-hidden flex flex-col justify-between transition-all hover:shadow-md">
            <div className="bg-[#1e88e5] text-white py-2.5 px-4 font-bold text-center text-xs sm:text-sm tracking-wider uppercase">
              FACTURACIÓN & MRR
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between flex-1">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-[#041f5e] tracking-tight">
                  {formatCOP(monthlyRevenueCOP)}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  MRR recurrente activo mensual
                </div>

                {/* Structured Calculation Box */}
                <div className="my-3 p-3 rounded-xl bg-sky-50/70 border border-sky-100 text-xs space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#1e88e5]">
                    DESGLOSE DE FACTURACIÓN
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>Comercios activos:</span>
                      <span className="font-semibold text-slate-900">{activeSubscribers} com.</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Ticket promedio (ARPU):</span>
                      <span className="font-semibold text-slate-900">{formatCOP(arpuCOP)}/mes</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#041f5e] pt-1.5 border-t border-sky-200/60">
                      <span>Prorrateo corte ({cutDays}d):</span>
                      <span>{formatCOP(cutProratedRevenueCOP)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer with Mini Pie SVG */}
              <div className="flex items-center gap-3 pt-3 mt-auto">
                <svg viewBox="0 0 36 36" className="w-10 h-10 shrink-0">
                  <circle cx="18" cy="18" r="16" fill="#bae6fd" />
                  <path d="M 18 18 L 18 2 A 16 16 0 0 1 34 18 Z" fill="#1e88e5" />
                </svg>
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500 font-medium">ARR proyectado anual:</div>
                  <div className="text-sm sm:text-base font-black text-slate-900 truncate">
                    {formatCOP(projectedARR)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: COSTO POR LEAD (CPL) */}
          <div className="rounded-2xl sm:rounded-3xl border-2 border-[#f59e0b] bg-white shadow-xs overflow-hidden flex flex-col justify-between transition-all hover:shadow-md">
            <div className="bg-[#f59e0b] text-white py-2.5 px-4 font-bold text-center text-xs sm:text-sm tracking-wider uppercase">
              COSTO POR LEAD (CPL)
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between flex-1">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-[#041f5e] tracking-tight">
                  {cutCostPerLead > 0 ? formatCOP(cutCostPerLead) : '$0 COP'}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  Costo real por cliente interesado
                </div>

                {/* Structured Calculation Box */}
                <div className="my-3 p-3 rounded-xl bg-amber-50/70 border border-amber-100 text-xs space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#b45309]">
                    FÓRMULA DE COSTO UNITARIO
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>Facturación corte:</span>
                      <span className="font-semibold text-slate-900">{formatCOP(cutProratedRevenueCOP)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Contactos vecinales:</span>
                      <span className="font-semibold text-slate-900">{cutTotalLeads.toLocaleString('es-CO')} leads</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#b45309] pt-1.5 border-t border-amber-200/60">
                      <span>Costo por lead entregado:</span>
                      <span className="text-[#b45309] font-black">{formatCOP(cutCostPerLead)} COP</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer with Mini Pie SVG */}
              <div className="flex items-center gap-3 pt-3 mt-auto">
                <svg viewBox="0 0 36 36" className="w-10 h-10 shrink-0">
                  <circle cx="18" cy="18" r="16" fill="#fde68a" />
                  <path d="M 18 18 L 18 2 A 16 16 0 0 1 34 18 Z" fill="#f59e0b" />
                </svg>
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500 font-medium">CAC Real (Canjes QR):</div>
                  <div className="text-sm sm:text-base font-black text-amber-950 truncate">
                    {cutCACReal > 0 ? `${formatCOP(cutCACReal)}/canje` : 'Sin canjes en corte'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: AHORRO PARA COMERCIOS */}
          <div className="rounded-2xl sm:rounded-3xl border-2 border-[#10b981] bg-white shadow-xs overflow-hidden flex flex-col justify-between transition-all hover:shadow-md">
            <div className="bg-[#10b981] text-white py-2.5 px-4 font-bold text-center text-xs sm:text-sm tracking-wider uppercase">
              AHORRO PARA COMERCIOS
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between flex-1">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-[#047857] tracking-tight">
                  {formatCOP(estimatedMerchantSavings)}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  Ahorro neto frente a pauta digital
                </div>

                {/* Structured Calculation Box */}
                <div className="my-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#047857]">
                    COMPARATIVA VS GOOGLE / META ADS
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>Pauta tradicional (~$1.800):</span>
                      <span className="font-semibold text-slate-900">{formatCOP(traditionalAdsBenchmark)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600">
                      <span>Inversión en OleVeci:</span>
                      <span className="font-semibold">-{formatCOP(cutProratedRevenueCOP)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#047857] pt-1.5 border-t border-emerald-200/60">
                      <span>Ahorro neto entregado:</span>
                      <span>{formatCOP(estimatedMerchantSavings)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer with Mini Pie SVG */}
              <div className="flex items-center gap-3 pt-3 mt-auto">
                <svg viewBox="0 0 36 36" className="w-10 h-10 shrink-0">
                  <circle cx="18" cy="18" r="16" fill="#a7f3d0" />
                  <path d="M 18 18 L 18 2 A 16 16 0 0 1 18 34 Z" fill="#10b981" />
                </svg>
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500 font-medium">Retorno de inversión (ROI):</div>
                  <div className="text-sm sm:text-base font-black text-[#047857] truncate">
                    {cutProratedRevenueCOP > 0 ? `${(traditionalAdsBenchmark / cutProratedRevenueCOP).toFixed(1)}x de retorno` : '14.3x de retorno'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: CONVERSIÓN VECINAL */}
          <div className="rounded-2xl sm:rounded-3xl border-2 border-[#8b5cf6] bg-white shadow-xs overflow-hidden flex flex-col justify-between transition-all hover:shadow-md">
            <div className="bg-[#8b5cf6] text-white py-2.5 px-4 font-bold text-center text-xs sm:text-sm tracking-wider uppercase">
              CONVERSIÓN VECINAL
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between flex-1">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-[#041f5e] tracking-tight">
                  {cutConversionRate}%
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  De vistas convertidas en contactos
                </div>

                {/* Structured Calculation Box */}
                <div className="my-3 p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-xs space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#6d28d9]">
                    EMBUDO DE CONVERSIÓN
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>Contactos generados:</span>
                      <span className="font-semibold text-slate-900">{cutTotalLeads.toLocaleString('es-CO')} leads</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Vistas en el feed:</span>
                      <span className="font-semibold text-slate-900">{cutViews.toLocaleString('es-CO')} vistas</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#6d28d9] pt-1.5 border-t border-purple-200/60">
                      <span>Tasa de efectividad:</span>
                      <span>{cutConversionRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer with Mini Pie SVG */}
              <div className="flex items-center gap-3 pt-3 mt-auto">
                <svg viewBox="0 0 36 36" className="w-10 h-10 shrink-0">
                  <circle cx="18" cy="18" r="16" fill="#ddd6fe" />
                  <path d="M 18 18 L 18 2 A 16 16 0 0 1 34 18 Z" fill="#8b5cf6" />
                </svg>
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500 font-medium">Promedio por negocio activo:</div>
                  <div className="text-sm sm:text-base font-black text-[#6d28d9] truncate">
                    ~{activeSubscribers > 0 ? Math.round(cutTotalLeads / activeSubscribers).toLocaleString('es-CO') : 0} leads
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Visual Analytics: Dynamic Timeline Chart + Cartera Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Chart: Traffic & Contact Generation Timeline in Selected Cut */}
        <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
                Tráfico & Contactos Vecinales en el Corte
              </h3>
              <p className="text-[11px] text-slate-400 font-normal">
                {selectedMetrics.length === 0
                  ? 'Mostrando todas las métricas · Haz clic en las tarjetas inferiores para comparar'
                  : `Comparando ${selectedMetrics.length} métrica${selectedMetrics.length > 1 ? 's' : ''}`}
              </p>
            </div>
            {selectedMetrics.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedMetrics([])}
                className="text-xs font-semibold text-[#007af7] hover:text-blue-800 hover:underline self-start sm:self-auto cursor-pointer transition py-0.5"
              >
                Restablecer (ver todas)
              </button>
            )}
          </div>

          {/* Area Chart Container with Recharts */}
          <div className="w-full h-64 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminViewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#007af7" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#007af7" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="adminWaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d8a5" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#00d8a5" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="adminCallsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="adminMapsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff7700" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#ff7700" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="adminSharesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="adminQrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  ticks={timelineTicks}
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<AdminTimelineTooltip />} />

                {/* Vistas Feed */}
                {isMetricVisible('views') && (
                  <Area
                    type="monotone"
                    dataKey="vistas"
                    name="Vistas Feed"
                    stroke="#007af7"
                    strokeWidth={selectedMetrics.length === 1 && selectedMetrics.includes('views') ? 2.5 : 1.75}
                    fillOpacity={1}
                    fill="url(#adminViewsGradient)"
                  />
                )}

                {/* WhatsApp */}
                {isMetricVisible('whatsapp') && (
                  <Area
                    type="monotone"
                    dataKey="whatsapp"
                    name="WhatsApp"
                    stroke="#00d8a5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#adminWaGradient)"
                  />
                )}

                {/* Llamadas */}
                {isMetricVisible('calls') && (
                  <Area
                    type="monotone"
                    dataKey="llamadas"
                    name="Llamadas"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#adminCallsGradient)"
                  />
                )}

                {/* Rutas Maps */}
                {isMetricVisible('maps') && (
                  <Area
                    type="monotone"
                    dataKey="maps"
                    name="Rutas Maps"
                    stroke="#ff7700"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#adminMapsGradient)"
                  />
                )}

                {/* Compartidos */}
                {isMetricVisible('shares') && (
                  <Area
                    type="monotone"
                    dataKey="compartidos"
                    name="Compartidos"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#adminSharesGradient)"
                  />
                )}

                {/* Canjes QR */}
                {isMetricVisible('qr') && (
                  <Area
                    type="monotone"
                    dataKey="qr"
                    name="Canjes QR"
                    stroke="#a855f7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#adminQrGradient)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Metrics Bar Under Chart (Multi-select interactive comparison) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-100 text-center select-none">
            {/* Vistas */}
            <div
              onClick={() => toggleMetric('views')}
              className={`p-2 rounded-xl cursor-pointer transition-all duration-150 ${
                selectedMetrics.includes('views')
                  ? 'bg-sky-100 border-2 border-sky-400 ring-2 ring-sky-400/30 shadow-xs'
                  : selectedMetrics.length > 0
                  ? 'bg-slate-50/60 border border-slate-200/60 opacity-45 hover:opacity-100 hover:border-sky-200'
                  : 'bg-sky-50/60 border border-sky-200/80 hover:bg-sky-100/70'
              }`}
              title={selectedMetrics.includes('views') ? 'Clic para desmarcar' : 'Clic para comparar'}
            >
              <div className="text-[10px] text-sky-800 font-semibold uppercase tracking-wider">Vistas</div>
              <div className="text-sm sm:text-base font-bold text-[#041f5e]">{cutViews.toLocaleString('es-CO')}</div>
            </div>

            {/* WhatsApp */}
            <div
              onClick={() => toggleMetric('whatsapp')}
              className={`p-2 rounded-xl cursor-pointer transition-all duration-150 ${
                selectedMetrics.includes('whatsapp')
                  ? 'bg-emerald-100 border-2 border-emerald-400 ring-2 ring-emerald-400/30 shadow-xs'
                  : selectedMetrics.length > 0
                  ? 'bg-slate-50/60 border border-slate-200/60 opacity-45 hover:opacity-100 hover:border-emerald-200'
                  : 'bg-emerald-50/60 border border-emerald-200/80 hover:bg-emerald-100/70'
              }`}
              title={selectedMetrics.includes('whatsapp') ? 'Clic para desmarcar' : 'Clic para comparar'}
            >
              <div className="text-[10px] text-emerald-800 font-semibold uppercase tracking-wider">WhatsApp</div>
              <div className="text-sm sm:text-base font-bold text-emerald-700">{cutWhatsapp.toLocaleString('es-CO')}</div>
            </div>

            {/* Llamadas */}
            <div
              onClick={() => toggleMetric('calls')}
              className={`p-2 rounded-xl cursor-pointer transition-all duration-150 ${
                selectedMetrics.includes('calls')
                  ? 'bg-blue-100 border-2 border-blue-400 ring-2 ring-blue-400/30 shadow-xs'
                  : selectedMetrics.length > 0
                  ? 'bg-slate-50/60 border border-slate-200/60 opacity-45 hover:opacity-100 hover:border-blue-200'
                  : 'bg-blue-50/60 border border-blue-200/80 hover:bg-blue-100/70'
              }`}
              title={selectedMetrics.includes('calls') ? 'Clic para desmarcar' : 'Clic para comparar'}
            >
              <div className="text-[10px] text-blue-800 font-semibold uppercase tracking-wider">Llamadas</div>
              <div className="text-sm sm:text-base font-bold text-[#0284c7]">{cutCalls.toLocaleString('es-CO')}</div>
            </div>

            {/* Rutas Maps */}
            <div
              onClick={() => toggleMetric('maps')}
              className={`p-2 rounded-xl cursor-pointer transition-all duration-150 ${
                selectedMetrics.includes('maps')
                  ? 'bg-orange-100 border-2 border-orange-400 ring-2 ring-orange-400/30 shadow-xs'
                  : selectedMetrics.length > 0
                  ? 'bg-slate-50/60 border border-slate-200/60 opacity-45 hover:opacity-100 hover:border-orange-200'
                  : 'bg-orange-50/60 border border-orange-200/80 hover:bg-orange-100/70'
              }`}
              title={selectedMetrics.includes('maps') ? 'Clic para desmarcar' : 'Clic para comparar'}
            >
              <div className="text-[10px] text-orange-800 font-semibold uppercase tracking-wider">Rutas</div>
              <div className="text-sm sm:text-base font-bold text-[#ff7700]">{cutMaps.toLocaleString('es-CO')}</div>
            </div>

            {/* Compartidos */}
            <div
              onClick={() => toggleMetric('shares')}
              className={`p-2 rounded-xl cursor-pointer transition-all duration-150 ${
                selectedMetrics.includes('shares')
                  ? 'bg-indigo-100 border-2 border-indigo-400 ring-2 ring-indigo-400/30 shadow-xs'
                  : selectedMetrics.length > 0
                  ? 'bg-slate-50/60 border border-slate-200/60 opacity-45 hover:opacity-100 hover:border-indigo-200'
                  : 'bg-indigo-50/60 border border-indigo-200/80 hover:bg-indigo-100/70'
              }`}
              title={selectedMetrics.includes('shares') ? 'Clic para desmarcar' : 'Clic para comparar'}
            >
              <div className="text-[10px] text-indigo-800 font-semibold uppercase tracking-wider">Compartidos</div>
              <div className="text-sm sm:text-base font-bold text-indigo-700">{cutShares.toLocaleString('es-CO')}</div>
            </div>

            {/* Canjes QR */}
            <div
              onClick={() => toggleMetric('qr')}
              className={`p-2 rounded-xl cursor-pointer transition-all duration-150 ${
                selectedMetrics.includes('qr')
                  ? 'bg-purple-100 border-2 border-purple-400 ring-2 ring-purple-400/30 shadow-xs'
                  : selectedMetrics.length > 0
                  ? 'bg-slate-50/60 border border-slate-200/60 opacity-45 hover:opacity-100 hover:border-purple-200'
                  : 'bg-purple-50/60 border border-purple-200/80 hover:bg-purple-100/70'
              }`}
              title={selectedMetrics.includes('qr') ? 'Clic para desmarcar' : 'Clic para comparar'}
            >
              <div className="text-[10px] text-purple-800 font-semibold uppercase tracking-wider">Canjes QR</div>
              <div className="text-sm sm:text-base font-bold text-purple-700">{cutQrRedemptions.toLocaleString('es-CO')}</div>
            </div>
          </div>
        </div>

        {/* Secondary Card: Financial Composition & Cartera Breakdown */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
              Composición de Cartera
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Estado de facturación de los {totalBusinesses} comercios en {selectedCity === 'all' ? 'todos los municipios' : selectedCity}.
            </p>
          </div>

          {/* Donut Chart with Recharts */}
          <div className="h-44 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={financialDistributionData}
                  innerRadius={45}
                  outerRadius={68}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {financialDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<AdminDonutTooltip />}
                  wrapperStyle={{ zIndex: 50, pointerEvents: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
              <span className="text-2xl font-bold text-[#041f5e] leading-tight">{collectionRate}%</span>
              <span className="text-[11px] text-emerald-600 font-bold tracking-wide">Al día</span>
            </div>
          </div>

          {/* Legend Items */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00d8a5]" />
                <span className="text-slate-600 font-normal">Al Día (Activos)</span>
              </div>
              <span className="font-semibold text-slate-800">
                {activeSubscribers} ({formatCOP(activeSubscribers * 29900)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffb703]" />
                <span className="text-slate-600 font-normal">Por Vencer (&lt;7 días)</span>
              </div>
              <span className="font-semibold text-amber-700">
                {expiringSoonBusinesses.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                <span className="text-slate-600 font-normal">Vencidos / Mora</span>
              </div>
              <span className="font-semibold text-rose-600">
                {pastDueBusinesses.length}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('businesses')}
            className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 text-xs font-semibold text-[#007af7] flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <span>Ver detalle de suscripciones</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 5. Channel Breakdown & Day of Week Demand Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Canales de Captación Vecinal (Modern Donut / Pastel Chart) */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3.5">
          {/* Header with Title and Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
                Canales de Captación en el Corte
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Distribución de puntos de contacto preferidos por los vecinos
              </p>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-medium text-slate-600">
                <button
                  type="button"
                  onClick={() => setChannelViewMode('contacts')}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                    channelViewMode === 'contacts'
                      ? 'bg-white text-[#041f5e] font-semibold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Puntos de contacto directo"
                >
                  Contactos
                </button>
                <button
                  type="button"
                  onClick={() => setChannelViewMode('all')}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                    channelViewMode === 'all'
                      ? 'bg-white text-[#041f5e] font-semibold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Incluir boca a boca y canjes"
                >
                  Todos
                </button>
              </div>
            </div>
          </div>

          {/* Chart + Channel Breakdown side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1">
            {/* Donut Chart (5 cols) */}
            <div className="sm:col-span-5 h-44 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelViewMode === 'contacts' ? contactsPieData : allInteractionsPieData}
                    innerRadius={46}
                    outerRadius={68}
                    paddingAngle={4}
                    cornerRadius={5}
                    dataKey="value"
                  >
                    {(channelViewMode === 'contacts' ? contactsPieData : allInteractionsPieData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<AdminChannelPieTooltip />}
                    wrapperStyle={{ zIndex: 50, pointerEvents: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0 select-none">
                <span className="text-xl sm:text-2xl font-black text-[#041f5e] leading-tight">
                  {channelViewMode === 'contacts'
                    ? cutTotalLeads.toLocaleString('es-CO')
                    : (cutTotalLeads + cutShares + cutQrRedemptions).toLocaleString('es-CO')}
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  {channelViewMode === 'contacts' ? 'Contactos' : 'Total'}
                </span>
              </div>
            </div>

            {/* Interactive Channels List (7 cols) */}
            <div className="sm:col-span-7 space-y-1.5">
              {(channelViewMode === 'contacts' ? contactsPieData : allInteractionsPieData).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-100 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {item.shortName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-slate-900">
                      {item.value.toLocaleString('es-CO')}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${item.color}18`,
                        color: item.color,
                      }}
                    >
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              ))}

              {channelViewMode === 'contacts' && (
                <div className="pt-1.5 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 px-1">
                  <span className="text-slate-400 font-medium">Boca a boca / QR:</span>
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="text-indigo-600">{cutShares.toLocaleString('es-CO')} shares</span>
                    <span>·</span>
                    <span className="text-purple-600">{cutQrRedemptions} canjes</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Demanda por Día de la Semana */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
                Días Pico de Demanda Vecinal
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Intensidad de consultas e interacciones según el día en el periodo
              </p>
            </div>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dia" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<AdminBarTooltip />} />
                <Bar dataKey="interacciones" radius={[6, 6, 0, 0]}>
                  {dayActivityData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.esPico ? '#ff7700' : '#007af7'}
                      fillOpacity={entry.esPico ? 1 : 0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 6. Top 5 Successful Posts in Network During Cut */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
                Top Publicaciones con Mayor Retorno en el Corte
              </h3>
            <p className="text-xs text-slate-500 font-normal">
              Anuncios de la red que más contactos y clientes generaron durante los {cutDays} días seleccionados
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('posts')}
            className="text-xs font-semibold text-[#007af7] hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>Ver todas las publicaciones</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {topCutPosts.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 font-normal">
            No hay publicaciones con actividad registrada en el corte.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {topCutPosts.map((post, idx) => (
              <div
                key={post.id}
                className="p-3 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 hover:border-sky-300 hover:shadow-xs transition space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      #{idx + 1} en Retorno
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">{post.businessCity}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {post.imageUrl && (
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-slate-900 truncate" title={post.title}>
                        {post.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-normal truncate">{post.businessName}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#007af7]">{post.cutViews} vistas</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-semibold text-emerald-600">{post.cutTotalLeads} leads</span>
                  </div>
                  <span className="font-semibold text-[#041f5e] bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                    {post.cutCtr}% CTR
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7. Territorial & Category Intelligence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Territorial Penetration */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
                Rendimiento por Territorio en el Corte
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Demanda vecinal y comercios activos por cada municipio
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('municipalities')}
              className="text-xs font-semibold text-[#007af7] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Gestionar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {municipalityBreakdown.slice(0, 5).map((m) => {
              const share = cutTotalLeads > 0 ? Math.round((m.leads / cutTotalLeads) * 100) : 0;
              return (
                <div key={m.city} className="p-2.5 rounded-xl bg-slate-50/70 hover:bg-sky-50/40 transition border border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="font-medium text-slate-800 flex items-center gap-1.5">
                      <span>{m.city}</span>
                      <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-600">
                        {m.businesses} com. · {m.activePosts} posts
                      </span>
                    </div>
                    <span className="font-semibold text-emerald-600">
                      {m.leads} leads ({share}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#007af7] to-[#00d8a5] rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, Math.min(100, share))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categories Leadership */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
                Demanda por Categorías en el Corte
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Sectores con mayor captación de clientes vecinales
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('categories')}
              className="text-xs font-semibold text-[#007af7] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Gestionar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {categoryBreakdown.map((c) => {
              const share = cutTotalLeads > 0 ? Math.round((c.leads / cutTotalLeads) * 100) : 0;
              return (
                <div key={c.id} className="p-2.5 rounded-xl bg-slate-50/70 hover:bg-purple-50/40 transition border border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="font-medium text-slate-800 flex items-center gap-1.5">
                      <span>{c.name}</span>
                      <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-600">
                        {c.count} comercios
                      </span>
                    </div>
                    <span className="font-semibold text-purple-600">
                      {c.leads} leads ({share}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-[#007af7] rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, Math.min(100, share))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 8. Merchant Churn & Inactivity Alert */}
      {businessesWithoutActivePosts.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-amber-50/90 border border-amber-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-800" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-amber-950">
                  Alerta de Retención: {businessesWithoutActivePosts.length} comercios sin publicaciones vigentes
                </h4>
                <p className="text-[11px] text-amber-800 font-normal">
                  Comercios que no tienen anuncios activos en el feed corren riesgo de churn por falta de visibilidad.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('businesses')}
              className="text-xs font-semibold text-amber-950 bg-white px-3 py-1.5 rounded-xl border border-amber-300 hover:bg-amber-100 transition self-start sm:self-auto cursor-pointer shadow-2xs"
            >
              Contactar para reactivación
            </button>
          </div>
        </div>
      )}

      {/* 9. Individual Merchant Evaluation Table with Dynamic Cut Calculation */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
              Evaluación de Comercios en el Corte
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Retorno por negocio
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchMerchant}
                onChange={(e) => setSearchMerchant(e.target.value)}
                placeholder="Buscar comercio o ciudad..."
                className="text-xs pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-slate-800 placeholder-slate-400 w-full sm:w-56"
              />
            </div>

            {/* Table Segmented Filter */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setTableFilter('top_leads')}
                className={`text-xs px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
                  tableFilter === 'top_leads'
                    ? 'bg-white text-[#041f5e] font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏆 Top Retorno
              </button>
              <button
                type="button"
                onClick={() => setTableFilter('attention_needed')}
                className={`text-xs px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 font-medium ${
                  tableFilter === 'attention_needed'
                    ? 'bg-white text-rose-600 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>⚠️ Atención</span>
                {(pastDueBusinesses.length > 0 || expiringSoonBusinesses.length > 0) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setTableFilter('all')}
                className={`text-xs px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
                  tableFilter === 'all'
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({filteredBusinesses.length})
              </button>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Comercio</th>
                <th className="py-2.5 px-3">Territorio</th>
                <th className="py-2.5 px-3 text-right">Vistas ({cutDays}d)</th>
                <th className="py-2.5 px-3 text-right">Leads WhatsApp</th>
                <th className="py-2.5 px-3 text-right">Rutas Maps</th>
                <th className="py-2.5 px-3 text-right">Conversión</th>
                <th className="py-2.5 px-3 text-center">Estado Cartera</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedMerchants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-normal">
                    No se encontraron comercios que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                displayedMerchants.map((b) => {
                  const bizPosts = posts.filter((p) => p.businessId === b.id);
                  const bizActivePosts = bizPosts.filter((p) => isPostActive(p));

                  let bViews = 0;
                  let bWhatsapp = 0;
                  let bMaps = 0;
                  let bCalls = 0;

                  rangeDateKeys.forEach((k) => {
                    if (bizPosts.length > 0) {
                      bizPosts.forEach((p) => {
                        const d = getPostDayRecord(p, k);
                        bViews += d.views;
                        bWhatsapp += d.whatsappClicks;
                        bMaps += d.mapsClicks;
                        bCalls += d.calls;
                      });
                    } else {
                      const d = getBusinessDayRecord(b, k);
                      bViews += d.views;
                      bWhatsapp += d.whatsappClicks;
                      bMaps += d.mapsClicks;
                      bCalls += d.calls;
                    }
                  });

                  const totalBizLeads = bWhatsapp + bMaps + bCalls;
                  const conv = bViews > 0 ? ((totalBizLeads / bViews) * 100).toFixed(1) : '0';

                  const isExpired =
                    b.subscription?.status === 'expired' ||
                    (b.subscription?.expiresAt && new Date(b.subscription.expiresAt).getTime() <= now);
                  const isExpiringSoon =
                    b.subscription?.expiresAt &&
                    new Date(b.subscription.expiresAt).getTime() > now &&
                    new Date(b.subscription.expiresAt).getTime() - now <= sevenDaysMs;

                  return (
                    <tr key={b.id} className="hover:bg-sky-50/30 transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {b.logo ? (
                            <img
                              src={b.logo}
                              alt={b.name}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-[#041f5e] text-white font-semibold flex items-center justify-center text-xs shrink-0">
                              {b.name.slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate flex items-center gap-1">
                              <span>{b.name}</span>
                              {b.verified && <ShieldCheck className="w-3.5 h-3.5 text-[#ff7700] shrink-0" />}
                            </div>
                            <div className="text-[11px] text-slate-500 font-normal truncate">
                              {b.subCategory} · {bizActivePosts.length} posts
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-slate-700 font-medium">{b.city}</span>
                        <span className="block text-[10px] text-slate-400 font-normal truncate">{b.sector}</span>
                      </td>

                      <td className="py-3 px-3 text-right font-medium text-slate-800">
                        {bViews.toLocaleString('es-CO')}
                      </td>

                      <td className="py-3 px-3 text-right font-semibold text-emerald-600">
                        {bWhatsapp.toLocaleString('es-CO')}
                      </td>

                      <td className="py-3 px-3 text-right font-semibold text-[#ff7700]">
                        {bMaps.toLocaleString('es-CO')}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <span className="font-semibold text-[#041f5e] bg-sky-50 px-2 py-0.5 rounded text-[11px] border border-sky-100">
                          {conv}%
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {isExpired ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            Vencido
                          </span>
                        ) : isExpiringSoon ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            Vence en &lt;7d
                          </span>
                        ) : b.subscription?.status === 'active' ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Al Día
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {b.status}
                          </span>
                        )}
                      </td>

                      
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
