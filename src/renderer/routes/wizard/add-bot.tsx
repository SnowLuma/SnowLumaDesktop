import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@snowluma/ui';
import { Play, CheckCircle2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useWizardNavigate } from './wizard-shell';

export function AddBotStep() {
  const { t } = useTranslation();
  const { next, back } = useWizardNavigate();
  const utils = trpc.useUtils();
  const qq = trpc.qq.cached.useQuery();
  const states = trpc.bot.states.useQuery(undefined, { refetchInterval: 2_000 });
  const upsert = trpc.bot.upsert.useMutation({ onSuccess: () => utils.bot.list.invalidate() });
  const startBot = trpc.bot.start.useMutation();

  const [customName, setCustomName] = useState('');
  const [launchMode, setLaunchMode] = useState<'desktop' | 'user'>('desktop');
  const [hideQq, setHideQq] = useState(true);
  const [pendingUin, setPendingUin] = useState<string | null>(null);

  const onlineBot = states.data?.find((s) => s.status === 'online');

  // Once a Bot flips to online, advance state to "done for this step"
  useEffect(() => {
    if (onlineBot && !pendingUin) {
      setPendingUin(onlineBot.uin);
    }
  }, [onlineBot, pendingUin]);

  const handleLaunch = () => {
    if (!qq.data) return;
    // For first-Bot flow we don't yet know the UIN — we'll use a placeholder
    // and reconcile via core's bridge events.
    const tempUin = `pending-${Date.now()}`;
    upsert.mutate(
      {
        uin: tempUin,
        customName,
        qqPath: qq.data.path,
        launchMode,
        hideQqWindowAfterLogin: hideQq,
        createdAt: Date.now(),
      },
      {
        onSuccess: () => {
          startBot.mutate({ uin: tempUin });
        },
      },
    );
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{t('wizard.addBot.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('wizard.addBot.subtitle')}</p>
      </header>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="bot-name">{t('wizard.addBot.nameLabel')}</Label>
            <Input id="bot-name" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={t('wizard.addBot.namePlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="launch-mode">{t('wizard.addBot.launchMode')}</Label>
            <Select value={launchMode} onValueChange={(v) => setLaunchMode(v as 'desktop' | 'user')}>
              <SelectTrigger id="launch-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desktop">{t('wizard.addBot.launchDesktop')}</SelectItem>
                <SelectItem value="user">{t('wizard.addBot.launchUser')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {launchMode === 'desktop' ? t('wizard.addBot.launchDesktopHint') : t('wizard.addBot.launchUserHint')}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('wizard.addBot.hideAfterLogin')}</Label>
              <p className="text-xs text-muted-foreground">{t('wizard.addBot.hideAfterLoginHint')}</p>
            </div>
            <Switch checked={hideQq} onCheckedChange={(checked) => setHideQq(checked === true)} />
          </div>
          {!onlineBot && (
            <Button onClick={handleLaunch} disabled={!qq.data || upsert.isPending}>
              <Play className="size-4" />
              {upsert.isPending ? t('wizard.addBot.launching') : t('wizard.addBot.launch')}
            </Button>
          )}
          {onlineBot && (
            <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
              <CheckCircle2 className="size-5 text-success" />
              <span>{t('wizard.addBot.online', { uin: onlineBot.uin })}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t('wizard.addBot.loginHint')}</p>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => back('add-bot')}>{t('wizard.back')}</Button>
        <Button onClick={() => next('add-bot')}>
          {onlineBot ? t('wizard.next') : t('wizard.addBot.skipForNow')}
        </Button>
      </div>
    </section>
  );
}
