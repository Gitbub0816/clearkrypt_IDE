module app.booking

enum BookingStatus {
  pending
  confirmed
  cancelled(reason: String)
  completed
}
