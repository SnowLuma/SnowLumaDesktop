import { useNavigate } from '@tanstack/react-router';
import { Button, Card, CardContent } from '@snowluma/ui';
import { Compass, Home } from 'lucide-react';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="space-y-5 p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Compass className="size-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-semibold tracking-tight">页面不存在</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              路径无效或已被移除。回到主界面继续操作吧。
            </p>
          </div>
          <Button variant="default" size="sm" onClick={() => navigate({ to: '/app/bots' })}>
            <Home className="size-4" />
            回主界面
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
