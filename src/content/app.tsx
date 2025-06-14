import ReactDOM from 'react-dom/client';

function App() {
  return <></>;
}

export const renderApp = (container: HTMLElement) => {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
};
