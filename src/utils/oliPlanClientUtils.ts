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
