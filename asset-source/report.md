# Asset processing report

Total processed image size: **9.72 MB** in `app/assets/images/`.

| id | group | in | out | alpha ok | halo fix | islands removed | notes |
|---|---|---|---|---|---|---|---|
| app-icon | identity | 1024x1024 | icon 1024<br>adaptive 1024 (66%)<br>favicon 48 | yes | - | 0 |  |
| splash-art | identity | 1024x1536 | 1024x1536 PNG + JPEG (no upscaling) | yes | - | 0 |  |
| game-bg-pattern | identity | 1024x1024 | 512<br>256 | yes | - | 0 |  |
| emblem-otters | emblems | 1024x1024 | @1x 512x512 | yes | yes | 0 | @2x (1024px) skipped: source is only 837px<br>@3x (1536px) skipped: source is only 837px |
| emblem-frogs | emblems | 1024x1024 | @1x 512x512 | yes | yes | 0 | @2x (1024px) skipped: source is only 843px<br>@3x (1536px) skipped: source is only 843px |
| emblem-kingfishers | emblems | 1024x1024 | @1x 512x512 | yes | yes | 0 | @2x (1024px) skipped: source is only 879px<br>@3x (1536px) skipped: source is only 879px |
| mascot-otter | mascots | 1024x1024 | @1x 768x768 | yes | yes | 6 | @2x (1536px) skipped: source is only 1027px<br>@3x (2304px) skipped: source is only 1027px |
| mascot-frog | mascots | 1024x1024 | @1x 768x768 | yes | yes | 5 | @2x (1536px) skipped: source is only 1028px<br>@3x (2304px) skipped: source is only 1028px |
| mascot-kingfisher | mascots | 1024x1024 | @1x 768x768 | yes | yes | 5 | @2x (1536px) skipped: source is only 944px<br>@3x (2304px) skipped: source is only 944px |
| avatar-heron | avatars | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 1 |  |
| avatar-duck | avatars | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 0 |  |
| avatar-owl | avatars | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 3 |  |
| avatar-fox | avatars | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 0 |  |
| avatar-salamander | avatars | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 0 |  |
| avatar-dragonfly | avatars | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 0 |  |
| avatar-trout | avatars | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 0 |  |
| avatar-hedgehog | avatars | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 0 |  |
| marker-player | markers | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| marker-outpost | markers | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| marker-disputed | markers | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| marker-unsafe | markers | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| marker-fog | markers | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| flag-white | markers | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576<br>@1x 192x192<br>@2x 384x384<br>@3x 576x576<br>@1x 192x192<br>@2x 384x384<br>@3x 576x576<br>@1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 1 |  |
| treasure-pipe | treasures | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| treasure-trash | treasures | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| treasure-wildlife | treasures | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| treasure-plant | treasures | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| treasure-algae | treasures | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| badge-explorer | badges | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768<br>@1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 2 |  |
| badge-defender | badges | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768<br>@1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 1 |  |
| badge-detective | badges | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768<br>@1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 1 |  |
| badge-storm-chaser | badges | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768<br>@1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 0 |  |
| badge-treasure-hunter | badges | 1024x1024 | @1x 256x256<br>@2x 512x512<br>@3x 768x768<br>@1x 256x256<br>@2x 512x512<br>@3x 768x768 | yes | yes | 0 |  |
| icon-streak-flame | effects | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| coin | effects | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| coin-pile | effects | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| sparkle | effects | 1024x1024 | @1x 192x192<br>@2x 384x384<br>@3x 576x576 | yes | yes | 0 |  |
| plant-stage-1 | plant | 1024x1024 | @1x 512x512 | yes | yes | 3 | @2x (1024px) skipped: source is only 984px<br>@3x (1536px) skipped: source is only 984px<br>aligned with the other stages (same pot width and bottom line) |
| plant-stage-2 | plant | 1024x1024 | @1x 512x512 | yes | yes | 43 | @2x (1024px) skipped: source is only 984px<br>@3x (1536px) skipped: source is only 984px<br>aligned with the other stages (same pot width and bottom line) |
| plant-stage-3 | plant | 1024x1024 | @1x 512x512 | yes | yes | 3 | @2x (1024px) skipped: source is only 984px<br>@3x (1536px) skipped: source is only 984px<br>aligned with the other stages (same pot width and bottom line) |
| plant-stage-4 | plant | 1024x1024 | @1x 512x512 | yes | yes | 8 | @2x (1024px) skipped: source is only 984px<br>@3x (1536px) skipped: source is only 984px<br>aligned with the other stages (same pot width and bottom line) |
| plant-stage-5 | plant | 1024x1024 | @1x 512x512 | yes | yes | 23 | @2x (1024px) skipped: source is only 984px<br>@3x (1536px) skipped: source is only 984px<br>aligned with the other stages (same pot width and bottom line) |
| onboarding-explore | onboarding | 1024x1024 | @1x 892x1024 | yes | yes | 6 | @2x (2048px) skipped: source is only 1066px<br>@3x (3072px) skipped: source is only 1066px |
| onboarding-science | onboarding | 1024x1024 | @1x 781x859 | yes | yes | 12 | @1x made at the source size 859px (target 1024px; no upscaling)<br>@2x (2048px) skipped: source is only 859px<br>@3x (3072px) skipped: source is only 859px |
| onboarding-safety | onboarding | 1024x1024 | @1x 751x875 | yes | yes | 6 | @1x made at the source size 875px (target 1024px; no upscaling)<br>@2x (2048px) skipped: source is only 875px<br>@3x (3072px) skipped: source is only 875px |
| storm-cloud | moments | 1024x1024 | @1x 496x512 | yes | yes | 22 | @2x (1024px) skipped: source is only 935px<br>@3x (1536px) skipped: source is only 935px |
| victory-banner | moments | 1024x1024 | @1x 505x512 | yes | yes | 13 | @2x (1024px) skipped: source is only 960px<br>@3x (1536px) skipped: source is only 960px |
| quest-scroll | moments | 1024x1024 | @1x 453x512 | yes | yes | 0 | @2x (1024px) skipped: source is only 836px<br>@3x (1536px) skipped: source is only 836px |
| quest-chest | moments | 1024x1024 | @1x 512x491 | yes | yes | 0 | @2x (1024px) skipped: source is only 792px<br>@3x (1536px) skipped: source is only 792px |
| empty-treasures | moments | 1024x1024 | @1x 512x448<br>@2x 1024x896 | yes | yes | 4 | @3x (1536px) skipped: source is only 1047px |
| empty-peace | moments | 1024x1024 | @1x 490x512 | yes | yes | 10 | @2x (1024px) skipped: source is only 796px<br>@3x (1536px) skipped: source is only 796px |
| tile-conquered | moments | 1024x1024 | @1x 397x512<br>@1x 397x512<br>@1x 397x512<br>@1x 397x512 | yes | yes | 5 | @2x (1024px) skipped: source is only 979px<br>@3x (1536px) skipped: source is only 979px |
