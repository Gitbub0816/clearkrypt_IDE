module app.bad

error Boom {
  bang
}

fn quiet() -> Int {
  throw Boom.bang
}
