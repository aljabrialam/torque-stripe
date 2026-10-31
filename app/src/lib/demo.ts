// Demo-only fixtures. Everything here is labelled "sample" in the UI; answers never come from this file.

/** Demo questions: each shows a different engine behaviour on the real dataset. */
export const DEMO_QUESTIONS: { model: string; q: string; label?: string; shows: string }[] = [
  { model: 'AS350B3', q: 'main rotor servo-control torque inspection', shows: 'Answered, all units' },
  { model: 'AS350B3', q: 'Any proposed ADs for AS350B3?', shows: 'List for a model' },
  { model: 'AS350B', q: 'What does FAA-2026-11800 require?', shows: 'Model listed' },
  { model: 'AS350B3', q: 'What does FAA-2026-11800 require?', shows: 'Not applicable' },
  { model: '', q: 'Status of FAA-2026-1338', shows: 'Revision chain' },
  { model: '', q: 'Is FAA-2013-0541 still active?', shows: 'Withdrawn' },
  { model: '', q: 'Does FAA-2026-1335 apply to my 787?', shows: 'Needs variant' },
  { model: '787-9', q: 'Does FAA-2026-1335 apply to my 787-9?', shows: 'Units unconfirmed' },
  { model: '', q: 'Which NPRM supersedes AD 2026-09-02?', shows: 'Supersedes' },
  { model: '', q: 'What is the torque for the A380-841 landing gear?', label: 'A380-841 landing gear torque', shows: 'Refused' },
]

/** A sample operator so the Fleet view has something to show before the real backend holds customer fleets. */
export const SAMPLE_OPERATOR = {
  name: 'Sample operator (demo)',
  base: 'WSSS · Singapore',
  fleet: [
    { model: 'AS350B3', tails: ['9V-HLA', '9V-HLB', '9V-HLC'] },
    { model: 'A330-243', tails: ['9V-STA', '9V-STB'] },
    { model: '787-9', tails: ['9V-OJA'] },
    { model: 'A350-941', tails: ['9V-SMA', '9V-SMB', '9V-SMC', '9V-SMD'] },
    { model: 'ATR72-212A', tails: ['9V-ATR'] },
  ],
}

/** Sample shift activity for the top status strip. */
export const SAMPLE_SHIFT = { engineer: 'B1 · Line maintenance', shift: 'Day shift', station: 'WSSS' }
