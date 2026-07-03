module app.nested

fn triangular(n: Int) -> Int {
  fn sumUpTo(current: Int) -> Int {
    if current <= 0 {
      return 0
    }
    return current + sumUpTo(current: current - 1)
  }
  return sumUpTo(current: n)
}

fn discountedTotal(base: Int, discountPercent: Int) -> Int {
  fn applyDiscount(amount: Int) -> Int {
    return amount - (amount * discountPercent / 100)
  }
  fn addServiceFee(amount: Int) -> Int {
    return amount + 5
  }
  return addServiceFee(amount: applyDiscount(amount: base))
}

fn describeTotal(base: Int, discountPercent: Int) -> String {
  let total = discountedTotal(base: base, discountPercent: discountPercent)
  return "Total: \(total)"
}
