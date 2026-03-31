import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';

export const Butterfly = ({ isTyping = false, focusPoint = null as { x: number, y: number } | null }) => {
  const controls = useAnimation();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isResting, setIsResting] = useState(false);
  const lastMoveTime = useRef(Date.now());

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 });
      lastMoveTime.current = Date.now();
      setIsResting(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastMoveTime.current > 5000) {
        setIsResting(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const move = async () => {
      if (focusPoint) {
        await controls.start({
          x: [`${focusPoint.x - 5}vw`, `${focusPoint.x + 5}vw`, `${focusPoint.x - 5}vw`],
          y: [`${focusPoint.y - 5}vh`, `${focusPoint.y + 5}vh`, `${focusPoint.y - 5}vh`],
          transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
        });
        return;
      }

      if (isResting) {
        await controls.start({
          x: `${mousePos.x + (Math.random() * 2 - 1)}vw`,
          y: `${mousePos.y + (Math.random() * 2 - 1)}vh`,
          transition: { duration: 5, ease: "easeInOut" }
        });
      } else {
        const nextX = Math.random() * 80 + 10;
        const nextY = Math.random() * 80 + 10;
        
        await controls.start({
          x: `${nextX}vw`,
          y: `${nextY}vh`,
          transition: { duration: 6 + Math.random() * 4, ease: "easeInOut" }
        });
      }
    };

    const timer = setTimeout(move, 100);
    return () => clearTimeout(timer);
  }, [controls, mousePos, isResting, focusPoint]);

  return (
    <motion.div
      animate={controls}
      className="fixed z-50 pointer-events-none"
      initial={{ x: '50vw', y: '50vh' }}
    >
      <motion.div
        animate={{
          rotate: [0, -5, 0],
          y: [0, -10, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="relative w-12 h-12"
      >
        {/* Side view butterfly wings */}
        <motion.div
          animate={{
            rotateY: isTyping ? [0, 80, 0] : [0, 45, 0],
          }}
          transition={{
            duration: isTyping ? 0.3 : 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 origin-left"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full butterfly-glow fill-cyan-light/20 stroke-cyan-light/40">
            <path d="M10,50 C10,20 40,10 70,30 C90,45 80,70 60,80 C40,90 10,80 10,50 Z" />
            <path d="M15,55 C15,35 35,25 55,40 C70,50 65,70 50,75 C35,80 15,75 15,55 Z" opacity="0.5" />
          </svg>
        </motion.div>
        
        {/* Body */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-light/40 rounded-full blur-[1px]" />
      </motion.div>
    </motion.div>
  );
};
