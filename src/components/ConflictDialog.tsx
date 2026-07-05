/**
 * ConflictDialog — UI for manual conflict resolution.
 *
 * Shows a side-by-side diff of server vs client data,
 * lets the user pick which version to keep per field.
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, Server, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  applyManualResolution,
  autoResolve,
  type ConflictRecord,
  type ConflictInfo,
  type ConflictStrategy,
} from '@/lib/conflictResolver';

// ─── Props ──────────────────────────────────────────────────────────

interface ConflictDialogProps {
  conflict: ConflictInfo | null;
  onResolve: (resolvedData: ConflictRecord, strategy: ConflictStrategy) => void;
  onDismiss: () => void;
  /** Human-readable field labels (e.g., { full_name: 'الاسم', phone: 'التلفون' }) */
  fieldLabels?: Record<string, string>;
}

// ─── Component ──────────────────────────────────────────────────────

export function ConflictDialog({ conflict, onResolve, onDismiss, fieldLabels = {} }: ConflictDialogProps) {
  const [choices, setChoices] = useState<Record<string, 'client' | 'server'>>({});

  // Initialize choices with server as default
  useEffect(() => {
    if (!conflict) return;
    const initial: Record<string, 'client' | 'server'> = {};
    conflict.conflictingFields.forEach(f => { initial[f] = 'server'; });
    setChoices(initial);
  }, [conflict]);

  if (!conflict) return null;

  const allResolved = conflict.conflictingFields.every(f => choices[f]);

  const handleAutoResolve = (strategy: ConflictStrategy) => {
    const result = autoResolve(conflict, strategy);
    onResolve(result.mergedData, strategy);
  };

  const handleManualResolve = () => {
    const resolved = applyManualResolution(conflict, choices);
    onResolve(resolved, 'manual');
  };

  const getLabel = (field: string) =>
    fieldLabels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? '✓' : '✗';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  return (
    <Dialog open={!!conflict} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            تعارض في البيانات
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            شخص تاني عدّل نفس السجل. اختار النسخة اللي عايزها لكل حقل.
          </p>
        </DialogHeader>

        {/* Quick actions */}
        <div className="flex gap-2 px-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAutoResolve('last-write-wins')}
            className="text-xs"
          >
            <Server className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
            استخدم نسخة السيرفر
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const allClient: Record<string, 'client' | 'server'> = {};
              conflict.conflictingFields.forEach(f => { allClient[f] = 'client'; });
              setChoices(allClient);
            }}
            className="text-xs"
          >
            <Monitor className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
            استخدم نسختي
          </Button>
        </div>

        {/* Field-by-field comparison */}
        <div className="flex-1 overflow-y-auto space-y-1 py-2">
          {conflict.conflictingFields.map(field => {
            const serverVal = formatValue(conflict.serverData[field]);
            const clientVal = formatValue(conflict.clientData[field]);
            const selected = choices[field];

            return (
              <div key={field} className="rounded-lg border p-3">
                <div className="text-sm font-medium mb-2">{getLabel(field)}</div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Server version */}
                  <button
                    onClick={() => setChoices(prev => ({ ...prev, [field]: 'server' }))}
                    className={cn(
                      'rounded-md border p-2 text-start text-xs transition-all',
                      selected === 'server'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 ring-1 ring-blue-500'
                        : 'border-muted hover:border-blue-300'
                    )}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <Server className="h-3 w-3 text-blue-500" />
                      <span className="font-medium text-blue-600">السيرفر</span>
                      {selected === 'server' && <Check className="h-3 w-3 text-blue-500 mr-auto" />}
                    </div>
                    <div className="text-muted-foreground whitespace-pre-wrap break-all">{serverVal}</div>
                  </button>

                  {/* Client version */}
                  <button
                    onClick={() => setChoices(prev => ({ ...prev, [field]: 'client' }))}
                    className={cn(
                      'rounded-md border p-2 text-start text-xs transition-all',
                      selected === 'client'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 ring-1 ring-emerald-500'
                        : 'border-muted hover:border-emerald-300'
                    )}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <Monitor className="h-3 w-3 text-emerald-500" />
                      <span className="font-medium text-emerald-600">نسختي</span>
                      {selected === 'client' && <Check className="h-3 w-3 text-emerald-500 mr-auto" />}
                    </div>
                    <div className="text-muted-foreground whitespace-pre-wrap break-all">{clientVal}</div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex gap-2">
          <Badge variant="outline" className="ml-auto">
            v{conflict.clientVersion} → v{conflict.serverVersion}
          </Badge>
          <Button variant="ghost" onClick={onDismiss}>إلغاء</Button>
          <Button onClick={handleManualResolve} disabled={!allResolved}>
            <Check className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            تطبيق الاختيارات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
