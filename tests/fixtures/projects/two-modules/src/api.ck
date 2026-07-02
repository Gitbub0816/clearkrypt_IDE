module app.api

import app.models.User

fn welcome(user: User) -> String {
  return "Welcome, " + user.name
}
