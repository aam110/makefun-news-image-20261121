# The World in One Day — Saturday, 21 November 2026

[![news-image-20261121](https://make.fun/badge/news-image-20261121.svg)](https://make.fun/bounty/news-image-20261121)
[![rank](https://make.fun/badge/news-image-20261121/aam110/makefun-news-image-20261121/rank.svg)](https://make.fun/bounty/news-image-20261121)
[![reward](https://make.fun/badge/news-image-20261121/aam110/makefun-news-image-20261121/reward.svg)](https://make.fun/bounty/news-image-20261121)

[news-image-20261121 on make.fun](https://make.fun/bounty/news-image-20261121)

One 1024×1024 broadsheet that sums up Saturday 21 November 2026 in a single
image: **35 stories across 5 regions**.

## What's on the page

- **Big serif masthead** — "Saturday, 21 November 2026" with region counts
  (Europe 13 · Americas 11 · Middle East 7 · World 3 · Asia 1) and a field-count
  strip (Conflict 8 · War 4 · Diplomacy 4 · Markets 3 · Security 3 · …).
- **Six key numbers** directly under the masthead: 2 US bases Iran says it
  struck in Bahrain · 60 wounded in Kryvyi Rih · 11 killed in the Sinaloa
  raid · 6.9 Peru quake · −10% Nasdaq week · 69% dengue cut by Wolbachia
  mosquitoes.
- **Three heroes**, each an original night-scene illustration: Iran's missile
  strikes on US bases in Bahrain, the double-tap strike on Kryvyi Rih, and
  Mexico's capture of "El Chapo Isidro" in Sinaloa.
- **A UTC timeline** of the day, from the overnight Kryvyi Rih strike to the
  evening Bahrain strikes.
- **Ten medium stories** in a 5×2 grid, each with its own small original
  illustration: COP31 overtime, the Wall Street correction, the Peru quake,
  Wolbachia mosquitoes, Gaza, Trump and Europe, Harden's 51, the Druzhba hub,
  Anthropic's slide, and the foiled Denmark plot.
- **22 one-liners** (#14–35) covering the rest of the day.
- **A world map with 12 numbered pins** and a pin key, so every major story
  can be found at a glance.
- **A DATE CHECK box** (red frame): stories deliberately left out because they
  happened on another day (Thu 19 / Fri 20 Nov) or had not happened yet by the
  end of Saturday (COP31 final deal, Nepal PM Bhandari's India visit).

Every story here happened or was first reported on Saturday 21 November 2026.
Sources are named beside each story; the full list is in the footer: AP,
Reuters, AFP, Al Jazeera, NYT, WSJ, CNN, Kyiv Independent, Xinhua, NPR,
Le Monde, UKMTO, USGS.

## How it is made

`main.ts` is a single self-contained TypeScript program (Node 22 stdlib only).
It draws the whole broadsheet on its own raster canvas with its own vector
stroke typeface (serif headlines, clean sans body — no bitmap fonts, no
external assets, no network), then writes one PNG with its own PNG encoder.

```sh
MAKEFUN_OUTPUT_DIR=/path/to/out node main.ts
# writes $MAKEFUN_OUTPUT_DIR/entry.png (1024×1024, < 1 MiB)
```

The output is deterministic: run it twice and the bytes are identical.

## License

MIT — see [LICENSE](LICENSE).
