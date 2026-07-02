module app.text

fn fullName(first: String, last: String) -> String {
  return first + " " + last
}

fn larger(a: Int, b: Int) -> Int {
  if a > b {
    return a
  } else {
    return b
  }
}

fn describeCount(count: Int) -> String {
  let label = "items"
  if count == 1 {
    return "1 item"
  }
  return "many " + label
}
