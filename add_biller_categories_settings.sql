CREATE TABLE IF NOT EXISTS public.biller_categories_settings (
    id SERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    category_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, category_name)
);
