export default function ShinyText({ text, className = "" }) {
  return <span className={`shiny-text inline-block font-semibold ${className}`}>{text}</span>;
}

