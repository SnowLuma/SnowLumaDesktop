import { Button, Tooltip, TooltipContent, TooltipTrigger, Kbd } from '@snowluma/ui';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface SidebarToggleProps {
  collapsed: boolean;
  onToggle: () => void;
  label?: string;
}

export function SidebarToggle({ collapsed, onToggle, label = '切换侧栏' }: SidebarToggleProps) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label={label}>
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        <span className="flex items-center gap-1.5">
          {label}
          <Kbd>⌘B</Kbd>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
