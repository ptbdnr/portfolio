---
title: Welcome to the blog
date: 2026-11-10
summary: What this site is, why it looks like 1989, and how the blog works — with every kind of embed in one place.
tags: [meta, site]
season: spring
---

Every mountain hut has a logbook by the door. People write the date, where they came from, where they are heading — and, if the soup was good, a line about the soup. This blog is mine.

It is where I write about the things I keep coming back to: applied AI, optimisation, uncertainty, and the occasional day in the mountains. Expect half-finished thoughts more than finished answers.

## Why does it look like this?

The screens I grew up with had **chunky pixels**, and the most advanced information service in the house was teletext. So the site is a little journey drawn in pixels — from a Sardinian beach to an Alpine summit — with a few nods to that era. The blog's index is a teletext page, for example: try typing a page number on it.

> If any of it gets in your way, open the **Menu** (top right) and switch on **Simple view** — or just switch off the animals, the old-TV effect or the sound. The words are what matter.

## What an entry can hold

Entries are plain Markdown files. Here is a quick tour, mostly as a note to future me.

### Pictures

![A sandpile grown one grain at a time](/media/sandpile.png "A sandpile after 16,000 grains — more on that in another entry")

### Video

Local video files (`.mp4`, `.webm`) use the normal image syntax:

![A sandpile growing, grain by grain](/media/sandpile.mp4 "Sixteen thousand grains, dropped one at a time")

…and so do YouTube or Vimeo links. Here is a lovely visual introduction to neural networks:

![But what is a neural network? — 3Blue1Brown](https://www.youtube.com/watch?v=aircAruvnKk)

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

Each entry gets an alpine grade from its length and how technical it is, a walking time in the style of the yellow signposts, and a hut stamp for your pass once you reach the end.[^stamps]

See you on the trail.

[^stamps]: Stamps and wildlife sightings are kept only in your browser's local storage.
