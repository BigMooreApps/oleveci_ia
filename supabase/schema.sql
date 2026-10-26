-- ==============================================================================
-- OleVeci - Esquema de Base de Datos para Supabase (PostgreSQL)
-- Ejecuta este script completo en el SQL Editor de tu panel de Supabase
-- ==============================================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLA: CATEGORÍAS (categories)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon_name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. TABLA: MUNICIPIOS Y SECTORES (sectors)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city_name TEXT NOT NULL,
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    type TEXT DEFAULT 'urban',
    radius_meters INTEGER DEFAULT 1500,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. TABLA: COMERCIOS LOCALES (businesses)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.businesses (
    id TEXT PRIMARY KEY DEFAULT 'biz_' || replace(uuid_generate_v4()::text, '-', ''),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    logo TEXT NOT NULL,
    cover_image TEXT,
    description TEXT,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    sub_category TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    sector TEXT NOT NULL,
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    hours TEXT,
    whatsapp TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    instagram TEXT,
    facebook TEXT,
    tiktok TEXT,
    youtube TEXT,
    website TEXT,
    twitter TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    rating NUMERIC(3, 2) DEFAULT 5.0,
    verified BOOLEAN DEFAULT false,
    featured BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'pending_review')),
    suspension_reason TEXT,
    suspended_at TIMESTAMPTZ,
    review_status TEXT DEFAULT 'none',
    review_requested_at TIMESTAMPTZ,
    correction_note TEXT,
    subscription JSONB DEFAULT '{"status": "trial", "planName": "Plan Veci Pro", "priceCOP": 39000, "autoRenew": true}'::jsonb,
    billing_info JSONB,
    payment_history JSONB DEFAULT '[]'::jsonb,
    username TEXT UNIQUE,
    password TEXT DEFAULT 'Veci2026',
    access_email TEXT,
    access_pin TEXT,
    access_password TEXT DEFAULT 'Veci2026',
    owner_name TEXT,
    owner_phone TEXT,
    metrics JSONB DEFAULT '{"views": 0, "whatsappClicks": 0, "mapsClicks": 0, "calls": 0, "shares": 0, "qrRedemptions": 0}'::jsonb,
    suspension_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migraciones seguras para businesses existentes
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS facebook TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS tiktok TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS youtube TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS twitter TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS access_email TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS access_pin TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS access_password TEXT DEFAULT 'Veci2026';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS suspension_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;

-- Índices de búsqueda para comercios
CREATE INDEX IF NOT EXISTS idx_businesses_city ON public.businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON public.businesses(category_id);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON public.businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_username ON public.businesses(username);

-- ==============================================================================
-- 5. TABLA: ANUNCIOS Y PUBLICACIONES (posts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.posts (
    id TEXT PRIMARY KEY DEFAULT 'post_' || replace(uuid_generate_v4()::text, '-', ''),
    business_id TEXT REFERENCES public.businesses(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    business_logo TEXT NOT NULL,
    business_city TEXT NOT NULL,
    business_sector TEXT NOT NULL,
    business_whatsapp TEXT NOT NULL,
    business_phone TEXT NOT NULL,
    business_address TEXT NOT NULL,
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    type TEXT NOT NULL DEFAULT 'promotion',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    video_url TEXT,
    media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
    image_position JSONB DEFAULT '{"x": 50, "y": 50}'::jsonb,
    image_scale NUMERIC(4, 2) DEFAULT 1.0,
    image_fit TEXT DEFAULT 'cover',
    video_position JSONB DEFAULT '{"x": 50, "y": 50}'::jsonb,
    video_scale NUMERIC(4, 2) DEFAULT 1.0,
    video_fit TEXT DEFAULT 'cover',
    image_filter TEXT,
    aspect_ratio TEXT DEFAULT '9:16',
    media_bg_fill TEXT DEFAULT 'blur',
    original_price NUMERIC(12, 2),
    promotional_price NUMERIC(12, 2),
    price_scope TEXT,
    price_type TEXT,
    approximate_price NUMERIC(12, 2),
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    expiry_label TEXT,
    validity_schedule JSONB,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    plan_category_id TEXT,
    plan_category_ids TEXT[] DEFAULT '{}',
    plan_category_name TEXT,
    plan_role TEXT,
    plan_roles TEXT[] DEFAULT '{}',
    target_audience TEXT[] DEFAULT '{}',
    is_plan BOOLEAN DEFAULT false,
    plan_data JSONB,
    featured BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_review')),
    suspension_reason TEXT,
    suspended_at TIMESTAMPTZ,
    suspension_history JSONB DEFAULT '[]'::jsonb,
    metrics JSONB DEFAULT '{"views": 0, "whatsappClicks": 0, "mapsClicks": 0, "calls": 0, "shares": 0, "qrRedemptions": 0}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migraciones seguras para posts existentes
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_fit TEXT DEFAULT 'cover';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_position JSONB DEFAULT '{"x": 50, "y": 50}'::jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_scale NUMERIC(4, 2) DEFAULT 1.0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_fit TEXT DEFAULT 'cover';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_filter TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS price_scope TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS price_type TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS approximate_price NUMERIC(12, 2);
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS plan_category_id TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS plan_category_name TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS plan_role TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS plan_roles TEXT[] DEFAULT '{}';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS target_audience TEXT[] DEFAULT '{}';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS suspension_history JSONB DEFAULT '[]'::jsonb;

-- Índices de búsqueda para publicaciones
CREATE INDEX IF NOT EXISTS idx_posts_business_id ON public.posts(business_id);
CREATE INDEX IF NOT EXISTS idx_posts_city ON public.posts(business_city);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON public.posts(expires_at);

-- ==============================================================================
-- 6. TABLA: ITINERARIOS Y PLANES PRE-DISEÑADOS (ready_plans)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ready_plans (
    id TEXT PRIMARY KEY,
    plan_title TEXT NOT NULL,
    municipality TEXT NOT NULL,
    scheduled_time TEXT,
    cover_image TEXT,
    personal_note TEXT,
    estimated_budget NUMERIC(12, 2) DEFAULT 0,
    hide_prices BOOLEAN DEFAULT false,
    card_template TEXT DEFAULT 'oleveci_brand',
    theme JSONB DEFAULT '{}'::jsonb,
    bg_layout TEXT DEFAULT 'horizontal',
    post_ids TEXT[] NOT NULL DEFAULT '{}',
    fallback_posts JSONB DEFAULT '[]'::jsonb,
    category TEXT DEFAULT 'plan_otros',
    plan_category_ids TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    time_of_day TEXT DEFAULT 'tarde',
    day_type TEXT DEFAULT 'weekend',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migraciones seguras para ready_plans existentes
ALTER TABLE public.ready_plans ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'plan_otros';
ALTER TABLE public.ready_plans ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.ready_plans ADD COLUMN IF NOT EXISTS time_of_day TEXT DEFAULT 'tarde';
ALTER TABLE public.ready_plans ADD COLUMN IF NOT EXISTS day_type TEXT DEFAULT 'weekend';
ALTER TABLE public.ready_plans ADD COLUMN IF NOT EXISTS fallback_posts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ready_plans ALTER COLUMN cover_image DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ready_plans_municipality ON public.ready_plans(municipality);
CREATE INDEX IF NOT EXISTS idx_ready_plans_category ON public.ready_plans(category);

-- ==============================================================================
-- 7. TABLA: CANJES DE CÓDIGOS QR (qr_redemptions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.qr_redemptions (
    id TEXT PRIMARY KEY DEFAULT 'qr_' || replace(uuid_generate_v4()::text, '-', ''),
    post_id TEXT REFERENCES public.posts(id) ON DELETE CASCADE,
    business_id TEXT REFERENCES public.businesses(id) ON DELETE CASCADE,
    post_title TEXT NOT NULL,
    code TEXT NOT NULL,
    redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_business_id ON public.qr_redemptions(business_id);
CREATE INDEX IF NOT EXISTS idx_qr_post_id ON public.qr_redemptions(post_id);

-- ==============================================================================
-- 8. POLÍTICAS DE SEGURIDAD (Row Level Security - RLS)
-- ==============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ready_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_redemptions ENABLE ROW LEVEL SECURITY;

-- Lectura pública
DROP POLICY IF EXISTS "Lectura pública de categorías" ON public.categories;
CREATE POLICY "Lectura pública de categorías" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lectura pública de sectores" ON public.sectors;
CREATE POLICY "Lectura pública de sectores" ON public.sectors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lectura pública de comercios" ON public.businesses;
CREATE POLICY "Lectura pública de comercios" ON public.businesses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lectura pública de anuncios" ON public.posts;
CREATE POLICY "Lectura pública de anuncios" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lectura pública de itinerarios" ON public.ready_plans;
CREATE POLICY "Lectura pública de itinerarios" ON public.ready_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lectura pública de canjes QR" ON public.qr_redemptions;
CREATE POLICY "Lectura pública de canjes QR" ON public.qr_redemptions FOR SELECT USING (true);

-- Escritura permitida para la aplicación
DROP POLICY IF EXISTS "Permitir inserción de categorías" ON public.categories;
CREATE POLICY "Permitir inserción de categorías" ON public.categories FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualización de categorías" ON public.categories;
CREATE POLICY "Permitir actualización de categorías" ON public.categories FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir inserción de sectores" ON public.sectors;
CREATE POLICY "Permitir inserción de sectores" ON public.sectors FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualización de sectores" ON public.sectors;
CREATE POLICY "Permitir actualización de sectores" ON public.sectors FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir inserción de comercios" ON public.businesses;
CREATE POLICY "Permitir inserción de comercios" ON public.businesses FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualización de comercios" ON public.businesses;
CREATE POLICY "Permitir actualización de comercios" ON public.businesses FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminación de comercios" ON public.businesses;
CREATE POLICY "Permitir eliminación de comercios" ON public.businesses FOR DELETE USING (true);

DROP POLICY IF EXISTS "Permitir inserción de anuncios" ON public.posts;
CREATE POLICY "Permitir inserción de anuncios" ON public.posts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualización de anuncios" ON public.posts;
CREATE POLICY "Permitir actualización de anuncios" ON public.posts FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminación de anuncios" ON public.posts;
CREATE POLICY "Permitir eliminación de anuncios" ON public.posts FOR DELETE USING (true);

DROP POLICY IF EXISTS "Permitir inserción de itinerarios" ON public.ready_plans;
CREATE POLICY "Permitir inserción de itinerarios" ON public.ready_plans FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualización de itinerarios" ON public.ready_plans;
CREATE POLICY "Permitir actualización de itinerarios" ON public.ready_plans FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminación de itinerarios" ON public.ready_plans;
CREATE POLICY "Permitir eliminación de itinerarios" ON public.ready_plans FOR DELETE USING (true);

DROP POLICY IF EXISTS "Permitir inserción de canjes QR" ON public.qr_redemptions;
CREATE POLICY "Permitir inserción de canjes QR" ON public.qr_redemptions FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 9. DATOS SEMILLA INICIALES (Categorías Oficiales OleVeci)
-- ==============================================================================
INSERT INTO public.categories (id, name, slug, icon_name, description, color)
VALUES
    ('cat_automoviles', 'Autos y Motos', 'autos-y-motos', 'Car', 'Talleres, lavaderos, repuestos y accesorios', '#475569'),
    ('cat_belleza', 'Belleza y Cuidado Personal', 'belleza-y-cuidado-personal', 'Sparkles', 'Peluquerías, barberías, spas y estética', '#EC4899'),
    ('cat_cafes', 'Cafés y Panaderías', 'cafes-y-panaderias', 'Coffee', 'Cafeterías de especialidad, panaderías y repostería', '#B45309'),
    ('cat_comida_rapida', 'Comida Rápida', 'comida-rapida', 'Pizza', 'Hamburguesas, pizzas, perros y picadas', '#F97316'),
    ('cat_fitness', 'Deportes y Fitness', 'deportes-y-fitness', 'Dumbbell', 'Gimnasios, canchas, crossfit y suplementos', '#06B6D4'),
    ('cat_hogar', 'Hogar y Decoración', 'hogar-y-decoracion', 'Home', 'Muebles, decoración, plantas y jardinería', '#14B8A6'),
    ('cat_mascotas', 'Mascotas y Veterinarias', 'mascotas-y-veterinarias', 'PawPrint', 'Veterinarias, pet shops, guarderías y grooming', '#F59E0B'),
    ('cat_moda', 'Moda y Accesorios', 'moda-y-accesorios', 'Shirt', 'Ropa, calzado, joyería y accesorios', '#6366F1'),
    ('cat_ninos', 'Niños y Familia', 'ninos-y-familia', 'Baby', 'Ropa infantil, juguetes y estimulación', '#F43F5E'),
    ('cat_regalos', 'Regalos y Floristerías', 'regalos-y-floristerias', 'Gift', 'Floristerías, desayunos sorpresa y anchetas', '#D946EF'),
    ('cat_planes_eventos', 'Planes y Experiencias', 'planes-y-experiencias', 'Ticket', 'Turismo local, eventos, paintball y recreación', '#8B5CF6'),
    ('cat_restaurantes', 'Restaurantes', 'restaurantes', 'Utensils', 'Cocina típica, carnes, internacional y gourmet', '#EF4444'),
    ('cat_salud', 'Salud y Bienestar', 'salud-y-bienestar', 'HeartPulse', 'Odontología, laboratorios, ópticas y farmacias', '#10B981'),
    ('cat_servicios', 'Servicios Profesionales y Técnicos', 'servicios-profesionales-y-tecnicos', 'Briefcase', 'Abogados, contadores, publicidad y asesorías', '#64748B'),
    ('cat_tecnologia', 'Tecnología y Electrónica', 'tecnologia-y-electronica', 'Laptop', 'Servicio técnico de celulares, PCs y accesorios', '#3B82F6'),
    ('cat_educacion', 'Educación y Cursos', 'educacion-y-cursos', 'GraduationCap', 'Idiomas, artes, música y refuerzo escolar', '#0284C7'),
    ('cat_ferreteria', 'Ferretería y Construcción', 'ferreteria-y-construccion', 'Hammer', 'Materiales, pinturas, herramientas e iluminación', '#A16207'),
    ('cat_otros', 'Tiendas y Otros Comercios', 'tiendas-y-otros-comercios', 'Store', 'Variedades, papelerías y comercios varios', '#94A3B8'),
    -- Aliases de compatibilidad
    ('cat_gastronomia', 'Gastronomía & Café', 'gastronomia', 'Utensils', 'Restaurantes, cafeterías y repostería local', '#EF4444'),
    ('cat_mercados', 'Mercados & Plaza', 'mercados', 'ShoppingBag', 'Plazas de mercado, huertas y abarrotes', '#10B981'),
    ('cat_artesanias', 'Artesanías & Oficios', 'artesanias', 'Palette', 'Talleres artesanales y creadores locales', '#8B5CF6'),
    ('cat_bienestar', 'Salud & Bienestar', 'bienestar', 'HeartPulse', 'Belleza, spas, yoga y cuidado personal', '#EC4899')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    icon_name = EXCLUDED.icon_name,
    description = EXCLUDED.description,
    color = EXCLUDED.color;
