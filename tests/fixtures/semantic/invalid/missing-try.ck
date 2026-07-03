module app.bad

error Boom {
  bang
}

fn dangerous() throws Boom -> Int {
  return 1
}

fn use() throws Boom -> Int {
  return dangerous()
}
