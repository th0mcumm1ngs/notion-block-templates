import AppKit
import Foundation

func read() {
    let pb = NSPasteboard.general
    var result: [String: String] = [:]

    for type in pb.types ?? [] {
        if let data = pb.data(forType: type) {
            result[type.rawValue] = data.base64EncodedString()
        }
    }

    let jsonData = (try? JSONSerialization.data(withJSONObject: result)) ?? Data()
    print(String(data: jsonData, encoding: .utf8) ?? "{}")
}

func write() {
    let stdinData = FileHandle.standardInput.readDataToEndOfFile()
    guard let dict = (try? JSONSerialization.jsonObject(with: stdinData)) as? [String: String] else {
        fputs("Error: invalid JSON\n", stderr)
        exit(1)
    }

    let pb = NSPasteboard.general
    pb.clearContents()
    for (typeStr, b64) in dict {
        if let data = Data(base64Encoded: b64) {
            pb.setData(data, forType: NSPasteboard.PasteboardType(rawValue: typeStr))
        }
    }
}

let args = CommandLine.arguments
guard args.count >= 2 else {
    fputs("Usage: clipboard-bridge read|write\n", stderr)
    exit(1)
}

switch args[1] {
case "read":
    read()
case "write":
    write()
default:
    fputs("Unknown command: \(args[1])\n", stderr)
    exit(1)
}
