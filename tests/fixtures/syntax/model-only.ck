module app.models

model User {
  id: ID
  name: String
  email: Email
  avatarUrl: URL?
  tags: Set<String>
  scores: List<Int>
  attributes: Map<String, String>
  isActive: Bool = true
}
