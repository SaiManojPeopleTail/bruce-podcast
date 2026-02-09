export default function Checkbox({ className = '', ...props }) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-600 dark:focus:ring-offset-slate-800 ' +
                className
            }
        />
    );
}
