import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';

interface UseGlobalDropTrapProps {
    onFileDrop: (file: File) => void;
    isEnabled: boolean;
}

export function useGlobalDropTrap({ onFileDrop, isEnabled }: UseGlobalDropTrapProps) {
    const [isWindowDragging, setIsWindowDragging] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (!isEnabled) return;
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
            if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
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

            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;

            if (files.length > 1) {
                showToast({
                    type: 'warning',
                    title: 'Single File Only',
                    message: 'Please drop one affidavit or document at a time.',
                });
                return;
            }

            // Ingest the file directly regardless of where it was dropped on screen
            onFileDrop(files[0]);
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
    }, [isEnabled, onFileDrop, showToast]);

    return { isWindowDragging };
}