import Foundation

/// LSP base-protocol framing: JSON-RPC bodies prefixed with
/// `Content-Length: N\r\n\r\n`. Stateful so it tolerates partial chunks and
/// multiple messages per chunk, both routine on process pipes.
public final class FramingParser {
    private var buffer = Data()

    public init() {}

    /// Feeds raw bytes; returns every complete JSON body now available.
    public func push(_ chunk: Data) -> [Data] {
        buffer.append(chunk)
        var messages: [Data] = []
        let separator = Data("\r\n\r\n".utf8)
        while true {
            guard let headerRange = buffer.range(of: separator) else {
                break
            }
            let headerData = buffer.subdata(in: buffer.startIndex..<headerRange.lowerBound)
            guard let header = String(data: headerData, encoding: .utf8),
                  let length = FramingParser.contentLength(in: header) else {
                // Garbage before a valid header: skip past it and keep going.
                buffer.removeSubrange(buffer.startIndex..<headerRange.upperBound)
                continue
            }
            let bodyStart = headerRange.upperBound
            guard buffer.count - (bodyStart - buffer.startIndex) >= length else {
                break
            }
            let bodyEnd = buffer.index(bodyStart, offsetBy: length)
            messages.append(buffer.subdata(in: bodyStart..<bodyEnd))
            buffer.removeSubrange(buffer.startIndex..<bodyEnd)
        }
        return messages
    }

    public static func frame(_ body: Data) -> Data {
        var framed = Data("Content-Length: \(body.count)\r\n\r\n".utf8)
        framed.append(body)
        return framed
    }

    private static func contentLength(in header: String) -> Int? {
        for line in header.split(separator: "\r\n") {
            let parts = line.split(separator: ":", maxSplits: 1)
            if parts.count == 2,
               parts[0].trimmingCharacters(in: .whitespaces).lowercased() == "content-length",
               let value = Int(parts[1].trimmingCharacters(in: .whitespaces)) {
                return value
            }
        }
        return nil
    }
}
