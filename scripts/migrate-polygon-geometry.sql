-- Migration script to convert JSONB geometry to PostGIS geometry
-- This script converts existing JSONB geometry data to PostGIS MultiPolygon format

-- First, create a backup of the existing data
CREATE TABLE IF NOT EXISTS user_polygons_backup AS TABLE user_polygons;

-- Add a new temporary column for PostGIS geometry
ALTER TABLE user_polygons ADD COLUMN geometry_new geometry(MultiPolygon, 4326);

-- Update the new column by converting JSONB to PostGIS geometry
UPDATE user_polygons 
SET geometry_new = ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)
WHERE geometry IS NOT NULL AND geometry::text != 'null' AND geometry::text != '' AND geometry::text != 'null';

-- Drop the old JSONB column
ALTER TABLE user_polygons DROP COLUMN geometry;

-- Rename the new column to geometry
ALTER TABLE user_polygons RENAME COLUMN geometry_new TO geometry;

-- Make the geometry column NOT NULL (only if there are no null values)
-- First check if there are any null values
-- If there are, we'll need to handle them separately

-- Create spatial index
CREATE INDEX IF NOT EXISTS idx_user_polygons_geometry ON user_polygons USING GIST (geometry);

-- Verify the migration
SELECT COUNT(*) as total_records, 
       COUNT(geometry) as non_null_geometry,
       COUNT(*) - COUNT(geometry) as null_geometry_count
FROM user_polygons;
