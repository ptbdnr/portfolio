---
title: Calibration is a form of honesty
date: 2026-10-04
summary: Good mountain guides and good models share a habit — when they say seventy percent, they mean it.
tags: [ml, ai, uncertainty, mountains]
season: autumn
---

There is a moment on most big days out when someone asks: *are we still going to make it?* The useful answer is never "yes" or "no". It is something like "probably, if the snow holds — let's decide at the col". That answer contains a probability, a condition and a decision point. It is also exactly what I want from a machine learning model.

## Accuracy is not the whole story

A model can be right most of the time and still mislead you, because it is right *for the wrong confidence*. A model is **calibrated** when its stated probabilities match how often things actually happen: of all the days it calls "70% good", about 70% turn out good.

A reliability diagram makes this visible. Bin the predictions by confidence, then plot how often each bin was right:

![Reliability diagram of an over-confident and a calibrated forecaster](/media/reliability.svg "Bars on the dashed diagonal are calibrated. The red model is too sure of itself at both ends.")

The red model is *over-confident*: when it says 90%, reality is closer to 70%. Many modern neural networks behave like this out of the box (Guo et al., 2017). On a mountain, that shape has a name — summit fever.

## Measuring it

The expected calibration error is the weighted average gap between confidence and accuracy across bins:

$$
\mathrm{ECE} = \sum_{b=1}^{B} \frac{|S_b|}{n}\,\bigl|\operatorname{acc}(S_b) - \operatorname{conf}(S_b)\bigr|
$$

```python
import numpy as np

def expected_calibration_error(conf: np.ndarray, correct: np.ndarray, bins: int = 10) -> float:
    edges = np.linspace(0.0, 1.0, bins + 1)
    idx = np.clip(np.digitize(conf, edges) - 1, 0, bins - 1)
    ece = 0.0
    for b in range(bins):
        mask = idx == b
        if mask.any():
            ece += mask.mean() * abs(correct[mask].mean() - conf[mask].mean())
    return ece
```

It is a blunt instrument — sensitive to the binning, blind to *which* inputs are off — but it is a good first altimeter reading.

## Fixing it (a little)

The surprisingly effective first fix is *temperature scaling*: divide the logits $z$ by a single learned number $T$ before the softmax, fitted on held-out data.

$$
\hat{p} = \operatorname{softmax}(z / T)
$$

With $T > 1$ the model becomes less sure of itself without changing which answer it picks, so accuracy is untouched. One parameter, often a big improvement. It is the statistical equivalent of a guide quietly adding an hour to the guidebook time.

## Language models and turning back

Large language models make this both more important and harder. They can sound equally fluent whether they know something or not, and asking them how confident they are does not always give you a calibrated number. The practical answers look a lot like mountain craft:

1. **Measure before you trust.** Build evaluations on your own data, including the awkward cases.
2. **Give the system a way to turn back.** "I'm not sure — here is who to ask" should be a valid, rewarded outcome, not a failure.
3. **Decide the turn-around point in advance.** Thresholds for when a human reviews an answer are easier to set calmly at the start than in the moment.

## The habit

Calibration is not glamorous. It does not make a model more impressive in a demo. But it is what lets other people make good decisions with your numbers — which, in the end, is the job.

The best people I have been in the mountains with are like that. Their "probably" means probably. You can plan around it.
