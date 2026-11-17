import { motion } from "framer-motion";

export default function SplitText({ text = "", className = "", delay = 0.025 }) {
  const letters = Array.from(text);

  return (
    <span className={`inline-flex flex-wrap ${className}`} aria-label={text}>
      {letters.map((char, index) => (
        <motion.span
          key={`${char}-${index}`}
          initial={{ opacity: 0, y: 14, rotateX: -35 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{
            type: "spring",
            stiffness: 320,
            damping: 24,
            delay: index * delay,
          }}
          className="inline-block"
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </span>
  );
}

