import Capacitor
import StoreKit
import UIKit


class SceneDelegate: UIResponder, UIWindowSceneDelegate {

  var window: UIWindow?

  func scene(
    _ scene: UIScene, willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = (scene as? UIWindowScene) else { return }

    let window = UIWindow(windowScene: windowScene)
    // CAPBridgeViewController loads the Capacitor/Angular app
    window.rootViewController = CAPBridgeViewController()
    self.window = window
    window.makeKeyAndVisible()

    // Handle cold boot via a custom URL scheme
    if let urlContext = connectionOptions.urlContexts.first {
      let url = urlContext.url
      
      // Check if the cold-boot URL is meant for the App Store
      if url.scheme == AppConstants.urlScheme && url.host == "openAppStore" {
        presentAppStore()
      } else {
        _ = ApplicationDelegateProxy.shared.application(
          UIApplication.shared,
          open: url,
          options: [
            .sourceApplication: urlContext.options.sourceApplication ?? "",
            .annotation: urlContext.options.annotation ?? [:]
          ]
        )
      }
    }
    // Handle cold boot via a Universal Link
    else if let userActivity = connectionOptions.userActivities.first {
      _ = ApplicationDelegateProxy.shared.application(
        UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let urlContext = URLContexts.first else { return }
    let url = urlContext.url

    // Check if the runtime URL scheme is pointing to the App Store overlay
    if url.scheme == AppConstants.urlScheme && url.host == "openAppStore" {
      presentAppStore()
      return
    }

    // Otherwise, route it directly to Capacitor
    _ = ApplicationDelegateProxy.shared.application(
      UIApplication.shared,
      open: url,
      options: [
        .sourceApplication: urlContext.options.sourceApplication ?? "",
        .annotation: urlContext.options.annotation ?? [:],
      ]
    )
  }

  private func presentAppStore() {
    guard let vc = self.window?.rootViewController else { return }

    let storeVC = SKStoreProductViewController()
    storeVC.loadProduct(
      withParameters: [SKStoreProductParameterITunesItemIdentifier: AppConstants.iosAppStoreId]
    ) { _, _ in }
    vc.present(storeVC, animated: true)
  }

  func scene(
    _ scene: UIScene,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) {
    _ = ApplicationDelegateProxy.shared.application(
      UIApplication.shared, continue: userActivity, restorationHandler: restorationHandler)
  }

  func sceneDidBecomeActive(_ scene: UIScene) {}
  func sceneWillResignActive(_ scene: UIScene) {}
  func sceneWillEnterForeground(_ scene: UIScene) {}
  func sceneDidEnterBackground(_ scene: UIScene) {}
}
