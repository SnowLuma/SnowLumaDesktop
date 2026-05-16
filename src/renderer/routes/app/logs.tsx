import { useTranslation } from 'react-i18next';
import { Card, CardContent, ScrollArea, Button } from '@snowluma/ui';
import { FolderOpen, RotateCw } from 'lucide-react';
import { trpc } from '../../lib/trpc';

export function LogsView() {
  const { t } = useTranslation();
  const coreState = trpc.core.state.useQuery(undefined, { refetchInterval: 2_000 });

  return (
    <div className="flex h-full flex-col p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('main.logs.title')}</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => coreState.refetch()}>
            <RotateCw className="size-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => alert(t('main.logs.openFolderHint'))}>
            <FolderOpen className="size-4" />
            {t('main.logs.openFolder')}
          </Button>
        </div>
      </header>
      <Card className="flex-1">
        <CardContent className="h-full p-0">
          <ScrollArea className="h-[calc(100vh-200px)]">
            <pre className="whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {coreState.data?.recentOutput?.join('\n') ?? t('main.logs.empty')}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
