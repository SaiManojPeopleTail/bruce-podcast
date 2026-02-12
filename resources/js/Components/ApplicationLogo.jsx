const appName = import.meta.env.VITE_APP_NAME;

export default function ApplicationLogo({ fontSize = '3rem', ...props }) {
    return (
        <h3
            className="barlow-condensed-semibold text-[#ffde59] text-center hero-bottom-text"
            style={{ fontSize }}
            {...props}
        >
            {appName}
        </h3>
    );
}
