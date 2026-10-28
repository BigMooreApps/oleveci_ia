import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { APP_CONFIG } from '../../config/brand';
import { Business, Post, DailyMetricRecord } from '../../types';
import { OleVeciIcon } from '../OleVeciLogo';
import {
  MessageCircle,
  Calendar,
  Search,
  Check,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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

type TableFilter = 'top_leads' | 'churn_risk' | 'at_risk_cartera' | 'all';
type MetricChartType = 'all' | 'whatsapp' | 'maps' | 'views';

// Custom Tooltip for Timeline AreaChart
const AdminTimelineTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const rawData = payload[0]?.payload;
    const vistas = payload.find((p: any) => p.dataKey === 'vistas')?.value || 0;
    const leads = payload.find((p: any) => p.dataKey === 'leads')?.value || 0;
    const whatsapp = rawData?.whatsapp || 0;
    const maps = rawData?.maps || 0;
    const llamadas = rawData?.llamadas || 0;
    const conversion = vistas > 0 ? ((leads / vistas) * 100).toFixed(1) : '0';
    const displayDate = rawData?.fullDateLabel || label;

    return (
      <div className="bg-[#041f5e] text-white p-3 rounded-2xl shadow-xl text-xs border border-white/20 min-w-[210px] space-y-2 select-none pointer-events-none">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="font-semibold text-sky-200 capitalize">{displayDate}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400 text-[#041f5e]">
            {conversion}% conv.
          </span>
        </div>
        <div className="space-y-1 text-slate-200">
          <div className="flex items-center justify-between gap-3">
            <span>Vistas Feed:</span>
            <span className="font-semibold text-white">{vistas.toLocaleString('es-CO')}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Contactos Directos:</span>
            <span className="font-semibold text-emerald-400">{leads.toLocaleString('es-CO')}</span>
          </div>
          <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-300">
            <span>{whatsapp} WA</span>
            <span>{maps} Rutas</span>
            <span>{llamadas} Tel</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = () => {
  const {
    businesses,
    posts,
    municipalities,
    categories,
    isPostActive,
  } = useApp();

  // 1. DATE RANGE CUT STATE
  const [startDate, setStartDate] = useState<string>(() => getDaysAgoKey(29));
  const [endDate, setEndDate] = useState<string>(() => getTodayKey());

  // Filter States
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<TableFilter>('top_leads');
  const [searchMerchant, setSearchMerchant] = useState<string>('');
  const [chartMetric, setChartMetric] = useState<MetricChartType>('all');
  const [showFormulaExplanation, setShowFormulaExplanation] = useState<boolean>(false);
  const [copiedBizId, setCopiedBizId] = useState<string | null>(null);

  // Quick Presets
  const handlePresetChange = (preset: '7d' | '30d' | 'month') => {
    if (preset === '7d') {
      setStartDate(getDaysAgoKey(6));
      setEndDate(getTodayKey());
    } else if (preset === '30d') {
      setStartDate(getDaysAgoKey(29));
      setEndDate(getTodayKey());
    } else if (preset === 'month') {
      setStartDate(getStartOfMonthKey());
      setEndDate(getTodayKey());
    }
  };

  const handleStartDateChange = (newStart: string) => {
    if (!newStart) return;
    setStartDate(newStart);
    if (newStart > endDate) setEndDate(newStart);
  };

  const handleEndDateChange = (newEnd: string) => {
    if (!newEnd) return;
    setEndDate(newEnd);
    if (newEnd < startDate) setStartDate(newEnd);
  };

  const rangeDateKeys = useMemo(() => getDateKeysInRange(startDate, endDate), [startDate, endDate]);
  const cutDays = useMemo(() => countCutDays(startDate, endDate), [startDate, endDate]);

  const filteredBusinesses = useMemo(() => {
    if (selectedCity === 'all') return businesses;
    return businesses.filter((b) => b.city === selectedCity);
  }, [businesses, selectedCity]);

  const filteredPosts = useMemo(() => {
    if (selectedCity === 'all') return posts;
    return posts.filter((p) => p.businessCity === selectedCity);
  }, [posts, selectedCity]);

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

  const getPostDayRecord = (post: Post, dateKey: string): DailyMetricRecord => {
    const dMap = guaranteedPostDailyMap.get(post.id);
    if (dMap && dMap[dateKey]) return dMap[dateKey];
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

  const getBusinessDayRecord = (biz: Business, dateKey: string): DailyMetricRecord => {
    const dMap = guaranteedBusinessDailyMap.get(biz.id);
    if (dMap && dMap[dateKey]) return dMap[dateKey];
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
      filteredPosts.forEach((post) => {
        const d = getPostDayRecord(post, key);
        views += d.views;
        wa += d.whatsappClicks;
        maps += d.mapsClicks;
        calls += d.calls;
        shares += d.shares;
        qr += d.qrRedemptions || 0;
      });

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

  // Channel Contribution Shares
  const waShare = cutTotalLeads > 0 ? Math.round((cutWhatsapp / cutTotalLeads) * 100) : 0;
  const mapsShare = cutTotalLeads > 0 ? Math.round((cutMaps / cutTotalLeads) * 100) : 0;
  const callsShare = cutTotalLeads > 0 ? Math.round((cutCalls / cutTotalLeads) * 100) : 0;

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

  // Financial Metrics
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

  const projectedARR = monthlyRevenueCOP * 12;
  const dailyBillingRate = monthlyRevenueCOP / 30;
  const cutProratedRevenueCOP = cutDays === 30 ? monthlyRevenueCOP : Math.round(cutDays * dailyBillingRate);
  const collectionRate = totalBusinesses > 0 ? Math.round((activeSubscribers / totalBusinesses) * 100) : 0;
  const atRiskRevenueCOP = (expiringSoonBusinesses.length + pastDueBusinesses.length) * 29900;
  const cutCostPerLead = cutTotalLeads > 0 ? Math.round(cutProratedRevenueCOP / cutTotalLeads) : 0;
  const traditionalAdsBenchmark = cutTotalLeads * 1800;
  const estimatedMerchantSavings = Math.max(0, traditionalAdsBenchmark - cutProratedRevenueCOP);
  const leadsPerActiveBiz = activeSubscribers > 0 ? (cutTotalLeads / activeSubscribers).toFixed(1) : '0';

  // Content Health
  const activePostsCount = useMemo(() => {
    return filteredPosts.filter((p) => isPostActive(p)).length;
  }, [filteredPosts, isPostActive]);

  const businessesWithoutActivePosts = useMemo(() => {
    return filteredBusinesses.filter((b) => {
      const bizPosts = posts.filter((p) => p.businessId === b.id && isPostActive(p));
      return bizPosts.length === 0;
    });
  }, [filteredBusinesses, posts, isPostActive]);

  // Health Score of the Network (0 - 100)
  const healthScore = useMemo(() => {
    if (totalBusinesses === 0) return 100;
    const collectionWeight = collectionRate; // 0-100
    const publishingWeight = Math.min(100, Math.round(((totalBusinesses - businessesWithoutActivePosts.length) / totalBusinesses) * 100));
    const leadWeight = cutTotalLeads > 0 ? Math.min(100, Math.round(parseFloat(cutConversionRate) * 4)) : 0;
    return Math.round(collectionWeight * 0.45 + publishingWeight * 0.35 + leadWeight * 0.2);
  }, [collectionRate, totalBusinesses, businessesWithoutActivePosts.length, cutTotalLeads, cutConversionRate]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // 5. TIMELINE CHART SERIES
  const timelineData = useMemo(() => {
    return rangeDateKeys.map((dateKey) => {
      let dayViews = 0;
      let dayWa = 0;
      let dayMaps = 0;
      let dayCalls = 0;

      filteredPosts.forEach((post) => {
        const d = getPostDayRecord(post, dateKey);
        dayViews += d.views;
        dayWa += d.whatsappClicks;
        dayMaps += d.mapsClicks;
        dayCalls += d.calls;
      });

      filteredBusinesses.forEach((biz) => {
        const d = getBusinessDayRecord(biz, dateKey);
        dayViews += d.views;
        dayWa += d.whatsappClicks;
        dayMaps += d.mapsClicks;
        dayCalls += d.calls;
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
      };
    });
  }, [rangeDateKeys, filteredPosts, filteredBusinesses, guaranteedPostDailyMap, guaranteedBusinessDailyMap, cutDays]);

  const timelineTicks = useMemo(() => {
    if (timelineData.length <= 6) return timelineData.map((d) => d.name);
    const total = timelineData.length;
    const step = (total - 1) / 4;
    const indices = [0, Math.round(step), Math.round(step * 2), Math.round(step * 3), total - 1];
    return Array.from(new Set(indices)).map((idx) => timelineData[idx].name);
  }, [timelineData]);

  // 6. PORTFOLIO BREAKDOWN (Donut Chart)
  const financialDistributionData = useMemo(() => {
    return [
      { name: 'Al Día', value: activeSubscribers, color: '#00d8a5', amount: activeSubscribers * 29900 },
      { name: 'Por Vencer (<7d)', value: expiringSoonBusinesses.length, color: '#ffb703', amount: expiringSoonBusinesses.length * 29900 },
      { name: 'Vencidos / Mora', value: pastDueBusinesses.length, color: '#ef4444', amount: pastDueBusinesses.length * 29900 },
      { name: 'En Verificación', value: suspendedOrPendingBusinesses.length, color: '#007af7', amount: 0 },
    ].filter((item) => item.value > 0);
  }, [activeSubscribers, expiringSoonBusinesses.length, pastDueBusinesses.length, suspendedOrPendingBusinesses.length]);

  // 7. TERRITORIAL PERFORMANCE
  const municipalityBreakdown = useMemo(() => {
    const map: Record<string, { city: string; businesses: number; activePosts: number; leads: number; avgLeads: string }> = {};
    municipalities.forEach((m) => {
      map[m.name] = { city: m.name, businesses: 0, activePosts: 0, leads: 0, avgLeads: '0' };
    });

    businesses.forEach((b) => {
      const city = b.city || 'Otro';
      if (!map[city]) map[city] = { city, businesses: 0, activePosts: 0, leads: 0, avgLeads: '0' };
      map[city].businesses += 1;
    });

    posts.forEach((p) => {
      const city = p.businessCity || 'Otro';
      if (!map[city]) map[city] = { city, businesses: 0, activePosts: 0, leads: 0, avgLeads: '0' };
      if (isPostActive(p)) map[city].activePosts += 1;
      rangeDateKeys.forEach((key) => {
        const d = getPostDayRecord(p, key);
        map[city].leads += (d.whatsappClicks + d.mapsClicks + d.calls);
      });
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        avgLeads: item.businesses > 0 ? (item.leads / item.businesses).toFixed(1) : '0',
      }))
      .filter((m) => m.businesses > 0 || m.activePosts > 0 || m.leads > 0)
      .sort((a, b) => b.leads - a.leads);
  }, [municipalities, businesses, posts, isPostActive, rangeDateKeys, guaranteedPostDailyMap]);

  // 8. MERCHANTS TABLE FILTERING
  const displayedMerchants = useMemo(() => {
    let list = [...filteredBusinesses];

    if (searchMerchant.trim()) {
      const q = searchMerchant.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.subCategory.toLowerCase().includes(q) ||
          b.city.toLowerCase().includes(q)
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
    } else if (tableFilter === 'churn_risk') {
      // Suscritos activos pero con CERO publicaciones vigentes
      list = list.filter((b) => {
        const hasPosts = posts.some((p) => p.businessId === b.id && isPostActive(p));
        return !hasPosts;
      });
    } else if (tableFilter === 'at_risk_cartera') {
      // Vencidos o por vencer en menos de 7 días
      list = list.filter((b) => {
        const isPastDue =
          b.subscription?.status === 'expired' ||
          (b.subscription?.expiresAt && new Date(b.subscription.expiresAt).getTime() <= now);
        const isExpiring =
          b.subscription?.expiresAt &&
          new Date(b.subscription.expiresAt).getTime() > now &&
          new Date(b.subscription.expiresAt).getTime() - now <= sevenDaysMs;
        return isPastDue || isExpiring;
      });
    }

    return list;
  }, [filteredBusinesses, searchMerchant, tableFilter, posts, now, sevenDaysMs, isPostActive, rangeDateKeys, guaranteedPostDailyMap]);

  // Contact / Renewal WhatsApp
  const handleCopyContactMessage = (b: Business, type: 'renewal' | 'publish' | 'general') => {
    let text = '';
    if (type === 'renewal') {
      text = `Hola ${b.name}, te saludamos del equipo de ${APP_CONFIG.name}. Tu suscripción comercial vence pronto (${b.subscription?.expiresAt ? new Date(b.subscription.expiresAt).toLocaleDateString('es-CO') : 'este mes'}). Recuerda renovar para seguir recibiendo contactos directos por WhatsApp en ${b.city}. ¡Gracias por ser parte de nuestra red local!`;
    } else if (type === 'publish') {
      text = `Hola ${b.name}, te saludamos de ${APP_CONFIG.name}. Notamos que tu negocio no tiene publicaciones vigentes activas en el feed de ${b.city}. Publicar ofertas semanales aumenta tus contactos directos. ¿Te apoyamos publicando tu contenido?`;
    } else {
      text = `Hola ${b.name}, te saludamos de ${APP_CONFIG.name}. Queremos compartirte el balance de contactos vecinales generados para tu negocio en ${b.city}. ¿Tienes 5 minutos para revisar tu rendimiento?`;
    }

    const cleanPhone = (b.whatsapp || b.phone || '').replace(/\D/g, '');
    if (cleanPhone) {
      const fullPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      navigator.clipboard.writeText(text);
      setCopiedBizId(b.id);
      setTimeout(() => setCopiedBizId(null), 3000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Control Bar & Global Network Health (Clean white card style) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                <OleVeciIcon size={22} />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#041f5e]">
                Centro de Inteligencia & Métricas de Red
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-1">
              Supervisión de facturación, retención, conversión vecinal y rendimiento territorial en Sabana Centro
            </p>
          </div>

          {/* Quick Presets & Date Cut Controls */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs border border-slate-200/80">
              <button
                type="button"
                onClick={() => handlePresetChange('7d')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
                  cutDays === 7 ? 'bg-white text-[#041f5e] font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 días
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('30d')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
                  cutDays === 30 ? 'bg-white text-[#041f5e] font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 días
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('month')}
                className="px-2.5 py-1 rounded-lg transition cursor-pointer font-medium text-slate-600 hover:text-slate-900"
              >
                Este mes
              </button>
            </div>

            <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 px-3 py-1 gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="text-xs font-semibold text-[#041f5e] bg-transparent outline-none cursor-pointer p-0"
                title="Fecha inicial de corte"
              />
              <span className="text-slate-300 select-none text-[10px]">al</span>
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

            <button
              type="button"
              onClick={() => setShowFormulaExplanation(!showFormulaExplanation)}
              className={`p-2 rounded-xl border text-xs transition cursor-pointer ${
                showFormulaExplanation
                  ? 'bg-[#007af7] text-white border-transparent'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'
              }`}
              title="Glosario de fórmulas matemáticas"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Territory Selector & Executive Status Indicators */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <select
              id="select-admin-metrics-city"
              aria-label="Filtrar por Municipio"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[#041f5e] focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer transition"
            >
              <option value="all">Todos los Municipios ({municipalities.length})</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} ({businesses.filter((b) => b.city === m.name).length} com.)
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400 font-normal">
              {filteredBusinesses.length} comercios en alcance
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-600 flex-wrap">
            <div>
              Salud de Red: <span className="font-bold text-[#007af7]">{healthScore}/100</span>
            </div>
            <div>
              Comercios al Día: <span className="font-bold text-emerald-600">{activeSubscribers} / {totalBusinesses}</span>
            </div>
            <div>
              Posts Vigentes: <span className="font-bold text-[#041f5e]">{activePostsCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Formula Explanation Collapsible Banner */}
      {showFormulaExplanation && (
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-50 border border-slate-200 shadow-xs text-xs space-y-2.5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200">
            <span className="font-bold text-[#041f5e]">Glosario de Indicadores Matemáticos Reconciliados</span>
            <button
              onClick={() => setShowFormulaExplanation(false)}
              className="text-slate-400 hover:text-slate-700 font-semibold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-slate-600">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="font-semibold text-[#041f5e] block mb-1">MRR & Facturación Prorrateada</span>
              Ingresos mensuales recurrentes de suscripciones activas ($29.900 COP/mes). En cortes de {cutDays} días equivale a $996,67 COP/día por comercio.
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="font-semibold text-[#041f5e] block mb-1">Costo Por Lead (CPL)</span>
              Facturación prorrateada del corte ÷ Total de contactos vecinales (WhatsApp + Rutas GPS + Llamadas).
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="font-semibold text-[#041f5e] block mb-1">Ahorro para Comercios</span>
              Comparativa contra Meta/Google Ads en Colombia (~$1.800 COP/lead). Ahorro neto entregado a la red comercial local.
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="font-semibold text-[#041f5e] block mb-1">Cartera en Riesgo Inmediato</span>
              Suma en COP de cuotas vencidas y por vencer en menos de 7 días que requieren contacto preventivo.
            </div>
          </div>
        </div>
      )}

      {/* 2. Four Core Financial & Impact Cards (No icons, clean typography, high data value) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: MRR & Facturación */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Facturación & MRR
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#041f5e]">
              {formatCOP(monthlyRevenueCOP)}
            </div>
            <div className="mt-1 text-xs text-slate-500 font-normal">
              ARR proyectado: <span className="font-semibold text-slate-700">{formatCOP(projectedARR)}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-normal">Corte ({cutDays}d):</span>
            <span className="font-semibold text-[#007af7] bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200/60">
              {formatCOP(cutProratedRevenueCOP)}
            </span>
          </div>
        </div>

        {/* Card 2: Cartera en Riesgo Inmediato */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Cartera en Riesgo
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-rose-600">
              {formatCOP(atRiskRevenueCOP)}
            </div>
            <div className="mt-1 text-xs text-slate-500 font-normal">
              {expiringSoonBusinesses.length} por vencer (&lt;7d) · {pastDueBusinesses.length} en mora
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-normal">Tasa de cobro:</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
              {collectionRate}% al día
            </span>
          </div>
        </div>

        {/* Card 3: Costo Por Lead (CPL) */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Costo Por Lead (CPL)
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-[#041f5e]">
              {cutCostPerLead > 0 ? formatCOP(cutCostPerLead) : '$0 COP'}
            </div>
            <div className="mt-1 text-xs text-slate-500 font-normal">
              Inversión por contacto vecinal en el corte
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-normal">Promedio/negocio:</span>
            <span className="font-semibold text-slate-700">
              {leadsPerActiveBiz} leads
            </span>
          </div>
        </div>

        {/* Card 4: Ahorro para Comercios */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Ahorro para Comercios
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
              {formatCOP(estimatedMerchantSavings)}
            </div>
            <div className="mt-1 text-xs text-slate-500 font-normal">
              Vs. pauta tradicional (~$1.800 COP/lead)
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-normal">Leads generados:</span>
            <span className="font-semibold text-emerald-700">
              {cutTotalLeads.toLocaleString('es-CO')}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Traffic Timeline & Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Timeline Chart */}
        <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
                Evolución de Tráfico y Contactos en el Corte
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Comportamiento diario de vistas e interacciones comerciales
              </p>
            </div>

            {/* Metric Toggle */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs self-start sm:self-auto border border-slate-200/80">
              <button
                type="button"
                onClick={() => setChartMetric('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
                  chartMetric === 'all' ? 'bg-white text-[#041f5e] font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Contactos
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('whatsapp')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
                  chartMetric === 'whatsapp' ? 'bg-white text-emerald-700 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('maps')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
                  chartMetric === 'maps' ? 'bg-white text-[#ff7700] font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Maps GPS
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('views')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
                  chartMetric === 'views' ? 'bg-white text-[#007af7] font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vistas Feed
              </button>
            </div>
          </div>

          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminLeadsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007af7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#007af7" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="adminWaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d8a5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00d8a5" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="adminMapsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff7700" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ff7700" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="adminViewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#041f5e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#041f5e" stopOpacity={0.0} />
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
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip content={<AdminTimelineTooltip />} />

                {chartMetric === 'all' && (
                  <Area
                    type="monotone"
                    dataKey="leads"
                    stroke="#007af7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#adminLeadsGradient)"
                  />
                )}
                {chartMetric === 'whatsapp' && (
                  <Area
                    type="monotone"
                    dataKey="whatsapp"
                    stroke="#00d8a5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#adminWaGradient)"
                  />
                )}
                {chartMetric === 'maps' && (
                  <Area
                    type="monotone"
                    dataKey="maps"
                    stroke="#ff7700"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#adminMapsGradient)"
                  />
                )}
                {chartMetric === 'views' && (
                  <Area
                    type="monotone"
                    dataKey="vistas"
                    stroke="#041f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#adminViewsGradient)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Metrics Bar Under Chart */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Vistas Feed</div>
              <div className="text-sm sm:text-base font-bold text-[#041f5e]">{cutViews.toLocaleString('es-CO')}</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-emerald-800 uppercase tracking-wider font-semibold">WhatsApp</div>
              <div className="text-sm sm:text-base font-bold text-emerald-700">
                {cutWhatsapp.toLocaleString('es-CO')} <span className="text-[10px] text-slate-400 font-normal">({waShare}%)</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-orange-800 uppercase tracking-wider font-semibold">Rutas Maps</div>
              <div className="text-sm sm:text-base font-bold text-[#ff7700]">
                {cutMaps.toLocaleString('es-CO')} <span className="text-[10px] text-slate-400 font-normal">({mapsShare}%)</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-[#007af7] uppercase tracking-wider font-semibold">Llamadas</div>
              <div className="text-sm sm:text-base font-bold text-[#007af7]">
                {cutCalls.toLocaleString('es-CO')} <span className="text-[10px] text-slate-400 font-normal">({callsShare}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversion Funnel & Channel Mix */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
              Embudo de Conversión Vecinal
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Flujo desde la visualización del anuncio hasta la intención directa
            </p>
          </div>

          <div className="space-y-3">
            {/* Stage 1: Impresiones */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">1. Alcance en Feed</span>
                <span className="font-bold text-[#041f5e]">{cutViews.toLocaleString('es-CO')}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-[#041f5e] rounded-full w-full" />
              </div>
            </div>

            {/* Stage 2: Interés y Boca a Boca */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">2. Boca a Boca (Compartidos)</span>
                <span className="font-bold text-indigo-600">{cutShares.toLocaleString('es-CO')}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${cutViews > 0 ? Math.max(5, Math.min(100, (cutShares / cutViews) * 100)) : 5}%` }}
                />
              </div>
            </div>

            {/* Stage 3: Contacto Comercial Efectivo */}
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-emerald-900">3. Contacto Directo (Leads)</span>
                <span className="font-bold text-emerald-700">
                  {cutTotalLeads.toLocaleString('es-CO')} ({cutConversionRate}%)
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-emerald-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.max(5, Math.min(100, parseFloat(cutConversionRate)))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>WhatsApp Directo:</span>
              <span className="font-semibold text-slate-800">{cutWhatsapp.toLocaleString('es-CO')} ({waShare}%)</span>
            </div>
            <div className="flex justify-between">
              <span>Rutas Cómo Llegar:</span>
              <span className="font-semibold text-slate-800">{cutMaps.toLocaleString('es-CO')} ({mapsShare}%)</span>
            </div>
            <div className="flex justify-between">
              <span>Llamadas Directas:</span>
              <span className="font-semibold text-slate-800">{cutCalls.toLocaleString('es-CO')} ({callsShare}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Territorial Performance & Financial Portfolio Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Territorial Performance Matrix */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
                Rendimiento & Densidad por Territorio
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Comercios afiliados, volumen de posts y contactos vecinales por municipio
              </p>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {municipalityBreakdown.length} activos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2">Municipio</th>
                  <th className="pb-2 text-center">Comercios</th>
                  <th className="pb-2 text-center">Posts</th>
                  <th className="pb-2 text-right">Leads</th>
                  <th className="pb-2 text-right">Promedio/Negocio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {municipalityBreakdown.map((m) => (
                  <tr key={m.city} className="hover:bg-slate-50/60 transition">
                    <td className="py-2.5 font-semibold text-slate-800">{m.city}</td>
                    <td className="py-2.5 text-center text-slate-600">{m.businesses}</td>
                    <td className="py-2.5 text-center text-slate-600">{m.activePosts}</td>
                    <td className="py-2.5 text-right font-bold text-[#041f5e]">
                      {m.leads.toLocaleString('es-CO')}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-emerald-600">
                      {m.avgLeads}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Composition Donut */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
                Composición de Cartera & Cobranza
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Estado de facturación de los {totalBusinesses} comercios registrados
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
              {collectionRate}% Cobrado
            </span>
          </div>

          <div className="h-44 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={financialDistributionData}
                  innerRadius={46}
                  outerRadius={68}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {financialDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any, item: any) => [
                    `${value} comercios (${formatCOP(item.payload.amount)})`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-[#041f5e]">{totalBusinesses}</span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Comercios</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00d8a5]" />
                <span className="text-slate-600 font-normal">Al Día (Activos)</span>
              </div>
              <span className="font-semibold text-slate-800">
                {activeSubscribers} com. ({formatCOP(activeSubscribers * 29900)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffb703]" />
                <span className="text-slate-600 font-normal">Por Vencer (&lt;7 días)</span>
              </div>
              <span className="font-semibold text-amber-700">
                {expiringSoonBusinesses.length} com. ({formatCOP(expiringSoonBusinesses.length * 29900)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                <span className="text-slate-600 font-normal">Vencidos / En Mora</span>
              </div>
              <span className="font-semibold text-rose-600">
                {pastDueBusinesses.length} com. ({formatCOP(pastDueBusinesses.length * 29900)})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Diagnostic Merchant Table: Churn Prevention & Retention */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#041f5e]">
              Matriz de Retención & Diagnóstico de Negocios
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Detección de comercios en riesgo de churn por inactividad o mora en {cutDays} días de corte
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchMerchant}
                onChange={(e) => setSearchMerchant(e.target.value)}
                placeholder="Buscar negocio o municipio..."
                className="text-xs pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-slate-800 placeholder-slate-400 w-full sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Filter Segment Tabs */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setTableFilter('top_leads')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer font-medium shrink-0 ${
              tableFilter === 'top_leads'
                ? 'bg-[#041f5e] text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Mayor Retorno (Top Leads)
          </button>
          <button
            type="button"
            onClick={() => setTableFilter('churn_risk')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer font-medium shrink-0 ${
              tableFilter === 'churn_risk'
                ? 'bg-amber-500 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Riesgo de Churn ({businessesWithoutActivePosts.length} sin publicaciones)
          </button>
          <button
            type="button"
            onClick={() => setTableFilter('at_risk_cartera')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer font-medium shrink-0 ${
              tableFilter === 'at_risk_cartera'
                ? 'bg-rose-600 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Cartera por Cobrar ({expiringSoonBusinesses.length + pastDueBusinesses.length})
          </button>
          <button
            type="button"
            onClick={() => setTableFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer font-medium shrink-0 ${
              tableFilter === 'all'
                ? 'bg-slate-700 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Todos ({filteredBusinesses.length})
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="pb-2.5">Comercio</th>
                <th className="pb-2.5">Estado Suscripción</th>
                <th className="pb-2.5 text-center">Posts Vigentes</th>
                <th className="pb-2.5 text-right">Leads en Corte</th>
                <th className="pb-2.5 text-right">CPL Estimado</th>
                <th className="pb-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedMerchants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No se encontraron comercios con el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                displayedMerchants.map((biz) => {
                  const bizPosts = posts.filter((p) => p.businessId === biz.id);
                  const activePosts = bizPosts.filter((p) => isPostActive(p)).length;

                  let bLeads = 0;
                  rangeDateKeys.forEach((k) => {
                    bizPosts.forEach((p) => {
                      const d = getPostDayRecord(p, k);
                      bLeads += d.whatsappClicks + d.mapsClicks + d.calls;
                    });
                  });

                  const isPastDue =
                    biz.subscription?.status === 'expired' ||
                    (biz.subscription?.expiresAt && new Date(biz.subscription.expiresAt).getTime() <= now);
                  const isExpiring =
                    biz.subscription?.expiresAt &&
                    new Date(biz.subscription.expiresAt).getTime() > now &&
                    new Date(biz.subscription.expiresAt).getTime() - now <= sevenDaysMs;

                  const costPerBizLead = bLeads > 0 ? Math.round(cutProratedRevenueCOP / bLeads) : 0;

                  return (
                    <tr key={biz.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3">
                        <div className="font-semibold text-slate-900">{biz.name}</div>
                        <div className="text-[11px] text-slate-400 font-normal">
                          {biz.city}{biz.sector ? ` · ${biz.sector}` : ''}
                        </div>
                      </td>

                      <td className="py-3">
                        {isPastDue ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                            Vencido / Mora
                          </span>
                        ) : isExpiring ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                            Vence en &lt;7d
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Al Día
                          </span>
                        )}
                      </td>

                      <td className="py-3 text-center">
                        <span
                          className={`font-semibold ${
                            activePosts === 0 ? 'text-amber-600' : 'text-slate-700'
                          }`}
                        >
                          {activePosts}
                        </span>
                      </td>

                      <td className="py-3 text-right font-bold text-[#041f5e]">
                        {bLeads.toLocaleString('es-CO')}
                      </td>

                      <td className="py-3 text-right text-slate-600 font-medium">
                        {costPerBizLead > 0 ? formatCOP(costPerBizLead) : '$0'}
                      </td>

                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyContactMessage(
                              biz,
                              isPastDue || isExpiring ? 'renewal' : activePosts === 0 ? 'publish' : 'general'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                          title="Contactar vía WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-600" />
                          <span>Contactar</span>
                        </button>
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
