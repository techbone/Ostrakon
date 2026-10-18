// Decode a rendered MP4 and extract representative frames for visual review.
import Foundation
import AVFoundation
import AppKit
import ImageIO

let url = URL(fileURLWithPath: CommandLine.arguments[1])
let folder = URL(fileURLWithPath: CommandLine.arguments[2])
try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
let asset = AVURLAsset(url: url)
let duration = CMTimeGetSeconds(asset.duration)
let video = asset.tracks(withMediaType: .video).first!
let audio = asset.tracks(withMediaType: .audio).first!
guard duration > 0 && duration <= 120 && video.naturalSize == CGSize(width: 1920, height: 1080),
      abs(video.nominalFrameRate - 24) < 0.1,
      CMTimeGetSeconds(audio.timeRange.duration) > 100 else {
    fatalError("Unexpected media duration, dimensions, frame rate or audio track.")
}
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
var timestamps = (0..<10).map { duration * (Double($0) + 0.5) / 10 }
if CommandLine.arguments.count > 3 {
    let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[3]))
    let plan = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    let scenes = plan["scenes"] as! [[String: Any]]
    timestamps = scenes.map { ($0["start"] as! Double) + ($0["duration"] as! Double) * 0.5 }
}
for (i, seconds) in timestamps.enumerated() {
    let image = try generator.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 24000), actualTime: nil)
    let destination = CGImageDestinationCreateWithURL(folder.appendingPathComponent("\(i).png") as CFURL,
                                                     "public.png" as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Frame export failed") }
}
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: audio, outputSettings: [
    AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 16,
    AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false,
    AVLinearPCMIsNonInterleaved: false
])
reader.add(output)
guard reader.startReading() else { throw reader.error! }
var buffers = 0
var bytes = 0
var peak = 0.0
var energy = 0.0
var sampleCount = 0
while let sample = output.copyNextSampleBuffer() {
    buffers += 1
    if let block = CMSampleBufferGetDataBuffer(sample) {
        let length = CMBlockBufferGetDataLength(block)
        bytes += length
        var values = [Int16](repeating: 0, count: length / 2)
        let status = values.withUnsafeMutableBytes { destination in
            CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: length, destination: destination.baseAddress!)
        }
        guard status == kCMBlockBufferNoErr else { fatalError("Audio sample copy failed") }
        for value in values {
            let normalized = Double(value) / 32768
            peak = max(peak, abs(normalized))
            energy += normalized * normalized
        }
        sampleCount += values.count
    }
}
guard reader.status == .completed && buffers > 0 && bytes > 1_000_000 else {
    fatalError("Narration decode failed")
}
guard peak > 0.01 && peak < 0.999 else { fatalError("Audio is silent or clipped") }
let result: [String: Any] = ["durationSeconds": duration, "width": video.naturalSize.width,
    "height": video.naturalSize.height, "fps": video.nominalFrameRate,
    "decodedAudioBuffers": buffers, "decodedAudioBytes": bytes,
    "decodedAudioPeakDbfs": 20 * log10(peak),
    "decodedAudioRmsDbfs": 20 * log10(sqrt(energy / Double(sampleCount))),
    "reviewFrames": 10, "bytes": try Data(contentsOf: url).count]
let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
try data.write(to: folder.appendingPathComponent("verification.json"))
print(String(data: data, encoding: .utf8)!)
