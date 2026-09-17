# 10 How do cards look on a phone?

Type: prototype
Status: resolved
Blocked by: 
Map: ../map.md

## Question

Build a throwaway prototype of the card face and the Hand display in portrait on a phone: SVG-drawn cards versus an image set, the four special cards, fanning and selecting cards for a Combination. React to it and decide the direction.

Note (decided 2026-09-17): the app draws its own cards as SVG. Fata Morgana's artwork is copyrighted and is not used. Four suits in distinct colours, plain rank glyphs, four original icons for Mah Jong, Dog, Phoenix and Dragon. The prototype decides layout, fanning and selection only.

## Answer

Prototype: four variants in one HTML file, captured on branch `prototype/card-art` (`.scratch/tichu/prototypes/card-art.html`, served locally via the `prototypes` launch config). Pavel reacted 2026-09-17.

**Verdict: variant D.** Card faces from B: solid suit-colour face, white rank, huge; specials in a fifth colour with an original icon. Hand as a **single overlapping row**, sorted low to high, with a small rank in the top-left corner so covered cards stay readable; a tapped card lifts and glows; no fanning, no grouping, no scrolling.

- Suits: Jade (green), Sword (blue), Pagoda (red), Star (yellow); specials in violet. All art original SVG.
- Rejected: A (rotated fan: cramped and hard to tap on a phone), B's rank grouping (nice for pairs but two rows and gaps), C (two scroll rows).
- Detail for the Table prototype: two-digit ranks (10) clip under the next card at 23 px overlap; either widen the overlap or shrink the corner glyph.
