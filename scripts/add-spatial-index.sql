-- Add spatial GIST index for forest_plots table
-- This is critical for performance even with 10,000 record limit

-- Create GIST index on geometry column for fast spatial queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_geom_gist 
ON forest_plots USING GIST (geom);

-- Create composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_region_geom 
ON forest_plots USING GIST (codeRegion, geom);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_dept_geom 
ON forest_plots USING GIST (codeDepartement, geom);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_commune_geom 
ON forest_plots USING GIST (codeCommune, geom);

-- Analyze the table to update statistics
ANALYZE forest_plots;

-- Display index information for verification
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'forest_plots' 
    AND indexname LIKE 'idx_forest_plots_%'
ORDER BY indexname;
