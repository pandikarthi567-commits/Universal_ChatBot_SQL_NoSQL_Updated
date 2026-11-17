import { motion } from "framer-motion";

export default function BlurText({
  text = "",
  delay = 0.05,
  className = "",
  as: Component = "p",
}) {
  const words = text.split(" ");

  return (
    <Component className={`inline-flex flex-wrap ${className}`}>
      {words.map((word, idx) => (
        <motion.span
          key={`${word}-${idx}`}
          initial={{ filter: "blur(10px)", opacity: 0, y: 12 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{
            duration: 0.45,
            delay: idx * delay,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mr-[0.28em] inline-block"
        >
          {word}
        </motion.span>
      ))}
    </Component>
  );
}

