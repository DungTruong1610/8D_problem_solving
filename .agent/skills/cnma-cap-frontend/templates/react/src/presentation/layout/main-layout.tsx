import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, Activity, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface NavItem {
    label: string;
    path: string;
    icon: React.ElementType;
}

interface NavSection {
    title?: string;
    items: NavItem[];
}

/** Default navigation — override by passing `sections` prop */
const DEFAULT_SECTIONS: NavSection[] = [
    {
        title: 'Monitoring',
        items: [
            { label: 'Dashboard', path: '/', icon: LayoutDashboard },
            { label: 'Monitor Logs', path: '/logs', icon: Activity },
        ],
    },
    {
        title: 'Configuration',
        items: [
            { label: 'Settings', path: '/settings', icon: Settings },
        ],
    },
];

interface MainLayoutProps {
    children: React.ReactNode;
    /** App title shown in mobile header */
    appTitle?: string;
    /** Navigation sections — uses default if not provided */
    sections?: NavSection[];
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    appTitle = 'Application',
    sections = DEFAULT_SECTIONS,
}) => {
    const [isOpen, setIsOpen] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="h-screen bg-background flex flex-col font-sans overflow-hidden">
            {/* Desktop: Red brand line */}
            <div className="hidden md:block h-1 bg-brand w-full shrink-0 z-30" />

            {/* Mobile Header */}
            <header className="bg-white border-b-4 border-brand h-14 px-4 flex md:hidden items-center justify-between shadow-sm z-30 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-text-secondary"
                        aria-label="Toggle sidebar"
                    >
                        {isOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <span className="text-base font-bold text-text-primary tracking-tight truncate">
                        {appTitle}
                    </span>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Mobile overlay */}
                {isOpen && (
                    <div
                        className="fixed inset-0 bg-black/30 z-40 md:hidden"
                        onClick={() => setIsOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside
                    className={`
                        bg-white border-r border-border-custom flex flex-col shrink-0 transition-all duration-300 ease-in-out
                        absolute md:relative h-full z-50
                        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                        ${isCollapsed ? 'w-60 md:w-16' : 'w-60 md:w-56 lg:w-64'}
                    `}
                >
                    <nav className="flex-1 overflow-y-auto py-4">
                        {sections.map((section, sIdx) => (
                            <div key={sIdx}>
                                {section.title && !isCollapsed && (
                                    <div className="px-3 md:px-4 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wider mt-4 first:mt-0 mb-2">
                                        {section.title}
                                    </div>
                                )}
                                {section.items.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => setIsOpen(false)}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-3 py-2 mx-2 rounded-md transition-all text-sm md:text-base font-medium ${
                                                isActive
                                                    ? 'bg-red-50 text-brand'
                                                    : 'text-text-secondary hover:bg-slate-50 hover:text-text-primary'
                                            } ${isCollapsed ? 'md:justify-center md:px-0' : ''}`
                                        }
                                    >
                                        <item.icon className="h-5 w-5 shrink-0" />
                                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                                    </NavLink>
                                ))}
                            </div>
                        ))}
                    </nav>

                    {/* Collapse toggle (desktop only) */}
                    <div className="hidden md:flex border-t border-border-custom p-2">
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-slate-50 rounded-md transition-colors"
                        >
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : (
                                <>
                                    <ChevronLeft className="h-4 w-4" />
                                    <span>Collapse</span>
                                </>
                            )}
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto main-content p-3 md:p-4 lg:p-6 min-w-0">
                    <div className="w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
