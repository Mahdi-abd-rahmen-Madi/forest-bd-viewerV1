'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { FOREST_REGIONS, getRegionCoverageGeoJSON } from '@/utils/forestCoverageGeometry';

interface ForestCoverageOverlayProps {
    visible: boolean;
    onClose: () => void;
    onNavigateToRegion?: (regionCode: string) => void;
}

export function ForestCoverageOverlay({ visible, onClose, onNavigateToRegion }: ForestCoverageOverlayProps) {
    const [expandedRegion, setExpandedRegion] = useState<string | null>(null);

    if (!visible) return null;

    const handleRegionClick = (regionCode: string) => {
        if (expandedRegion === regionCode) {
            setExpandedRegion(null);
        } else {
            setExpandedRegion(regionCode);
        }
    };

    const handleNavigateToRegion = (regionCode: string) => {
        if (onNavigateToRegion) {
            onNavigateToRegion(regionCode);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 bg-[#0b4a59] text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MapPin size={20} />
                        <h3 className="font-semibold text-lg">Forest Data Coverage</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="hover:bg-white/20 rounded p-1 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    {/* Main Info */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center gap-2 text-blue-700 mb-2">
                            <Info size={16} />
                            <span className="text-sm font-medium">Forest Analysis Available Regions</span>
                        </div>
                        <p className="text-xs text-blue-600 leading-relaxed">
                            Forest cover and species analysis is available for 13 departments across 4 regions in France 
                            with complete BD FORET data integration. Click on any region below to navigate there.
                        </p>
                        <div className="mt-3 text-xs text-blue-700 font-medium">
                            Total Coverage: 130,549 forest plots
                        </div>
                    </div>

                    {/* Regions List */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700">Available Regions:</h4>
                        
                        {FOREST_REGIONS.map((region) => (
                            <div key={region.code} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                {/* Region Header */}
                                <button
                                    onClick={() => handleRegionClick(region.code)}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        <div className="text-left">
                                            <div className="text-sm font-medium text-gray-800">{region.name}</div>
                                            <div className="text-xs text-gray-500">{region.departments.length} departments</div>
                                        </div>
                                    </div>
                                    {expandedRegion === region.code ? (
                                        <ChevronUp size={16} className="text-gray-400" />
                                    ) : (
                                        <ChevronDown size={16} className="text-gray-400" />
                                    )}
                                </button>

                                {/* Expanded Region Details */}
                                {expandedRegion === region.code && (
                                    <div className="px-4 pb-3 pt-0 border-t border-gray-200">
                                        <div className="pt-3 space-y-2">
                                            {/* Departments */}
                                            <div className="text-xs text-gray-600">
                                                <span className="font-medium">Departments:</span> {region.departments.join(', ')}
                                            </div>
                                            
                                            {/* Coverage Bounds */}
                                            <div className="text-xs text-gray-600">
                                                <span className="font-medium">Coverage Area:</span>
                                                <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                                                    <div>Longitude: {region.bounds.minLng}° to {region.bounds.maxLng}°E</div>
                                                    <div>Latitude: {region.bounds.minLat}° to {region.bounds.maxLat}°N</div>
                                                </div>
                                            </div>

                                            {/* Navigate Button */}
                                            {onNavigateToRegion && (
                                                <button
                                                    onClick={() => handleNavigateToRegion(region.code)}
                                                    className="mt-3 w-full px-3 py-2 text-white bg-[#0b4a59] hover:bg-[#083d48] rounded-lg transition-colors text-xs font-medium flex items-center justify-center gap-2"
                                                >
                                                    <MapPin size={14} />
                                                    Navigate to {region.name}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Testing Instructions */}
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                        <h4 className="text-sm font-medium text-amber-700 mb-2">How to Test:</h4>
                        <ol className="text-xs text-amber-600 space-y-1 list-decimal list-inside">
                            <li>Navigate to any of the 4 available regions</li>
                            <li>Draw polygons where you see green forest areas</li>
                            <li>Save the polygon to get forest analysis results</li>
                            <li>Check species distribution and coverage percentage</li>
                            <li>Try different regions to compare forest types</li>
                        </ol>
                    </div>
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
                        {onNavigateToRegion && (
                            <button
                                onClick={() => handleNavigateToRegion('NORMANDIE')}
                                className="flex-1 px-3 py-2 text-white bg-[#0b4a59] hover:bg-[#083d48] rounded-lg transition-colors text-sm font-medium"
                            >
                                Explore First Region
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
