import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  ScrollArea,
  Badge,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  EmptyState,
  cn,
} from '@snowluma/ui';
import { FolderOpen, RotateCw, FileText, Search, Filter, Pause, Play } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ViewHeader } from './main-shell';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: { id: LogLevel; label: string; tone: 'soft' | 'info' | 'warning' | 'destructive' }[] = [
  { id: 'debug', label: 'DEBUG', tone: 'soft' },
  { id: 'info', label: 'INFO', tone: 'info' },
  { id: 'warn', label: 'WARN', tone: 'warning' },
  { id: 'error', label: 'ERROR', tone: 'destructive' },
];

interface ParsedEntry {
  raw: string;
  ts: string | null;
  level: LogLevel | null;
  source: string | null;
  message: string;
}

const LINE_RE = /^\[(?<ts>[^\]]+)\] \[(?<level>DEBUG|INFO|WARN|ERROR)\] \[(?<source>[^\]]+)\] (?<msg>.*)$/i;

function parseLine(raw: string): ParsedEntry {
  // Accept both Desktop's structured format and core's "[stdout] ..." prefix.
  const stdMatch = raw.match(/^\[stdout\]\s*(.*)$/i);
  const stderrMatch = raw.match(/^\[stderr\]\s*(.*)$/i);
  if (stdMatch) {
    return { raw, ts: null, level: 'info', source: 'core', message: stdMatch[1] ?? '' };
  }
  if (stderrMatch) {
    return { raw, ts: null, level: 'error', source: 'core', message: stderrMatch[1] ?? '' };
  }
  const m = raw.match(LINE_RE);
  if (!m?.groups) return { raw, ts: null, level: null, source: null, message: raw };
  return {
    raw,
    ts: m.groups.ts ?? null,
    level: (m.groups.level.toLowerCase() as LogLevel) ?? null,
    source: m.groups.source ?? null,
    message: m.groups.msg ?? '',
  };
}

export function LogsView() {
  const { t } = useTranslation();
  const coreState = trpc.core.state.useQuery(undefined, { refetchInterval: 2_000 });
  const [enabledLevels, setEnabledLevels] = useState<Set<LogLevel>>(
    new Set(['debug', 'info', 'warn', 'error']),
  );
  const [query, setQuery] = useState('');
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<ParsedEntry[]>([]);

  const entries = useMemo<ParsedEntry[]>(() => {
    const lines = coreState.data?.recentOutput ?? [];
    return lines.map(parseLine);
  }, [coreState.data?.recentOutput]);

  const display = paused ? frozen : entries;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return display.filter((e) => {
      if (e.level && !enabledLevels.has(e.level)) return false;
      if (!q) return true;
      return e.raw.toLowerCase().includes(q);
    });
  }, [display, enabledLevels, query]);

  function toggleLevel(level: LogLevel) {
    setEnabledLevels((cur) => {
      const next = new Set(cur);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={t('main.logs.title')}
        icon={<FileText className="size-4" />}
        actions={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    if (!paused) setFrozen(entries);
                    setPaused((p) => !p);
                  }}
                  aria-label={paused ? '继续刷新' : '暂停刷新'}
                >
                  {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{paused ? '继续刷新' : '暂停刷新'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={() => coreState.refetch()}>
                  <RotateCw className={cn('size-4', coreState.isFetching && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">立即刷新</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={() => alert(t('main.logs.openFolderHint'))}>
                  <FolderOpen className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('main.logs.openFolder')}</TooltipContent>
            </Tooltip>
          </>
        }
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/40 px-4 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索"
            className="h-8 w-56 pl-7"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Filter className="size-3.5" />
          <span>等级</span>
        </div>
        <div className="flex items-center gap-1">
          {LEVELS.map((l) => {
            const active = enabledLevels.has(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => toggleLevel(l.id)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                  active
                    ? l.tone === 'soft'
                      ? 'border-transparent bg-muted text-muted-foreground'
                      : l.tone === 'info'
                        ? 'border-transparent bg-info/15 text-info'
                        : l.tone === 'warning'
                          ? 'border-transparent bg-warning/15 text-warning'
                          : 'border-transparent bg-destructive/15 text-destructive'
                    : 'border-border bg-card text-muted-foreground/60 hover:text-foreground',
                )}
              >
                {l.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto text-[10px] text-muted-foreground">
          {filtered.length} / {display.length} 行
          {paused && <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 font-medium text-warning">已暂停</span>}
        </div>
      </div>
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <EmptyState
            className="m-6"
            icon={<FileText className="size-5" />}
            title={t('main.logs.empty')}
            description="core 启动后日志会出现在这里。"
          />
        ) : (
          <div className="divide-y divide-border/40 font-mono text-[11px] leading-relaxed">
            {filtered.map((e, i) => (
              <LogRow key={i} entry={e} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function LogRow({ entry }: { entry: ParsedEntry }) {
  return (
    <div className="flex items-start gap-3 px-4 py-1.5 hover:bg-muted/40">
      {entry.ts && (
        <span className="shrink-0 text-muted-foreground/60">{entry.ts.split('T')[1]?.split('.')[0] ?? entry.ts}</span>
      )}
      {entry.level && (
        <Badge variant={levelToTone(entry.level)} size="sm" className="shrink-0 uppercase">
          {entry.level}
        </Badge>
      )}
      {entry.source && <span className="shrink-0 text-muted-foreground">[{entry.source}]</span>}
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-all text-foreground/90">{entry.message}</span>
    </div>
  );
}

function levelToTone(level: LogLevel): 'soft' | 'info' | 'warning' | 'destructive' {
  switch (level) {
    case 'debug':
      return 'soft';
    case 'info':
      return 'info';
    case 'warn':
      return 'warning';
    case 'error':
      return 'destructive';
  }
}
