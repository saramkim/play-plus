'use client';


import * as React from 'react';

import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@utils/helper';

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot='label'
      className={cn(
        'min-w-[120px] shrink-0 text-gray-800 text-nowrap select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
