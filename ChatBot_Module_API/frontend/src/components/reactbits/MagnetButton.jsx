import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function MagnetButton({
  children,
  className = "",
  strength = 0.28,
  disabled = false,
  ...props
}) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 320, damping: 20 });
  const springY = useSpring(y, { stiffness: 320, damping: 20 });

  const handleMouseMove = (e) => {
    if (disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    x.set(dx * strength);
    y.set(dy * strength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
}

