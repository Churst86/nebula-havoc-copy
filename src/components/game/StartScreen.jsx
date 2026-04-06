import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Trophy, Settings, Play } from 'lucide-react';
import HighScoresMenu from './HighScoresMenu';
import OptionsScreen from './OptionsScreen';
import SavedGamesScreen from './SavedGamesScreen';
import { sounds } from '../../hooks/useSound.js';
import { loadAllSaveFiles } from '../../lib/gameSettings';

export const GAME_VERSION = import.meta.env.VITE_APP_VERSION || 'v1.3.0';
const BUILD_HASH = import.meta.env.VITE_BUILD_HASH || 'dev';
const BUILD_TIME = import.meta.env.VITE_BUILD_TIME || '';
const IS_WEB_DEV = !!import.meta.env.DEV;

export default function StartScreen({ onStart, onContinue, settings, onSettingsChange }) {
  const [showScores, setShowScores] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showSavedGames, setShowSavedGames] = useState(false);
  const [saves, setSaves] = useState(() => loadAllSaveFiles());
  const [patchState, setPatchState] = useState({
    checking: false,
    available: false,
    patching: false,
    progress: 0,
    currentVersion: GAME_VERSION,
    latestVersion: null,
    source: 'github',
    configured: true,
    patch: null,
    error: '',
    isDevBuild: false,
  });
  const isDesktop = !!window?.desktopApp?.isElectron;
  const displayCurrentVersion = !isDesktop && IS_WEB_DEV
    ? `dev-${BUILD_HASH}`
    : (patchState.currentVersion || GAME_VERSION);
  const buildModeBadge = (() => {
    if (!isDesktop && IS_WEB_DEV) {
      return { label: 'WEB DEV BUILD', className: 'bg-sky-700/70 text-sky-100 border-sky-400/60' };
    }
    if (!isDesktop) {
      return { label: 'WEB RELEASE', className: 'bg-indigo-700/70 text-indigo-100 border-indigo-400/60' };
    }
    if (patchState.isDevBuild) {
      return { label: 'DESKTOP LOCAL BUILD', className: 'bg-violet-700/60 text-violet-100 border-violet-400/70' };
    }
    return { label: 'DESKTOP RELEASE', className: 'bg-emerald-700/60 text-emerald-100 border-emerald-400/70' };
  })();

  const updaterBadge = (() => {
    if (!isDesktop) return { label: 'UPDATER DISABLED (WEB)', className: 'bg-slate-700/70 text-slate-200 border-slate-500/60' };
    if (patchState.checking) return { label: 'CHECKING...', className: 'bg-cyan-700/55 text-cyan-100 border-cyan-400/70' };
    if (patchState.error) return { label: 'CHECK FAILED', className: 'bg-red-700/60 text-red-100 border-red-400/70' };
    if (patchState.available) return { label: 'UPDATE AVAILABLE', className: 'bg-amber-700/60 text-amber-100 border-amber-400/70' };
    if (patchState.configured === false) return { label: 'UPDATER OFF', className: 'bg-slate-700/70 text-slate-200 border-slate-500/60' };
    return { label: 'UP TO DATE', className: 'bg-emerald-700/60 text-emerald-100 border-emerald-400/70' };
  })();
  const musicEnabled = settings.musicEnabled !== false;
  const bossModeUnlocked = settings.bossModeUnlocked === true;
  const hasAnySave = Object.values(saves || {}).some(Boolean);

  // Stop game music and start title music immediately on mount.
  // The IntroCrawl requires a user gesture to dismiss, so autoplay is already unblocked by the time StartScreen mounts.
  useEffect(() => {
    sounds.stopAllMusic();
    sounds.setMusicEnabled(musicEnabled);
    sounds.playTitleMusic();
  }, []);

  useEffect(() => {
    const refreshSave = () => setSaves(loadAllSaveFiles());
    refreshSave();
    window.addEventListener('focus', refreshSave);
    document.addEventListener('visibilitychange', refreshSave);
    return () => {
      window.removeEventListener('focus', refreshSave);
      document.removeEventListener('visibilitychange', refreshSave);
    };
  }, []);

  useEffect(() => {
    const desktopApi = window.desktopApp;
    if (!desktopApi?.isElectron || typeof desktopApi.checkForPatch !== 'function') return undefined;

    let cancelled = false;
    setPatchState(prev => ({ ...prev, checking: true, error: '' }));

    if (typeof desktopApi.getAppVersion === 'function') {
      desktopApi.getAppVersion().then((result) => {
        if (cancelled) return;
        if (result?.ok) {
          const updates = {};
          if (result.version) updates.currentVersion = result.version;
          if (result.isDevBuild !== undefined) updates.isDevBuild = result.isDevBuild;
          if (Object.keys(updates).length) setPatchState(prev => ({ ...prev, ...updates }));
        }
      }).catch(() => {
        // Keep existing fallback when version bridge fails.
      });
    }

    const detachProgress = typeof desktopApi.onPatchProgress === 'function'
      ? desktopApi.onPatchProgress((progress) => {
          if (cancelled) return;
          if (progress?.stage === 'downloading') {
            setPatchState(prev => ({
              ...prev,
              patching: true,
              progress: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
            }));
          }
        })
      : null;

    const manifestUrl = import.meta.env.VITE_PATCH_MANIFEST_URL || '';
    const githubRepo = import.meta.env.VITE_GITHUB_REPO || 'Churst86/nebula-havoc-copy';
    const githubAssetPattern = import.meta.env.VITE_GITHUB_ASSET_REGEX || 'Nebula-Havoc-.*\\.exe$';
    desktopApi.checkForPatch({
      manifestUrl,
      githubRepo,
      githubAssetPattern,
    }).then((result) => {
      if (cancelled) return;
      if (!result?.ok) {
        setPatchState(prev => ({
          ...prev,
          checking: false,
          error: result?.error || 'Unable to check for updates.',
        }));
        return;
      }

      setPatchState(prev => ({
        ...prev,
        checking: false,
        currentVersion: result.currentVersion || GAME_VERSION,
        latestVersion: result.latestVersion || null,
        source: result.patch?.source || (githubRepo ? 'github' : manifestUrl ? 'manifest' : 'none'),
        configured: result.configured !== false,
        available: !!result.updateAvailable,
        isDevBuild: result.isDevBuild || prev.isDevBuild,
        patch: result.patch || null,
        error: '',
      }));
    }).catch((error) => {
      if (cancelled) return;
      setPatchState(prev => ({
        ...prev,
        checking: false,
        error: error?.message || 'Unable to check for updates.',
      }));
    });

    return () => {
      cancelled = true;
      if (typeof detachProgress === 'function') detachProgress();
    };
  }, []);

  const beginPatchFlow = async () => {
    const desktopApi = window.desktopApp;
    if (!desktopApi?.isElectron || typeof desktopApi.downloadPatch !== 'function' || typeof desktopApi.applyPatchAndRestart !== 'function') {
      setPatchState(prev => ({ ...prev, error: 'Patching is unavailable in this build.' }));
      return;
    }

    if (!patchState.patch) {
      setPatchState(prev => ({ ...prev, error: 'Patch details are missing.' }));
      return;
    }

    try {
      setPatchState(prev => ({ ...prev, patching: true, progress: 0, error: '' }));
      const download = await desktopApi.downloadPatch(patchState.patch);
      if (!download?.ok) {
        setPatchState(prev => ({ ...prev, patching: false, error: download?.error || 'Patch download failed.' }));
        return;
      }

      setPatchState(prev => ({ ...prev, progress: 100 }));
      const applied = await desktopApi.applyPatchAndRestart({ patchPath: download.patchPath, version: patchState.latestVersion });
      if (!applied?.ok) {
        setPatchState(prev => ({ ...prev, patching: false, error: applied?.error || 'Could not apply patch.' }));
      }
    } catch (error) {
      setPatchState(prev => ({ ...prev, patching: false, error: error?.message || 'Could not apply patch.' }));
    }
  };

  if (showScores) return <HighScoresMenu onBack={() => setShowScores(false)} />;
  if (showOptions) return <OptionsScreen settings={settings} onSettingsChange={onSettingsChange} onBack={() => setShowOptions(false)} />;
  if (showSavedGames) {
    return (
      <SavedGamesScreen
        saves={saves}
        onBack={() => setShowSavedGames(false)}
        onLoad={(slot) => {
          setShowSavedGames(false);
          onContinue?.(slot);
        }}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto"
      style={{
        backgroundImage: 'url(https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69b94c96f2e7813ac4b009de/107976521_image.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}>
      
      {/* Dark overlay for text legibility */}
      <div className="absolute inset-0 bg-black/50" />
      
      <div className="relative z-10 text-center space-y-4 md:space-y-8 px-4 w-full max-w-xs md:max-w-sm">
        <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600">
          NEBULA HAVOK
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg tracking-widest uppercase">
          Bullet Hell Space Shooter
        </p>

        <div className="space-y-2 md:space-y-3 pt-1 md:pt-2">
          <Button
            onClick={onStart}
            size="lg"
            className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-base md:text-lg px-8 md:px-10 py-4 md:py-6 rounded-xl w-full">
            NEW GAME
          </Button>

          {bossModeUnlocked && (
            <Button
              onClick={() => onStart(false, true)}
              size="lg"
              variant="outline"
              className="font-bold text-base md:text-lg px-8 md:px-10 py-4 md:py-6 rounded-xl w-full border-red-500/60 text-red-400 hover:bg-red-950/30">
              ⚔ BOSS MODE
            </Button>
          )}

          <Button
            onClick={() => setShowSavedGames(true)}
            size="lg"
            variant="outline"
            className="font-bold text-sm md:text-lg px-6 md:px-10 py-4 md:py-6 rounded-xl w-full gap-2 border-cyan-500 text-cyan-300 hover:bg-cyan-900/30">
              <Play className="w-4 h-4 md:w-5 md:h-5" />
              {hasAnySave ? 'LOAD GAME' : 'SAVED GAMES'}
            </Button>

          <div className="flex gap-2 md:gap-3">
            <Button
              onClick={() => setShowScores(true)}
              variant="outline"
              size="lg"
              className="font-bold px-4 md:px-6 py-4 md:py-6 rounded-xl gap-2 flex-1 text-sm md:text-base">
              <Trophy className="w-4 h-4 md:w-5 md:h-5" />
              SCORES
            </Button>
            <Button
              onClick={() => setShowOptions(true)}
              variant="outline"
              size="lg"
              className="font-bold px-4 md:px-6 py-4 md:py-6 rounded-xl gap-2 flex-1 text-sm md:text-base">
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
              OPTIONS
            </Button>
          </div>

          {patchState.checking && (
            <div className="text-xs text-cyan-300/80 font-mono pt-1">Checking for updates...</div>
          )}

          {patchState.error && (
            <div className="text-xs text-red-300/90 font-mono pt-1">Updater: {patchState.error}</div>
          )}

          <div className="text-[11px] text-cyan-200/80 font-mono pt-1">
            Runtime: {isDesktop ? 'desktop' : 'web'}
            {' '}| Build: {isDesktop ? (patchState.isDevBuild ? `local·${BUILD_HASH}` : 'release') : (IS_WEB_DEV ? `dev·${BUILD_HASH}` : 'release')}
            {' '}| Version: {displayCurrentVersion}
            {isDesktop ? ` | Latest: ${patchState.latestVersion || (patchState.checking ? 'checking...' : 'n/a')}` : ''}
            {isDesktop && !patchState.checking && patchState.configured === false ? ' | Updater not configured' : ''}
          </div>
          {!isDesktop && IS_WEB_DEV && (
            <div className="text-[10px] text-sky-300/80 font-mono">
              ⚡ Web dev server build — local preview only
              {BUILD_TIME ? ` · started ${new Date(BUILD_TIME).toLocaleString()}` : ''}
            </div>
          )}
          {isDesktop && patchState.isDevBuild && !patchState.checking && (
            <div className="text-[10px] text-violet-300/80 font-mono">
              ⚡ Local build — changes not yet in a release
              {BUILD_TIME ? ` · built ${new Date(BUILD_TIME).toLocaleDateString()}` : ''}
            </div>
          )}

          <div className="pt-1 flex items-center justify-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${buildModeBadge.className}`}>
              {buildModeBadge.label}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${updaterBadge.className}`}>
              {updaterBadge.label}
            </span>
          </div>

          <div className="hidden md:block text-sm text-muted-foreground space-y-1 pt-2">
            <p><kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">WASD</kbd> or <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Arrow Keys</kbd> to move</p>
            <p>Auto-fire enabled &bull; <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> to pause</p>
          </div>
        </div>
      </div>

      {patchState.available && (
        <div className="absolute inset-0 z-30 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative w-full max-w-md rounded-2xl border border-cyan-500/40 bg-slate-950/95 p-6 text-left shadow-[0_0_40px_rgba(0,240,255,0.2)]">
            <div className="text-cyan-300 font-black tracking-wide text-lg">Patch Available</div>
            <p className="mt-2 text-sm text-slate-200">
              New version {patchState.latestVersion || 'available'} detected (current {patchState.currentVersion || GAME_VERSION}).
            </p>
            <p className="mt-1 text-xs text-cyan-200/80 font-mono">Source: {patchState.patch?.source || patchState.source || 'github'}</p>
            {patchState.patch?.notes && (
              <p className="mt-2 text-xs text-cyan-200/80 whitespace-pre-wrap">{patchState.patch.notes}</p>
            )}

            {patchState.patching && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-cyan-200/90 font-mono">
                  <span>Patching...</span>
                  <span>{Math.round(patchState.progress)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-cyan-900/40">
                  <div
                    className="h-full rounded-full bg-cyan-300 transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, patchState.progress))}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-300/90">The game will restart automatically when patching finishes.</div>
              </div>
            )}

            {patchState.error && (
              <div className="mt-3 text-xs text-red-300">{patchState.error}</div>
            )}

            <div className="mt-5 flex gap-2 justify-end">
              <Button
                onClick={() => setPatchState(prev => ({ ...prev, available: false }))}
                variant="outline"
                disabled={patchState.patching}
              >
                Later
              </Button>
              <Button
                onClick={beginPatchFlow}
                disabled={patchState.patching}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
              >
                {patchState.patching ? 'Patching...' : 'Patch and Restart'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>);

}