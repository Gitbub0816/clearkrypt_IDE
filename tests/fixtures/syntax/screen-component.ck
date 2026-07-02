module app.ui

model User {
  id: ID
  name: String
  email: Email
}

component UserCard(user: User) {
  VStack {
    Text(user.name)
    Text(user.email)
  }
}

screen ProfileScreen(id: ID) {
  title "Profile"

  VStack {
    Text("Profile")
  }
}

route /profile/:id -> ProfileScreen(id: ID)
