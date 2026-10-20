import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';

export function useGlobalDropTrap() {
    const [isWindowDragging, setIsWindowDragging] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        let dragCounter = 0;

        const handleWindowDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        };

        const handleWindowDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter++;
            if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                setIsWindowDragging(true);
            }
        };

        const handleWindowDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                setIsWindowDragging(false);
            }
        };

        const handleWindowDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            setIsWindowDragging(false);

            // Check if dropped outside an explicit dropzone target
            const target = e.target as HTMLElement | null;
            const isInsideDropzone = target?.closest('[data-dropzone="true"]');

            if (!isInsideDropzone && e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                showToast({
                    type: 'warning',
                    title: 'Accidental Drop Intercepted',
                    message: 'Please drop documents directly into the designated upload zone.',
                });
            }
        };

        window.addEventListener('dragover', handleWindowDragOver);
        window.addEventListener('dragenter', handleWindowDragEnter);
        window.addEventListener('dragleave', handleWindowDragLeave);
        window.addEventListener('drop', handleWindowDrop);

        return () => {
            window.removeEventListener('dragover', handleWindowDragOver);
            window.removeEventListener('dragenter', handleWindowDragEnter);
            window.removeEventListener('dragleave', handleWindowDragLeave);
            window.removeEventListener('drop', handleWindowDrop);
        };
    }, [showToast]);

    return { isWindowDragging };
}