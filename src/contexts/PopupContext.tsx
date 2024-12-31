import { createContext, useContext, useState, ReactNode } from 'react';

export type PopupStatus = 'success' | 'error' | 'info';
type PopupContent = {
  title: string;
  content: ReactNode;
  status?: PopupStatus;
};

interface PopupContextType {
  showPopup: (content: PopupContent) => void;
  hidePopup: () => void;
  popup: PopupContent | null;
  isOpen: boolean;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

export const PopupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [popup, setPopup] = useState<PopupContent | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const showPopup = (content: PopupContent) => {
    setPopup(content);
    setIsOpen(true);
  };

  const hidePopup = () => {
    setPopup(null);
    setIsOpen(false);
  };

  return <PopupContext.Provider value={{ showPopup, hidePopup, popup, isOpen }}>{children}</PopupContext.Provider>;
};

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopup must be used within a PopupProvider');
  }
  return context;
};
