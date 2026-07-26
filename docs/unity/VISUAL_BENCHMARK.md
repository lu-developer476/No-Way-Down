# VisualBenchmark specification

`Assets/NWD/Scenes/Benchmark/VisualBenchmark.unity` is generated only by the Unity editor command. It is a development-only, approximately 10 × 10 m technical room and is deliberately absent from the canonical manifest and disabled in normal Build Settings. It is not node 36, cannot advance progress, and has no narrative output.

The idempotent generator authors marked provisional geometry for a floor, enclosure, small step, door, columns, pipes, debris, bank furniture and a localized puddle; cold, warm and restricted red lighting; a first-person camera, placeholder weapon and independent flashlight; reflection and light probes; named decal/local-fog authoring roots; a benchmark volume; fixed capture transforms; and start/end points. These primitives are instrumentation, not final-quality art and do not reproduce either visual reference.

The technical material kit uses HDRP/Lit and localized wetness with non-uniform smoothness. All materials and renderer assignments require inspection after Editor generation; no claim about missing/pink materials can be made before that inspection.

## Reproducible measurement

Use a Windows x64 Development build at High, 1920 × 1080, after a clean restart. Capture `Benchmark_Overview`, `Benchmark_Flashlight`, `Benchmark_WetFloor`, and `Benchmark_EmergencyLight`. Record hardware, Unity patch, build commit, average/minimum FPS, CPU/GPU frame times, light count, volumetric and SSR state. The development overlay reports FPS, frame time, resolution, quality, approximate lights, scene and active pipeline. Draw calls and triangles are explicitly reported unavailable until a supported profiler recorder is integrated.

Current baseline: **no medido**. No Editor or player build was available in the execution environment.
