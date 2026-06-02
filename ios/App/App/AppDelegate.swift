import AVFoundation
import Capacitor
import FirebaseCore
import FirebaseMessaging
import UIKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    // REMOVED: var window: UIWindow? (This moves to SceneDelegate)

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // do {
        //     // .playback ensures audio plays through the silent switch
        //     // .mixWithOthers prevents interrupting background music
        //     try AVAudioSession.sharedInstance().setCategory(
        //         .playback, mode: .default, options: [.mixWithOthers])
        //     try AVAudioSession.sharedInstance().setActive(true)
        // } catch {
        //     print("[AVAudioSession] setup failed: \(error)")
        // }
        
        FirebaseApp.configure()
        return true
    }

    // MARK: UISceneSession Lifecycle
    // Add these configuration methods so iOS knows to use the SceneDelegate
    
    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
    }

    // MARK: Push Notifications (Stays in AppDelegate)

    func application(
        _ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token(completion: { (token, error) in
            if let error = error {
                NotificationCenter.default.post(
                    name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
            } else if let token = token {
                NotificationCenter.default.post(
                    name: .capacitorDidRegisterForRemoteNotifications, object: token)
            }
        })
    }

    func application(
        _ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}