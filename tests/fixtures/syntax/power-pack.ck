module app.orders

enum OrderStatus {
  pending
  shipped
  delivered
}

error OrderError {
  notFound
  rejected(reason: String)
}

model Customer {
  name: String
}

model Order {
  id: ID
  label: String
  note: String?
  customer: Customer?
  status: OrderStatus
}

fn statusLabel(status: OrderStatus) -> String {
  let label = match status {
    pending -> "waiting"
    shipped -> "on the way"
    delivered -> "done"
  }
  return label
}

fn describe(order: Order) -> String {
  let note = order.note ?? "no note"
  return "Order \(order.label) (\(statusLabel(status: order.status))): \(note)"
}

fn customerName(order: Order) -> String {
  return order.customer?.name ?? "anonymous"
}

fn noteLength(order: Order) -> Int {
  if let note = order.note {
    return lengthOf(text: note)
  } else {
    return 0
  }
}

fn lengthOf(text: String) -> Int {
  return 1
}

fn requireShipped(status: OrderStatus) throws OrderError -> String {
  return match status {
    shipped -> "ok"
    else -> "not yet"
  }
}

fn checkOrder(order: Order) throws OrderError -> String {
  if order.label == "" {
    throw OrderError.rejected(reason: "missing label")
  }
  return try requireShipped(status: order.status)
}

fn defaultStatus() -> OrderStatus {
  return OrderStatus.pending
}
