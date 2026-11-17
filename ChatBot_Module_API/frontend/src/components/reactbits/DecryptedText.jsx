import { useEffect, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_:-";

export default function DecryptedText({
  text = "",
  speed = 24,
  className = "",
}) {
  const [display, setDisplay] = useState(text);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let iteration = 0;
    const target = String(text || "");
    if (!target) {
      setDisplay("");
      return;
    }
    const timer = setInterval(() => {
      const next = target
        .split("")
        .map((char, idx) => {
          if (char === " ") return " ";
          if (idx < iteration) return target[idx];
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        })
        .join("");
      setDisplay(next);
      iteration += 1.2;
      if (iteration >= target.length) {
        setDisplay(target);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, tick]);

  return (
    <span
      onMouseEnter={() => setTick((t) => t + 1)}
      className={className}
    >
      {display}
    </span>
  );
}

