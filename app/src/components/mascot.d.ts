export type MascotPose = 'wave' | 'point' | 'check' | 'stop'
export const MASCOT_POSES: MascotPose[]
export function mascotSvg(pose?: MascotPose, opts?: { size?: number; title?: string }): string
