import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardContent, Input, Label, Switch, Separator } from '@snowluma/ui';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useWizardNavigate } from './wizard-shell';

export function NetworkStep() {
  const { t } = useTranslation();
  const { next, back } = useWizardNavigate();
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();
  const mirrors = trpc.mirrors.list.useQuery();
  const upsert = trpc.mirrors.upsert.useMutation({ onSuccess: () => void utils.mirrors.list.invalidate() });
  const remove = trpc.mirrors.delete.useMutation({ onSuccess: () => void utils.mirrors.list.invalidate() });

  const [draftName, setDraftName] = useState('');
  const [draftTemplate, setDraftTemplate] = useState('');

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{t('wizard.network.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('wizard.network.subtitle')}</p>
      </header>
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center justify-between text-sm">
            <span>{t('wizard.network.using')}</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              {t('wizard.network.advanced')}
              <ChevronDown className={`size-3 transition ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {expanded && (
            <>
              <Separator />
              <div className="space-y-2">
                {mirrors.data?.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="truncate font-medium">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground">prio {m.priority}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{m.template}</div>
                    </div>
                    <Switch
                      checked={m.enabled}
                      onCheckedChange={(checked) =>
                        upsert.mutate({ ...m, enabled: checked === true })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove.mutate({ id: m.id })}
                      disabled={m.id === 'github'}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                  <Label>{t('wizard.network.addMirror')}</Label>
                  <Input
                    placeholder={t('wizard.network.nameLabel')}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                  />
                  <Input
                    placeholder="https://your-mirror/snowluma/{version}/{file}"
                    value={draftTemplate}
                    onChange={(e) => setDraftTemplate(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!draftName || !draftTemplate) return;
                      upsert.mutate({
                        id: `mirror-${Date.now()}`,
                        name: draftName,
                        template: draftTemplate,
                        priority: 50,
                        enabled: true,
                      });
                      setDraftName('');
                      setDraftTemplate('');
                    }}
                  >
                    <Plus className="size-4" />
                    {t('wizard.network.addButton')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <NavRow back={() => back('network')} next={() => next('network')} />
    </section>
  );
}

function NavRow({ back, next }: { back: () => void; next: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between">
      <Button variant="ghost" onClick={back}>
        {t('wizard.back')}
      </Button>
      <Button onClick={next}>{t('wizard.next')}</Button>
    </div>
  );
}
