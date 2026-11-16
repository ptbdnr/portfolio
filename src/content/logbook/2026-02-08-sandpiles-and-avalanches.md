---
title: Small rules, big avalanches
date: 2026-02-08
summary: A pile of sand, a few lines of code, and why some systems spend their lives on the edge of collapse.
tags: [complex-systems, ml, python, avalanches]
season: winter
---

Drop grains of sand onto a table, one at a time. For a while nothing interesting happens: the pile just grows. Then it starts doing something odd. Most new grains cause nothing at all, some cause a little slide — and every now and then a single grain sets off an avalanche that reorganises the whole pile.

In 1987 Per Bak, Chao Tang and Kurt Wiesenfeld turned this into a model small enough to fit on an index card, and it has been quietly influential ever since.

## The rule

Take a grid. Each cell holds a number of grains $z_i$. Add a grain to a random cell. If any cell reaches four grains, it **topples**: it loses four and each of its four neighbours gains one (grains falling off the edge are lost).

$$
z_i \ge 4 \;\Longrightarrow\; z_i \leftarrow z_i - 4, \qquad z_j \leftarrow z_j + 1 \;\; \text{for each neighbour } j
$$

Toppling can push neighbours over the threshold, which topple in turn. The number of topplings triggered by one grain is the *size* of that avalanche.

```python
import numpy as np

def add_grain(z: np.ndarray, x: int, y: int) -> int:
    """Drop one grain at (x, y), relax the pile, return the avalanche size."""
    z[y, x] += 1
    size, stack = 0, [(x, y)]
    while stack:
        cx, cy = stack.pop()
        if z[cy, cx] < 4:
            continue
        z[cy, cx] -= 4
        size += 1
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < z.shape[1] and 0 <= ny < z.shape[0]:
                z[ny, nx] += 1
                if z[ny, nx] >= 4:
                    stack.append((nx, ny))
        if z[cy, cx] >= 4:
            stack.append((cx, cy))
    return size
```

Drop all the grains on the same cell instead and you get something unexpectedly beautiful. The colours below are 0–3 grains, from dark to snow-white:

![A sandpile growing from a single source](/media/sandpile.mp4 "16,000 grains on one cell of a 96×96 grid")

## Living on the edge

The interesting part is what happens with random drops. Nobody tunes a parameter, yet the pile drives itself to a *critical* state where avalanches of every size occur, and their sizes follow a power law:

$$
P(s) \propto s^{-\tau}
$$

![Avalanche sizes on a log-log plot](/media/avalanche-sizes.svg "120,000 grains on a 48×48 grid. A quick least-squares fit on the straight part gives a slope of about −1.1; published estimates for this model are around 1.1–1.3 depending on method.")

On a log-log plot a power law is a straight line — no "typical" avalanche size, just fewer big ones than small ones, all the way up until the edges of the table get in the way. Bak called this *self-organised criticality*.

You can hear it, too. Below, every toppling is a click: most grains make a single tick, some a short burst, and every so often one sets off a crackle that goes on and on. Physicists call this kind of signal *crackling noise*; it turns up in paper being crumpled, magnets being magnetised and earthquakes.

![A sandpile at the critical point, one click per toppling](/media/sandpile-crackle.mp3 "Random grains on a 48×48 table at its critical point. Headphones help.")

## What it is not

It is tempting to say this explains snow avalanches. It doesn't, and I would not want anyone to make decisions in avalanche terrain based on a toy on a laptop. Real slab avalanches depend on weak layers, temperature, wind loading and slope angle — that is what avalanche bulletins and proper training are for.[^bulletin]

What the sandpile *does* teach is a habit of mind.

## Why I keep thinking about it

A lot of the systems I work with have the same shape: long quiet periods, lots of small corrections, and rare cascades — a delayed truck that reshuffles a whole depot's plan, or a training run that is fine for hours and then spikes. A few lessons carry over:

- **Averages hide the story.** If outcomes are heavy-tailed, the mean is dominated by events you may not have seen yet.
- **Look at the tail on purpose.** Test with the rare inputs, not just the common ones.
- **Small slack is cheap insurance.** A system run right at its threshold will eventually find out.

Four lines of rules, and still a good reminder to leave some margin.

[^bulletin]: In Italy, the regional services publish daily bulletins (for example AINEVA). Read them, and take a course.
