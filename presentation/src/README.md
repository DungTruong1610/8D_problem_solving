# 8D Copilot slides: source

> **Competition context:** [AI4Biz 2026 — LIKELION Vietnam](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21), team UIT_4Lovpe. Competition requirements and submission limits are maintained in that reference; technical examples below are not measured business outcomes unless explicitly documented.

`../8d-copilot-slides.html` is a build output. Edit the files here, then rebuild.

| File | Purpose |
|------|---------|
| `8d-copilot-slides.src.html` | Deck source: slides, CSS, step engine. Screenshots are `__IMGn__` placeholders, photos are `__PHOTO:name__`, photo credits are `__CREDIT:name__`, logos are `__LOGO:name__` (`img/logos/name.png`), and the intro video on slide 3 is `__VIDEO:name__`, read from `presentation/name.mp4`. The video is embedded as base64, so the built deck is about 36 MB. |
| `img/shotN.jpg` | Real app screenshots, injected as base64 by the build. Captured from the live site at 2× scale, case 8D-10048788 (shot1 D4, shot3 D7). shot2, shot4, shot6 and shot7 are no longer used by the deck. When you replace one, re-measure its `zone` and `bd` positions. |
| `img/photos/*.jpg` | Openly licensed photos (Wikimedia Commons). `credits.json` maps each file name to the credit line shown on the slide; `CREDITS.md` lists author, licence and source page. |
| `build.py` | Replaces the placeholders with the images and credits and writes `../8d-copilot-slides.html`. |

```bash
python presentation/src/build.py
```

## AI4Biz export requirements

The source assets described here may exist only in the local working tree. Publishing this Markdown does not publish or rebuild the HTML, images or video. Before submission, update the deck for AI4Biz / LIKELION Vietnam, use the roster in [README](../../README.md#team), export an English PDF of at most 15 slides, and verify a demo video of at most 2 minutes. At least 3 members must present in the final pitch. The older slide outline below is an editing reference, not a confirmed AI4Biz submission.

## Story and slides

The problem part follows one real case family from the demo data: the P90 pump housing
(MAT-10318, die casting line WC-CAST-03, defect DEF-0512, porosity at the sealing face).

| # | Slide | Content |
|---|-------|---------|
| 1 | Mở đầu | Cover |
| 2 | 8D là gì | Definition, Ford 1987, IATF 16949, why suppliers must answer with 8D; the P90 example |
| 3 | Một bản 8D mất bao lâu | Where 10–14 days go; the P90 leak recurring in May, Jul, Sep, Oct |
| 4 | Tám bước | D1–D8 applied to the P90 case |
| 5 | AI trong 8D | Four AI jobs and the steps they serve; real run of 8D-10049402 (75 s); why 8D suits AI |
| 6 | Trước và sau | 10–14 days → ½–1 day, five-row comparison |
| 7 | Sản phẩm | Wireframe vs real case screen (spotlight) |
| 8 | AI chạy ở đâu | Four pipeline stages, LLM vs rules, stack, measured cost |
| 9 | Tìm tiền lệ | Graph links MAT-10318 / WC-CAST-03 / DEF-0512 to the closed P90 cases |
| 10 | Khó khăn | Five hard problems and how the product handles them |
| 11 | Kiểm chứng | Four test scenarios |
| 12 | Kết thúc | Closing |

Figures from the demo database: 8D-10049140 closed in 24 days, 8D-10048577 in 26 days;
the AI analysis of 8D-10049402 took 75 s and about 135k tokens (DeepSeek Flash).
The "10–14 days" and "½–1 day" headline figures still need a cited source.

## Click steps

Each slide advances one click at a time. Attributes in the source drive it:

| Attribute | Effect at step N |
|-----------|------------------|
| `data-step="n"` | element appears (`.shown`) at step ≥ n, focused (`.now`) at step n |
| `data-hl="n"` | highlighted (`.now`) only at step n |

A slide's click count is the highest number it uses. On slides with `data-spot`, a light grey spotlight dims everything except the current `data-hl` zones and numbered badges.

The footer of every slide shows one dot per slide; the current slide's dot is red and stretched.

Keys: → / Space / Enter next, ← back, N speaker notes, F fullscreen, Home / End.

Last updated: 2026-10-16
