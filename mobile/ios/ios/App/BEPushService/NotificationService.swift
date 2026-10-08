import UserNotifications
import UniformTypeIdentifiers

/// BE Mastery — the picture on a notification.
///
/// A remote notification cannot carry an image in its payload: the only way an
/// iPhone shows one is for the app to attach a local file before the banner is
/// drawn, and the only code allowed to run at that moment is a notification
/// service extension (owner, 5 Oct 2026: "make it beautiful like Duolingo or
/// Temu, with images of any video recommendation").
///
/// So be-push sends `aps.mutable-content = 1` together with `be.image` — an
/// https URL the server has already restricted to a thumbnail host
/// (`cleanImage` in backend/push/push-worker.js). This downloads it, gives the
/// file the extension iOS needs to recognise it, and attaches it. iOS then
/// shows a thumbnail beside the text and the full picture when the learner
/// expands the notification.
///
/// Everything here is best-effort by design. No image, a download that fails,
/// a file iOS refuses — each delivers the original text rather than nothing,
/// and `serviceExtensionTimeWillExpire` makes the same promise when Apple's
/// time runs out.
///
/// Nothing is logged: a notification is the learner's own.
final class NotificationService: UNNotificationServiceExtension {

    /// Apple allows about 30 seconds in total; a thumbnail that has not arrived
    /// in a few is not worth making the learner wait for.
    private static let timeout: TimeInterval = 8

    private var handler: ((UNNotificationContent) -> Void)?
    private var content: UNMutableNotificationContent?
    private var task: URLSessionDownloadTask?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        handler = contentHandler
        let draft = request.content.mutableCopy() as? UNMutableNotificationContent
        content = draft

        guard let draft,
              let be = request.content.userInfo["be"] as? [AnyHashable: Any],
              let raw = be["image"] as? String,
              let url = URL(string: raw), url.scheme == "https"
        else { contentHandler(request.content); return }

        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForResource = NotificationService.timeout
        task = URLSession(configuration: config).downloadTask(with: url) { [weak self] file, response, _ in
            guard let self else { return }
            defer { self.finish() }
            guard let file,
                  let code = (response as? HTTPURLResponse)?.statusCode, code == 200,
                  let attachment = NotificationService.attachment(from: file, url: url)
            else { return }
            draft.attachments = [attachment]
        }
        task?.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        task?.cancel()
        finish()
    }

    /// Delivers once, with whatever has been achieved. Reached from the
    /// download and from the expiry warning, so it must be safe to call twice.
    private func finish() {
        guard let handler, let content else { return }
        self.handler = nil
        handler(content)
    }

    /// A downloaded file has no extension, and `UNNotificationAttachment`
    /// decides what a file is from its name — so it is moved next door with the
    /// right one, and the type is given as a hint as well.
    private static func attachment(from file: URL, url: URL) -> UNNotificationAttachment? {
        let ext = suffix(for: url)
        let named = file.deletingLastPathComponent()
            .appendingPathComponent("be-notification-image").appendingPathExtension(ext)
        do {
            try? FileManager.default.removeItem(at: named)
            try FileManager.default.moveItem(at: file, to: named)
            let hint = UTType(filenameExtension: ext)?.identifier ?? UTType.jpeg.identifier
            return try UNNotificationAttachment(identifier: "be-image", url: named,
                                                options: [UNNotificationAttachmentOptionsTypeHintKey: hint])
        } catch {
            return nil
        }
    }

    private static func suffix(for url: URL) -> String {
        let e = url.pathExtension.lowercased()
        return ["jpg", "jpeg", "png", "gif"].contains(e) ? e : "jpg"
    }
}
