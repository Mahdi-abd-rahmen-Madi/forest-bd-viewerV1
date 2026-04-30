'use client';

import { useState, useEffect } from 'react';
import { X, MapPin, Info } from 'lucide-react';

interface VosgesCoverageOverlayProps {
    visible: boolean;
    onClose: () => void;
    onNavigateToVosges?: () => void;
}

// Vosges region bounding box where forest data is available
const VOSGES_BOUNDS = {
    minLng: 5.39,
    maxLng: 7.19,
    minLat: 47.81,
    maxLat: 48.51
};

// Center of Vosges region for navigation
const VOSGES_CENTER = {
    lng: 6.29,
    lat: 48.16,
    zoom: 9
};

export function VosgesCoverageOverlay({ visible, onClose, onNavigateToVosges }: VosgesCoverageOverlayProps) {
    const [showDetails, setShowDetails] = useState(false);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
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
                <div className="p-4 space-y-4">
                    {/* Main Info */}
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center gap-2 text-blue-700 mb-2">
                            <Info size={16} />
                            <span className="text-sm font-medium">Forest Analysis Available Region</span>
                        </div>
                        <p className="text-xs text-blue-600 leading-relaxed">
                            Forest cover and species analysis is only available for the Vosges region 
                            in eastern France where we have BD FORET data.
                        </p>
                    </div>

                    {/* Coverage Details */}
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Coverage Area:</h4>
                        <div className="text-xs text-gray-600 space-y-1">
                            <div><strong>Longitude:</strong> {VOSGES_BOUNDS.minLng}° to {VOSGES_BOUNDS.maxLng}°E</div>
                            <div><strong>Latitude:</strong> {VOSGES_BOUNDS.minLat}° to {VOSGES_BOUNDS.maxLat}°N</div>
                            <div><strong>Region:</strong> Vosges, Grand Est, France</div>
                        </div>
                    </div>

                    {/* Toggle Details */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-xs text-[#0b4a59] hover:text-[#083d48] font-medium transition-colors"
                    >
                        {showDetails ? 'Hide' : 'Show'} Testing Instructions
                    </button>

                    {/* Detailed Instructions */}
                    {showDetails && (
                        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                            <h4 className="text-sm font-medium text-amber-700 mb-2">How to Test:</h4>
                            <ol className="text-xs text-amber-600 space-y-1 list-decimal list-inside">
                                <li>Navigate to the Vosges region (eastern France)</li>
                                <li>Draw polygons where you see green forest areas</li>
                                <li>Save the polygon to get forest analysis results</li>
                                <li>Check species distribution and coverage percentage</li>
                            </ol>
                        </div>
                    )}

                    {/* Quick Navigation */}
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
                        >
                            Close
                        </button>
                        {onNavigateToVosges && (
                            <button
                                onClick={() => {
                                    onNavigateToVosges();
                                    onClose();
                                }}
                                className="flex-1 px-3 py-2 text-white bg-[#0b4a59] hover:bg-[#083d48] rounded-lg transition-colors text-sm font-medium"
                            >
                                Navigate to Vosges
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
