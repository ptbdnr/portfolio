---
title: Welcome to the blog
date: 2026-11-10
summary: What this site is, why it's a walk through photographs, and how the blog works — with every kind of embed in one place.
tags: [meta, site]
season: spring
scene: valley
---

Every mountain hut has a logbook by the door. People write the date, where they came from, where they are heading — and, if the soup was good, a line about the soup. This blog is mine.

It is where I write about the things I keep coming back to: applied AI, optimisation, uncertainty, and the occasional day in the mountains. Expect half-finished thoughts more than finished answers.

## Why is it a walk?

Because that's how I'd rather meet people: outside, walking somewhere. The site is a walk from a Mediterranean beach to an Alpine summit and home to London, in 360° photographs you can look around in. I left notes along the way about who I am and what I do, and every post here is pinned somewhere on the trail like a waymark: red and white, like the paint on Alpine rocks.

The photographs are real places, free for anyone to use, from [Poly Haven](https://polyhaven.com). The sounds — wind, water, birds, cowbells — are made up live in your browser, so they never repeat quite the same way.

> If any of it gets in your way, open the **Menu** and switch on **Simple view**, or turn the sound and the motion down. The words are what matter.

## What an entry can hold

Entries are plain Markdown files. Here is a quick tour, mostly as a note to future me.

### Pictures

![A sandpile grown one grain at a time](/media/sandpile.png "A sandpile after 16,000 grains — more on that in another entry")

### Sound

Sound files (`.mp3`, `.m4a`, `.ogg`, `.opus`, `.wav`, `.flac`) use the image syntax too. This is a sandpile at its critical point, listened to: every click is one toppling, so a small avalanche is a tick and a big one a long crackle.

![A sandpile at the critical point, one click per toppling](/media/sandpile-crackle.mp3 "Twenty-four seconds of avalanches on a 48×48 table. Headphones help.")

### Video

Local video files (`.mp4`, `.webm`) use the same syntax:

![A sandpile growing, grain by grain](/media/sandpile.mp4 "Sixteen thousand grains, dropped one at a time")

…and so do YouTube or Vimeo links. Here is a lovely visual introduction to neural networks:

![But what is a neural network? — 3Blue1Brown](https://www.youtube.com/watch?v=aircAruvnKk)

While a post's own sound or video plays, the trail's sounds step back.

### Code and maths

```python
def turn_back(p_success: float, risk_budget: float = 0.1) -> bool:
    """Probably the most important function in mountaineering."""
    return 1 - p_success > risk_budget
```

Inline maths like $e^{i\pi} + 1 = 0$ works, and so do display equations:

$$
\mathrm{ECE} = \sum_{b=1}^{B} \frac{|S_b|}{n}\,\bigl|\operatorname{acc}(S_b) - \operatorname{conf}(S_b)\bigr|
$$

### Tables

| Grade | Means | Here it means |
|-------|-------|---------------|
| F | *facile* | a short read |
| PD | *peu difficile* | a coffee's worth |
| AD | *assez difficile* | some code or maths |
| D · TD · ED | harder and harder | bring snacks |

Each entry gets an alpine grade from its length and how technical it is, a walking time in the style of the yellow signposts, and a stamp in your logbook once you reach the end.[^stamps]

See you on the trail.

[^stamps]: Stamps, notes read and things spotted are kept only in your browser's local storage.
