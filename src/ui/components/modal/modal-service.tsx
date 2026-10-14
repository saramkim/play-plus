import { MessageContent } from './message-content';

class ModalService {
  private modalContent: React.ReactNode = null;
  private modalListener: ((c: React.ReactNode, pending: boolean) => void) | null = null;
  private pending = false;
  private version = 0;

  subscribe = (cb: (c: React.ReactNode, pending: boolean) => void) => {
    this.modalListener = cb;

    return () => {
      this.modalListener = null;
    };
  };

  show = (content: React.ReactNode) => {
    this.version += 1;
    this.pending = false;
    this.modalContent = content;
    if (this.modalListener) {
      this.modalListener(this.modalContent, this.pending);
    } else {
      console.error('No modal listener found');
    }
  };

  hide = () => {
    if (this.pending) return;
    this.modalContent = null;
    if (this.modalListener) {
      this.modalListener(this.modalContent, this.pending);
    } else {
      console.error('No modal listener found');
    }
  };

  confirm = (props: { title: string; message: string; onConfirm: () => void | Promise<void>; errorMessage?: (error: unknown) => string }) => {
    const version = this.version + 1;
    this.show(<MessageContent key={version} {...props} type='confirm'
      setPending={(pending) => {
        if (this.version !== version) return;
        this.pending = pending;
        this.modalListener?.(this.modalContent, pending);
      }}
      hideModal={() => { if (this.version === version) this.hide(); }} />);
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
