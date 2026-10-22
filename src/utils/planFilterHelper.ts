import { Post } from '../types';
import { SimulatedReadyPlan, resolvePlanPosts } from '../data/readyPlansData';

/**
 * Checks if a business post matches a plan experience (e.g. 'plan_comer_algo', 'plan_cita_romantica')
 */
export function matchesPostPlanExperience(post: Post, planType: string): boolean {
  if (!planType || planType === 'all') return true;

  const target = planType.toLowerCase();
  const postPlanCatId = (post.planCategoryId || '').toLowerCase();
  const postPlanCatName = (post.planCategoryName || '').toLowerCase();
  const postCat = (post.categoryId || '').toLowerCase();
  const postTags = (post.tags || []).map((t) => t.toLowerCase());

  if (
    postPlanCatId === target ||
    postPlanCatName.includes(target) ||
    postCat === target ||
    postTags.includes(target)
  ) {
    return true;
  }

  if (target === 'plan_comer_algo' || target === 'gastronomia') {
    return (
      postCat.includes('gastro') ||
      postCat.includes('comida') ||
      postCat.includes('restaurante') ||
      postCat === 'cat_restaurantes' ||
      postCat === 'cat_comida_rapida' ||
      postTags.some((t) =>
        ['comida', 'hamburguesa', 'pizza', 'parrilla', 'almuerzo', 'cena', 'restaurante', 'sushi', 'tacos'].some((k) =>
          t.includes(k)
        )
      )
    );
  }

  if (target === 'plan_tomar_algo' || target === 'cafe') {
    return (
      postCat.includes('cafe') ||
      postCat.includes('postre') ||
      postCat.includes('helado') ||
      postCat === 'cat_cafes' ||
      postTags.some((t) =>
        ['cafe', 'postre', 'helado', 'dulce', 'reposteria', 'cafe especial', 'panaderia'].some((k) =>
          t.includes(k)
        )
      )
    );
  }

  if (target === 'plan_cita_romantica' || target === 'romance') {
    return (
      postCat.includes('romance') ||
      postTags.some((t) =>
        ['pareja', 'cita', 'romantico', 'romance', 'vino', 'especial', 'aniversario'].some((k) =>
          t.includes(k)
        )
      )
    );
  }

  if (target === 'plan_con_amigos' || target === 'amigos') {
    return (
      postCat.includes('amigo') ||
      postCat === 'cat_comida_rapida' ||
      postCat === 'cat_planes_eventos' ||
      postTags.some((t) =>
        ['amigo', 'amigos', 'parche', 'alitas', 'picada', 'juegos', 'cerveza', 'combo'].some((k) =>
          t.includes(k)
        )
      )
    );
  }

  if (target === 'plan_noche_rumba' || target === 'rumba') {
    return (
      postCat.includes('bar') ||
      postCat.includes('rumba') ||
      postCat.includes('licor') ||
      postCat === 'cat_bares' ||
      postTags.some((t) =>
        ['bar', 'coctel', 'cerveza', 'rumba', 'noche', 'fiesta', 'licor', 'discoteca'].some((k) =>
          t.includes(k)
        )
      )
    );
  }

  if (target === 'plan_dia_con_ninos' || target === 'familia') {
    return (
      postCat.includes('nino') ||
      postCat.includes('familia') ||
      postCat === 'cat_planes_eventos' ||
      postTags.some((t) =>
        ['nino', 'ninos', 'familia', 'parque', 'juegos', 'recreacion', 'infantil'].some((k) =>
          t.includes(k)
        )
      )
    );
  }

  if (target === 'plan_consentir_mascotas' || target === 'mascotas') {
    return (
      postCat.includes('mascota') ||
      postCat === 'cat_mascotas' ||
      postTags.some((t) =>
        ['mascota', 'perro', 'gato', 'pet', 'veterinaria', 'peluqueria canina'].some((k) =>
          t.includes(k)
        )
      )
    );
  }

  if (target === 'plan_cuidado_personal' || target === 'wellness') {
    return (
      postCat.includes('belleza') ||
      postCat.includes('barberia') ||
      postCat.includes('spa') ||
      postCat === 'cat_belleza' ||
      postCat === 'cat_fitness' ||
      postTags.some((t) =>
        ['spa', 'barberia', 'belleza', 'unas', 'peluqueria', 'masaje', 'cuidado', 'facial', 'gym', 'fitness'].some((k) =>
          t.includes(k)
        )
      )
    );
  }

  if (target === 'plan_comprar_algo' || target === 'compras') {
    return (
      postCat.includes('compra') ||
      postCat.includes('tienda') ||
      postCat === 'cat_servicios' ||
      postTags.some((t) =>
        ['tienda', 'ropa', 'moda', 'calzado', 'compras', 'accesorio', 'tecnologia'].some((k) =>
          t.includes(k)
        )
      )
    );
  }

  if (target === 'plan_cuidar_la_nave' || target === 'autos') {
    return (
      postCat.includes('auto') ||
      postCat.includes('carro') ||
      postCat.includes('vehiculo') ||
      postCat === 'cat_automoviles' ||
      postTags.some((t) =>
        ['taller', 'lavado', 'carro', 'auto', 'moto', 'mecanica', 'detailing', 'aceite', 'frenos', 'repuestos'].some((k) =>
          t.includes(k)
        )
      )
    );
  }

  return false;
}

/**
 * Checks if a ready plan matches a plan experience (e.g. 'plan_comer_algo', 'plan_cita_romantica')
 */
export function matchesReadyPlanExperience(plan: SimulatedReadyPlan, planType: string, allPosts: Post[] = []): boolean {
  if (!planType || planType === 'all') return true;

  const typeLower = planType.toLowerCase();
  const planCatLower = (plan.category || '').toLowerCase();
  const planTags = (plan.tags || []).map((t) => t.toLowerCase());

  if (planCatLower === typeLower || planTags.includes(typeLower)) {
    return true;
  }

  if (typeLower === 'romance' || typeLower === 'plan_cita_romantica') {
    return (
      planCatLower === 'plan_cita_romantica' ||
      planCatLower === 'romance' ||
      planTags.includes('romance') ||
      planTags.includes('pareja')
    );
  }

  if (typeLower === 'gastronomia' || typeLower === 'plan_comer_algo') {
    return (
      planCatLower === 'plan_comer_algo' ||
      planCatLower === 'gastronomia' ||
      planCatLower === 'parrilla' ||
      planTags.includes('gourmet') ||
      planTags.includes('comer') ||
      planTags.includes('restaurante')
    );
  }

  if (typeLower === 'cafe' || typeLower === 'plan_tomar_algo') {
    return (
      planCatLower === 'plan_tomar_algo' ||
      planCatLower === 'cafe' ||
      planTags.includes('cafe') ||
      planTags.includes('postre')
    );
  }

  if (typeLower === 'night' || typeLower === 'plan_noche_rumba') {
    return (
      plan.timeOfDay === 'noche' ||
      planCatLower === 'plan_noche_rumba' ||
      planCatLower === 'rumba' ||
      planTags.includes('noche') ||
      planTags.includes('rumba') ||
      planTags.includes('bar')
    );
  }

  if (typeLower === 'amigos' || typeLower === 'plan_con_amigos') {
    return (
      planCatLower === 'plan_con_amigos' ||
      planCatLower === 'amigos' ||
      planTags.includes('amigos') ||
      planTags.includes('parche')
    );
  }

  if (typeLower === 'wellness' || typeLower === 'plan_cuidado_personal') {
    return (
      planCatLower === 'plan_cuidado_personal' ||
      planCatLower === 'wellness' ||
      planTags.includes('wellness') ||
      planTags.includes('spa')
    );
  }

  if (typeLower === 'naturaleza' || typeLower === 'plan_dia_con_ninos') {
    return (
      planCatLower === 'plan_dia_con_ninos' ||
      planCatLower === 'naturaleza' ||
      planTags.includes('naturaleza') ||
      planTags.includes('pasadia') ||
      planTags.includes('ninos')
    );
  }

  if (typeLower === 'plan_consentir_mascotas') {
    return (
      planCatLower === 'plan_consentir_mascotas' ||
      planTags.includes('mascotas') ||
      planTags.includes('pet')
    );
  }

  if (typeLower === 'plan_cuidar_la_nave') {
    return (
      planCatLower === 'plan_cuidar_la_nave' ||
      planTags.includes('autos') ||
      planTags.includes('motos')
    );
  }

  if (typeLower === 'plan_comprar_algo') {
    return (
      planCatLower === 'plan_comprar_algo' ||
      planTags.includes('compras') ||
      planTags.includes('shopping')
    );
  }

  // Check if any stop in the plan matches
  if (allPosts.length > 0) {
    const stops = resolvePlanPosts(plan, allPosts);
    return stops.some((s) => matchesPostPlanExperience(s, planType));
  }

  return false;
}
