# Forest Data Viewer - Symbiose Technical Challenge ✅ COMPLETED

## 📋 Reviewer Quick Guide
To help you quickly navigate to the specific deliverables for this technical challenge:
* **Part 1 - Technical Review**: See [TECHNICAL_REVIEW.md](./TECHNICAL_REVIEW.md)
* **Part 2 - Product Improvements**: All 4 mandatory improvements are detailed in the [Features](#-key-features--achievements) section below.
* **Part 3 - Service Boundary Extraction**: See the [Service Boundary Extraction](#part-3---service-boundary-extraction) section below.
* **Deep Dives & Architecture**: See the `/docs` folder for [Case Studies](./docs/CASE_STUDIES.md) and [Architecture Details](./docs/ARCHITECTURE.md).

## Executive Summary

Successfully transformed the original basic skeleton repository into a complete, production-minded full-stack geospatial application, fulfilling all Symbiose technical challenge requirements with significant additional enhancements (e.g. importing 130,549 real forest plots from IGN).

**Time Investment**: ~3-4 days of focused development work.

## 🎥 Demo

![Forest Data Viewer Demo](https://raw.githubusercontent.com/Mahdi-abd-rahmen-Madi/forest-bd-viewerV1/master/assets/videos/forest-data-viewer-demo-thumbnail.jpg)

[**Download Full Quality MP4**](https://raw.githubusercontent.com/Mahdi-abd-rahmen-Madi/forest-bd-viewerV1/master/assets/videos/forest-data-viewer-demo.mp4) (16.8 MB)

## 🚀 Quick Start

For detailed instructions, manual database configuration, or troubleshooting, please read [**docs/SETUP.md**](./docs/SETUP.md).

```bash
# 1. Clone and install dependencies
pnpm install

# 2. Run the development launcher (Automatically setups DB, packages, and runs servers)
./start-dev.sh

# Or, for a preview/demo mode (no login required, optimized performance):
./start-preview.sh
```

**Access Points:**
- **Frontend**: http://localhost:3000
- **GraphQL API & Playground**: http://localhost:4000/graphql

## 🌟 Key Features & Achievements

* **Official French Forest Data**: Imported 130,549 real forest plots from the IGN BD FORET dataset across 13 departments.
* **Polygon Spatial Analysis (E2E Fix)**: Fixed the broken drawing flow. Users can draw polygons and instantly get PostGIS-powered spatial intersection analysis, including area and species distribution.
* **Viewport-Based Data Loading**: Implemented strict zoom-based controls and bounding box filters to prevent browser crashes when handling the massive geospatial dataset.
* **User-State Persistence**: Map view state (coordinates & zoom) and filter preferences are saved per user and restored upon login.
* **PLU/PCI Urban Planning Integration**: Integrated external French geoportal WMS and vector tile layers with a unified cadastre control.
* **Performance Optimization**: Enabled and tested vital spatial (GIST) and administrative (B-tree) database indexes, achieving sub-second spatial queries.

## 🏗️ Documentation & Deep Dives

To keep this README concise, detailed engineering logs and architecture documentation have been moved to the `/docs` directory:

1. [**Architecture & Tech Specs**](./docs/ARCHITECTURE.md) - Details on the PostGIS schema, ETL pipeline, and GraphQL design.
2. [**Engineering Case Studies**](./docs/CASE_STUDIES.md) - Read how complex bugs like WMS Proxy Timeouts and Polygon Serialization were debugged and resolved.
3. [**Complete Setup Guide**](./docs/SETUP.md) - Manual setup instructions, testing steps, and troubleshooting.

---

## Part 3 - Service Boundary Extraction

To fulfill the architectural evolution requirement, I implemented a service-ready API boundary for the geospatial analysis domain.

**1. What boundary you chose:**
I extracted the **Geospatial Query Domain** into its own isolated boundary (`GeospatialService`).

**2. Why you chose it:**
Geospatial operations are computationally expensive and require specific database extensions (PostGIS). In a production environment, this is exactly the type of service you want to scale independently from the core user-facing API or authentication services.

**3. What coupling problem it solves or reduces:**
Previously, the `PolygonService` was directly executing raw PostGIS queries and handling geometry processing. By extracting this, `PolygonService` no longer knows *how* spatial queries are performed. It simply calls the `IGeospatialService` contract to get results.

**4. How this boundary could evolve into an actual service later:**
I created a `GeospatialServiceClient` abstraction. Right now, this client calls the internal `GeospatialService` in-process. To extract it to a real microservice, we only need to change the implementation of `GeospatialServiceClient` to make gRPC or HTTP calls to a new external service, without touching the consumers.

**5. What remains tightly coupled and why:**
The database schema remains tightly coupled. The extracted `GeospatialService` still relies on the shared `ForestPlot` TypeORM entities and the same PostgreSQL database as the main application. In a true microservices architecture, the geospatial service would own its own data store or at least its own read replica. This was deferred to avoid unnecessary infrastructure complexity for this exercise.
