import React from 'react';
import { Button } from '@cnma/react-ui';
import { ChevronLeft } from 'lucide-react';

interface SidebarToggleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isCollapsed?: boolean;
}

export const SidebarToggleButton: React.FC<SidebarToggleButtonProps> = ({ 
    isCollapsed, 
    className = "", 
    ...props 
}) => {
    return (
        <Button 
            type="button"
            variant="outline"
            size="icon"
            className={`absolute -right-3 top-20 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-sidebar-accent ${className}`}
            {...props}
        >
            <ChevronLeft className={`h-3.5 w-3.5 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
        </Button>
    );
};
