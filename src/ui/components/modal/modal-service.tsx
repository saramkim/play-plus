import { MessageContent } from './message-content';

class ModalService {
  private modalContent: React.ReactNode = null;
  private modalListener: ((c: React.ReactNode) => void) | null = null;

  subscribe = (cb: (c: React.ReactNode) => void) => {
    this.modalListener = cb;

    return () => {
      this.modalListener = null;
    };
  };

  show = (content: React.ReactNode) => {
    this.modalContent = content;
    if (this.modalListener) {
      this.modalListener(this.modalContent);
    } else {
      console.error('No modal listener found');
    }
  };

  hide = () => {
    this.modalContent = null;
    if (this.modalListener) {
      this.modalListener(this.modalContent);
    } else {
      console.error('No modal listener found');
    }
  };

  confirm = (props: { title: string; message: string; onConfirm: () => void }) => {
    this.show(<MessageContent {...props} type='confirm' hideModal={this.hide} />);
  };

  alert = (props: { title: string; message: string }) => {
    this.show(<MessageContent {...props} type='alert' hideModal={this.hide} />);
  };
}

export const modalService = new ModalService();

export const modal = Object.assign(modalService.show, {
  confirm: modalService.confirm,
  alert: modalService.alert,
  hide: modalService.hide,
});
