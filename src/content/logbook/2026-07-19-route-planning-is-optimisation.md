---
title: Hut-to-hut planning is an optimisation problem
date: 2026-07-19
summary: Shortest paths, time windows and the alpine start — a gentle bridge from mountain logistics to operations research.
tags: [optimisation, operations-research, mountains, python]
season: summer
---

Planning a hut-to-hut tour looks a lot like a problem I used to see at work, just with fewer parcels and better views. You have places, travel times between them, opening hours, capacities, and a fair amount of uncertainty. Somewhere in there is a "best" plan — if you can say what *best* means.

## The map is a graph

Start with the obvious model: huts are nodes, paths are edges, and each edge has a walking time.

![A toy hut network with the fastest feasible route highlighted](/media/hut-graph.svg "Red: the route that gets you to the summit soonest without breaking the rules below")

If all you want is the shortest walking time, this is Dijkstra's algorithm from 1959, and you are done before the coffee is ready. Real tours are more interesting because of **constraints**:

| In the mountains | In logistics |
|------------------|--------------|
| Hut beds must be booked | Depot and vehicle capacity |
| Cross the glacier before the snow softens | Delivery time windows |
| At most ~7 hours a day for the slowest in the group | Driver hours regulations |
| Weather windows | Uncertain demand and travel times |
| The rope team moves at one speed | A vehicle route is one sequence |

## Adding resources

Add a daily limit on walking hours and the problem becomes a *resource-constrained shortest path*. That small change makes it NP-hard in general — but instances the size of a ski tour are tiny, and a labelling algorithm handles them easily. Each label is a partial plan; we keep only labels that are not dominated by another one that is both faster *and* less tired.

```python
import heapq

def plan(graph, start, goal, max_day=7.0):
    """graph[u] = [(v, hours, needs_morning)]; returns (total_hours, days, path)."""
    # label: (total_hours, days, hours_today, node, path)
    queue = [(0.0, 1, 0.0, start, [start])]
    best = {}
    while queue:
        total, days, today, node, path = heapq.heappop(queue)
        if node == goal:
            return total, days, path
        if best.get((node, days), float("inf")) <= today:
            continue  # dominated: same place, same day, already less tired
        best[(node, days)] = today
        for nxt, hours, needs_morning in graph[node]:
            if hours > max_day:
                continue
            # Stay the night if today's legs would run too long or miss the cold morning.
            new_day = today + hours > max_day or (needs_morning and today > 0)
            heapq.heappush(queue, (
                total + hours,
                days + new_day,
                hours if new_day else today + hours,
                nxt,
                path + [nxt],
            ))
    return None
```

It is a sketch, not production code — but it shows the shape: the state carries the resources you care about, and dominance keeps the search small.

## What the model can't do

The objective is the hard part. Fastest? Safest? Most beautiful? The hut with the best *polenta*? In operations research we would turn these into weighted costs or constraints and argue about the weights in a meeting. In the mountains, the honest answer is that a model is good for **preparing options** — the plan B and plan C you will be glad of when the forecast changes — and judgement decides on the day.

$$
\min_{\text{route}} \; \sum_{e \in \text{route}} t_e \quad \text{s.t.} \quad \text{hours}_d \le H \;\; \forall d, \qquad \text{arrive}_{\text{glacier}} \le 11{:}00
$$

That second constraint is why alpine starts exist. Snow bridges are firmest in the cold of the early morning, so the plan has to be built backwards from the time you want to be off the ice.

## The part I like most

What I enjoy about optimisation is not the solver; it is the conversation it forces. Writing the constraints down makes everyone say what they actually care about. That is useful whether you are planning a fleet of vans or four days in the Alps with friends.
