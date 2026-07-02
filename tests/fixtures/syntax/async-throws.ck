module app.net

error NetworkError {
  timeout
  server(message: String)
}

model RemoteUser {
  id: ID
  name: String
}

fn fetchUser(id: ID) async throws NetworkError -> RemoteUser {
  return RemoteUser(id: id, name: "Remote")
}
