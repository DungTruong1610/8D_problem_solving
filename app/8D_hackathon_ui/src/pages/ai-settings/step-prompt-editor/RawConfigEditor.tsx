import { Alert, AlertDescription, Textarea } from '@cnma/react-ui';

export function RawConfigEditor({ value, error, onChange }: { value: string; error: string | null; onChange: (value: string) => void }) {
    return <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        {error && <Alert variant="destructive"><AlertDescription className="text-sm">{error}</AlertDescription></Alert>}
        <Textarea className="min-h-0 flex-1 resize-none font-mono text-sm leading-relaxed" value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} />
    </div>;
}
