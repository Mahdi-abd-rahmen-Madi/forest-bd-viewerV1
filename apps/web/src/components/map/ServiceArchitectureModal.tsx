'use client';

import { useState } from 'react';
import { X, Layers, Network, ArrowRight, Code, CheckCircle, AlertCircle } from 'lucide-react';

interface ServiceArchitectureModalProps {
    visible: boolean;
    onClose: () => void;
}

export function ServiceArchitectureModal({ visible, onClose }: ServiceArchitectureModalProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'interface' | 'client' | 'comparison'>('overview');

    if (!visible) return null;

    const renderOverview = () => (
        <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                    <CheckCircle size={20} />
                    <span className="font-semibold">Service Boundary Extraction - COMPLETED</span>
                </div>
                <p className="text-sm text-green-600">
                    Successfully extracted geospatial domain into service-ready boundary with clean interface abstraction.
                </p>
            </div>

            {/* Architecture Diagram */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Network size={18} />
                    Service Architecture Overview
                </h4>
                <div className="space-y-3">
                    {/* Layer 1 */}
                    <div className="flex items-center gap-3">
                        <div className="w-48 px-3 py-2 bg-blue-100 border border-blue-300 rounded text-sm font-medium text-blue-700">
                            PolygonService
                        </div>
                        <ArrowRight size={16} className="text-gray-400" />
                        <div className="flex-1 text-sm text-gray-600">Uses service client instead of direct spatial queries</div>
                    </div>
                    
                    {/* Layer 2 */}
                    <div className="flex items-center gap-3">
                        <div className="w-48 px-3 py-2 bg-purple-100 border border-purple-300 rounded text-sm font-medium text-purple-700">
                            GeospatialServiceClient
                        </div>
                        <ArrowRight size={16} className="text-gray-400" />
                        <div className="flex-1 text-sm text-gray-600">Abstraction layer with clean contract</div>
                    </div>
                    
                    {/* Layer 3 */}
                    <div className="flex items-center gap-3">
                        <div className="w-48 px-3 py-2 bg-green-100 border border-green-300 rounded text-sm font-medium text-green-700">
                            GeospatialService
                        </div>
                        <ArrowRight size={16} className="text-gray-400" />
                        <div className="flex-1 text-sm text-gray-600">Core PostGIS implementation with turf.js</div>
                    </div>
                </div>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <h5 className="font-medium text-blue-700 text-sm mb-2">Reduced Coupling</h5>
                    <p className="text-xs text-blue-600">PolygonService no longer directly handles spatial queries</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <h5 className="font-medium text-purple-700 text-sm mb-2">Clean Contract</h5>
                    <p className="text-xs text-purple-600">Type-safe interface for all geospatial operations</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <h5 className="font-medium text-green-700 text-sm mb-2">Future-Ready</h5>
                    <p className="text-xs text-green-600">Credible path toward microservice extraction</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <h5 className="font-medium text-amber-700 text-sm mb-2">Testability</h5>
                    <p className="text-xs text-amber-600">Service boundary enables easier testing</p>
                </div>
            </div>
        </div>
    );

    const renderInterface = () => (
        <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Code size={18} />
                    IGeospatialService Interface
                </h4>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                    <pre>{`interface IGeospatialService {
  // Core spatial operations
  analyzeSpatialIntersection(
    geometry: GeoJSON.Geometry
  ): Promise<AnalysisResults>;
  
  queryForestPlots(
    bounds: BoundingBox,
    filters?: ForestFilters
  ): Promise<ForestPlot[]>;
  
  calculateAreaStats(
    geometry: GeoJSON.Geometry
  ): Promise<AreaStatistics>;
  
  findIntersectingPlots(
    geometry: GeoJSON.Geometry
  ): Promise<ForestPlot[]>;
}`}</pre>
                </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h5 className="font-medium text-blue-700 mb-2">Key Interface Benefits</h5>
                <ul className="space-y-1 text-xs text-blue-600">
                    <li className="flex items-start gap-2">
                        <CheckCircle size={14} className="mt-0.5 shrink-0" />
                        <span>Strong typing for all spatial operations</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <CheckCircle size={14} className="mt-0.5 shrink-0" />
                        <span>Clear contract between service layers</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <CheckCircle size={14} className="mt-0.5 shrink-0" />
                        <span>Easy to mock for testing</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <CheckCircle size={14} className="mt-0.5 shrink-0" />
                        <span>Enables service swapping</span>
                    </li>
                </ul>
            </div>
        </div>
    );

    const renderClient = () => (
        <div className="space-y-4">
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <Layers size={18} />
                    GeospatialServiceClient Implementation
                </h4>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                    <pre>{`@Injectable()
export class GeospatialServiceClient 
  implements IGeospatialService {
  
  constructor(
    @Inject(GEOSPATIAL_SERVICE)
    private service: GeospatialService
  ) {}

  async analyzeSpatialIntersection(
    geometry: GeoJSON.Geometry
  ): Promise<AnalysisResults> {
    return this.service.analyzeSpatialIntersection(geometry);
  }

  // ... other interface methods
}`}</pre>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <h5 className="font-medium text-purple-700 text-sm mb-2">Abstraction Layer</h5>
                    <p className="text-xs text-purple-600">Provides clean boundary between business logic and spatial operations</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                    <h5 className="font-medium text-indigo-700 text-sm mb-2">Dependency Injection</h5>
                    <p className="text-xs text-indigo-600">NestJS DI container manages service lifecycle</p>
                </div>
            </div>
        </div>
    );

    const renderComparison = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                {/* Before */}
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                        <AlertCircle size={18} />
                        Before (Tightly Coupled)
                    </h4>
                    <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono mb-3">
                        <pre>{`// PolygonService directly
// handles spatial queries
class PolygonService {
  async analyzePolygon(geometry) {
    // Direct PostGIS queries
    const plots = await this.connection
      .createQueryBuilder(ForestPlot, 'plot')
      .where('ST_Intersects(plot.geometry, :geometry)', 
             { geometry })
      .getMany();
    
    // Direct turf.js calculations
    const area = turf.area(geometry);
    
    return { plots, area };
  }
}`}</pre>
                    </div>
                    <div className="space-y-1">
                        <div className="text-xs text-red-600 font-medium">Issues:</div>
                        <ul className="space-y-1 text-xs text-red-600">
                            <li>• Direct database coupling</li>
                            <li>• Hard to test</li>
                            <li>• No service boundary</li>
                            <li>• Difficult to extract</li>
                        </ul>
                    </div>
                </div>

                {/* After */}
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                        <CheckCircle size={18} />
                        After (Service Boundary)
                    </h4>
                    <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono mb-3">
                        <pre>{`// PolygonService uses
// service client
class PolygonService {
  constructor(
    private geoClient: GeospatialServiceClient
  ) {}

  async analyzePolygon(geometry) {
    // Clean service call
    const results = await this.geoClient
      .analyzeSpatialIntersection(geometry);
    
    return results;
  }
}`}</pre>
                    </div>
                    <div className="space-y-1">
                        <div className="text-xs text-green-600 font-medium">Benefits:</div>
                        <ul className="space-y-1 text-xs text-green-600">
                            <li>• Clean separation</li>
                            <li>• Easy to test</li>
                            <li>• Clear service boundary</li>
                            <li>• Ready for extraction</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h5 className="font-medium text-amber-700 mb-2">Microservice Extraction Path</h5>
                <div className="text-xs text-amber-600 space-y-1">
                    <p>1. <strong>Current State:</strong> Service-ready boundary with GeospatialServiceClient</p>
                    <p>2. <strong>Next Step:</strong> Replace GeospatialService with HTTP client</p>
                    <p>3. <strong>Final State:</strong> Independent microservice with same interface</p>
                </div>
            </div>
        </div>
    );

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Network },
        { id: 'interface', label: 'Interface', icon: Code },
        { id: 'client', label: 'Client', icon: Layers },
        { id: 'comparison', label: 'Before/After', icon: ArrowRight }
    ] as const;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 bg-[#0b4a59] text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Network size={20} />
                        <h3 className="font-semibold text-lg">Service Architecture Demo</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="hover:bg-white/20 rounded p-1 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                                    activeTab === tab.id
                                        ? 'text-[#0b4a59] border-b-2 border-[#0b4a59] bg-white'
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'interface' && renderInterface()}
                    {activeTab === 'client' && renderClient()}
                    {activeTab === 'comparison' && renderComparison()}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="flex-1 px-3 py-2 text-gray-700 bg-white hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium border border-gray-300"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => setActiveTab('comparison')}
                            className="flex-1 px-3 py-2 text-white bg-[#0b4a59] hover:bg-[#083d48] rounded-lg transition-colors text-sm font-medium"
                        >
                            View Before/After
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
