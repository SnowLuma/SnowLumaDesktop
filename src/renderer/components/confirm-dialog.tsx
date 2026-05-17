import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  buttonVariants,
  cn,
} from '@snowluma/ui';
import type { ReactNode } from 'react';
import { AlertTriangle, Trash2, Info } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive' | 'warning';
  icon?: ReactNode;
}

/**
 * Generic Yes/No confirmation modal. Replaces inline `window.confirm` and
 * gives delete-style flows a consistent surface.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  tone = 'default',
  icon,
}: ConfirmDialogProps) {
  const Icon = icon ?? (tone === 'destructive' ? <Trash2 className="size-5" /> : tone === 'warning' ? <AlertTriangle className="size-5" /> : <Info className="size-5" />);
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl',
                tone === 'destructive' && 'bg-destructive/15 text-destructive',
                tone === 'warning' && 'bg-warning/15 text-warning',
                tone === 'default' && 'bg-primary/15 text-primary',
              )}
            >
              {Icon}
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description && (
                <AlertDialogDescription className="mt-1">{description}</AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              tone === 'destructive' && buttonVariants({ variant: 'destructive' }),
              tone === 'warning' && buttonVariants({ variant: 'warning' }),
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
