import { useCallback, useEffect, useRef, type MouseEvent } from 'react';

type ModalOptions = {
  isOpen: boolean;
  onClose: () => void;
  closeOnEsc?: boolean;
  closeOnBackdrop?: boolean;
  lockScroll?: boolean;
};

export const useModalControls = ({
  isOpen,
  onClose,
  closeOnEsc = true,
  closeOnBackdrop = true,
  lockScroll = true,
}: ModalOptions) => {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeRef.current();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, closeOnEsc]);

  useEffect(() => {
    if (!isOpen || !lockScroll) return;
    const { body, documentElement } = document;
    const currentCount = Number(body.dataset.modalOpenCount || '0');
    const nextCount = currentCount + 1;
    body.dataset.modalOpenCount = String(nextCount);

    if (currentCount === 0) {
      body.dataset.modalPrevOverflow = body.style.overflow || '';
      body.dataset.modalPrevPadding = body.style.paddingRight || '';
      const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }
    return () => {
      const storedCount = Number(body.dataset.modalOpenCount || '1');
      const next = Math.max(0, storedCount - 1);
      if (next === 0) {
        body.style.overflow = body.dataset.modalPrevOverflow || '';
        body.style.paddingRight = body.dataset.modalPrevPadding || '';
        delete body.dataset.modalPrevOverflow;
        delete body.dataset.modalPrevPadding;
        delete body.dataset.modalOpenCount;
      } else {
        body.dataset.modalOpenCount = String(next);
      }
    };
  }, [isOpen, lockScroll]);

  const onBackdropClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!closeOnBackdrop || !isOpen) return;
      if (event.target !== event.currentTarget) return;
      closeRef.current();
    },
    [closeOnBackdrop, isOpen]
  );

  return { onBackdropClick };
};
