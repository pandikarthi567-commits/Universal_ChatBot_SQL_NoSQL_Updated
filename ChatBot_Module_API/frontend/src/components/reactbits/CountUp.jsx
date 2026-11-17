import { useEffect, useState } from "react";
import { animate } from "framer-motion";

export default function CountUp({
  to = 0,
  duration = 0.8,
  decimals = 0,
  suffix = "",
  className = "",
}) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    const controls = animate(0, Number(to) || 0, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setVal(latest),
    });
    return () => controls.stop();
  }, [to, duration]);

  return (
    <span className={className}>
      {decimals > 0 ? val.toFixed(decimals) : Math.round(val)}
      {suffix}
    </span>
  );
}

