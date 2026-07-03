module app.bad

enum Status {
  ready
  waiting
  failed
}

fn label(status: Status) -> String {
  return match status {
    ready -> "ready"
  }
}
