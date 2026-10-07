import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@cnma/react-ui';
import { TOUR_STEPS } from './guide-data';

export function GuideTour({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const navigate = useNavigate();
    const [index, setIndex] = useState(0);
    const step = TOUR_STEPS[index];
    const isLast = index === TOUR_STEPS.length - 1;

    const close = () => {
        onOpenChange(false);
        setIndex(0);
    };

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <p className="text-xs font-medium text-primary">Step {index + 1} of {TOUR_STEPS.length}</p>
                    <DialogTitle>{step.title}</DialogTitle>
                    <DialogDescription>{step.description}</DialogDescription>
                </DialogHeader>

                {/* Step dots double as navigation */}
                <div className="flex gap-1.5">
                    {TOUR_STEPS.map((s, i) => (
                        <button
                            key={s.title}
                            type="button"
                            aria-label={`Go to step ${i + 1}`}
                            onClick={() => setIndex(i)}
                            className={`h-1.5 flex-1 cursor-pointer rounded-full transition-colors ${i <= index ? 'bg-primary' : 'bg-muted'}`}
                        />
                    ))}
                </div>

                <ol className="space-y-2 text-sm text-muted-foreground">
                    {step.actions.map((action, i) => (
                        <li key={action} className="flex items-start gap-2.5">
                            <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                                {i + 1}
                            </span>
                            <span>{action}</span>
                        </li>
                    ))}
                </ol>

                <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => { close(); navigate(step.route); }}
                    >
                        Go to this page
                        <ArrowRight className="size-3.5" />
                    </Button>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                            Back
                        </Button>
                        <Button type="button" size="sm" onClick={() => (isLast ? close() : setIndex(index + 1))}>
                            {isLast ? 'Finish' : 'Next'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
