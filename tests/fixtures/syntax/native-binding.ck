module app.device

native swift fn deviceName() -> String {
  UIDevice.current.name
}

native kotlin fn deviceName() -> String {
  android.os.Build.MODEL
}

native typescript fn deviceName() -> String {
  return navigator.userAgent
}
