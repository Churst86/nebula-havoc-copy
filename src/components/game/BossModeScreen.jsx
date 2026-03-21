import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Skull, ArrowLeft } from 'lucide-react';

export default function BossModeScreen({ onStart, onBack }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
    >
      <div className="text-center space-y-6 p-8 max-w-sm w-full">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
        >
          <Skull className="w-16 h-16 mx-auto text-red-500" style={{ filter: 'drop-shadow(0 0 20px #ff2244)' }} />
        </motion.div>

        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-red-700">
          BOSS MODE
        </h1>

        <div className="space-y-2 text-sm text-muted-foreground text-left rounded-xl border border-red-900/40 p-4"
          style={{ background: 'rgba(40,0,0,0.5)' }}>
          <p className="text-red-400 font-bold mb-2">Rules:</p>
          <p>• Face all 5 bosses one by one</p>
          <p>• No regular enemies — pure boss fights</p>
          <p>• After defeating all 5, face <span className="text-red-300 font-bold">2 random bosses</span> simultaneously</p>
          <p>• Complete this endless gauntlet to earn the <span className="text-yellow-400 font-bold">Endless Nightmare</span> trophy</p>
          <p>• Defeat all 5 bosses to earn the <span className="text-yellow-400 font-bold">Boss Rush</span> trophy</p>
        </div>

        <Button
          onClick={onStart}
          size="lg"
          className="w-full font-black text-lg py-6 rounded-xl"
          style={{ background: 'linear-gradient(135deg, #880000, #cc0022)', color: '#fff', border: '2px solid #ff2244', boxShadow: '0 0 20px #ff224466' }}
        >
          <Skull className="w-5 h-5 mr-2" />
          ENTER THE GAUNTLET
        </Button>

        <Button onClick={onBack} variant="outline" className="w-full gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>
    </motion.div>
  );
}