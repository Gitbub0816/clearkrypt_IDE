module app.bad

fn outer() -> Int {
  fn helper() -> Int {
    return 1
  }
  fn helper() -> Int {
    return 2
  }
  return helper()
}
