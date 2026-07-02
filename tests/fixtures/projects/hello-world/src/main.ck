module app.main

model Greeting {
  id: ID
  message: String
  isFriendly: Bool = true
}

fn greetingText(greeting: Greeting) -> String {
  return greeting.message
}

fn friendlyGreeting(message: String) -> Greeting {
  return Greeting(id: "greeting-1", message: message)
}
