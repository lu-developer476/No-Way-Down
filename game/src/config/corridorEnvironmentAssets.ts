export type CorridorAssetCategory = 'architecture' | 'fixture' | 'damage' | 'prop' | 'foreground' | 'floor';

export interface CorridorEnvironmentAsset {
  key: string;
  path: string;
  intendedWidth: number;
  intendedHeight: number;
  category: CorridorAssetCategory;
}

const ROOT = 'assets/visual-v2/environments/institutional';
const asset = (name: string, intendedWidth: number, intendedHeight: number, category: CorridorAssetCategory): CorridorEnvironmentAsset => ({
  key: `corridor-${name}`, path: `${ROOT}/${name}.svg`, intendedWidth, intendedHeight, category
});

export const corridorEnvironmentAssets: readonly CorridorEnvironmentAsset[] = Object.freeze([
  asset('corridor-wall-clean', 640, 520, 'architecture'), asset('corridor-wall-damaged', 640, 520, 'architecture'),
  asset('teller-window', 420, 300, 'architecture'), asset('teller-window-broken', 420, 300, 'architecture'),
  asset('security-bars', 320, 360, 'architecture'), asset('service-door', 180, 340, 'architecture'),
  asset('security-door', 190, 350, 'architecture'), asset('exit-door', 220, 360, 'architecture'),
  asset('exit-sign', 150, 54, 'fixture'), asset('office-window-dark', 300, 230, 'architecture'),
  asset('office-window-lit', 300, 230, 'architecture'), asset('bank-bench', 260, 130, 'prop'),
  asset('trash-bin', 80, 120, 'prop'), asset('pipe-bundle', 360, 100, 'fixture'),
  asset('cable-tray', 420, 80, 'fixture'), asset('ceiling-light-cold', 180, 70, 'fixture'),
  asset('ceiling-light-emergency', 150, 80, 'fixture'), asset('wall-cracks-a', 180, 180, 'damage'),
  asset('wall-cracks-b', 220, 160, 'damage'), asset('humidity-stain', 280, 190, 'damage'),
  asset('blood-smear', 190, 100, 'damage'), asset('paper-cluster', 190, 90, 'prop'),
  asset('debris-cluster', 250, 100, 'prop'), asset('broken-furniture', 280, 190, 'prop'),
  asset('foreground-column', 170, 620, 'foreground'), asset('foreground-bars', 360, 620, 'foreground'),
  asset('stairs-end', 520, 420, 'architecture'), asset('floor-wet-strip', 480, 90, 'floor'),
  asset('floor-damage', 360, 90, 'floor'), asset('bank-signage', 300, 100, 'fixture')
]);

export const corridorEnvironmentAssetKeys = new Set(corridorEnvironmentAssets.map(({ key }) => key));
