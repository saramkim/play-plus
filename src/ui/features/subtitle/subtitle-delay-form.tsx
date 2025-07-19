import { useRef, useState } from 'react';

import { CheckIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { NumberInput } from '@/ui/components/number-input';
import { useClickOutside } from '@/ui/hooks/use-click-outside';

interface SubtitleDelayFormProps {
  initialDelay?: number;
  onUpdateDelay: (delay: number) => void;
  closeEditMode: () => void;
}

export function SubtitleDelayForm({ initialDelay, onUpdateDelay, closeEditMode }: SubtitleDelayFormProps) {
  const [delay, setDelay] = useState(initialDelay ?? 0);
  const formRef = useRef<HTMLFormElement>(null);

  useClickOutside([formRef], closeEditMode);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onUpdateDelay(delay);
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className='flex items-center gap-2'>
      <NumberInput value={delay} onChange={setDelay} step={0.1} />
      <Button variant='outline' size='sm' type='submit'>
        <CheckIcon />
      </Button>
    </form>
  );
}
