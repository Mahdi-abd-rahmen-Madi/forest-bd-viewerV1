-- Performance test script for database indexes
-- Run this before and after index creation to compare performance

-- Set up performance timing
\timing on

echo '=== Testing Spatial Query Performance ===';

-- Test 1: Spatial intersection query (most common)
EXPLAIN ANALYZE 
SELECT COUNT(*) as plot_count, 
       array_agg(DISTINCT code_departement) as departments
FROM forest_plots 
WHERE ST_Intersects(
    geom, 
    ST_MakeEnvelope(6.5, 48.0, 7.0, 48.5, 4326) -- Bounding box for Vosges area
);

echo '';
echo '=== Testing Administrative Query Performance ===';

-- Test 2: Department filtering (common for regional analysis)
EXPLAIN ANALYZE 
SELECT code_departement, 
       COUNT(*) as plot_count,
       AVG(surface_hectares) as avg_surface
FROM forest_plots 
WHERE code_departement = '088' -- Vosges
GROUP BY code_departement;

echo '';
echo '=== Testing Species Query Performance ===';

-- Test 3: Species analysis (array query)
EXPLAIN ANALYZE 
SELECT unnest(essences) as species, 
       COUNT(*) as plot_count
FROM forest_plots 
WHERE essences && ARRAY['feuillus', 'conifères'] -- GIN index test
GROUP BY species
ORDER BY plot_count DESC;

echo '';
echo '=== Testing User Polygon Query Performance ===';

-- Test 4: User polygon queries
EXPLAIN ANALYZE 
SELECT id, name, status, area_hectares
FROM user_polygons 
WHERE user_id = 'test-user-id' 
  AND status = 'completed'
ORDER BY created_at DESC;

echo '';
echo '=== Testing Combined Spatial + Administrative Query ===';

-- Test 5: Complex query combining spatial and administrative filters
EXPLAIN ANALYZE 
SELECT code_departement, 
       COUNT(*) as plot_count,
       AVG(surface_hectares) as avg_surface
FROM forest_plots 
WHERE code_departement IN ('014', '027', '050') -- Normandie departments
  AND ST_Intersects(
    geom, 
    ST_MakeEnvelope(-0.5, 48.5, 1.5, 50.0, 4326) -- Normandie bounding box
  )
GROUP BY code_departement;

\timing off

echo '';
echo '=== Index Usage Statistics ===';

-- Show which indexes are being used
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE tablename IN ('forest_plots', 'user_polygons')
    AND idx_scan > 0
ORDER BY idx_scan DESC;

echo '';
echo '=== Table Size Statistics ===';

-- Show table and index sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size
FROM pg_tables 
WHERE tablename IN ('forest_plots', 'user_polygons');
