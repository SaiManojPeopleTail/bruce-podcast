import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import { ImagePlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

/**
 * @param {{
 *   label?: string,
 *   hint?: string,
 *   error?: string,
 *   existingPreviewUrl?: string | null,
 *   removedPending?: boolean,
 *   onFileChange: (file: File | null) => void,
 *   onRemoveExisting?: () => void,
 * }} props
 */
export default function VideoThumbnailUpload({
    label = 'Video thumbnail',
    hint = 'Used on the Rise brands list, social/meta preview, and as the video poster on mobile. · JPG, PNG, WebP · max 10 MB',
    error,
    existingPreviewUrl = null,
    removedPending = false,
    onFileChange,
    onRemoveExisting,
}) {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!file) {
            setPreviewUrl(null);
            return undefined;
        }
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const setFileAndNotify = (next) => {
        setFile(next);
        onFileChange(next);
    };

    const pickFile = (picked) => {
        if (!picked?.type.startsWith('image/')) return;
        setFileAndNotify(picked);
    };

    const handleChange = (e) => {
        pickFile(e.target.files?.[0] ?? null);
        e.target.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        const picked = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
        if (picked) pickFile(picked);
    };

    const clearNew = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setFileAndNotify(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const showExisting = existingPreviewUrl && !removedPending && !previewUrl;

    return (
        <div>
            <InputLabel value={label} />
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{hint}</p>

            {(showExisting || previewUrl) && (
                <div className="relative mt-3 inline-block">
                    <img
                        src={previewUrl ?? existingPreviewUrl}
                        alt="Video thumbnail preview"
                        className="h-32 w-48 rounded-lg border border-gray-200 object-cover shadow-sm dark:border-slate-600"
                    />
                    {previewUrl ? (
                        <button
                            type="button"
                            onClick={clearNew}
                            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white shadow"
                            aria-label="Remove selected thumbnail"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    ) : onRemoveExisting ? (
                        <button
                            type="button"
                            onClick={onRemoveExisting}
                            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white shadow"
                            aria-label="Remove thumbnail"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    ) : null}
                </div>
            )}

            {removedPending && !previewUrl && (
                <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Thumbnail will be removed when you save. Upload a new one below (optional).
                </p>
            )}

            <label
                className={`mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 transition ${
                    dragging
                        ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-900/20'
                        : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/30 dark:border-slate-500 dark:bg-slate-700/50 dark:hover:border-indigo-400 dark:hover:bg-slate-700'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
            >
                <ImagePlus className={`h-5 w-5 shrink-0 ${dragging ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-300'}`} />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-600 dark:text-slate-300">
                    {dragging ? 'Drop image here' : file?.name || 'Click or drag to upload thumbnail'}
                </span>
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    onChange={handleChange}
                />
            </label>
            <InputError message={error} className="mt-1" />
        </div>
    );
}
