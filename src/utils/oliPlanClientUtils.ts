import { OliPlanResponse } from '../types';

export function formatPriceForSpeech(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
    return 'precio por confirmar';
  }
  return `${Math.round(amount).toLocaleString('es-CO')} pesos`;
}

export function removeStopAndRecalculatePlan(
  plan: OliPlanResponse,
  stopIndexOrPostId: number | string
): OliPlanResponse {
  if (!plan.stops || plan.stops.length === 0) return plan;

  const updatedStops = plan.stops.filter((s, idx) => {
    if (typeof stopIndexOrPostId === 'number') {
      return idx !== stopIndexOrPostId;
    }
    return s.postId !== stopIndexOrPostId;
  });

  const personCount = plan.personCount || 2;
  const userBudget = typeof plan.userBudget === 'number' ? plan.userBudget : 0;
  const totalCost = updatedStops.reduce((sum, s) => sum + (s.cost || 0), 0);
  const costPerPerson = personCount > 0 ? Math.round(totalCost / personCount) : totalCost;
  const budgetStatus = userBudget > 0
    ? (totalCost > userBudget ? 'over_budget' : 'on_budget')
    : 'on_budget';

  const updatedSpoken = `¡Listo veci! Te actualicé el plan sin esa parada. Ahora el recorrido tiene ${updatedStops.length} ${
    updatedStops.length === 1 ? 'parada' : 'paradas'
  } y el total estimado es de ${formatPriceForSpeech(totalCost)}.`;

  return {
    ...plan,
    userBudget,
    stops: updatedStops,
    costPerPerson,
    totalEstimatedCost: totalCost,
    savingsOrRemaining: userBudget > 0 ? Math.max(0, userBudget - totalCost) : 0,
    budgetStatus,
    spokenText: updatedSpoken,
  };
}

export function detectSearchFocus(prompt: string): 'business' | 'post' {
  if (!prompt) return 'business';
  const norm = prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const postSignals = [
    'promo', 'promocion', 'promociones', 'promoción',
    'descuento', 'descuentos', 'oferta', 'ofertas',
    '2x1', 'combo', 'combos', 'plato', 'platos', 'menu', 'carta',
    'antojo', 'antojos', 'tengo ganas de', 'se me antoja',
    'comer pizza', 'quiero pizza', 'pizza familiar',
    'comer hamburguesa', 'quiero hamburguesa', 'smash burger',
    'comer alitas', 'alitas bbq', 'alitas picantes',
    'comer sushi', 'comer empanada', 'comer arepa',
    'tomar capuchino', 'tomar cafe', 'tomar un cafe', 'tomar cafecito',
    'un postre', 'un croissant', 'un helado',
    'unas polas', 'unas cervezas', 'unos tragos', 'unos cocteles',
  ];

  const businessSignals = [
    'comercio', 'comercios', 'negocio', 'negocios',
    'tienda', 'tiendas', 'local', 'locales', 'establecimiento', 'establecimientos',
    'lugar', 'lugares', 'sitio', 'sitios',
    'donde comprar', 'donde ir a comprar', 'donde puedo comprar', 'donde consigo', 'donde conseguir',
    'donde venden', 'donde arregl', 'donde lav', 'donde atiend', 'donde queda', 'donde hay',
    'recomiendame un', 'recomiendame una', 'recomienda un', 'recomienda una',
    'papeleria', 'papelerias', 'papelería', 'miscelanea', 'miscelaneas', 'miscelánea',
    'fruver', 'fruvers', 'verdura', 'verduras', 'legumbre', 'legumbres', 'frutas y verduras',
    'supermercado', 'mercado campesino', 'tienda de barrio',
    'taller', 'talleres', 'talle', 'mecanic', 'mecanica', 'serviteca', 'llanteria', 'llantería',
    'autospa', 'lavadero', 'car wash',
    'veterinari', 'veterinaria', 'veterinario', 'clinica veterinaria', 'pet shop',
    'peluqueri', 'peluqueria', 'peluquería', 'barberi', 'barberia', 'barbería', 'salon de belleza', 'estetica', 'spa',
    'ferreteria', 'ferreterias', 'ferretería', 'drogueria', 'droguerias', 'droguería', 'farmacia', 'farmacias',
    'odontolog', 'dentista', 'consultorio', 'clinica',
    'gimnasio', 'gym', 'crossfit',
    'hotel', 'glamping', 'hostal',
    'restaurante', 'restaurantes', 'pizzeria', 'pizzerias', 'pizzería', 'hamburgueseria', 'cafeteria', 'cafeterias',
    'panaderia', 'panaderias', 'pasteleria', 'pastelerias',
    'gastrobar', 'bar artesanal',
  ];

  const hasBusinessSignal = businessSignals.some((sig) => norm.includes(sig));
  const hasPostSignal = postSignals.some((sig) => norm.includes(sig));

  if (hasBusinessSignal && !hasPostSignal) {
    return 'business';
  }

  if (hasPostSignal && !hasBusinessSignal) {
    return 'post';
  }

  if (hasBusinessSignal && hasPostSignal) {
    if (
      norm.includes('un lugar') ||
      norm.includes('un sitio') ||
      norm.includes('una tienda') ||
      norm.includes('un negocio') ||
      norm.includes('un comercio') ||
      norm.includes('donde ir a') ||
      norm.includes('donde comprar') ||
      norm.includes('donde venden') ||
      norm.includes('recomiendame un restaurante') ||
      norm.includes('recomiendame una pizzeria') ||
      norm.includes('recomiendame una papeleria') ||
      norm.includes('recomiendame un fruver') ||
      norm.includes('recomiendame un taller')
    ) {
      return 'business';
    }
    return 'post';
  }

  const standaloneFood = ['pizza', 'hamburguesa', 'burger', 'alitas', 'sushi', 'empanada', 'arepa', 'postre', 'croissant', 'cafe', 'capuchino'];
  if (standaloneFood.some((f) => norm.includes(f))) {
    return 'post';
  }

  return 'business';
}
