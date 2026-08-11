import UIKit
import SwiftUI
import ComposeApp

struct ComposeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        MainViewControllerKt.MainViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            ComposeView()
                .ignoresSafeArea(.keyboard)

            // Hide health, chat, and progress content before iOS captures the
            // app-switcher snapshot. Active-screen screenshots remain an OS/user
            // decision; the Android client uses FLAG_SECURE for a stricter policy.
            if scenePhase != .active {
                Color.black
                    .ignoresSafeArea()
                    .accessibilityLabel("Coach Foska is hidden while inactive")
            }
        }
    }
}
