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

-- Create index for faster spatial queries
CREATE INDEX IF NOT EXISTS idx_user_polygons_geometry ON public.user_polygons USING GIST (geometry);

-- Create index for user-specific queries
CREATE INDEX IF NOT EXISTS idx_user_polygons_user_id ON public.user_polygons (user_id);

-- Create index for status-based queries
CREATE INDEX IF NOT EXISTS idx_user_polygons_status ON public.user_polygons (status);
