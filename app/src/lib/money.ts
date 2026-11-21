/**
 * Money utilities.
 * All monetary amounts in application state and database are integer paise (bigint).
 * Never use floats for money.
 */

export function rupeesToPaise(rupees: number | string): bigint {
  const num = typeof rupees === "string" ? parseFloat(rupees.trim()) : rupees;
  if (isNaN(num) || num < 0) {
    throw new Error("Invalid rupee amount");
  }
  return BigInt(Math.round(num * 100));
}

export function paiseToRupees(paise: bigint): number {
  return Number(paise) / 100;
}

/**
 * Format paise into Indian Rupee format (en-IN), e.g. ₹1,23,456.00 or ₹1,250
 */
export function formatINR(paise: bigint, includePaise = false): string {
  const isNegative = paise < 0n;
  const absPaise = isNegative ? -paise : paise;
  const rupees = Number(absPaise / 100n);
  const remainingPaise = Number(absPaise % 100n);

  const formatter = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: includePaise || remainingPaise > 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });

  const formatted = formatter.format(rupees + remainingPaise / 100);
  return `${isNegative ? "-" : ""}₹${formatted}`;
}
