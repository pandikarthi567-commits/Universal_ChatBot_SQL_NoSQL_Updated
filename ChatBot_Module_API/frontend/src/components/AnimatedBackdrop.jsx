import { motion } from "framer-motion";

export default function AnimatedBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 130% 55% at 50% -8%, rgba(146, 157, 167, 0.45) 0%, rgba(146, 157, 167, 0.18) 45%, transparent 75%),
          radial-gradient(ellipse 140% 60% at 50% 108%, rgba(255, 72, 50, 0.58) 0%, rgba(255, 72, 50, 0.24) 48%, transparent 80%),
          linear-gradient(180deg, #444D56 0%, #282E35 16%, #1C1F24 36%, #17191C 55%, #1C1717 72%, #2B1411 88%, #441712 100%)
        `,
      }}
    >
      {/* Cyber Grid - Evenly spread across full page */}
      <div className="cyber-grid absolute inset-0 opacity-35" />

      {/* TOP: Cool Steel Grey (#929DA7) Ambient Light Spread */}
      <motion.div
        animate={{
          y: [0, 18, -14, 0],
          scaleX: [1, 1.06, 0.96, 1],
          opacity: [0.55, 0.72, 0.55],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/2 -translate-x-1/2 -top-36 h-[28rem] w-[82rem] max-w-[140vw] rounded-full bg-gradient-to-b from-[#929DA7]/65 via-[#AAB5BF]/30 to-transparent blur-[115px]"
      />

      {/* BOTTOM: Vibrant Coral Orange (#FF4832) Radiant Atmosphere */}
      <motion.div
        animate={{
          y: [0, -22, 18, 0],
          scaleX: [1, 1.08, 0.95, 1],
          opacity: [0.65, 0.85, 0.65],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/2 -translate-x-1/2 -bottom-36 h-[34rem] w-[88rem] max-w-[150vw] rounded-full bg-gradient-to-t from-[#FF4832]/75 via-[#FF553E]/45 to-transparent blur-[125px]"
      />

      {/* BOTTOM ACCENT: Inner Intense Coral Glow Core */}
      <motion.div
        animate={{
          scale: [1, 1.14, 1],
          opacity: [0.45, 0.65, 0.45],
        }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/2 -translate-x-1/2 -bottom-20 h-[18rem] w-[52rem] max-w-[110vw] rounded-full bg-[#FF4832]/50 blur-[90px]"
      />

      {/* CENTER: Subtle Midnight Charcoal Depth Anchor (Keeps Content Pristine & Legible) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(23, 25, 28, 0.15) 30%, rgba(23, 25, 28, 0.35) 55%, rgba(23, 25, 28, 0.20) 75%, transparent 100%)",
        }}
      />
    </div>
  );
}
