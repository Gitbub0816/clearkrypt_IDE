module app.scan

capability Camera

fn scanLabel() requires Camera -> String {
  return "scanning"
}
