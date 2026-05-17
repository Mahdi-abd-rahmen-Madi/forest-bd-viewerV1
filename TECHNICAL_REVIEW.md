# Part 1: Technical Review of the Existing Codebase

As requested in the challenge guidelines, this document outlines the initial technical review of the `TALHA017/forest-bd-viewer` repository before implementing the product improvements.

## What the current codebase already does well

The original repository provided a strong foundation that demonstrated geospatial expertise and modern web architecture:
- **Solid Architectural Foundation**: The choice of a Turborepo monorepo with Next.js (frontend) and NestJS (backend) provided a highly scalable and organized structure.
- **Geospatial Preparedness**: The PostGIS database setup and the initial coordinate transformation concepts (e.g., handling spatial geometries) showed a good understanding of geospatial requirements.
- **API Design Choice**: Using GraphQL with Apollo Server is an excellent choice for a data-heavy application, allowing the client to query exactly the spatial data it needs.
- **Separation of Concerns**: The basic directory structure cleanly separated the UI components from the API services and database entities.

## Main weaknesses or risks identified

While the foundation was strong, several critical gaps prevented the application from being production-ready:
- **Broken End-to-End Workflows**: The UI presented features (like saving polygons or cadastre WMS layers) that either lacked backend implementation or pointed to non-existent WMS layers, creating a deceptive user experience.
- **Performance Bottlenecks**: Database spatial indexes were defined but disabled or underutilized. Querying large geometries without active GIST indexes posed a massive scaling risk.
- **Type Safety Gaps**: Extensive use of the `any` type across the GraphQL and service layers bypassed the benefits of TypeScript and masked potential runtime errors in geometry parsing.
- **Missing Data Optimization**: Loading all geospatial data at once without viewport-based filtering or clustering would crash the client browser if a full dataset was loaded.
- **Fragile State Persistence**: Map states (like zoom and bounds) were not reliably persisted across sessions, degrading the user experience.

## Top 3 issues addressed first

To bring the most immediate value and stability to the product, I prioritized the following fixes:

1. **Fixing the End-to-End Polygon Analysis (Inconsistency Fix)**: 
   The frontend allowed drawing polygons, but the backend lacked the mutations and logic to persist and analyze them. I implemented a complete `PolygonModule` with robust PostGIS spatial intersection queries (`ST_Intersects`) and geometry serialization fixes, making the core product feature fully functional.

2. **Implementing Viewport-Based Data Loading (Geospatial Improvement)**:
   To handle the 130,549 real French forest plots I imported, I implemented dynamic viewport filtering. The app now calculates the map bounds, applies zoom-based visibility rules (no plots loaded at zoom < 12), and limits payload sizes, drastically improving client performance and preventing browser crashes.

3. **Enabling Spatial Database Indexes & Data Integrity (Maintainability & Performance)**:
   I activated and verified GIST indexes on geometry columns and B-tree indexes on administrative bounds. Furthermore, I eliminated `any` types in the data pipeline to ensure strict typing for all geospatial data passing between the frontend and PostGIS.

## What I intentionally decided not to fix (and why)

Given the 1-3 days recommended effort, I made strategic trade-offs to focus on core requirements:
- **Comprehensive Test Suite (Unit/E2E)**: While crucial for production, writing tests for the entire application would consume the entire time budget. I focused on architectural correctness and service boundaries instead.
- **Advanced Caching (Redis)**: Spatial queries can be expensive and typically require a distributed cache in production. I deferred this because the database index optimizations were sufficient for the scale of the exercise.
- **Complete UI Redesign**: The UI was functional. Aside from fixing broken layouts (like the saved polygons list hiding off-screen), I avoided redesigning the app to focus strictly on engineering robustness and backend architecture.
- **Full Microservices Migration**: I stopped at defining a *service boundary* for the geospatial domain (as requested) rather than deploying a separate Dockerized service, as a true microservice would introduce unnecessary operational overhead for this exercise context.
