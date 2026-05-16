import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { Toaster, toast } from '@snowluma/ui';
import { trashEntriesAtom } from '../../state/atoms';
import { trpc } from '../../lib/trpc';
import { useTranslation } from 'react-i18next';

/**
 * Mounted by the main shell. Renders the toast container AND watches the
 * trash atom so the TG-style 5s undo window can promote a soft-delete to a
 * hard-delete automatically when expired.
 */
export function ToastBridge() {
  const { t } = useTranslation();
  const [entries, setEntries] = useAtom(trashEntriesAtom);
  const finalize = trpc.bot.delete.finalize.useMutation();
  const undo = trpc.bot.delete.undo.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (entries.length === 0) return;
    const timers: NodeJS.Timeout[] = [];
    for (const entry of entries) {
      const remaining = entry.expiresAt - Date.now();
      if (remaining <= 0) {
        finalize.mutate({ trashEntry: entry.trashEntry });
        setEntries((cur) => cur.filter((e) => e.trashEntry !== entry.trashEntry));
        continue;
      }
      const id = setTimeout(() => {
        finalize.mutate({ trashEntry: entry.trashEntry });
        setEntries((cur) => cur.filter((e) => e.trashEntry !== entry.trashEntry));
      }, remaining);
      timers.push(id);
    }
    return () => timers.forEach(clearTimeout);
  }, [entries, finalize, setEntries]);

  // Fire one toast per new trash entry
  useEffect(() => {
    for (const entry of entries) {
      const name = entry.record.customName || entry.uin;
      toast(t('main.bots.deletedToast', { name }), {
        id: entry.trashEntry,
        duration: Math.max(0, entry.expiresAt - Date.now()),
        action: {
          label: t('main.bots.undo'),
          onClick: () => {
            undo.mutate(
              { trashEntry: entry.trashEntry },
              {
                onSuccess: () => {
                  utils.bot.list.invalidate();
                  utils.bot.states.invalidate();
                },
              },
            );
            setEntries((cur) => cur.filter((e) => e.trashEntry !== entry.trashEntry));
          },
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  return <Toaster />;
}
