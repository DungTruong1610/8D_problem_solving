import React, { useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/presentation/components/ui/popover';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Checkbox } from '@/presentation/components/ui/checkbox';
import { ChevronDown, Star, Trash2, Save } from 'lucide-react';
import type { Variant } from '@/domain/entities/Variant';
import { useTranslation } from 'react-i18next';

interface VariantManagementProps {
    variants: Variant[];
    currentVariantKey: string;
    onSelectVariant: (variant: Variant | null) => void; // null = standard
    onSaveVariant: (name: string, isDefault: boolean, isOverwrite: boolean) => void;
    onDeleteVariant: (id: string) => void;
    onSetDefault: (variant: Variant | null) => void; // null = clear default
}

export const VariantManagement: React.FC<VariantManagementProps> = ({
    variants,
    currentVariantKey,
    onSelectVariant,
    onSaveVariant,
    onDeleteVariant,
    onSetDefault,
}) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
    const [newVariantName, setNewVariantName] = useState('');
    const [isDefault, setIsDefault] = useState(false);

    // Find the current variant name for display
    const currentVariant = variants.find(v => v.variantKey === currentVariantKey);
    const { t } = useTranslation();
    const displayName = currentVariant?.variantName || t('variant.standard');

    const handleSelectStandard = () => {
        onSelectVariant(null);
        setIsPopoverOpen(false);
    };

    const handleSelectVariant = (variant: Variant) => {
        onSelectVariant(variant);
        setIsPopoverOpen(false);
    };

    const handleSave = () => {
        if (newVariantName.trim()) {
            onSaveVariant(newVariantName.trim(), isDefault, false);
            setNewVariantName('');
            setIsDefault(false);
            setIsSaveDialogOpen(false);
        }
    };

    const handleOverwrite = () => {
        if (currentVariant) {
            onSaveVariant(currentVariant.variantName, isDefault, true);
            setIsSaveDialogOpen(false);
        }
    };

    return (
        <>
            {/* Variant Trigger */}
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 text-base font-semibold h-auto py-1 px-2">
                        {displayName}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 bg-white" align="start">
                    <div className="p-3 border-b">
                        <h4 className="font-semibold text-sm">{t('variant.myViews')}</h4>
                    </div>

                    {/* Variant List */}
                    <div className="min-h-[200px] max-h-[300px] overflow-y-auto">
                        {/* Standard Variant */}
                        <button
                            className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center justify-between ${!currentVariantKey ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                                }`}
                            onClick={handleSelectStandard}
                        >
                            <span>{t('variant.standard')}</span>
                        </button>

                        {/* User Variants */}
                        {variants.map((variant) => (
                            <button
                                key={variant.ID}
                                className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center justify-between ${variant.variantKey === currentVariantKey ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                                    }`}
                                onClick={() => handleSelectVariant(variant)}
                            >
                                <span>{variant.variantName}</span>
                                {variant.isDefaultVariant && (
                                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="border-t p-2 flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                                setIsSaveDialogOpen(true);
                                setIsPopoverOpen(false);
                            }}
                        >
                            <Save className="h-3 w-3 mr-1" />
                            {t('variant.saveAs')}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                                setIsManageDialogOpen(true);
                                setIsPopoverOpen(false);
                            }}
                        >
                            {t('variant.manage')}
                        </Button>
                        {currentVariant && (
                            <Button
                                size="sm"
                                variant="default"
                                onClick={handleOverwrite}
                            >
                                <Save className="h-3 w-3 mr-1" />
                                {t('variant.save')}
                            </Button>
                        )}
                    </div>
                </PopoverContent>
            </Popover>

            {/* Save As Dialog */}
            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>{t('variant.saveView.title')}</DialogTitle>
                        <DialogDescription>
                            {t('variant.saveView.description')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label htmlFor="variant-name" className="text-sm font-medium">{t('variant.saveView.nameLabel')}</label>
                            <Input
                                id="variant-name"
                                placeholder={t('variant.saveView.namePlaceholder')}
                                value={newVariantName}
                                onChange={(e) => setNewVariantName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="set-default"
                                checked={isDefault}
                                onCheckedChange={(checked: boolean | 'indeterminate') => setIsDefault(checked === true)}
                            />
                            <label htmlFor="set-default" className="text-sm font-medium leading-none">
                                {t('variant.saveView.setDefault')}
                            </label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>{t('common.cancel')}</Button>
                        <Button onClick={handleSave} disabled={!newVariantName.trim()}>{t('variant.save')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manage Dialog */}
            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Manage Views</DialogTitle>
                        <DialogDescription>
                            Rename, delete, or set default views.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-72 overflow-y-auto">
                        {variants.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">{t('variant.manageViews.noViews')}</p>
                        ) : (
                            <div className="space-y-2">
                                {variants.map((variant) => (
                                    <div
                                        key={variant.ID}
                                        className="flex items-center justify-between p-3 border rounded-lg"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{variant.variantName}</span>
                                            {variant.isDefaultVariant && (
                                                <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                                    {t('variant.default')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0"
                                                title={variant.isDefaultVariant ? 'Remove Default' : 'Set as Default'}
                                                onClick={() => onSetDefault(variant.isDefaultVariant ? null : variant)}
                                            >
                                                <Star
                                                    className={`h-3.5 w-3.5 ${variant.isDefaultVariant
                                                        ? 'text-yellow-500 fill-yellow-500'
                                                        : 'text-gray-400'
                                                        }`}
                                                />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                                title="Delete"
                                                onClick={() => {
                                                    if (variant.ID) {
                                                        onDeleteVariant(variant.ID);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsManageDialogOpen(false)}>{t('common.close')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
