-- Database initialization script for forest-bd-viewer
-- This script creates all necessary tables and initial data

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    last_lng DOUBLE PRECISION,
    last_lat DOUBLE PRECISION,
    last_zoom DOUBLE PRECISION,
    last_filters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_polygons table
CREATE TABLE IF NOT EXISTS public.user_polygons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    geometry geometry(MultiPolygon, 4326) NOT NULL,
    area_hectares DOUBLE PRECISION NOT NULL,
    analysis_results JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_polygons_geometry ON public.user_polygons USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_user_polygons_user_id ON public.user_polygons (user_id);
CREATE INDEX IF NOT EXISTS idx_user_polygons_status ON public.user_polygons (status);

-- Create forest_plots table (if not exists)
CREATE TABLE IF NOT EXISTS forest_plots (
    id VARCHAR PRIMARY KEY,
    code_region VARCHAR(10),
    code_departement VARCHAR(10),
    code_commune VARCHAR(10),
    lieu_dit VARCHAR(255),
    geom GEOMETRY(MultiPolygon, 4326),
    essences VARCHAR(100)[],
    surface_hectares DOUBLE PRECISION,
    type_foret VARCHAR(100)
);

-- Insert test user for development (only if not exists)
INSERT INTO public.users (id, email, password_hash, first_name, last_name)
SELECT '00000000-0000-0000-0000-000000000000', 'test@example.com', 'hashed_password', 'Test', 'User'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = '00000000-0000-0000-0000-000000000000');

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
    RAISE NOTICE 'Tables created: users, user_polygons, forest_plots';
    RAISE NOTICE 'Test user created: test@example.com (ID: 00000000-0000-0000-0000-000000000000)';
END $$;
