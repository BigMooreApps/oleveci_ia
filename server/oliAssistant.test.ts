/**
 * BATERÍA MAESTRA DE AUDITORÍA Y PRUEBAS EXHAUSTIVAS PARA OLI ASSISTANT (OLEVECI)
 *
 * Total de pruebas: 325 pruebas automatizadas
 * Categorías:
 * - Suite 1: Batería Fundamental Base (Pruebas 001 a 033)
 * - Suite 2: Jerga Colombiana, Sabana Centro, Errores Tipográficos y Municipios (Pruebas 034 a 075)
 * - Suite 3: Casos Adversarios, Inyección de Prompts, Ataques y Casos Borde (Pruebas 076 a 125)
 * - Suite 4: Coherencia de Roles, Dietas, Mascotas y Filtros de Seguridad Familiar (Pruebas 126 a 165)
 * - Suite 5: Matriz de Horarios, Vigencia de Campañas y Zona Horaria Colombia UTC-5 (Pruebas 166 a 205)
 * - Suite 6: Aritmética Financiera, Escalado Multiusuario y Formato de Moneda COP (Pruebas 206 a 245)
 * - Suite 7: Dinámica Conversacional, Modificaciones de Plan e Interacción Humana (Pruebas 246 a 285)
 * - Suite 8: Formato WhatsApp, Enlaces Directos wa.me, Sesiones y Saneador de Voz (Pruebas 286 a 325)
 */

import { runBaselineSuite } from './tests/suite1_baseline';
import { runSlangSuite } from './tests/suite2_colombian_slang';
import { runAdversarialSuite } from './tests/suite3_adversarial_security';
import { runRoleDietarySuite } from './tests/suite4_role_dietary';
import { runScheduleValiditySuite } from './tests/suite5_schedule_validity';
import { runFinancialMathSuite } from './tests/suite6_financial_math';
import { runConversationalModsSuite } from './tests/suite7_conversational_mods';
import { runWhatsAppSessionSuite } from './tests/suite8_whatsapp_session';
import { waitForAllTests, printTestSummary } from './tests/testContext';

async function runMasterTestSuite() {
  console.log('================================================================');
  console.log('INICIANDO AUDITORÍA TOTAL DE OLI: BATERÍA COMPLETA DE 300+ PRUEBAS');
  console.log('================================================================');

  runBaselineSuite();
  runSlangSuite();
  runAdversarialSuite();
  runRoleDietarySuite();
  runScheduleValiditySuite();
  runFinancialMathSuite();
  runConversationalModsSuite();
  runWhatsAppSessionSuite();

  await waitForAllTests();
  printTestSummary();
}

runMasterTestSuite().catch((err) => {
  console.error('Error fatal durante la ejecución de pruebas maestras:', err);
  process.exit(1);
});
