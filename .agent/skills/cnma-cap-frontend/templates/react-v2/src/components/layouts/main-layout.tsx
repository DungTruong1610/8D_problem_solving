import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    Menu,
    ChevronLeft,
    ChevronRight,
    X,
    LogOut,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, cn } from '@cnma/react-ui';
import type { LucideIcon } from 'lucide-react';

// ── Nav config ────────────────────────────────────────────────────────────────

interface NavLeaf {
    type: 'leaf';
    to: string;
    icon: LucideIcon;
    label: string;
    adminOnly?: boolean;
}

interface NavGroup {
    type: 'group';
    icon: LucideIcon;
    label: string;
    adminOnly?: boolean;
    children: NavEntry[];
}

type NavEntry = NavLeaf | NavGroup;

/**
 * Build the navigation tree.
 * ★ Replace entries here to match your application's pages.
 */
function useNavTree(): NavEntry[] {
    const { t } = useTranslation();
    return [
        { type: 'leaf', to: '/', icon: LayoutDashboard, label: t('nav.home') },
        { type: 'leaf', to: '/settings', icon: Settings, label: t('nav.settings'), adminOnly: true },

        /*
         * Example group:
         * {
         *   type: 'group', icon: BarChart3, label: 'Analytics',
         *   children: [
         *     { type: 'leaf', to: '/analytics/overview', icon: TrendingUp, label: 'Overview' },
         *   ],
         * },
         */
    ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isGroupActive(entry: NavEntry, pathname: string): boolean {
    if (entry.type === 'leaf') {
        return entry.to === pathname || (entry.to !== '/' && pathname.startsWith(entry.to));
    }
    return entry.children.some((child) => isGroupActive(child, pathname));
}

// ── Leaf item ─────────────────────────────────────────────────────────────────

function NavLeafItem({
    to, icon: Icon, label, isCollapsed, depth = 0, onClick,
}: {
    to: string; icon: LucideIcon; label: string; isCollapsed: boolean; depth?: number; onClick?: () => void;
}) {
    const { pathname } = useLocation();
    const isActive = to === pathname || (to !== '/' && pathname.startsWith(to));

    return (
        <Link
            to={to}
            onClick={onClick}
            title={isCollapsed ? label : undefined}
            className={cn(
                'flex items-center gap-2.5 py-1.5 rounded-lg transition-all duration-200 text-sm group',
                isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isCollapsed ? 'justify-center px-2' : 'px-3',
            )}
            style={!isCollapsed ? { paddingLeft: `${12 + depth * 12}px` } : undefined}
        >
            <Icon
                size={depth > 0 ? 16 : 18}
                className={cn(
                    'shrink-0 transition-colors',
                    isActive
                        ? 'text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground group-hover:text-sidebar-accent-foreground',
                )}
            />
            {!isCollapsed && (
                <span className="font-medium whitespace-nowrap overflow-hidden truncate">{label}</span>
            )}
        </Link>
    );
}

// ── Group item ────────────────────────────────────────────────────────────────

import { ChevronDown } from 'lucide-react';

function NavGroupItem({ entry, isCollapsed, depth = 0, onLeafClick }: {
    entry: NavGroup; isCollapsed: boolean; depth?: number; onLeafClick?: () => void;
}) {
    const { pathname } = useLocation();
    const hasActiveChild = isGroupActive(entry, pathname);
    const [isOpen, setIsOpen] = useState(hasActiveChild);
    const Icon = entry.icon;

    React.useEffect(() => {
        if (hasActiveChild && !isOpen) setIsOpen(true);
    }, [hasActiveChild]);

    if (isCollapsed) return null;

    return (
        <div>
            <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen((prev) => !prev); }}
                className={cn(
                    'w-full flex items-center gap-2.5 py-1.5 rounded-lg transition-all duration-200 text-sm cursor-pointer',
                    hasActiveChild
                        ? 'text-sidebar-foreground font-semibold'
                        : 'text-sidebar-foreground font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
                style={{ paddingLeft: `${12 + depth * 12}px`, paddingRight: '12px' }}
            >
                <Icon size={depth > 0 ? 16 : 18} className="shrink-0 text-sidebar-foreground" />
                <span className="flex-1 text-left whitespace-nowrap overflow-hidden truncate">{entry.label}</span>
                <ChevronDown
                    size={14}
                    className={cn('shrink-0 transition-transform duration-200', isOpen ? '' : '-rotate-90')}
                />
            </button>

            {isOpen && (
                <div className="space-y-0.5 mt-0.5">
                    {entry.children.map((child, idx) =>
                        child.type === 'leaf' ? (
                            <NavLeafItem
                                key={child.to}
                                {...child}
                                isCollapsed={false}
                                depth={depth + 1}
                                onClick={onLeafClick}
                            />
                        ) : (
                            <NavGroupItem
                                key={idx}
                                entry={child as NavGroup}
                                isCollapsed={false}
                                depth={depth + 1}
                                onLeafClick={onLeafClick}
                            />
                        ),
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Layout ───────────────────────────────────────────────────────────────

export function MainLayout() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const { t } = useTranslation();

    // When app is embedded in BTP Workzone, the shell provides its own chrome
    const isInWorkZone = typeof window !== 'undefined' && window.parent !== window;

    const navTree = useNavTree();

    return (
        <div className="h-screen overflow-hidden bg-background flex font-sans">
            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 lg:static lg:translate-x-0',
                    isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0',
                    isCollapsed ? 'lg:w-16' : 'lg:w-72',
                )}
            >
                {/* Logo / Brand — hidden inside WorkZone (shell provides header) */}
                {!isInWorkZone && (
                    <div className={cn('p-4 flex items-center', isCollapsed ? 'justify-center' : 'justify-between')}>
                        {!isCollapsed && (
                            <div className="flex items-center gap-2 overflow-hidden">
                                <img src="./proconarum-logo.png" alt="Proconarum" className="h-6 object-contain" />
                                <span className="text-sm font-bold tracking-wide text-sidebar-foreground">
                                    {t('app.title')}
                                </span>
                            </div>
                        )}
                        {isCollapsed && (
                            <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden">
                                <img src="./proconarum-logo.png" alt="Logo" className="w-full h-full object-contain" />
                            </div>
                        )}

                        {/* Mobile close */}
                        <button
                            onClick={() => setIsMobileOpen(false)}
                            className="lg:hidden text-sidebar-foreground p-1 hover:bg-sidebar-accent rounded-md"
                        >
                            <X size={20} />
                        </button>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
                    {navTree.map((entry, idx) =>
                        entry.type === 'leaf' ? (
                            <NavLeafItem
                                key={entry.to}
                                {...entry}
                                isCollapsed={isCollapsed}
                                onClick={() => setIsMobileOpen(false)}
                            />
                        ) : (
                            <NavGroupItem
                                key={idx}
                                entry={entry as NavGroup}
                                isCollapsed={isCollapsed}
                                onLeafClick={() => setIsMobileOpen(false)}
                            />
                        ),
                    )}
                </div>

                {/* User profile — hidden in WorkZone */}
                {!isInWorkZone && (
                    <div className={cn('mt-auto border-t border-sidebar-border p-4', isCollapsed ? 'items-center' : '')}>
                        <div className={cn('flex items-center gap-3', isCollapsed ? 'justify-center' : '')}>
                            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-sidebar-accent-foreground shrink-0 border border-sidebar-border">
                                U
                            </div>
                            {!isCollapsed && (
                                <div className="overflow-hidden flex-1">
                                    <p className="text-sm font-medium text-sidebar-foreground truncate">{t('nav.user')}</p>
                                </div>
                            )}
                            <button
                                onClick={() => { window.location.href = '/do/logout'; }}
                                className={cn(
                                    'p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors',
                                    isCollapsed ? 'mt-2' : '',
                                )}
                                title={t('nav.logOut')}
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Desktop collapse toggle */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-20 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-sidebar-accent"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </aside>

            {/* Main content */}
            <main id="main-scroll-container" className="flex-1 overflow-auto bg-background flex flex-col w-full scroll-smooth">
                {/* Mobile header */}
                <div className="lg:hidden flex items-center p-4 border-b border-border bg-card">
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(true)} className="mr-2">
                        <Menu size={20} />
                    </Button>
                    <h1 className="text-lg font-bold text-foreground">{t('app.title')}</h1>
                </div>

                <div className="flex-1 w-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
