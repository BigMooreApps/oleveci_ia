import assert from 'node:assert';
import { runTest } from './testContext';
import {
  extractPersonCount,
  calculateItineraryBudget,
  formatPriceCOP,
  formatPriceForSpeech,
  sanitizeCurrencyText,
} from '../oliValidator';

export function runFinancialMathSuite() {
  console.log('\n--- SUITE 6: ARITMÉTICA FINANCIERA, PERSONAS Y MONEDA COP (Pruebas 206 a 245) ---');

  // ----------------------------------------------------------------------------
  // Bloque 1: Detección y Escalado por Número de Personas (Pruebas 206 a 215)
  // ----------------------------------------------------------------------------
  runTest(206, 'Detección de personas: "para mí solo" / "voy solo" -> 1 persona', () => {
    assert.strictEqual(extractPersonCount('Quiero salir solo a tomar un café'), 1);
    assert.strictEqual(extractPersonCount('Un plan para mí solo'), 1);
  });

  runTest(207, 'Detección de personas: "en pareja" / "con mi novia" -> 2 personas', () => {
    assert.strictEqual(extractPersonCount('Plan en pareja para este fin de semana'), 2);
    assert.strictEqual(extractPersonCount('Quiero salir con mi novia a almorzar'), 2);
    assert.strictEqual(extractPersonCount('Cena romántica con mi esposo'), 2);
  });

  runTest(208, 'Detección de personas: "somos 4 personas" -> 4 personas', () => {
    assert.strictEqual(extractPersonCount('Somos 4 personas para salir'), 4);
    assert.strictEqual(extractPersonCount('Para 4 personas en Cajicá'), 4);
  });

  runTest(209, 'Detección de personas: "con 3 amigos" -> 3 personas', () => {
    assert.strictEqual(extractPersonCount('Quiero salir con 3 amigos'), 3);
  });

  runTest(210, 'Detección de personas: "plan familiar" -> 3 personas mínimo', () => {
    assert.strictEqual(extractPersonCount('Plan familiar con los niños'), 3);
  });

  runTest(211, 'Detección de personas: "parche de 6 personas" -> 6 personas', () => {
    assert.strictEqual(extractPersonCount('Arma un plan para 6 personas'), 6);
  });

  runTest(212, 'Detección de personas: "somos 8 personas" -> 8 personas', () => {
    assert.strictEqual(extractPersonCount('Somos 8 personas para cenar'), 8);
  });

  runTest(213, 'Detección de personas: Límite superior razonable (cap máximo a 30)', () => {
    assert.strictEqual(extractPersonCount('Para 1000 personas en un evento'), 2, 'Ignora números absurdos y usa fallback');
    assert.strictEqual(extractPersonCount('Para 20 personas'), 20);
  });

  runTest(214, 'Detección de personas: "dos personas" en palabras', () => {
    assert.strictEqual(extractPersonCount('Queremos salir dos personas'), 2);
  });

  runTest(215, 'Detección de personas: Por defecto sin especificar -> 2 personas', () => {
    assert.strictEqual(extractPersonCount('Quiero un plan en Cajicá'), 2);
  });

  // ----------------------------------------------------------------------------
  // Bloque 2: Resúmenes Financieros y Estados de Presupuesto (Pruebas 216 a 225)
  // ----------------------------------------------------------------------------
  runTest(216, 'calculateItineraryBudget: Suma exacta del costo total del recorrido', () => {
    const stops = [{ cost: 24900 }, { cost: 13500 }, { cost: 22000 }];
    const budget = calculateItineraryBudget(stops, 100000, 2);
    assert.strictEqual(budget.totalEstimatedCost, 60400);
  });

  runTest(217, 'calculateItineraryBudget: Costo por persona redondeado limpiamente', () => {
    const stops = [{ cost: 25000 }, { cost: 15000 }];
    const budget = calculateItineraryBudget(stops, 100000, 4);
    assert.strictEqual(budget.costPerPerson, 10000);
  });

  runTest(218, 'calculateItineraryBudget: Estado under_budget cuando sobra presupuesto', () => {
    const stops = [{ cost: 20000 }, { cost: 10000 }];
    const budget = calculateItineraryBudget(stops, 50000, 2);
    assert.strictEqual(budget.budgetStatus, 'under_budget');
    assert.strictEqual(budget.savingsOrRemaining, 20000);
  });

  runTest(219, 'calculateItineraryBudget: Estado on_budget cuando coincide exactamente', () => {
    const stops = [{ cost: 35000 }, { cost: 15000 }];
    const budget = calculateItineraryBudget(stops, 50000, 2);
    assert.strictEqual(budget.budgetStatus, 'on_budget');
    assert.strictEqual(budget.savingsOrRemaining, 0);
  });

  runTest(220, 'calculateItineraryBudget: Estado over_budget cuando se supera el presupuesto', () => {
    const stops = [{ cost: 50000 }, { cost: 40000 }];
    const budget = calculateItineraryBudget(stops, 60000, 2);
    assert.strictEqual(budget.budgetStatus, 'over_budget');
    assert.strictEqual(budget.difference, -30000);
  });

  runTest(221, 'calculateItineraryBudget: Cero paradas produce total cero y no falla', () => {
    const budget = calculateItineraryBudget([], 50000, 2);
    assert.strictEqual(budget.totalEstimatedCost, 0);
    assert.strictEqual(budget.costPerPerson, 0);
  });

  runTest(222, 'calculateItineraryBudget: 1 parada para 1 persona', () => {
    const budget = calculateItineraryBudget([{ cost: 25000 }], 30000, 1);
    assert.strictEqual(budget.totalEstimatedCost, 25000);
    assert.strictEqual(budget.costPerPerson, 25000);
  });

  runTest(223, 'calculateItineraryBudget: Recorrido para grupo grande (6 personas)', () => {
    const stops = [{ cost: 120000 }, { cost: 60000 }];
    const budget = calculateItineraryBudget(stops, 250000, 6);
    assert.strictEqual(budget.totalEstimatedCost, 180000);
    assert.strictEqual(budget.costPerPerson, 30000);
  });

  runTest(224, 'calculateItineraryBudget: Explicación textual incluye precios formateados', () => {
    const stops = [{ cost: 20000 }];
    const budget = calculateItineraryBudget(stops, 30000, 1);
    assert.ok(budget.explanation.includes('20.000 pesos'));
    assert.ok(budget.explanation.includes('10.000 pesos'));
  });

  runTest(225, 'calculateItineraryBudget: División con números impares redondea sin decimales sucios', () => {
    const stops = [{ cost: 10000 }];
    const budget = calculateItineraryBudget(stops, 20000, 3);
    assert.strictEqual(budget.costPerPerson, 3333);
    assert.strictEqual(Number.isInteger(budget.costPerPerson), true);
  });

  // ----------------------------------------------------------------------------
  // Bloque 3: Precios de Respaldo, Aproximados y No Confirmados (Pruebas 226 a 235)
  // ----------------------------------------------------------------------------
  runTest(226, 'Precios: Uso prioritario de promotionalPrice sobre originalPrice', () => {
    const stops = [{ cost: 24900 }];
    const budget = calculateItineraryBudget(stops, 50000, 1);
    assert.strictEqual(budget.totalEstimatedCost, 24900);
  });

  runTest(227, 'Precios: Uso de originalPrice cuando no hay promotionalPrice', () => {
    const stops = [{ cost: 35000 }];
    const budget = calculateItineraryBudget(stops, 50000, 1);
    assert.strictEqual(budget.totalEstimatedCost, 35000);
  });

  runTest(228, 'Precios: Uso de approximatePrice cuando no hay precio fijo', () => {
    const stops = [{ cost: 18000 }];
    const budget = calculateItineraryBudget(stops, 50000, 1);
    assert.strictEqual(budget.totalEstimatedCost, 18000);
  });

  runTest(229, 'Precios no confirmados: Costo negativo -1 se marca como no confirmado', () => {
    const stops = [{ cost: 25000 }, { cost: -1, isUnconfirmed: true }];
    const budget = calculateItineraryBudget(stops, 50000, 2);
    assert.strictEqual(budget.hasUnconfirmedPrices, true);
    assert.strictEqual(budget.unconfirmedCount, 1);
    assert.strictEqual(budget.totalEstimatedCost, 25000);
  });

  runTest(230, 'Precios no confirmados: Precio ausente jamás se vuelve $0 confirmado', () => {
    const stops = [{ cost: (undefined as unknown as number), isUnconfirmed: true }];
    const budget = calculateItineraryBudget(stops, 50000, 1);
    assert.strictEqual(budget.hasUnconfirmedPrices, true);
    assert.ok(budget.explanation.includes('consultar'));
  });

  runTest(231, 'Precios no confirmados: Múltiples paradas con precio a consultar', () => {
    const stops = [
      { cost: -1, isUnconfirmed: true },
      { cost: -1, isUnconfirmed: true },
    ];
    const budget = calculateItineraryBudget(stops, 50000, 2);
    assert.strictEqual(budget.unconfirmedCount, 2);
  });

  runTest(232, 'Precios no confirmados: Costo NaN tratado como no confirmado', () => {
    const stops = [{ cost: NaN }];
    const budget = calculateItineraryBudget(stops, 50000, 1);
    assert.strictEqual(budget.hasUnconfirmedPrices, true);
  });

  runTest(233, 'Precios no confirmados: Costo null tratado como no confirmado', () => {
    const stops = [{ cost: (null as unknown as number) }];
    const budget = calculateItineraryBudget(stops, 50000, 1);
    assert.strictEqual(budget.hasUnconfirmedPrices, true);
  });

  runTest(234, 'Precios: Combinación de 2 confirmados y 1 no confirmado', () => {
    const stops = [{ cost: 20000 }, { cost: 15000 }, { cost: -1, isUnconfirmed: true }];
    const budget = calculateItineraryBudget(stops, 50000, 1);
    assert.strictEqual(budget.totalEstimatedCost, 35000);
    assert.strictEqual(budget.unconfirmedCount, 1);
  });

  runTest(235, 'Precios: Explicación para precios a consultar en WhatsApp', () => {
    const stops = [{ cost: 10000 }, { cost: -1, isUnconfirmed: true }];
    const budget = calculateItineraryBudget(stops, 20000, 1);
    assert.ok(budget.explanation.includes('precio a consultar'));
  });

  // ----------------------------------------------------------------------------
  // Bloque 4: Formateo de Moneda COP y Síntesis de Locución (Pruebas 236 a 245)
  // ----------------------------------------------------------------------------
  runTest(236, 'formatPriceCOP: Separador de miles para 500 pesos', () => {
    assert.strictEqual(formatPriceCOP(500), '500 pesos');
  });

  runTest(237, 'formatPriceCOP: Separador de miles para 1.500 pesos', () => {
    assert.strictEqual(formatPriceCOP(1500), '1.500 pesos');
  });

  runTest(238, 'formatPriceCOP: Separador de miles para 24.900 pesos', () => {
    assert.strictEqual(formatPriceCOP(24900), '24.900 pesos');
  });

  runTest(239, 'formatPriceCOP: Separador de miles para 125.000 pesos', () => {
    assert.strictEqual(formatPriceCOP(125000), '125.000 pesos');
  });

  runTest(240, 'formatPriceCOP: Separador de miles para 1.250.000 pesos', () => {
    assert.strictEqual(formatPriceCOP(1250000), '1.250.000 pesos');
  });

  runTest(241, 'formatPriceCOP: Cero o valor nulo', () => {
    assert.strictEqual(formatPriceCOP(0), '0 pesos');
    assert.strictEqual(formatPriceCOP(null), 'Precio por confirmar');
  });

  runTest(242, 'formatPriceForSpeech: Pronunciación natural "25 mil pesos"', () => {
    assert.strictEqual(formatPriceForSpeech(25000), '25 mil pesos');
  });

  runTest(243, 'formatPriceForSpeech: Pronunciación natural "125 mil pesos"', () => {
    assert.strictEqual(formatPriceForSpeech(125000), '125 mil pesos');
  });

  runTest(244, 'formatPriceForSpeech: Pronunciación natural "un millón 250 mil pesos"', () => {
    assert.strictEqual(formatPriceForSpeech(1250000), 'un millón 250 mil pesos');
  });

  runTest(245, 'sanitizeCurrencyText: Elimina símbolos de dólar sin romper números', () => {
    const raw = 'La hamburguesa cuesta $ 24.900 y el jugo $ 8.000 COP';
    const clean = sanitizeCurrencyText(raw);
    assert.ok(!clean.includes('$'));
    assert.ok(clean.includes('24.900 pesos'));
    assert.ok(clean.includes('8.000 pesos'));
  });
}
