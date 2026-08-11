import React from 'react';

const TabLoadingSkeleton = () => {
    return (
        <div className="w-full animate-pulse space-y-8 p-6 lg:p-12">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between mb-12">
                <div className="space-y-3">
                    <div className="h-8 w-64 bg-surface-low rounded-xl" />
                    <div className="h-4 w-48 bg-surface-low/50 rounded-lg" />
                </div>
                <div className="h-12 w-40 bg-primary/10 rounded-full" />
            </div>

            {/* Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-32 bg-white/50 border border-white rounded-[2rem] shadow-sm p-6 space-y-3">
                        <div className="h-3 w-20 bg-surface-low/30 rounded-full" />
                        <div className="h-8 w-24 bg-surface-low rounded-lg" />
                    </div>
                ))}
            </div>

            {/* Main Table/Content Skeleton */}
            <div className="bg-white/50 backdrop-blur-md rounded-[3rem] p-8 border border-white shadow-sm min-h-[400px]">
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex gap-4 items-center border-b border-surface-low/10 pb-4 last:border-0">
                            <div className="w-12 h-12 bg-surface-low/20 rounded-2xl" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-1/3 bg-surface-low rounded-lg" />
                                <div className="h-3 w-1/4 bg-surface-low/50 rounded-lg" />
                            </div>
                            <div className="h-8 w-24 bg-surface-low/20 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TabLoadingSkeleton;
