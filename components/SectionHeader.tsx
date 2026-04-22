import React from 'react';

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, children }) => {
    return (
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 mb-16 animate-in relative z-20 w-full">
            <div className="flex items-start gap-6">
                <div className="w-1.5 h-16 bg-gradient-to-b from-cyan to-blue-600 rounded-full hidden lg:block shadow-glow" />
                <div className="space-y-2">
                    <h1 className="text-h1-premium uppercase">{title}</h1>
                    {subtitle && <p className="text-subtitle-italic max-w-2xl">{subtitle}</p>}
                </div>
            </div>
            {children && (
                <div className="flex flex-wrap items-center gap-4">
                    {children}
                </div>
            )}
        </div>
    );
};

export default SectionHeader;
