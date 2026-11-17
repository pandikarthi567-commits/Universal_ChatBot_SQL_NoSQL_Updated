export default function StarBorder({
  children,
  className = "",
  innerClassName = "",
  color = "rgba(255, 72, 50, 0.75)",
  secondaryColor = "rgba(146, 157, 167, 0.60)",
}) {
  return (
    <div className={`relative overflow-hidden rounded-3xl p-[1.5px] ${className}`}>
      <div
        className="star-border-beam pointer-events-none absolute -inset-[80%]"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${color} 60deg, transparent 130deg, ${secondaryColor} 220deg, transparent 300deg)`,
        }}
      />
      <div className={`relative rounded-[calc(1.5rem-1.5px)] bg-[#17191C]/95 ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}
