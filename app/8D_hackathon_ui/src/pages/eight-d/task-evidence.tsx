import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Spinner,
} from '@cnma/react-ui';
import {
    Download,
    ExternalLink,
    Eye,
    FileText,
    Paperclip,
    Trash2,
    UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    deleteTaskEvidence,
    getEvidenceDownloadUrl,
    listTaskEvidence,
    uploadTaskEvidence,
    type TaskEvidenceItem,
} from '@/services/eightd-service';
import type { ActionTask } from '../../../../../shared/action-task';

function formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Dialog hiển thị preview file PDF đính kèm kèm đầy đủ thông tin metadata.
 */
export function PdfPreviewDialog({
    file,
    taskName,
    onClose,
}: {
    file: TaskEvidenceItem | null;
    taskName?: string;
    onClose: () => void;
}) {
    if (!file) return null;
    const downloadUrl = getEvidenceDownloadUrl(file.ID);

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-4xl lg:max-w-5xl h-[88vh] max-h-[92vh] flex flex-col p-5">
                <DialogHeader className="border-b pb-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-base font-semibold truncate" title={file.fileName}>
                                    {file.fileName}
                                </DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                                    <span>{formatFileSize(file.fileSize)}</span>
                                    <span>•</span>
                                    <span>Uploaded by <strong>{file.uploadedBy || 'User'}</strong></span>
                                    <span>•</span>
                                    <span>{file.uploadedAt ? new Date(file.uploadedAt).toLocaleString('en-GB') : '—'}</span>
                                    {file.disciplineCode && (
                                        <>
                                            <span>•</span>
                                            <span className="font-medium text-foreground">{file.disciplineCode}</span>
                                        </>
                                    )}
                                    {taskName && (
                                        <>
                                            <span>•</span>
                                            <span className="truncate max-w-xs text-foreground/90 font-medium" title={taskName}>
                                                Task: {taskName}
                                            </span>
                                        </>
                                    )}
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <a
                                href={downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open in Tab
                            </a>
                            <a
                                href={downloadUrl}
                                download={file.fileName}
                                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-3 text-sm font-medium transition-colors"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Download
                            </a>
                        </div>
                    </div>
                </DialogHeader>

                <div className="relative flex-1 min-h-0 pt-3">
                    <iframe
                        src={`${downloadUrl}#toolbar=1&navpanes=0`}
                        title={file.fileName}
                        className="h-full w-full rounded-lg border bg-muted/20"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Section upload / list completion evidence for a specific task inside TaskDetail dialog.
 */
export function TaskEvidenceSection({
    reportID,
    disciplineCode,
    task,
    readOnly = false,
    onEvidenceUploaded,
}: {
    reportID: string;
    disciplineCode: string;
    task: ActionTask;
    readOnly?: boolean;
    onEvidenceUploaded?: () => void;
}) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [clientError, setClientError] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<TaskEvidenceItem | null>(null);

    const { data: allEvidences = [], isLoading } = useQuery({
        queryKey: ['8d', 'evidence', reportID],
        queryFn: () => listTaskEvidence(reportID),
        enabled: Boolean(reportID),
    });

    const taskEvidences = allEvidences.filter(
        (e) => e.disciplineCode === disciplineCode && e.taskId === task.id,
    );

    const uploadMutation = useMutation({
        mutationFn: (file: File) =>
            uploadTaskEvidence({
                reportID,
                disciplineCode,
                taskId: task.id,
                file,
            }),
        onSuccess: (created) => {
            setClientError(null);
            toast.success(`Evidence uploaded: ${created.fileName}`);
            void queryClient.invalidateQueries({ queryKey: ['8d', 'evidence', reportID] });
            onEvidenceUploaded?.();
        },
        onError: (e: any) => {
            toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Could not upload evidence.');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (evidenceID: string) => deleteTaskEvidence(evidenceID),
        onSuccess: () => {
            toast.success('Evidence removed.');
            void queryClient.invalidateQueries({ queryKey: ['8d', 'evidence', reportID] });
        },
        onError: (e: any) => {
            toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Could not remove evidence.');
        },
    });

    const isBusy = uploadMutation.isPending || deleteMutation.isPending;
    const statusLower = String(task.status || '').trim().toLowerCase();
    const isActionDiscipline = disciplineCode === 'D3' || disciplineCode === 'D5' || disciplineCode === 'D7';
    const canUpload = isActionDiscipline
        ? (statusLower === 'open' || statusLower === 'done')
        : (statusLower === 'done' || statusLower === 'in progress');

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setClientError(null);

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            setClientError('Only PDF files are allowed.');
            return;
        }

        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            const actualMb = (file.size / (1024 * 1024)).toFixed(2);
            setClientError(`File size exceeds 10 MB limit (actual: ${actualMb} MB).`);
            return;
        }

        uploadMutation.mutate(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-2 rounded-lg border bg-muted/10 p-3.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                    <Paperclip className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span>Completion Evidence</span>
                </div>
                {taskEvidences.length > 0 && (
                    <span className="text-sm font-medium text-success">
                        {taskEvidences.length} {taskEvidences.length === 1 ? 'PDF' : 'PDFs'} attached
                    </span>
                )}
            </div>

            {/* List existing files */}
            {taskEvidences.length > 0 && (
                <div className="space-y-2">
                    {taskEvidences.map((file) => (
                        <div
                            key={file.ID}
                            className="flex items-center justify-between gap-3 rounded-lg border bg-card p-2.5 shadow-2xs hover:bg-muted/20 transition-colors"
                        >
                            <div className="flex min-w-0 items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFile(file)}
                                            className="max-w-[200px] sm:max-w-[280px] md:max-w-[380px] truncate text-sm font-semibold text-foreground hover:text-primary hover:underline transition-colors text-left cursor-pointer"
                                            title={`Click to preview ${file.fileName}`}
                                        >
                                            {file.fileName}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFile(file)}
                                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                            title="Preview PDF"
                                            aria-label="Preview PDF"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {formatFileSize(file.fileSize)} · by {file.uploadedBy || 'User'} ·{' '}
                                        {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString('en-GB') : '—'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                                <a
                                    href={getEvidenceDownloadUrl(file.ID)}
                                    download={file.fileName}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 items-center gap-1 rounded border border-border bg-background px-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                </a>
                                {!readOnly && (
                                    <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => deleteMutation.mutate(file.ID)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50 cursor-pointer"
                                        title="Remove evidence"
                                        aria-label="Remove evidence"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!canUpload && taskEvidences.length === 0 && (
                <p className="text-sm italic text-muted-foreground">
                    {isActionDiscipline
                        ? 'Upload becomes available once this task is published (Open).'
                        : 'Upload becomes available once this task is marked Done.'}
                </p>
            )}

            {/* Upload Box */}
            {!readOnly && canUpload && (
                <div className="rounded-lg border border-dashed border-border/80 bg-background/50 p-4 text-center">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileSelected}
                        className="hidden"
                        disabled={isBusy}
                    />
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                        <UploadCloud className="h-6 w-6 text-muted-foreground" />
                        <div className="space-y-0.5">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => fileInputRef.current?.click()}
                                className="h-8 text-sm gap-1.5"
                            >
                                {isBusy ? <Spinner className="h-3.5 w-3.5" /> : <UploadCloud className="h-3.5 w-3.5" />}
                                Upload evidence (PDF)
                            </Button>
                            <p className="text-sm text-muted-foreground">
                                PDF only, max 10 MB.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {clientError && (
                <p className="text-sm font-medium text-destructive">{clientError}</p>
            )}

            {isLoading && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Spinner className="h-3.5 w-3.5" />
                    Loading evidence...
                </div>
            )}

            {/* Popup preview file PDF */}
            <PdfPreviewDialog
                file={previewFile}
                taskName={task.name}
                onClose={() => setPreviewFile(null)}
            />
        </div>
    );
}

const STEP_LABELS: Record<string, string> = {
    D3: 'D3 · Containment Actions',
    D5: 'D5 · Corrective Actions',
    D7: 'D7 · Preventive Actions',
};

/**
 * Archive panel displaying all task completion evidences grouped by discipline code (D3, D5, D7...).
 */
export function EvidenceArchivePanel({ reportID }: { reportID: string }) {
    const [previewFile, setPreviewFile] = useState<TaskEvidenceItem | null>(null);

    const { data: evidences = [], isLoading } = useQuery({
        queryKey: ['8d', 'evidence', reportID],
        queryFn: () => listTaskEvidence(reportID),
        enabled: Boolean(reportID),
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground space-y-2">
                <Spinner className="h-5 w-5 text-primary" />
                <p>Loading completion evidence...</p>
            </div>
        );
    }

    if (evidences.length === 0) {
        return (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No completion evidence submitted yet.
            </div>
        );
    }

    // Group by disciplineCode
    const groups = new Map<string, TaskEvidenceItem[]>();
    for (const item of evidences) {
        const list = groups.get(item.disciplineCode) || [];
        list.push(item);
        groups.set(item.disciplineCode, list);
    }

    const sortedCodes = Array.from(groups.keys()).sort();

    return (
        <div className="space-y-4">
            {sortedCodes.map((code) => {
                const items = groups.get(code) || [];
                const label = STEP_LABELS[code] || `${code} Actions`;

                return (
                    <div key={code} className="space-y-2.5 rounded-lg border bg-card p-3 shadow-2xs">
                        <div className="flex items-center justify-between border-b pb-1.5">
                            <h4 className="text-base font-bold uppercase tracking-wider text-foreground">
                                {label}
                            </h4>
                            <span className="text-sm font-medium text-muted-foreground">
                                {items.length} file{items.length > 1 ? 's' : ''}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {items.map((file) => (
                                <div
                                    key={file.ID}
                                    className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-2.5 text-sm hover:bg-muted/30 transition-colors"
                                >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-destructive/10 text-destructive">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewFile(file)}
                                                    className="max-w-[160px] sm:max-w-[200px] truncate text-sm font-semibold text-foreground hover:text-primary hover:underline transition-colors text-left cursor-pointer"
                                                    title={`Click to preview ${file.fileName}`}
                                                >
                                                    {file.fileName}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewFile(file)}
                                                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                                    title="Preview PDF"
                                                    aria-label="Preview PDF"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Task: <strong className="font-medium text-foreground">{file.taskId}</strong> ·{' '}
                                                {formatFileSize(file.fileSize)} · by {file.uploadedBy || 'User'} ·{' '}
                                                {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString('en-GB') : '—'}
                                            </p>
                                        </div>
                                    </div>

                                    <a
                                        href={getEvidenceDownloadUrl(file.ID)}
                                        download={file.fileName}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-border bg-background px-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Popup preview file PDF */}
            <PdfPreviewDialog
                file={previewFile}
                taskName={previewFile?.taskId}
                onClose={() => setPreviewFile(null)}
            />
        </div>
    );
}
