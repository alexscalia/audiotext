import { Decimal } from "decimal.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

const COST_DP = 6;
const FX_DP = 8;

export type Currency = "usd" | "eur" | "gbp";

export type RateLineSnapshot = {
  minDurationSeconds: number;
  incrementSeconds: number;
  setupFee: string | null;
  buyCurrency: Currency;
  buyRate: string;
  sellCurrency: Currency;
  sellRate: string;
};

export type PricedCdr = {
  billableSeconds: number;
  buyCost: string;
  sellCost: string;
  margin: string;
  fxRate: string | null;
};

export class FxRateMissingError extends Error {
  constructor(base: Currency, quote: Currency) {
    super(`FX rate required for ${base}->${quote} but none supplied`);
    this.name = "FxRateMissingError";
  }
}

export function billableSeconds(
  billsec: number,
  minDurationSeconds: number,
  incrementSeconds: number,
): number {
  if (!Number.isInteger(billsec) || billsec < 0) {
    throw new Error(`billsec must be non-negative integer, got ${billsec}`);
  }
  if (incrementSeconds <= 0) {
    throw new Error(`incrementSeconds must be > 0, got ${incrementSeconds}`);
  }
  const clamped = Math.max(billsec, minDurationSeconds);
  if (clamped === 0) return 0;
  return Math.ceil(clamped / incrementSeconds) * incrementSeconds;
}

function costFor(
  billable: number,
  ratePerMinute: string,
  setupFee: string | null,
): Decimal {
  const variable = new Decimal(billable).mul(ratePerMinute).div(60);
  const fee = setupFee == null ? new Decimal(0) : new Decimal(setupFee);
  return variable.plus(fee).toDecimalPlaces(COST_DP, Decimal.ROUND_HALF_UP);
}

export function priceCdr(
  billsec: number,
  line: RateLineSnapshot,
  fxRate: string | null,
): PricedCdr {
  const billable = billableSeconds(
    billsec,
    line.minDurationSeconds,
    line.incrementSeconds,
  );
  const buyCost = costFor(billable, line.buyRate, line.setupFee);
  const sellCost = costFor(billable, line.sellRate, line.setupFee);

  const sameCurrency = line.buyCurrency === line.sellCurrency;
  let fxOut: string | null;
  let buyInSell: Decimal;

  if (sameCurrency) {
    if (fxRate != null) {
      throw new Error("fxRate must be null when buy/sell currencies match");
    }
    fxOut = null;
    buyInSell = buyCost;
  } else {
    if (fxRate == null) {
      throw new FxRateMissingError(line.buyCurrency, line.sellCurrency);
    }
    const fx = new Decimal(fxRate);
    if (fx.lte(0)) throw new Error(`fxRate must be > 0, got ${fxRate}`);
    fxOut = fx.toDecimalPlaces(FX_DP, Decimal.ROUND_HALF_UP).toFixed(FX_DP);
    buyInSell = buyCost
      .mul(fx)
      .toDecimalPlaces(COST_DP, Decimal.ROUND_HALF_UP);
  }

  const margin = sellCost.minus(buyInSell);

  return {
    billableSeconds: billable,
    buyCost: buyCost.toFixed(COST_DP),
    sellCost: sellCost.toFixed(COST_DP),
    margin: margin.toFixed(COST_DP),
    fxRate: fxOut,
  };
}
