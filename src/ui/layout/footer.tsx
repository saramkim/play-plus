import { ModeToggle } from './mode-toggle';

export function Footer() {
  return (
    <div className='grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-t px-2'>
      <div className='flex justify-start'>
        <ModeToggle />
      </div>
      <div className='flex items-center justify-center gap-2'>
        <img src='icons/play-plus_48x.png' alt='' className='w-4' />
        <h1 className='text-[16px] font-bold text-primary'>Play Plus</h1>
      </div>
      <div aria-hidden='true' />
    </div>
  );
}
