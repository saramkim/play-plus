import ReactDOM from 'react-dom/client';

import { Controller } from './components/controller';
import { LoopStatus } from './components/loop-status';

function App() {
  return (
    <div className='relative size-full pointer-events-none z-[9999]'>
      <Controller />
      <LoopStatus />
    </div>
  );
}

export const renderApp = (container: HTMLElement) => {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
};
