// Optional local video-production tool. Uses macOS AVFoundation, not the app.
import Foundation
import AVFoundation
import AppKit
import CoreGraphics
import CoreVideo
import ImageIO

struct Frame: Decodable { let start: Double; let path: String }
struct Scene: Decodable {
    let id: String; let start: Double; let duration: Double
    let audio: String; let audioOffset: Double; let audioSeconds: Double
    let frames: [Frame]
}
struct Plan: Decodable {
    let width: Int; let height: Int; let fps: Int; let duration: Double
    let scenes: [Scene]
}
func time(_ seconds: Double) -> CMTime { CMTime(seconds: seconds, preferredTimescale: 24000) }
func image(_ path: String) throws -> CGImage {
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
          let result = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "Demo", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot read \(path)"])
    }
    return result
}

let planURL = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let plan = try JSONDecoder().decode(Plan.self, from: Data(contentsOf: planURL))
let temporary = output.deletingLastPathComponent().appendingPathComponent("picture.mov")
for url in [temporary, output] { if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) } }
let writer = try AVAssetWriter(outputURL: temporary, fileType: .mov)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: plan.width, AVVideoHeightKey: plan.height,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 6_000_000,
                                     AVVideoExpectedSourceFrameRateKey: plan.fps,
                                     AVVideoMaxKeyFrameIntervalKey: plan.fps * 2,
                                     AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel]
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: plan.width,
    kCVPixelBufferHeightKey as String: plan.height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
])
writer.add(input)
guard writer.startWriting() else { throw writer.error! }
writer.startSession(atSourceTime: .zero)
var count = 0
var previous: CGImage? = nil
let rect = CGRect(x: 0, y: 0, width: plan.width, height: plan.height)
let colorSpace = CGColorSpaceCreateDeviceRGB()
for scene in plan.scenes {
    let images = try scene.frames.map { try image($0.path) }
    let frameCount = Int((scene.duration * Double(plan.fps)).rounded())
    print("Rendering \(scene.id) …")
    for f in 0..<frameCount {
        while !input.isReadyForMoreMediaData {
            if writer.status == .failed { throw writer.error! }
            Thread.sleep(forTimeInterval: 0.002)
        }
        try autoreleasepool {
            var buffer: CVPixelBuffer?
            guard CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buffer) == kCVReturnSuccess,
                  let pixels = buffer else { throw NSError(domain: "Demo", code: 2) }
            CVPixelBufferLockBaseAddress(pixels, [])
            let context = CGContext(data: CVPixelBufferGetBaseAddress(pixels), width: plan.width,
                height: plan.height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pixels),
                space: colorSpace, bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
            let local = Double(f) / Double(plan.fps)
            let selected = scene.frames.lastIndex(where: { $0.start <= local }) ?? 0
            context.draw(images[selected], in: rect)
            // Short editorial dissolve between actual captured states.
            if let old = previous, local < 0.30 {
                context.setAlpha(CGFloat(1 - local / 0.30))
                context.draw(old, in: rect)
                context.setAlpha(1)
            }
            // A subtle timeline gives the still-capture edit continuous motion.
            context.setFillColor(CGColor(red: 0.75, green: 0.42, blue: 0.28, alpha: 1))
            let global = Double(count) / Double(plan.fps)
            context.fill(CGRect(x: 76, y: 22, width: 1768 * global / plan.duration, height: 3))
            CVPixelBufferUnlockBaseAddress(pixels, [])
            guard adaptor.append(pixels, withPresentationTime: CMTime(value: Int64(count), timescale: Int32(plan.fps))) else {
                throw writer.error ?? NSError(domain: "Demo", code: 3)
            }
        }
        count += 1
    }
    previous = images.last
}
input.markAsFinished()
let finish = DispatchSemaphore(value: 0)
writer.finishWriting { finish.signal() }
finish.wait()
guard writer.status == .completed else { throw writer.error! }

let composition = AVMutableComposition()
let sourceVideo = AVURLAsset(url: temporary)
let video = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
try video.insertTimeRange(CMTimeRange(start: .zero, duration: time(plan.duration)),
                          of: sourceVideo.tracks(withMediaType: .video)[0], at: .zero)
let audio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
for scene in plan.scenes {
    let asset = AVURLAsset(url: URL(fileURLWithPath: scene.audio))
    guard let track = asset.tracks(withMediaType: .audio).first else { throw NSError(domain: "Demo", code: 4) }
    try audio.insertTimeRange(CMTimeRange(start: .zero, duration: time(scene.audioSeconds)),
                               of: track, at: time(scene.start + scene.audioOffset))
}
let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPreset1920x1080)!
export.outputURL = output
export.outputFileType = .mp4
export.shouldOptimizeForNetworkUse = true
export.metadata = {
    let title = AVMutableMetadataItem()
    title.identifier = .commonIdentifierTitle
    title.value = "Ostrakon — Zcash Privacy, in Plain Sight" as NSString
    let author = AVMutableMetadataItem()
    author.identifier = .commonIdentifierCreator
    author.value = "techbone" as NSString
    return [title, author]
}()
let done = DispatchSemaphore(value: 0)
export.exportAsynchronously { done.signal() }
done.wait()
guard export.status == .completed else { throw export.error! }
try FileManager.default.removeItem(at: temporary)
print("Finished: \(output.path) (\(plan.duration)s, \(plan.width)×\(plan.height))")
