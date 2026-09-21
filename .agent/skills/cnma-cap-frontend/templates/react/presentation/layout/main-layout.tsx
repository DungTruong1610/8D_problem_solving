/* ================================================================
   MainLayout — Responsive Branded Sidebar
   ================================================================
   Customization:
   - Replace {{APP_TITLE}} with your app name
   - Edit NAV_ITEMS array to add/remove navigation items
   - Edit section headers ("MONITORING", "MANAGEMENT") as needed
   - Icons: import from 'lucide-react' — see https://lucide.dev/icons
   ================================================================ */

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    Menu,
    X,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    children: React.ReactNode;
}

/**
 * Navigation items configuration.
 * Add new items here — they will appear in the sidebar automatically.
 * 
 * @property path  — Route path (must match your <Route> definitions)
 * @property icon  — Lucide icon component
 * @property text  — Display text
 * @property end   — If true, only matches exact path (use for "/" root)
 */
const NAV_ITEMS = [
    { path: '/', icon: LayoutDashboard, text: 'Dashboard', end: true },
    // Add more items as needed:
    // { path: '/settings', icon: Settings, text: 'Settings' },
];

export function MainLayout({ children }: Props) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Close mobile sidebar on resize to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="h-screen bg-background flex flex-col font-sans overflow-hidden">
            {/* Desktop: Red brand line */}
            <div className="hidden md:block h-1 bg-brand w-full shrink-0 z-30" />

            {/* Mobile: Header with hamburger */}
            <header className="bg-white border-b-4 border-brand h-14 px-4 flex md:hidden items-center justify-between shadow-sm z-30 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-text-secondary"
                        aria-label="Toggle sidebar"
                    >
                        {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <span className="text-base font-bold text-text-primary tracking-tight truncate">
                        {{APP_TITLE}}
                    </span>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile: Backdrop overlay */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/40 z-40 md:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                        aria-hidden="true"
                    />
                )}

                {/* Sidebar */}
                <aside
                    className={cn(
                        'bg-white border-r border-border-custom flex flex-col shrink-0',
                        'transition-all duration-300 ease-in-out',
                        'absolute md:relative h-full z-50',
                        isCollapsed ? 'w-60 md:w-16' : 'w-60 md:w-56 lg:w-64',
                        isSidebarOpen
                            ? 'translate-x-0'
                            : '-translate-x-full md:translate-x-0'
                    )}
                >
                    <nav
                        className="p-3 md:p-4 space-y-1 overflow-y-auto flex-1 overflow-x-hidden"
                        onClick={() => {
                            if (window.innerWidth < 768) setIsSidebarOpen(false);
                        }}
                    >
                        {NAV_ITEMS.map((item) => (
                            <SidebarNavItem
                                key={item.path}
                                {...item}
                                isCollapsed={isCollapsed}
                            />
                        ))}
                    </nav>

                    {/* Collapse toggle (desktop only) */}
                    <div className="p-3 border-t border-border-custom mt-auto hidden md:flex items-center justify-center shrink-0">
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="w-full flex items-center justify-center p-2 hover:bg-slate-100 rounded-md text-text-secondary transition-colors"
                            title={isCollapsed ? 'Expand' : 'Collapse'}
                        >
                            {isCollapsed ? (
                                <ChevronRight size={18} className="shrink-0" />
                            ) : (
                                <ChevronLeft size={18} className="shrink-0" />
                            )}
                            <span
                                className={cn(
                                    'ml-2 text-sm font-medium',
                                    isCollapsed ? 'hidden' : 'block'
                                )}
                            >
                                Collapse
                            </span>
                        </button>
                    </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 overflow-y-auto bg-background p-3 md:p-4 lg:p-6 min-w-0">
                    <div className="w-full max-w-full">{children}</div>
                </main>
            </div>
        </div>
    );
}

/* ── Sidebar Nav Item ── */
interface SidebarNavItemProps {
    path: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    text: string;
    end?: boolean;
    isCollapsed: boolean;
}

function SidebarNavItem({
    path,
    icon: Icon,
    text,
    end,
    isCollapsed,
}: SidebarNavItemProps) {
    return (
        <NavLink
            to={path}
            end={end}
            className={({ isActive }) =>
                cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm md:text-base font-medium',
                    isActive
                        ? 'bg-red-50 text-brand'
                        : 'text-text-secondary hover:bg-slate-50 hover:text-text-primary',
                    isCollapsed ? 'md:justify-center md:px-2' : 'md:px-4'
                )
            }
            title={isCollapsed ? text : undefined}
        >
            <Icon size={18} className="shrink-0" />
            <span className={cn('truncate', isCollapsed && 'md:hidden')}>
                {text}
            </span>
        </NavLink>
    );
}
