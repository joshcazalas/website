import type { FactoryCore } from './factory-core';
import type { FoundationOutpost } from './foundation-outpost';
import type { MenuBackdrop } from './menu-backdrop';
import type { MainMenu } from './main-menu';
import type { Destination } from './factory';
import type { ReleaseSnapshot } from './caz-release';
import type { PlaybackSnapshot } from './auxide-playback';
import type { AuxideAudio } from './auxide-audio';

export type FactoryDebugState = {
  ready: boolean; entered: boolean; entry: MainMenu['state']; menu: MenuBackdrop['state'];
  machines: number; belts: number; crossings: number; railRoutes: number;
  conveyors: FactoryCore['conveyorState'];
  camera: { x: number; y: number; zoom: number }; paused: boolean; time: number; fps: number;
  trains: FactoryCore['trainState']; destination: Destination; outpost: FoundationOutpost['state'];
  caz: ReleaseSnapshot & { machines: number; belts: number; crossings: number };
  auxide: { selected: number; players: PlaybackSnapshot[]; audio: AuxideAudio['state'] };
};
