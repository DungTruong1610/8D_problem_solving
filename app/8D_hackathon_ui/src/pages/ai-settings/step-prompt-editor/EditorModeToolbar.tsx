import type { ReactNode } from 'react';
import { Button } from '@cnma/react-ui';
import { Code, LayoutList } from 'lucide-react';

interface EditorModeToolbarProps {
    mode: 'form' | 'json';
    onVisual: () => void;
    onJson: () => void;
    actions?: ReactNode;
}

export function EditorModeToolbar({ mode, onVisual, onJson, actions }: EditorModeToolbarProps) {
    return <div className="mb-4 flex shrink-0 items-center justify-between rounded-lg border bg-card p-2">
        <div className="flex gap-2">
            <Button size="sm" variant={mode === 'form' ? 'secondary' : 'ghost'} onClick={onVisual} className="h-9 text-sm font-medium gap-1.5"><LayoutList className="h-4 w-4" /> Visual Editor</Button>
            <Button size="sm" variant={mode === 'json' ? 'secondary' : 'ghost'} onClick={onJson} className="h-9 text-sm font-medium gap-1.5"><Code className="h-4 w-4" /> JSON Source</Button>
        </div>
        {actions}
    </div>;
}
