import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  billableSeconds,
  FxRateMissingError,
  priceCdr,
  type RateLineSnapshot,
} from "./rating.js";

const baseLine: RateLineSnapshot = {
  minDurationSeconds: 30,
  incrementSeconds: 6,
  setupFee: null,
  buyCurrency: "usd",
  buyRate: "0.012000",
  sellCurrency: "usd",
  sellRate: "0.024000",
};

describe("billableSeconds", () => {
  it("clamps below min duration", () => {
    assert.equal(billableSeconds(5, 30, 6), 30);
  });
  it("rounds up to increment", () => {
    assert.equal(billableSeconds(31, 30, 6), 36);
    assert.equal(billableSeconds(60, 30, 6), 60);
    assert.equal(billableSeconds(61, 30, 6), 66);
  });
  it("treats per-second billing (inc=1) correctly", () => {
    assert.equal(billableSeconds(45, 0, 1), 45);
  });
  it("returns 0 for 0 billsec when min is 0", () => {
    assert.equal(billableSeconds(0, 0, 1), 0);
  });
  it("rejects negative billsec", () => {
    assert.throws(() => billableSeconds(-1, 0, 1));
  });
  it("rejects increment <= 0", () => {
    assert.throws(() => billableSeconds(10, 0, 0));
  });
});

describe("priceCdr — same currency", () => {
  it("computes cost with min-duration clamp", () => {
    const r = priceCdr(5, baseLine, null);
    assert.equal(r.billableSeconds, 30);
    // 30s * 0.012/min = 30/60 * 0.012 = 0.006
    assert.equal(r.buyCost, "0.006000");
    assert.equal(r.sellCost, "0.012000");
    assert.equal(r.margin, "0.006000");
    assert.equal(r.fxRate, null);
  });

  it("applies increment rounding", () => {
    const r = priceCdr(61, baseLine, null);
    assert.equal(r.billableSeconds, 66);
    // 66/60 * 0.012 = 0.0132
    assert.equal(r.buyCost, "0.013200");
    assert.equal(r.sellCost, "0.026400");
    assert.equal(r.margin, "0.013200");
  });

  it("adds setup fee once", () => {
    const r = priceCdr(60, { ...baseLine, setupFee: "0.005000" }, null);
    // 60/60 * 0.012 + 0.005 = 0.017
    assert.equal(r.buyCost, "0.017000");
    assert.equal(r.sellCost, "0.029000");
    assert.equal(r.margin, "0.012000");
  });

  it("handles zero rate (free destination)", () => {
    const r = priceCdr(
      120,
      { ...baseLine, buyRate: "0", sellRate: "0", setupFee: "0.010000" },
      null,
    );
    assert.equal(r.buyCost, "0.010000");
    assert.equal(r.sellCost, "0.010000");
    assert.equal(r.margin, "0.000000");
  });

  it("rejects fxRate when currencies match", () => {
    assert.throws(() => priceCdr(60, baseLine, "1.10000000"));
  });
});

describe("priceCdr — cross currency", () => {
  const crossLine: RateLineSnapshot = {
    ...baseLine,
    buyCurrency: "usd",
    sellCurrency: "eur",
    buyRate: "0.012000",
    sellRate: "0.011000",
  };

  it("applies fx to buy side before margin", () => {
    // billable = 60, buy = 0.012, sell = 0.011, fx usd->eur = 0.92
    // buyEur = 0.012 * 0.92 = 0.01104
    // margin = 0.011 - 0.01104 = -0.00004
    const r = priceCdr(60, crossLine, "0.92000000");
    assert.equal(r.buyCost, "0.012000");
    assert.equal(r.sellCost, "0.011000");
    assert.equal(r.margin, "-0.000040");
    assert.equal(r.fxRate, "0.92000000");
  });

  it("rejects missing fx when currencies differ", () => {
    assert.throws(
      () => priceCdr(60, crossLine, null),
      (err: unknown) => err instanceof FxRateMissingError,
    );
  });

  it("rejects non-positive fx", () => {
    assert.throws(() => priceCdr(60, crossLine, "0"));
    assert.throws(() => priceCdr(60, crossLine, "-0.1"));
  });
});

describe("priceCdr — precision", () => {
  it("avoids float drift on classic 0.1+0.2 trap", () => {
    // ratePerMin where naive math would drift
    const r = priceCdr(
      60,
      {
        ...baseLine,
        buyRate: "0.100000",
        sellRate: "0.200000",
        setupFee: "0.300000",
      },
      null,
    );
    // 60/60 * 0.1 + 0.3 = 0.4 exact
    assert.equal(r.buyCost, "0.400000");
    // 60/60 * 0.2 + 0.3 = 0.5 exact
    assert.equal(r.sellCost, "0.500000");
    assert.equal(r.margin, "0.100000");
  });

  it("rounds HALF_UP at 6dp", () => {
    // 7s * 0.013/min = 7/60 * 0.013 = 0.001516666... → 0.001517
    const r = priceCdr(
      7,
      {
        ...baseLine,
        minDurationSeconds: 0,
        incrementSeconds: 1,
        buyRate: "0.013000",
        sellRate: "0.013000",
      },
      null,
    );
    assert.equal(r.buyCost, "0.001517");
    assert.equal(r.sellCost, "0.001517");
  });
});
