import ReactDOM from 'react-dom/client';

import { Controller } from './components/controller';

function App() {
  return (
    <div className='fixed inset-0 pointer-events-none z-[9999]'>
      <Controller />
    </div>
  );
}

export const renderApp = (container: HTMLElement) => {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
};
