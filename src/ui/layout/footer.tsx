import { ModeToggle } from './mode-toggle';
import { MoreMenu } from './more-menu';

export function Footer() {
  return (
    <div className='flex justify-between items-center h-10 border-t px-2'>
      <div className='w-full'>
        <ModeToggle />
      </div>
      <div className='flex justify-center items-center gap-2 w-full'>
        <img src='icons/play-plus_48x.png' alt='logo' className='w-4' />
        <h1 className='text-[16px] font-bold text-primary'>Play Plus</h1>
      </div>
      <div className='flex justify-end items-center w-full'>
        <MoreMenu />
      </div>
    </div>
  );
}
