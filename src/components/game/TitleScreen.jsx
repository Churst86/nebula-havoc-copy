import React from 'react';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

export default function TitleScreen({ onPlayClick }) {
  return (
    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-40 space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Zap className="w-16 h-16 text-primary fill-primary" />
          <h1 className="text-6xl font-black text-white tracking-wider">VOID STORM</h1>
          <Zap className="w-16 h-16 text-primary fill-primary" />
        </div>
        <p className="text-muted-foreground text-lg">Survive the electromagnetic tempest</p>
      </div>

      <Button
        onClick={onPlayClick}
        className="bg-primary hover:bg-primary/90 text-lg h-12 px-12"
      >
        PLAY
      </Button>

      <p className="text-muted-foreground text-sm text-center max-w-sm">
        Use arrow keys or WASD to move • Space or click to aim • Enter to pause
      </p>
    </div>
  );
}