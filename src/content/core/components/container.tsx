import React from 'react';

import { usePadding } from '@/content/core/hooks/use-padding';
import { cn } from '@/ui/lib/utils';

export function Container({ className, ...props }: Omit<React.ComponentProps<'div'>, 'style'>) {
  const { paddingX, paddingY } = usePadding();
  return (
    <div
      className={cn('absolute', className)}
      style={{ top: paddingY, bottom: paddingY, left: paddingX, right: paddingX }}
      {...props}
    />
  );
}
