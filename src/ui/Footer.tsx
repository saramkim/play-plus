import MoreMenu from './MoreMenu';

function Footer() {
  return (
    <div className='flex justify-between items-center h-8 border-t border-t-gray-300 px-2'>
      <div className='w-full'></div>
      <div className='flex justify-center items-center gap-2 w-full'>
        <img src='icons/play-plus_48x.png' alt='logo' className='w-4' />
        <h1 className='text-[16px] font-bold text-teal-500'>Play Plus</h1>
      </div>
      <div className='flex justify-end items-center w-full'>
        <MoreMenu direction='topLeft' />
      </div>
    </div>
  );
}

export default Footer;
