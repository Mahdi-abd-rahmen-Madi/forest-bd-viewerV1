-- Add comprehensive indexes for forest_plots and user_polygons tables
-- This is critical for performance with 130,000+ forest records

-- ===== FOREST_PLOTS INDEXES =====

-- Create GIST index on geometry column for fast spatial queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_geom_gist 
ON forest_plots USING GIST (geom);

-- Create B-tree indexes for administrative area filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_code_region 
ON forest_plots (code_region);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_code_departement 
ON forest_plots (code_departement);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_code_commune 
ON forest_plots (code_commune);

-- Create composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_region_dept 
ON forest_plots (code_region, code_departement);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_dept_commune 
ON forest_plots (code_departement, code_commune);

-- Create GIN index for essences array queries (species analysis)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_essences_gin 
ON forest_plots USING GIN (essences);

-- Create composite spatial indexes for administrative + spatial queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_region_geom 
ON forest_plots USING GIST (code_region, geom);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_dept_geom 
ON forest_plots USING GIST (code_departement, geom);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forest_plots_commune_geom 
ON forest_plots USING GIST (code_commune, geom);

-- ===== USER_POLYGONS INDEXES =====

-- Create indexes for user polygon queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_polygons_user_id 
ON user_polygons (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_polygons_status 
ON user_polygons (status);

-- Create composite index for user's polygons by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_polygons_user_status 
ON user_polygons (user_id, status);

-- ===== PERFORMANCE OPTIMIZATION =====

-- Analyze tables to update statistics after index creation
ANALYZE forest_plots;
ANALYZE user_polygons;

-- Display index information for verification
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('forest_plots', 'user_polygons') 
    AND (indexname LIKE 'idx_forest_plots_%' OR indexname LIKE 'idx_user_polygons_%')
ORDER BY tablename, indexname;

-- Display index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE tablename IN ('forest_plots', 'user_polygons')
ORDER BY tablename, indexname;
