module app.bad

fn f(name: String) -> String {
  return name ?? "fallback"
}
