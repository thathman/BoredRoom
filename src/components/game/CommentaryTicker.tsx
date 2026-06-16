import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface CommentaryTickerProps {
  line: string | null;
}

export function CommentaryTicker({ line }: CommentaryTickerProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-3xl px-4 pointer-events-none">
      <AnimatePresence mode="wait">
        {line && (
          <motion.div
            key={line}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.35 }}
            className="glass neon-border rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl"
          >
            <Sparkles className="w-5 h-5 text-primary shrink-0 animate-pulse-neon" />
            <p className="text-base md:text-xl font-display text-foreground leading-snug">
              {line}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
