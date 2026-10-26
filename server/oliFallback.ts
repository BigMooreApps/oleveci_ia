import { Post, Business } from '../src/types';
import {
  formatPriceCOP,
  formatPriceForSpeech,
  calculateItineraryBudget,
  resolveTargetDateFromPrompt,
  extractPersonCount,
} from './oliValidator';
import { OliPlanStop, OliPlanResponse, GenerateOliPlanInput, OliAuditStep } from './oliTypes';
import {
  normalizeText,
  textContainsTerm,
  extractMunicipality,
  extractRequestedTopic,
  getEligiblePlanPosts,
  classifyPostRole,
  generateActivityFromPost,
  getScheduleTimeForRole,
  buildCoherentItinerary,
  sanitizeSpokenText,
  removeStopAndRecalculatePlan,
  isPlanRefinementIntent,
  createAuditTrace,
} from './oliCatalogEngine';

export function handleRefinementPlan(
  input: GenerateOliPlanInput,
  businessMap: Map<string, Business>,
  eligiblePosts: Post[]
): OliPlanResponse {
  const { userPrompt, previousPlan, userBudget = 100000, currentCity = 'Cajicá' } = input;
  const normPrompt = normalizeText(userPrompt);

  if (!previousPlan || !previousPlan.stops || previousPlan.stops.length === 0) {
    return generateFallbackOliPlan({ ...input, previousPlan: null });
  }

  if (
    normPrompt.includes('quita') ||
    normPrompt.includes('quitar') ||
    normPrompt.includes('elimina') ||
    normPrompt.includes('eliminar') ||
    normPrompt.includes('borra') ||
    normPrompt.includes('borrar')
  ) {
    let removeIndex = 0;
    if (normPrompt.includes('segund') || normPrompt.includes('2da') || normPrompt.includes('2')) removeIndex = 1;
    else if (normPrompt.includes('tercer') || normPrompt.includes('3ra') || normPrompt.includes('3') || normPrompt.includes('ultim')) removeIndex = 2;
    removeIndex = Math.min(removeIndex, previousPlan.stops.length - 1);
    return removeStopAndRecalculatePlan(previousPlan, removeIndex);
  }

  const existingStops = [...previousPlan.stops];

  let targetIndex = -1;
  if (normPrompt.includes('primer') || normPrompt.includes('1ra') || normPrompt.includes('parada 1') || normPrompt.includes('el primer')) {
    targetIndex = 0;
  } else if (normPrompt.includes('segund') || normPrompt.includes('2da') || normPrompt.includes('parada 2') || normPrompt.includes('el segund')) {
    targetIndex = 1;
  } else if (normPrompt.includes('tercer') || normPrompt.includes('3ra') || normPrompt.includes('parada 3') || normPrompt.includes('el tercer') || normPrompt.includes('ultim')) {
    targetIndex = existingStops.length - 1;
  }

  const { topic } = extractRequestedTopic(userPrompt);
  const normTopic = topic ? normalizeText(topic) : '';

  if (targetIndex === -1) {
    if (
      normPrompt.includes('pizza') ||
      normPrompt.includes('pollo') ||
      normPrompt.includes('hamburguesa') ||
      normPrompt.includes('carne') ||
      normPrompt.includes('asado') ||
      normPrompt.includes('almuerzo') ||
      normPrompt.includes('cena') ||
      normTopic.includes('pizza') ||
      normTopic.includes('pollo') ||
      normTopic.includes('carne')
    ) {
      const mainIdx = existingStops.findIndex((s) => {
        const p = eligiblePosts.find((p) => p.id === s.postId);
        return p && classifyPostRole(p) === 'main_course';
      });
      targetIndex = mainIdx !== -1 ? mainIdx : 0;
    } else if (
      normPrompt.includes('cafe') ||
      normPrompt.includes('postre') ||
      normPrompt.includes('torta') ||
      normPrompt.includes('helado') ||
      normTopic.includes('cafe') ||
      normTopic.includes('postre')
    ) {
      const dessertIdx = existingStops.findIndex((s) => {
        const p = eligiblePosts.find((p) => p.id === s.postId);
        return p && classifyPostRole(p) === 'cafe_dessert';
      });
      targetIndex = dessertIdx !== -1 ? dessertIdx : 1;
    } else if (
      normPrompt.includes('cerveza') ||
      normPrompt.includes('trago') ||
      normPrompt.includes('vino') ||
      normPrompt.includes('coctel')
    ) {
      targetIndex = existingStops.length - 1;
    } else {
      targetIndex = 0;
    }
  }

  targetIndex = Math.min(Math.max(targetIndex, 0), existingStops.length - 1);

  const otherBizIds = new Set(
    existingStops.filter((_, idx) => idx !== targetIndex).map((s) => s.businessId)
  );

  const searchKeywords: string[] = [];
  if (normTopic) searchKeywords.push(...normTopic.split(/\s+/).filter((w) => w.length > 2));
  if (normPrompt.includes('pizza')) searchKeywords.push('pizza', 'pizzeria', 'italiana', 'artesanal');
  if (normPrompt.includes('pollo')) searchKeywords.push('pollo', 'broaster', 'alitas', 'crispy');
  if (normPrompt.includes('hamburguesa')) searchKeywords.push('hamburguesa', 'burger', 'smash');
  if (normPrompt.includes('cafe')) searchKeywords.push('cafe', 'postre', 'reposteria');
  if (normPrompt.includes('postre')) searchKeywords.push('postre', 'torta', 'helado');

  const targetCity = extractMunicipality(userPrompt, previousPlan.stops[targetIndex]?.businessCity || currentCity);

  const scoredCandidates = eligiblePosts
    .filter((p) => !otherBizIds.has(p.businessId) && p.id !== existingStops[targetIndex].postId)
    .map((p) => {
      const b = businessMap.get(p.businessId);
      const combined = normalizeText(
        `${p.title} ${p.description || ''} ${(p.tags || []).join(' ')} ${b?.name || ''} ${b?.description || ''} ${p.categoryId || ''}`
      );
      let score = 0;
      for (const kw of searchKeywords) {
        if (textContainsTerm(combined, kw)) score += 30;
      }
      if (b?.city && normalizeText(b.city) === normalizeText(targetCity)) score += 15;
      if (p.businessCity && normalizeText(p.businessCity) === normalizeText(targetCity)) score += 15;

      return { post: p, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  let replacementPost = scoredCandidates.length > 0 ? scoredCandidates[0].post : null;

  if (!replacementPost) {
    // Keep matching role if possible, avoid replacing dining with a barber shop
    const currentRole = classifyPostRole(eligiblePosts.find(p => p.id === existingStops[targetIndex].postId) || existingStops[targetIndex] as any);
    replacementPost = eligiblePosts.find(
      (p) => !otherBizIds.has(p.businessId) && p.id !== existingStops[targetIndex].postId && classifyPostRole(p) === currentRole
    ) || null;
  }

  if (replacementPost) {
    const biz = businessMap.get(replacementPost.businessId) || ({
      id: replacementPost.businessId,
      name: replacementPost.businessName,
      city: replacementPost.businessCity || targetCity,
      address: replacementPost.businessAddress || 'Sabana Centro',
      phone: replacementPost.businessPhone,
      whatsapp: replacementPost.businessWhatsapp,
      coordinates: replacementPost.coordinates,
    } as Business);

    const cost = replacementPost.promotionalPrice || replacementPost.originalPrice || replacementPost.approximatePrice || 25000;
    const postRole = classifyPostRole(replacementPost);
    const stopTime = existingStops[targetIndex].time || getScheduleTimeForRole(postRole, targetIndex, existingStops.length, replacementPost, biz);
    const activityDesc = generateActivityFromPost(replacementPost, biz);

    const newStop: OliPlanStop = {
      postId: replacementPost.id,
      businessId: replacementPost.businessId,
      businessName: biz.name || replacementPost.businessName,
      businessCity: biz.city || replacementPost.businessCity || targetCity,
      businessAddress: biz.address || 'Sabana Centro',
      businessPhone: biz.phone || replacementPost.businessPhone,
      businessWhatsapp: biz.whatsapp || replacementPost.businessWhatsapp,
      time: stopTime,
      activity: activityDesc,
      postTitle: replacementPost.title,
      imageUrl: replacementPost.imageUrl || biz.coverImage || biz.logo || '/Logo_OleVeci.png',
      cost,
      whySelected: `Opción seleccionada especialmente para cumplir con tu antojo de ${topic || 'comida local'}.`,
    };

    existingStops[targetIndex] = newStop;
  }

  const personCount = previousPlan.personCount || extractPersonCount(userPrompt);
  const budgetSummary = calculateItineraryBudget(
    existingStops.map((s) => ({ cost: s.cost })),
    previousPlan.userBudget || userBudget,
    personCount
  );

  const ordinalLabels = ['primera', 'segunda', 'tercera', 'cuarta'];
  const replacedStop = existingStops[targetIndex];
  const targetLabel = ordinalLabels[targetIndex] || `parada ${targetIndex + 1}`;

  let spokenText = `¡Listo veci! Ya te cambié la ${targetLabel} parada por ${replacedStop.businessName} para ${replacedStop.activity}. `;
  if (existingStops.length === 1) {
    spokenText += `El plan queda en ${existingStops[0].businessName} con un total estimado de ${formatPriceForSpeech(budgetSummary.totalEstimatedCost)}.`;
  } else if (existingStops.length === 2) {
    spokenText += `Ahora el recorrido inicia en ${existingStops[0].businessName} para ${existingStops[0].activity}, y luego pasamos a ${existingStops[1].businessName} para ${existingStops[1].activity}. En total les sale en ${formatPriceForSpeech(budgetSummary.totalEstimatedCost)}.`;
  } else {
    spokenText += `El recorrido completo queda así: primero ${existingStops[0].businessName} para ${existingStops[0].activity}, luego ${existingStops[1].businessName} para ${existingStops[1].activity}, y cerramos en ${existingStops[2].businessName} para ${existingStops[2].activity}. En total todo les sale en ${formatPriceForSpeech(budgetSummary.totalEstimatedCost)}.`;
  }

  spokenText = sanitizeSpokenText(spokenText, existingStops, true, false, false);

  return {
    ...previousPlan,
    type: 'plan',
    spokenText,
    greeting: '¡Listo veci! Ya te ajusté el plan',
    planTitle: topic ? `Ruta con ${topic.charAt(0).toUpperCase() + topic.slice(1)} Ajustada` : `Plan Veci Ajustado`,
    summary: `Itinerario actualizado con ${existingStops[targetIndex].businessName} en la ${targetLabel} parada.`,
    stops: existingStops,
    costPerPerson: budgetSummary.costPerPerson,
    totalEstimatedCost: budgetSummary.totalEstimatedCost,
    savingsOrRemaining: budgetSummary.savingsOrRemaining,
    budgetStatus: budgetSummary.budgetStatus,
    hasUnconfirmedPrices: budgetSummary.hasUnconfirmedPrices,
  };
}

export function generateFallbackOliPlan(input: GenerateOliPlanInput): OliPlanResponse {
  const {
    userPrompt,
    currentCity = 'Cajicá',
    userBudget = 100000,
    previousPlan,
    catalogPosts,
    catalogBusinesses,
    referenceDate = new Date(),
  } = input;

  const normPrompt = normalizeText(userPrompt);
  const isRefinement = isPlanRefinementIntent(userPrompt, previousPlan);

  const businessMap = new Map<string, Business>();
  catalogBusinesses.forEach((b) => businessMap.set(b.id, b));

  const targetCity = extractMunicipality(userPrompt, currentCity);
  const dateInfo = resolveTargetDateFromPrompt(userPrompt, referenceDate);

  let targetAudience = 'En pareja';
  if (normPrompt.includes('familia') || normPrompt.includes('nino') || normPrompt.includes('hijo') || normPrompt.includes('papas')) {
    targetAudience = 'Familiar';
  } else if (normPrompt.includes('amigo') || normPrompt.includes('parche') || normPrompt.includes('combo')) {
    targetAudience = 'Amigos';
  } else if (normPrompt.includes('solo') || normPrompt.includes('relaj') || normPrompt.includes('tranqui')) {
    targetAudience = 'Solo';
  }

  const allowGym =
    normPrompt.includes('gym') ||
    normPrompt.includes('gimnasio') ||
    normPrompt.includes('fitness') ||
    normPrompt.includes('entrenar') ||
    normPrompt.includes('pesas') ||
    normPrompt.includes('crossfit');

  const eligiblePosts = getEligiblePlanPosts(catalogPosts, dateInfo.targetDate, dateInfo.dayOfWeek, businessMap).filter((p) => {
    const biz = businessMap.get(p.businessId);
    const desc = normalizeText(`${p.title} ${p.description || ''} ${p.categoryId || ''} ${biz?.name || ''} ${biz?.categoryId || ''}`);

    if (!allowGym && (desc.includes('gimnasio') || desc.includes('crossfit') || desc.includes('pesas') || desc.includes('gym') || desc.includes('fitness'))) {
      return false;
    }
    if (targetAudience === 'Familiar') {
      const subCat = normalizeText(biz?.subCategory || '');
      if (
        desc.includes('discoteca') ||
        desc.includes('rumba') ||
        desc.includes('licorera') ||
        desc.includes('bar nocturno') ||
        desc.includes('rock & beer') ||
        desc.includes('cueva del rock') ||
        desc.includes('cocteleria') ||
        subCat.includes('bar') ||
        subCat.includes('coctel') ||
        p.businessId === 'biz_bar_nocturno'
      ) {
        return false;
      }
    }
    return true;
  });

  if (isRefinement && previousPlan && previousPlan.stops && previousPlan.stops.length > 0) {
    return handleRefinementPlan(input, businessMap, eligiblePosts);
  }

  let cityPosts = eligiblePosts.filter((p) => {
    const b = businessMap.get(p.businessId);
    return (
      (b?.city && normalizeText(b.city) === normalizeText(targetCity)) ||
      (p.businessCity && normalizeText(p.businessCity) === normalizeText(targetCity))
    );
  });

  if (cityPosts.length < 2) {
    cityPosts = eligiblePosts;
  }

  const { topic, isSpecificFoodOrActivity } = extractRequestedTopic(userPrompt);

  let matchedPosts: Post[] = [];
  let isAlternativeSuggestion = false;
  let alternativeNotice: string | undefined = undefined;

  if (isSpecificFoodOrActivity && topic) {
    const normTopic = normalizeText(topic);
    const stopWords = new Set(['con', 'para', 'los', 'las', 'del', 'una', 'uno', 'por', 'que']);
    const topicWords = normTopic.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));

    const scoredMatches = cityPosts
      .map((p) => {
        const b = businessMap.get(p.businessId);
        const rawStr = `${p.title} ${p.description || ''} ${p.tags?.join(' ') || ''} ${b?.name || ''} ${b?.description || ''} ${b?.subCategory || ''} ${p.categoryId || ''}`;
        const normStr = normalizeText(rawStr);
        let score = 0;

        if (normTopic === 'arroz chino') {
          if (
            normStr.includes('arroz chino') ||
            normStr.includes('comida china') ||
            normStr.includes('chaufa') ||
            normStr.includes('chifa') ||
            (normStr.includes('arroz') && normStr.includes('chino'))
          ) {
            score = 100;
          }
        } else {
          if (normTopic.includes(' ') && normStr.includes(normTopic)) {
            score += 100;
          }
          const matchedWords = topicWords.filter((w) => {
            const root = w.endsWith('s') && w.length > 4 ? w.slice(0, -1) : w;
            return new RegExp(`(^|[^a-z0-9])${root}([^a-z0-9]|$)`).test(normStr);
          });
          if (matchedWords.length === topicWords.length && topicWords.length > 0) {
            score += 60;
          } else {
            score += matchedWords.length * 25;
          }
        }
        return { post: p, score };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scoredMatches.length > 0) {
      matchedPosts = scoredMatches.map((m) => m.post);
    } else {
      isAlternativeSuggestion = true;
      alternativeNotice = `En este momento no tenemos publicaciones de ${topic} en ${targetCity} registradas en la app.`;
      matchedPosts = cityPosts.filter((p) => {
        const r = classifyPostRole(p);
        return r === 'main_course' || r === 'cafe_dessert';
      });
    }
  } else {
    matchedPosts = cityPosts;
  }

  if (allowGym) {
    const gymPost = cityPosts.find((p) => {
      const biz = businessMap.get(p.businessId);
      const combined = normalizeText(`${p.title} ${p.description || ''} ${p.tags?.join(' ') || ''} ${biz?.name || ''}`);
      return combined.includes('gimnasio') || combined.includes('pesas') || combined.includes('crossfit') || combined.includes('gym');
    });
    if (gymPost && !matchedPosts.some((m) => m.id === gymPost.id)) {
      matchedPosts.unshift(gymPost);
    }
  }

  let targetStopCount = 3;
  if (normPrompt.includes('2 paradas') || normPrompt.includes('dos paradas')) {
    targetStopCount = 2;
  } else if (normPrompt.includes('3 paradas') || normPrompt.includes('tres paradas')) {
    targetStopCount = 3;
  } else if (matchedPosts.length <= 2 && cityPosts.length <= 2) {
    targetStopCount = 2;
  }

  const selectedPosts = buildCoherentItinerary(
    matchedPosts,
    cityPosts,
    targetStopCount,
    Boolean(normPrompt.includes('comida') || normPrompt.includes('almuerzo') || normPrompt.includes('cena'))
  );

  const stops: OliPlanStop[] = selectedPosts.map((p, idx) => {
    const biz = businessMap.get(p.businessId) || ({
      id: p.businessId,
      name: p.businessName,
      city: p.businessCity || targetCity,
      address: p.businessAddress || 'Sabana Centro',
      phone: p.businessPhone,
      whatsapp: p.businessWhatsapp,
      coordinates: p.coordinates,
    } as Business);

    const cost = p.promotionalPrice || p.originalPrice || p.approximatePrice || 25000;
    const postRole = classifyPostRole(p);
    const stopTime = getScheduleTimeForRole(postRole, idx, selectedPosts.length, p, biz, dateInfo.dayOfWeek);
    const activityDesc = generateActivityFromPost(p, biz);

    return {
      postId: p.id,
      businessId: p.businessId,
      businessName: biz.name || p.businessName,
      businessCity: biz.city || p.businessCity || targetCity,
      businessAddress: biz.address || 'Sabana Centro',
      businessPhone: biz.phone || p.businessPhone,
      businessWhatsapp: biz.whatsapp || p.businessWhatsapp,
      time: stopTime,
      activity: activityDesc,
      postTitle: p.title,
      imageUrl: p.imageUrl || biz.coverImage || biz.logo || '/Logo_OleVeci.png',
      cost,
      whySelected: `Excelente opción en ${biz.city} para disfrutar de su reconocida propuesta local.`,
    };
  });

  const personCount = extractPersonCount(userPrompt);
  const budgetSummary = calculateItineraryBudget(
    stops.map((s) => ({ cost: s.cost })),
    userBudget,
    personCount
  );

  const totalCostSpeech = formatPriceForSpeech(budgetSummary.totalEstimatedCost);

  let spokenText = '';
  if (isAlternativeSuggestion && topic) {
    spokenText = `¡Listo veci! En este momento no tenemos publicaciones de ${topic} en ${targetCity} registradas en la app, pero te armé esta sugerencia alternativa con lo mejor de la gastronomía de la zona: `;
  } else if (isRefinement) {
    spokenText = `¡Listo veci! Ya te ajusté el plan: `;
  } else {
    spokenText = `¡Listo veci! Te armé este plan para ${dateInfo.dayName} en ${targetCity}: `;
  }

  if (stops.length === 1) {
    spokenText += `Arrancan en ${stops[0].businessName} para ${stops[0].activity}. En total les sale en ${totalCostSpeech}. ¿Cómo la ves?`;
  } else if (stops.length === 2) {
    spokenText += `Arrancan primero en ${stops[0].businessName} para ${stops[0].activity}, y después se van para ${stops[1].businessName} para ${stops[1].activity}. En total todo les sale en ${totalCostSpeech}. ¿Qué te parece este planazo?`;
  } else if (stops.length >= 3) {
    spokenText += `Arrancan primero en ${stops[0].businessName} para ${stops[0].activity}, después se van para ${stops[1].businessName} para ${stops[1].activity}, y para rematar cierran en ${stops[2].businessName} para ${stops[2].activity}. En total todo les sale en ${totalCostSpeech}. ¿Cómo la ves?`;
  }

  spokenText = sanitizeSpokenText(spokenText, stops, isRefinement, false, isAlternativeSuggestion);

  const planTitle = isAlternativeSuggestion
    ? `Sugerencia Gastronómica en ${targetCity}`
    : isRefinement
    ? `Plan Veci Ajustado en ${targetCity}`
    : topic
    ? `Ruta de ${topic.charAt(0).toUpperCase() + topic.slice(1)} en ${targetCity}`
    : `Ruta Especial ${targetAudience} en ${targetCity}`;

  const summary = isAlternativeSuggestion && topic
    ? `Sugerencia alternativa: No hay publicaciones de ${topic} en ${targetCity}, pero te recomendamos esta ruta con la mejor gastronomía local.`
    : `Itinerario de ${stops.length} paradas locales en ${targetCity} para disfrutar al máximo.`;

  const businessesInCity = catalogBusinesses.filter(
    (b) => normalizeText(b.city) === normalizeText(targetCity)
  ).length;

  const steps: OliAuditStep[] = [
    {
      step: '1',
      title: 'Recepción e Interpretación Semántica',
      status: 'info',
      details: `Instrucción recibida: "${userPrompt}". Clasificado como creación de plan. Municipio: "${targetCity}". Perfil: "${targetAudience}". Personas: ${personCount}.`,
      data: { userPrompt, targetCity, targetAudience, personCount },
    },
    {
      step: '2',
      title: 'Filtrado en Base de Datos y Horarios',
      status: 'success',
      details: `Catálogo total: ${catalogPosts.length} publicaciones de ${catalogBusinesses.length} comercios. Se filtraron ${cityPosts.length} opciones vigentes en ${targetCity}.`,
      data: { eligibleCount: eligiblePosts.length, cityPostsCount: cityPosts.length },
    },
    {
      step: '3',
      title: 'Motor de Decisión (Respaldo Determinista)',
      status: 'info',
      details: 'Ejecutado con motor determinista de itinerarios coherentes (sin clave GEMINI_API_KEY activa). Reglas de balance aplicadas: sin solapamiento de plato fuerte, sin repetir comercios.',
      data: { model: 'Motor Determinista Local' },
    },
    {
      step: '4',
      title: 'Validación Antialucinación y Presupuesto',
      status: 'success',
      details: `Itinerario de ${stops.length} paradas ensamblado con comercios verificados. Total: ${budgetSummary.totalEstimatedCost} COP (${budgetSummary.budgetStatus}).`,
      data: { stops: stops.map((s) => ({ name: s.businessName, cost: s.cost })) },
    },
  ];

  const auditTrace = createAuditTrace({
    rawPrompt: userPrompt,
    executionMode: 'deterministic_fallback',
    modelUsed: 'Motor Determinista Local',
    apiKeyPresent: Boolean(input.apiKey || process.env.GEMINI_API_KEY),
    intentDetected: isRefinement ? 'plan_refinement' : 'plan_creation',
    targetMunicipality: targetCity,
    detectedAudience: targetAudience,
    personCount,
    totalBusinesses: catalogBusinesses.length,
    totalPosts: catalogPosts.length,
    businessesInCity,
    eligiblePosts: eligiblePosts.length,
    matchedBusinesses: [],
    matchedPosts: [],
    stops,
    steps,
  });

  return {
    type: 'plan',
    spokenText,
    greeting: isAlternativeSuggestion ? '¡Listo veci! Sugerencia gastronómica' : isRefinement ? '¡Listo veci! Ya te ajusté el plan' : '¡Listo veci! Te tengo el plan',
    planTitle,
    summary,
    day: dateInfo.dayName === 'el domingo' ? 'Domingo' : dateInfo.dayName === 'el sábado' ? 'Sábado' : dateInfo.dayName === 'hoy' ? 'Hoy' : 'Fin de semana',
    targetAudience,
    personCount,
    costPerPerson: budgetSummary.costPerPerson,
    userBudget: budgetSummary.userBudget,
    totalEstimatedCost: budgetSummary.totalEstimatedCost,
    savingsOrRemaining: budgetSummary.savingsOrRemaining,
    budgetStatus: budgetSummary.budgetStatus,
    hasUnconfirmedPrices: budgetSummary.hasUnconfirmedPrices,
    stops,
    isAlternativeSuggestion,
    alternativeNotice,
    requestedTopic: topic || undefined,
    recommendations: [
      'Muestra la publicación activa en OleVeci al llegar al local para validar tarifas promocionales.',
      'Los horarios son sugeridos según la ruta; recomendamos confirmar disponibilidad previa.',
    ],
    alternativeOptions: [
      'Si prefieren una parada adicional o cambiar de municipio, sólo avísame y te lo ajusto al instante.',
    ],
    auditTrace,
  };
}
