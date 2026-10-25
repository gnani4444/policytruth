'use client';
// motion-primitives TextShimmer (ibelick, MIT), via 21st.dev; types stripped, light-only colours.
import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

function TextShimmerComponent({ children, as: Component = 'p', className, duration = 2, spread = 2 }) {
  const MotionComponent = useMemo(() => motion.create(Component), [Component]);
  const dynamicSpread = useMemo(() => children.length * spread, [children, spread]);

  return (
    <MotionComponent
      className={cn(
        'relative inline-block bg-[length:250%_100%,auto] bg-clip-text',
        'text-transparent [--base-color:#6b6b6b] [--base-gradient-color:#0b0c0c]',
        '[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))]',
        className
      )}
      initial={{ backgroundPosition: '100% center' }}
      animate={{ backgroundPosition: '0% center' }}
      transition={{ repeat: Infinity, duration, ease: 'linear' }}
      style={{ '--spread': `${dynamicSpread}px`, backgroundImage: 'var(--bg), linear-gradient(var(--base-color), var(--base-color))' }}
    >
      {children}
    </MotionComponent>
  );
}

export const TextShimmer = React.memo(TextShimmerComponent);
