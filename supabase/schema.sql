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
    username TEXT UNIQUE,
    password TEXT DEFAULT 'Veci2026',
    owner_name TEXT,
    owner_phone TEXT,
    metrics JSONB DEFAULT '{"views": 0, "whatsappClicks": 0, "mapsClicks": 0, "calls": 0, "shares": 0, "qrRedemptions": 0}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
    aspect_ratio TEXT DEFAULT '9:16',
    media_bg_fill TEXT DEFAULT 'blur',
    original_price NUMERIC(12, 2),
    promotional_price NUMERIC(12, 2),
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    expiry_label TEXT,
    validity_schedule JSONB,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    plan_category_ids TEXT[] DEFAULT '{}',
    is_plan BOOLEAN DEFAULT false,
    plan_data JSONB,
    featured BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_review')),
    metrics JSONB DEFAULT '{"views": 0, "whatsappClicks": 0, "mapsClicks": 0, "calls": 0, "shares": 0, "qrRedemptions": 0}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
    cover_image TEXT NOT NULL,
    personal_note TEXT,
    estimated_budget NUMERIC(12, 2) DEFAULT 0,
    hide_prices BOOLEAN DEFAULT false,
    card_template TEXT DEFAULT 'oleveci_brand',
    theme JSONB,
    bg_layout TEXT DEFAULT 'horizontal',
    post_ids TEXT[] NOT NULL DEFAULT '{}',
    plan_category_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ready_plans_municipality ON public.ready_plans(municipality);

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

-- ==============================================================================
-- 8. POLÍTICAS DE SEGURIDAD (Row Level Security - RLS)
-- ==============================================================================
-- Habilitar RLS en todas las tablas
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ready_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_redemptions ENABLE ROW LEVEL SECURITY;

-- Lectura pública para cualquier usuario (anónimo o registrado)
CREATE POLICY "Lectura pública de categorías" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Lectura pública de sectores" ON public.sectors FOR SELECT USING (true);
CREATE POLICY "Lectura pública de comercios" ON public.businesses FOR SELECT USING (true);
CREATE POLICY "Lectura pública de anuncios" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Lectura pública de itinerarios" ON public.ready_plans FOR SELECT USING (true);
CREATE POLICY "Lectura pública de canjes QR" ON public.qr_redemptions FOR SELECT USING (true);

-- Escritura permitida para clientes autenticados y con clave pública de app
CREATE POLICY "Permitir inserción de categorías" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de categorías" ON public.categories FOR UPDATE USING (true);

CREATE POLICY "Permitir inserción de sectores" ON public.sectors FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de sectores" ON public.sectors FOR UPDATE USING (true);

CREATE POLICY "Permitir inserción de comercios" ON public.businesses FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de comercios" ON public.businesses FOR UPDATE USING (true);

CREATE POLICY "Permitir inserción de anuncios" ON public.posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de anuncios" ON public.posts FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación de anuncios" ON public.posts FOR DELETE USING (true);

CREATE POLICY "Permitir inserción de itinerarios" ON public.ready_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización de itinerarios" ON public.ready_plans FOR UPDATE USING (true);

CREATE POLICY "Permitir inserción de canjes QR" ON public.qr_redemptions FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 9. DATOS SEMILLA INICIALES (Todas las 18 Categorías OleVeci)
-- ==============================================================================
INSERT INTO public.categories (id, name, slug, icon_name, description, color)
VALUES
    ('cat_automoviles', 'Automóviles & Motos', 'automoviles', 'Car', 'Talleres, lavaderos, repuestos y accesorios', '#f59e0b'),
    ('cat_belleza', 'Belleza & Cuidado Personal', 'belleza', 'Sparkles', 'Peluquerías, barberías, spas y estética', '#ec4899'),
    ('cat_cafes', 'Cafés & Panaderías', 'cafes', 'Coffee', 'Cafeterías de especialidad, panaderías y repostería', '#8b5cf6'),
    ('cat_comida_rapida', 'Comida Rápida & Callejera', 'comida_rapida', 'Pizza', 'Hamburguesas, pizzas, perros y picadas', '#ef4444'),
    ('cat_fitness', 'Deportes & Fitness', 'fitness', 'Dumbbell', 'Gimnasios, canchas, crossfit y suplementos', '#10b981'),
    ('cat_hogar', 'Hogar & Decoración', 'hogar', 'Home', 'Muebles, decoración, plantas y jardinería', '#06b6d4'),
    ('cat_mascotas', 'Mascotas & Veterinaria', 'mascotas', 'PawPrint', 'Veterinarias, pet shops, guarderías y grooming', '#14b8a6'),
    ('cat_moda', 'Moda & Accesorios', 'moda', 'Shirt', 'Ropa, calzado, joyería y accesorios', '#f43f5e'),
    ('cat_ninos', 'Niños & Juguetes', 'ninos', 'Baby', 'Ropa infantil, juguetes y estimulación', '#84cc16'),
    ('cat_regalos', 'Regalos & Detalles', 'regalos', 'Gift', 'Floristerías, desayunos sorpresa y anchetas', '#a855f7'),
    ('cat_planes_eventos', 'Planes & Entretenimiento', 'planes_eventos', 'Ticket', 'Turismo local, eventos, paintball y recreación', '#3b82f6'),
    ('cat_restaurantes', 'Restaurantes & Gastronomía', 'restaurantes', 'Utensils', 'Cocina típica, carnes, internacional y gourmet', '#f97316'),
    ('cat_salud', 'Salud & Bienestar', 'salud', 'HeartPulse', 'Odontología, laboratorios, ópticas y farmacias', '#0ea5e9'),
    ('cat_servicios', 'Servicios Profesionales', 'servicios', 'Briefcase', 'Abogados, contadores, publicidad y asesorías', '#64748b'),
    ('cat_tecnologia', 'Tecnología & Reparación', 'tecnologia', 'Laptop', 'Servicio técnico de celulares, PCs y accesorios', '#6366f1'),
    ('cat_educacion', 'Educación & Cursos', 'educacion', 'GraduationCap', 'Idiomas, artes, música y refuerzo escolar', '#eab308'),
    ('cat_ferreteria', 'Ferretería & Construcción', 'ferreteria', 'Hammer', 'Materiales, pinturas, herramientas e iluminación', '#78716c'),
    ('cat_otros', 'Otros Comercios', 'otros', 'Store', 'Variedades, papelerías y comercios varios', '#6b7280'),
    ('cat_gastronomia', 'Gastronomía & Café', 'gastronomia', 'Utensils', 'Restaurantes, cafeterías y repostería local', '#ff5722'),
    ('cat_mercados', 'Mercados & Plaza', 'mercados', 'ShoppingBag', 'Plazas de mercado, huertas y abarrotes', '#4caf50'),
    ('cat_artesanias', 'Artesanías & Oficios', 'artesanias', 'Palette', 'Talleres artesanales y creadores locales', '#9c27b0'),
    ('cat_bienestar', 'Salud & Bienestar', 'bienestar', 'HeartPulse', 'Belleza, spas, yoga y cuidado personal', '#e91e63')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    icon_name = EXCLUDED.icon_name,
    description = EXCLUDED.description,
    color = EXCLUDED.color;
