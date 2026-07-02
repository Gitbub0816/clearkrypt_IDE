module app.auth

error AuthError {
  invalidCredentials
  lockedOut(until: DateTime)
  network(message: String)
}
