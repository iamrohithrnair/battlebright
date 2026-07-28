/**
 * Public surface of the voice-commentary widget.
 *
 * Mount it anywhere with two roster names:
 *
 *   import { CommentaryDeck } from '@/components/commentary';
 *   <CommentaryDeck robotA="Tombstone" robotB="End Game" autoStart compact />
 *
 * It fetches its own script, synthesises its own audio and cleans up after
 * itself, so it needs nothing from the host page.
 */
export { CommentaryDeck, type CommentaryDeckProps } from './CommentaryDeck';

// Exported for hosts that want to build their own chrome around the engine.
export { useCommentary, type CommentaryEngine, type Phase } from './useCommentary';
export { TranscriptRail, type TranscriptRailProps } from './TranscriptRail';
export { GroundingPanel, type GroundingPanelProps } from './GroundingPanel';
export { TransportBar, type TransportBarProps } from './TransportBar';
export { Visualiser, type VisualiserProps } from './Visualiser';
export { VoiceSelect, type VoiceSelectProps } from './VoiceSelect';
export { HoldToTalk, type HoldToTalkProps } from './HoldToTalk';
