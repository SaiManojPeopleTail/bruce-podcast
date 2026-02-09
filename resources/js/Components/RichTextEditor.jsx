import { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const DEFAULT_MODULES = {
    toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
    ],
};

export default function RichTextEditor({ value = '', onChange, placeholder, className = '', id }) {
    const modules = useMemo(() => DEFAULT_MODULES, []);

    return (
        <div className={className} id={id}>
            <ReactQuill
                theme="snow"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                modules={modules}
                className="rounded-md border border-gray-300 dark:border-slate-600 [&_.ql-editor]:min-h-[180px] [&_.ql-container]:rounded-b-md [&_.ql-toolbar]:rounded-t-md [&_.ql-toolbar]:border-gray-300 [&_.ql-toolbar]:bg-gray-50 dark:[&_.ql-toolbar]:border-slate-600 dark:[&_.ql-toolbar]:bg-slate-700/50 [&_.ql-editor]:dark:bg-slate-700 [&_.ql-editor]:dark:text-slate-200"
            />
        </div>
    );
}
