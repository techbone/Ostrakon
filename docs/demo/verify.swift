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
for (i, seconds) in [3.0, 15.0, 28.0, 42.0, 51.0, 65.0, 78.0, 91.0, 103.0, 114.0].enumerated() {
    let image = try generator.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 24000), actualTime: nil)
    let destination = CGImageDestinationCreateWithURL(folder.appendingPathComponent("\(i).png") as CFURL,
                                                     "public.png" as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Frame export failed") }
}
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: audio, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
reader.add(output)
guard reader.startReading() else { throw reader.error! }
var buffers = 0
var bytes = 0
while let sample = output.copyNextSampleBuffer() {
    buffers += 1
    if let block = CMSampleBufferGetDataBuffer(sample) { bytes += CMBlockBufferGetDataLength(block) }
}
guard reader.status == .completed && buffers > 0 && bytes > 1_000_000 else {
    fatalError("Narration decode failed")
}
let result: [String: Any] = ["durationSeconds": duration, "width": video.naturalSize.width,
    "height": video.naturalSize.height, "fps": video.nominalFrameRate,
    "decodedAudioBuffers": buffers, "decodedAudioBytes": bytes,
    "reviewFrames": 10, "bytes": try Data(contentsOf: url).count]
let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
try data.write(to: folder.appendingPathComponent("verification.json"))
print(String(data: data, encoding: .utf8)!)
