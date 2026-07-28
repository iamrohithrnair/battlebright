/**
 * The shared 3D arena module. Pages compose these rather than declaring their
 * own lights, floors or robot geometry, so the pit looks the same everywhere.
 */
export { ArenaCanvas, type ArenaCanvasProps } from './ArenaCanvas';
export { ArenaFloor, type ArenaFloorProps } from './ArenaFloor';
export { LightRig, type LightRigProps } from './LightRig';
export { RobotMesh, type RobotMeshProps } from './RobotMesh';
export { RobotSilhouette, type RobotSilhouetteProps } from './RobotSilhouette';
export { ImpactBurst, SpotBeam, FloorGlow } from './Effects';
export { ARENA, accentFor, liveryFor } from './palette';
